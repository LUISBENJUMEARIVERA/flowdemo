import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { exec } from 'node:child_process';
import { computeSceneSchedule } from './scenePlanner.js';
import { runVideoGenerationJob, sanitizeError } from './videoGenerator.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 0;
const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads_tmp');
const OUTPUTS_DIR = path.join(ROOT_DIR, 'generated_videos');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use('/api/videos', express.static(OUTPUTS_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const jobs = new Map();

function emitJobEvent(jobId, payload) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.latestState = { ...job.latestState, ...payload };
  const dataStr = `data: ${JSON.stringify(job.latestState)}\n\n`;
  for (const res of job.clients) {
    res.write(dataStr);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: 'gemini-omni-1.2-flash', planner: 'gemini-4-hydrogen' });
});

app.post('/api/verify-key', async (req, res) => {
  const apiKey = req.headers['x-gemini-api-key'] || req.body?.apiKey;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return res.status(400).json({ valid: false, error: 'Ingresa una Google API Key válida.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim(), apiVersion: 'v1beta' });
    await ai.interactions.create({
      model: 'gemini-4-hydrogen',
      input: 'Responde únicamente: OK',
    });
    return res.json({ valid: true, message: 'Conexión verificada con Google Gemini API.' });
  } catch (err) {
    return res.status(401).json({
      valid: false,
      error: sanitizeError(err, apiKey.trim()),
    });
  }
});

app.post('/api/plan-preview', (req, res) => {
  const targetDuration = Number(req.body?.duration) || 10;
  const singleClipMax = Number(req.body?.singleClipMax) || 15;
  const schedule = computeSceneSchedule(targetDuration, singleClipMax);
  res.json({
    targetDuration,
    singleClipMax,
    exceedsSingleClip: schedule.length > 1,
    schedule,
  });
});

app.post(
  '/api/generate',
  upload.fields([
    { name: 'background', maxCount: 1 },
    { name: 'person', maxCount: 1 },
  ]),
  (req, res) => {
    const apiKey = (req.headers['x-gemini-api-key'] || req.body?.apiKey || '').trim();
    const bgFile = req.files?.background?.[0];
    const personFile = req.files?.person?.[0];

    const cleanup = () => {
      if (bgFile?.path && fs.existsSync(bgFile.path)) fs.unlinkSync(bgFile.path);
      if (personFile?.path && fs.existsSync(personFile.path)) fs.unlinkSync(personFile.path);
    };

    if (!apiKey) {
      cleanup();
      return res.status(400).json({ error: 'Falta la Google API Key en la cabecera o formulario.' });
    }
    if (!bgFile || !personFile) {
      cleanup();
      return res.status(400).json({ error: 'Debes subir tanto la foto del fondo como la foto de la persona.' });
    }

    const prompt = (req.body?.prompt || '').trim();
    if (!prompt) {
      cleanup();
      return res.status(400).json({ error: 'El prompt del video no puede estar vacío.' });
    }

    const targetDuration = Math.max(3, Math.min(90, Number(req.body?.duration) || 10));
    const singleClipMax = Number(req.body?.singleClipMax) === 8 ? 8 : 15;
    const aspectRatio = req.body?.aspectRatio === '9:16' ? '9:16' : '16:9';
    const resolution = ['360p', '720p', '1080p', '4k'].includes(req.body?.resolution)
      ? req.body.resolution
      : '720p';

    const jobId = crypto.randomUUID().slice(0, 12);
    const schedule = computeSceneSchedule(targetDuration, singleClipMax);
    const outputDir = path.join(OUTPUTS_DIR, jobId);

    jobs.set(jobId, {
      id: jobId,
      clients: new Set(),
      latestState: {
        jobId,
        stage: 'queued',
        message: 'Trabajo iniciado...',
        progressPct: 2,
        schedule,
        completedScenes: [],
        plan: null,
        error: null,
      },
    });

    res.json({ jobId, schedule });

    // Run async pipeline in background
    runVideoGenerationJob({
      jobId,
      apiKey,
      prompt,
      bgPath: bgFile.path,
      bgMime: bgFile.mimetype || 'image/png',
      personPath: personFile.path,
      personMime: personFile.mimetype || 'image/png',
      targetDuration,
      singleClipMax,
      aspectRatio,
      resolution,
      outputDir,
      onProgress: (payload) => emitJobEvent(jobId, payload),
    })
      .catch((err) => {
        emitJobEvent(jobId, {
          stage: 'error',
          error: sanitizeError(err, apiKey),
          message: sanitizeError(err, apiKey),
        });
      })
      .finally(() => {
        cleanup();
      });
  }
);

app.get('/api/jobs/:jobId/events', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Trabajo no encontrado.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify(job.latestState)}\n\n`);
  job.clients.add(res);

  req.on('close', () => {
    job.clients.delete(res);
  });
});

app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Trabajo no encontrado.' });
  }
  res.json(job.latestState);
});

// Servir frontend compilado (dist/) en el mismo puerto libre
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const server = app.listen(PORT, '127.0.0.1', () => {
  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
  const url = `http://127.0.0.1:${actualPort}`;
  console.log(`[FlowStudio] Aplicacion iniciada en puerto libre: ${url}`);

  if (process.argv.includes('--open')) {
    const cmd =
      process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
    exec(cmd);
  }
});
