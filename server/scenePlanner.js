/**
 * Scene Planner & Consistency Engine
 * Splits target video durations into valid Gemini Omni 1.2 Flash / Google Flow segments
 * and uses Gemini 4 Hydrogen to extract character & environment anchors for multi-scene consistency.
 */

const MIN_CLIP_SECONDS = 3;
const MAX_CHAPTER_TOTAL_SECONDS = 30; // Omni 1.2 Flash cumulative extension cap per interaction chain

/**
 * Splits a remaining duration into valid chunks between MIN_CLIP_SECONDS and maxChunk,
 * ensuring no remainder is ever < MIN_CLIP_SECONDS.
 */
function splitExtensionChunks(remaining, maxChunk) {
  const chunks = [];
  let left = remaining;

  while (left > 0) {
    if (left <= maxChunk) {
      chunks.push(left);
      break;
    }
    // Avoid leaving a remainder < MIN_CLIP_SECONDS
    if (left - maxChunk < MIN_CLIP_SECONDS) {
      const first = Math.floor(left / 2);
      const second = left - first;
      chunks.push(first, second);
      break;
    }
    chunks.push(maxChunk);
    left -= maxChunk;
  }

  return chunks;
}

/**
 * Computes an optimal multi-scene schedule for any requested duration (3s - 60s+).
 * @param {number} targetDuration - Requested total duration in seconds.
 * @param {number} singleClipMax - Max seconds for a single generation (15 for Omni 1.2 Flash, 8 for Google Flow strict).
 * @returns {Array<{index: number, chapter: number, duration: number, mode: string, startSec: number, endSec: number}>}
 */
export function computeSceneSchedule(targetDuration, singleClipMax = 15) {
  const total = Math.max(MIN_CLIP_SECONDS, Math.round(Number(targetDuration) || 10));
  const baseMax = Math.min(15, Math.max(MIN_CLIP_SECONDS, singleClipMax));
  const extendMax = Math.min(10, baseMax); // Omni 1.2 Flash allows 3s-10s per extension turn

  const scenes = [];
  let cursor = 0;
  let chapter = 1;
  let sceneIndex = 1;

  while (cursor < total) {
    const remainingTotal = total - cursor;
    // Cap each chapter at MAX_CHAPTER_TOTAL_SECONDS (30s)
    // Also ensure if we have more left after this chapter, the next chapter gets >= MIN_CLIP_SECONDS
    let chapterTarget = Math.min(remainingTotal, MAX_CHAPTER_TOTAL_SECONDS);
    if (remainingTotal - chapterTarget > 0 && remainingTotal - chapterTarget < MIN_CLIP_SECONDS) {
      chapterTarget = remainingTotal - MIN_CLIP_SECONDS;
    }

    // First scene of the chapter: r2v_base (chapter 1) or chapter_bridge (chapter > 1)
    let baseDuration;
    if (chapterTarget <= baseMax) {
      baseDuration = chapterTarget;
    } else if (chapterTarget - baseMax < MIN_CLIP_SECONDS) {
      baseDuration = chapterTarget - MIN_CLIP_SECONDS;
    } else {
      baseDuration = baseMax;
    }

    const mode = chapter === 1 ? 'r2v_base' : 'chapter_bridge';
    scenes.push({
      index: sceneIndex++,
      chapter,
      duration: baseDuration,
      mode,
      startSec: cursor,
      endSec: cursor + baseDuration,
    });
    cursor += baseDuration;

    const chapterExtRemaining = chapterTarget - baseDuration;
    if (chapterExtRemaining > 0) {
      const extChunks = splitExtensionChunks(chapterExtRemaining, extendMax);
      for (const dur of extChunks) {
        scenes.push({
          index: sceneIndex++,
          chapter,
          duration: dur,
          mode: 'extend_chain',
          startSec: cursor,
          endSec: cursor + dur,
        });
        cursor += dur;
      }
    }

    chapter += 1;
  }

  return scenes;
}

/**
 * Uses Gemini 4 Hydrogen to analyze the background & person photos and author
 * a consistent multi-scene storyboard with locked character & environment anchors.
 */
