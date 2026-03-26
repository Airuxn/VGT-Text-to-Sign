import express from 'express';
import cors from 'cors';
import { createLexiconIndex } from './core/lexicon.js';
import { createVideoIndex } from './core/videoIndex.js';
import { createConvertRouter } from './routes/convert.js';
import { createFeedbackRouter } from './routes/feedback.js';
import { createVideoRouter } from './routes/video.js';
import { createAvatarRouter } from './routes/avatar.js';

const app = express();
const port = process.env.PORT || 8080;
const lexicon = createLexiconIndex();
const videoIndex = createVideoIndex();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', createConvertRouter(lexicon, videoIndex));
app.use('/api', createVideoRouter(videoIndex));
app.use('/api', createAvatarRouter());
app.use('/api', createFeedbackRouter());

app.listen(port, () => {
  console.log(`api listening on ${port}`);
});
