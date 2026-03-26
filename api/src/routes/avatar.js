import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cachePathFor(videoUrl, fps) {
  const cacheDir = path.resolve(process.cwd(), '../../data/avatar-cache');
  ensureDir(cacheDir);
  const key = sha1(`${videoUrl}|fps=${fps}|fullbody=v4-fullclip`);
  return path.join(cacheDir, `${key}.json`);
}

function runPythonPoseExtract({ videoUrl, out, fps, maxMs }) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), 'src/avatar/pose_extract.py');
    const args = [
      scriptPath,
      '--videoUrl', videoUrl,
      '--out', out,
      '--fps', String(fps),
      '--maxMs', String(maxMs)
    ];

    const proc = spawn('python3', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) return resolve(stdout);
      return reject(new Error(`pose_extract failed (code ${code}): ${stderr || stdout}`));
    });
  });
}

export function createAvatarRouter() {
  const router = Router();

  router.post('/avatar/poses', async (req, res) => {
    const segments = req.body?.segments;
    const fps = Number(req.body?.options?.fps || 12);

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'segments[] required' });
    }

    const out = [];
    const errors = [];

    // Sequential extraction (keeps CPU predictable). For production, parallelize with a worker pool.
    for (const seg of segments) {
      const idx = seg.index;
      const videoUrl = seg.videoUrl;
      if (!videoUrl) {
        out[idx] = null;
        continue;
      }

      const cacheFile = cachePathFor(videoUrl, fps);
      try {
        if (fs.existsSync(cacheFile)) {
          out[idx] = readJson(cacheFile);
          continue;
        }

        await runPythonPoseExtract({
          videoUrl,
          out: cacheFile,
          fps,
          // Extract full MP4 timeline so overlay does not stop before video end.
          maxMs: 0
        });

        out[idx] = readJson(cacheFile);
      } catch (err) {
        errors.push({ idx, signId: seg.signId, message: err.message });
        out[idx] = null;
      }
    }

    return res.json({ ok: true, fps, posesByIndex: out, errors });
  });

  return router;
}