export async function planScenesWithGemini({
  ai,
  userPrompt,
  bgFile,
  personFile,
  schedule,
}) {
  const fallbackPlan = buildFallbackPlan(userPrompt, schedule);

  if (schedule.length === 1) {
    return {
      character_anchor: 'Persona de la segunda imagen de referencia (manteniendo rostro, vestimenta y proporciones exactas).',
      environment_anchor: 'Escenario de la primera imagen de referencia (manteniendo iluminación, arquitectura y atmósfera).',
      scenes: [
        {
          scene_number: 1,
          visual_prompt:
            `Use the first image as the environment/background reference and the second image as the person/character reference rather than literal starting frames. ` +
            `Generate a true, photorealistic, fluid live-action video (NOT a static image overlay, cutout, or slideshow): the person from the second image is physically integrated inside the 3D space of the setting from the first image with natural shadows, matching ambient lighting, realistic body and facial motion, and smooth cinematic camera movement: ${userPrompt}. ` +
            `Keep the person's facial identity, hairstyle, and clothing completely faithful to the second image, and keep the environment faithful to the first image.`,
          transition_note: 'Escena única continua.',
        },
      ],
    };
  }

  const sceneBreakdownText = schedule
    .map(
      (s) =>
        `- Scene ${s.index} (${s.duration}s, ${s.startSec}s-${s.endSec}s, mode=${s.mode})`
    )
    .join('\n');

  const directorInstruction = `You are an expert AI Film Director & Continuity Supervisor.
You are given TWO reference images:
- Image 1: Background / Environment reference.
- Image 2: Person / Character reference.

User's video concept: "${userPrompt}"

The video must be split into ${schedule.length} sequential scenes to reach ${schedule[schedule.length - 1].endSec}s total:
${sceneBreakdownText}

Analyze both images carefully and return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "character_anchor": "Concise, vivid visual description of the person in Image 2 (face, hair, outfit, colors, accessories) in English.",
  "environment_anchor": "Concise, vivid visual description of the background in Image 1 (setting, architecture/nature, lighting, palette) in English.",
  "scenes": [
    {
      "scene_number": 1,
      "visual_prompt": "Detailed prompt in English for Gemini Omni 1.2 Flash. Must produce a true, fluid, photorealistic live-action video with natural physics, shadows, lighting integration, and smooth camera motion (NEVER a flat photo overlay, cutout, or static pan). For scene 1 (r2v_base) or chapter_bridge, explicitly state: 'Use the first image as the environment/background reference and the second image as the person/character reference rather than literal starting frames.' For extend_chain scenes, start with 'Extend this video seamlessly in one continuous fluid motion.' and describe how the action, camera, and audio continue naturally while keeping the exact character and background from the reference images.",
      "transition_note": "Short 1-sentence Spanish summary of what happens in this scene for the user UI."
    }
  ]
}`;

  try {
    const interaction = await ai.interactions.create({
      model: 'gemini-4-hydrogen',
      input: [
        { type: 'image', uri: bgFile.uri, mime_type: bgFile.mimeType },
        { type: 'image', uri: personFile.uri, mime_type: personFile.mimeType },
        { type: 'text', text: directorInstruction },
      ],
    });

    const rawText = (interaction.output_text || '').trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackPlan;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length !== schedule.length) {
      return fallbackPlan;
    }

    return {
      character_anchor: parsed.character_anchor || fallbackPlan.character_anchor,
      environment_anchor: parsed.environment_anchor || fallbackPlan.environment_anchor,
      scenes: parsed.scenes.map((sc, idx) => ({
        scene_number: idx + 1,
        visual_prompt: sc.visual_prompt || fallbackPlan.scenes[idx].visual_prompt,
        transition_note: sc.transition_note || fallbackPlan.scenes[idx].transition_note,
      })),
    };
  } catch (err) {
    console.warn('[ScenePlanner] Fallback triggered:', err?.message || err);
    return fallbackPlan;
  }
}

function buildFallbackPlan(userPrompt, schedule) {
  return {
    character_anchor: 'Exact person from Image 2 (same face, hair, clothing, and proportions).',
    environment_anchor: 'Exact environment from Image 1 (same lighting, architecture, and palette).',
    scenes: schedule.map((s, idx) => {
      if (s.mode === 'r2v_base') {
        return {
          scene_number: s.index,
          visual_prompt:
            `Use the first image as the environment/background reference and the second image as the person/character reference rather than literal starting frames. ` +
            `Generate a true, photorealistic, fluid live-action video (NOT a static image overlay or cutout) with natural lighting, shadows, and smooth camera motion. Opening scene (${s.duration}s): ${userPrompt}. Keep the person's identity and outfit identical to the second image and the setting identical to the first image.`,
          transition_note: `Escena inicial (${s.duration}s): integración fluida de personaje y entorno.`,
        };
      }
      if (s.mode === 'chapter_bridge') {
        return {
          scene_number: s.index,
          visual_prompt:
            `Use the first image as the environment/background reference and the second image as the person/character reference rather than literal starting frames. ` +
            `Generate a true, fluid live-action video continuing the narrative seamlessly (${s.duration}s, part ${idx + 1} of ${schedule.length}): ${userPrompt}. Maintain exact character appearance, clothing, natural motion, and lighting continuity.`,
          transition_note: `Nuevo capítulo (${s.duration}s): continuidad fluida de personaje y fondo.`,
        };
      }
      return {
        scene_number: s.index,
        visual_prompt:
          `Extend this video seamlessly in one continuous fluid motion (${s.duration}s continuation, part ${idx + 1} of ${schedule.length}). ` +
          `Keep the exact same person from the second reference image and the exact same environment from the first reference image with natural physics and lighting. ` +
          `Continue the action naturally: ${userPrompt}. Smooth camera motion and continuous audio.`,
        transition_note: `Extensión continua (+${s.duration}s): movimiento fluido sin cortes.`,
      };
    }),
  };
}
