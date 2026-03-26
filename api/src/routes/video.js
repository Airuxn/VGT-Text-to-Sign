import { Router } from 'express';

export function createVideoRouter(videoIndex) {
  const router = Router();
  router.get('/video-clips', (_req, res) => {
    res.json({ items: videoIndex.all() });
  });
  return router;
}
