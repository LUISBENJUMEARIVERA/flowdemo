import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { computeSceneSchedule, planScenesWithGemini } from './scenePlanner.js';

const VIDEO_MODEL = 'gemini-omni-1.2-flash';

/**
 * Redacts API keys or sensitive tokens from error strings before returning to client.
 */
export function sanitizeError(err, apiKey = '') {
  let msg = err?.message || String(err || 'Error desconocido');
  if (apiKey && apiKey.length >= 8) {
    msg = msg.split(apiKey).join('[REDACTED_KEY]');
  }
  msg = msg.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]');
  msg = msg.replace(/([?&](?:key|api_key|apiKey|access_token)=)[^&\s]+/g, '$1[REDACTED]');
  return msg;
}

/**
 * Uploads a local image file to Gemini Files API and waits until ACTIVE.
 */
async function uploadAndWaitForActive(ai, filePath, mimeType) {
  let uploaded = await ai.files.upload({
    file: filePath,
    config: { mimeType },
  });

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    if (uploaded.state === 'ACTIVE') {
      return {
        uri: uploaded.uri,
        mimeType: uploaded.mimeType || mimeType,
        name: uploaded.name,
      };
    }
    if (uploaded.state === 'FAILED') {
      throw new Error(`El archivo ${path.basename(filePath)} falló al procesarse en Gemini Files API.`);
    }
    await new Promise((r) => setTimeout(r, 1500));
    uploaded = await ai.files.get({ name: uploaded.name });
  }

  throw new Error(`Tiempo de espera agotado esperando activación de ${path.basename(filePath)}.`);
}

/**
 * Downloads the generated video from interaction.output_video to disk.
 */
async function saveOutputVideo(ai, outputVideo, destPath, apiKey) {
  if (outputVideo.data) {
    const buffer = Buffer.from(outputVideo.data, 'base64');
    fs.writeFileSync(destPath, buffer);
    return;
  }

  if (outputVideo.uri) {
    try {
      await ai.files.download({
        file: outputVideo.uri,
        downloadPath: destPath,
      });
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
        return;
      }
    } catch {
      // Fallback to authenticated fetch if SDK downloadPath fails on URI
    }

    const res = await fetch(outputVideo.uri, {
      headers: { 'x-goog-api-key': apiKey },
    });
    if (!res.ok) {
      throw new Error(`No se pudo descargar el video generado (HTTP ${res.status}).`);
    }
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
    return;
  }

  throw new Error('La respuesta de Gemini Omni Flash no incluyó ni URI ni datos de video.');
}

/**
 * Runs the complete multi-scene video generation pipeline.
 */
export async function runVideoGenerationJob({
  jobId,
  apiKey,
  prompt,
  bgPath,
  bgMime,
  personPath,
  personMime,
  targetDuration,
  singleClipMax = 15,
  aspectRatio = '16:9',
  resolution = '720p',
  outputDir,
  onProgress,
}) {
  fs.mkdirSync(outputDir, { recursive: true });

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: 600_000 }, // 10 minutes per request
  });

  const schedule = computeSceneSchedule(targetDuration, singleClipMax);

  onProgress({
    stage: 'uploading',
    message: 'Subiendo foto de fondo y foto de persona a Gemini Files API...',
    schedule,
    progressPct: 8,
  });

  const [bgFile, personFile] = await Promise.all([
    uploadAndWaitForActive(ai, bgPath, bgMime),
    uploadAndWaitForActive(ai, personPath, personMime),
  ]);

  onProgress({
    stage: 'planning',
    message:
      schedule.length > 1
        ? `Duración (${targetDuration}s) supera el límite de una toma (${singleClipMax}s). Planificando ${schedule.length} escenas consistentes con Gemini 4 Hydrogen...`
        : 'Preparando dirección de escena única con ingredientes visuales...',
    progressPct: 18,
  });

  const plan = await planScenesWithGemini({
    ai,
    userPrompt: prompt,
    bgFile,
    personFile,
    schedule,
  });

  onProgress({
    stage: 'planned',
    message: `Guion de ${schedule.length} escena(s) listo. Anclas de consistencia fijadas.`,
    plan,
    progressPct: 24,
  });

  const completedScenes = [];
  let previousInteractionId = null;

  for (let i = 0; i < schedule.length; i++) {
    const sceneSpec = schedule[i];
    const scenePlan = plan.scenes[i];

    const isExtension = sceneSpec.mode === 'extend_chain' && previousInteractionId;
    if (sceneSpec.mode === 'chapter_bridge') {
      previousInteractionId = null;
    }

    const baseProgress = 25 + Math.round((i / schedule.length) * 70);
    onProgress({
      stage: 'generating_scene',
      currentScene: sceneSpec.index,
      totalScenes: schedule.length,
      message: isExtension
        ? `Extendiendo Escena ${sceneSpec.index}/${schedule.length} (+${sceneSpec.duration}s) manteniendo personaje y fondo...`
        : `Generando Escena ${sceneSpec.index}/${schedule.length} (${sceneSpec.duration}s) con ingredientes...`,
      progressPct: baseProgress,
    });

    const inputParts = [
      { type: 'image', uri: bgFile.uri, mime_type: bgFile.mimeType },
      { type: 'image', uri: personFile.uri, mime_type: personFile.mimeType },
      {
        type: 'text',
        text: `${scenePlan.visual_prompt}\n\n[Continuity Anchors] Character: ${plan.character_anchor} | Environment: ${plan.environment_anchor}`,
      },
    ];

    const responseFormat = {
      type: 'video',
      delivery: 'uri',
      duration: `${sceneSpec.duration}s`,
      resolution,
    };

    if (!isExtension) {
      responseFormat.aspect_ratio = aspectRatio;
    }

    const createParams = {
      model: VIDEO_MODEL,
      input: inputParts,
      response_format: responseFormat,
    };

    if (isExtension) {
      createParams.previous_interaction_id = previousInteractionId;
    }

    const interaction = await ai.interactions.create(createParams);
    const outputVideo = interaction.output_video;

    if (!outputVideo || (!outputVideo.uri && !outputVideo.data)) {
      throw new Error(
        `La escena ${sceneSpec.index} no devolvió video. Verifica que tu región soporte Gemini Omni 1.2 Flash con referencias.`
      );
    }

    previousInteractionId = interaction.id || null;

    const fileName = `scene_${sceneSpec.index}.mp4`;
    const destPath = path.join(outputDir, fileName);
    await saveOutputVideo(ai, outputVideo, destPath, apiKey);

    const sceneResult = {
      index: sceneSpec.index,
      chapter: sceneSpec.chapter,
      duration: sceneSpec.duration,
      startSec: sceneSpec.startSec,
      endSec: sceneSpec.endSec,
      mode: sceneSpec.mode,
      transitionNote: scenePlan.transition_note,
      videoUrl: `/api/videos/${jobId}/${fileName}`,
      interactionId: previousInteractionId,
    };

    completedScenes.push(sceneResult);

    onProgress({
      stage: 'scene_done',
      scene: sceneResult,
      completedScenes: [...completedScenes],
      progressPct: 25 + Math.round(((i + 1) / schedule.length) * 70),
      message: `Escena ${sceneSpec.index}/${schedule.length} completada (${sceneSpec.duration}s).`,
    });
  }

  onProgress({
    stage: 'completed',
    message: `¡Video completo de ${targetDuration}s generado en ${completedScenes.length} escena(s)!`,
    completedScenes,
    plan,
    progressPct: 100,
  });

  return { completedScenes, plan };
}
