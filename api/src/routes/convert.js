import { Router } from 'express';
import { buildGesturePlan } from '../core/planner.js';

export function createConvertRouter(lexicon, videoIndex) {
  const router = Router();

  router.post('/convert', (req, res) => {
    const text = req.body?.text;
    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > 600) {
      return res.status(400).json({ error: 'text too long (max 600 chars)' });
    }

    const payload = buildGesturePlan(text, lexicon, videoIndex);
    return res.json(payload);
  });

  return router;
}
