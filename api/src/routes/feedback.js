import { Router } from 'express';

const inMemoryFeedback = [];

export function createFeedbackRouter() {
  const router = Router();

  router.post('/feedback', (req, res) => {
    const { input, segmentToken, note } = req.body || {};
    if (!input || !segmentToken) {
      return res.status(400).json({ error: 'input and segmentToken are required' });
    }
    inMemoryFeedback.push({ input, segmentToken, note: note || '', createdAt: new Date().toISOString() });
    return res.status(202).json({ ok: true });
  });

  router.get('/feedback', (_req, res) => {
    return res.json({ items: inMemoryFeedback });
  });

  return router;
}
