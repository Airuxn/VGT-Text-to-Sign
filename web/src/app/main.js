import { convertText, sendFeedback, getVideoClips, fetchAvatarPoses } from '../services/api.js';
import { SmoothVideoPlayer } from '../player/SmoothVideoPlayer.js';
import { FullBodyOverlay } from '../avatar/FullBodyOverlay.js';

const input = document.getElementById('input');
const status = document.getElementById('status');
const warningsEl = document.getElementById('warnings');
const fallbackSummary = document.getElementById('fallbackSummary');
const segmentMeta = document.getElementById('segmentMeta');
const renderModeEl = document.getElementById('renderMode');
const videoFallbackEl = document.getElementById('videoFallback');
const noVideoEl = document.getElementById('noVideo');

const overlayCanvas = document.getElementById('avatarOverlay');
const videoWrap = document.querySelector('.video-wrap');
const overlay = new FullBodyOverlay(overlayCanvas);

const videoA = document.getElementById('signVideoA');
const videoB = document.getElementById('signVideoB');
const player = new SmoothVideoPlayer(videoA, videoB);

for (const v of [videoA, videoB]) {
  v.addEventListener('loadedmetadata', () => overlay.resize());
}

let lastResult = null;
let posesByIndex = [];
let overlayRaf = null;
let lastSegIdx = null;
let overlayLoopToken = 0;
let playRequestId = 0;

function toNorm01(p) {
  if (!p || typeof p[0] !== 'number' || typeof p[1] !== 'number') return null;
  const x01 = p[0] / 2 + 0.5;
  const y01 = 0.5 - p[1] / 2;
  if (!Number.isFinite(x01) || !Number.isFinite(y01)) return null;
  return { x01, y01 };
}

function buildGlobalFitFromPoses(poseBundles) {
  const xs = [];
  const ys = [];
  const pushPoints = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const p of arr) {
      const q = toNorm01(p);
      if (!q) continue;
      xs.push(q.x01);
      ys.push(q.y01);
    }
  };

  for (const bundle of poseBundles || []) {
    const kfs = bundle?.keyframes;
    if (!Array.isArray(kfs) || !kfs.length) continue;
    for (let i = 0; i < kfs.length; i += 3) {
      const k = kfs[i];
      pushPoints(k?.pose);
      pushPoints(k?.face);
      pushPoints(k?.left);
      pushPoints(k?.right);
    }
  }

  if (!xs.length) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const pad = 0.06;
  const inner = 1 - 2 * pad;
  const bw = Math.max(0.2, maxX - minX);
  const bh = Math.max(0.35, maxY - minY);
  let s = Math.min(inner / bw, inner / bh);
  // Never zoom in; only zoom out to keep the whole sentence consistent.
  s = Math.min(1.0, s);

  return (x01, y01) => ({
    x01: 0.5 + (x01 - cx) * s,
    y01: 0.5 + (y01 - cy) * s,
  });
}

function stopOverlayLoop() {
  overlayLoopToken += 1;
  if (overlayRaf) cancelAnimationFrame(overlayRaf);
  overlayRaf = null;
}

function startOverlayLoop() {
  stopOverlayLoop();
  const token = overlayLoopToken;
  lastSegIdx = null;

  const tick = () => {
    if (token !== overlayLoopToken) return;
    overlayRaf = requestAnimationFrame(tick);
    const segIdx = player.getCurrentSegmentIndex();
    const bundle = posesByIndex[segIdx];
    if (lastSegIdx !== segIdx) {
      overlay.setKeyframes(bundle?.keyframes?.length ? bundle : null);
      lastSegIdx = segIdx;
    }

    const activeVid = player.getActiveVideoElement();
    if (!activeVid) {
      overlay.render();
      return;
    }
    overlay.setVideoElement(activeVid);
    overlay.setTimeMs((activeVid.currentTime || 0) * 1000);
    // Always render: clears canvas when there is no pose data (fixes blank stage in skeleton-only mode).
    overlay.render();
  };

  overlayRaf = requestAnimationFrame(tick);
}

player.onSegmentChange = (segment) => {
  if (!segment) {
    segmentMeta.textContent = '—';
    renderModeEl.textContent = '—';
    videoFallbackEl.textContent = '—';
    noVideoEl.classList.remove('show');
    overlay.setKeyframes(null);
    return;
  }

  segmentMeta.textContent = `${segment.token} · ${segment.signId} · conf ${Number(segment.confidence).toFixed(2)}`;
  renderModeEl.textContent = segment.videoUrl
    ? `Dictionary video (${segment.renderMode})`
    : `${segment.renderMode} (geen clip)`;

  if (segment.videoUrl) {
    noVideoEl.classList.remove('show');
    videoFallbackEl.innerHTML = `<a href="${segment.videoUrl}" target="_blank" rel="noopener">${segment.videoUrl}</a>`;
  } else {
    noVideoEl.classList.add('show');
    videoFallbackEl.textContent = 'Geen MP4-URL voor dit segment.';
  }
};

async function convert() {
  status.textContent = 'Converting...';
  warningsEl.textContent = '';
  fallbackSummary.textContent = '';

  try {
    const result = await convertText(input.value);
    lastResult = result;
    posesByIndex = [];
    overlay.setKeyframes(null);
    overlay.setGlobalFit(null);
    stopOverlayLoop();

    player.setPlan(result.segments);
    const withVideo = result.segments.filter((s) => s.videoUrl).length;
    warningsEl.textContent = result.warnings.length ? `Warnings: ${result.warnings.join(' | ')}` : '';
    fallbackSummary.textContent = `Dictionary video: ${withVideo}/${result.segments.length} segmenten`;
    status.textContent = `Plan ready (${result.segments.length} segmenten). Druk Play voor video.`;
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  }
}

async function ensureAvatarPoses() {
  // Extract only for avatar segments (avatar3d) that have a real MP4 URL.
  const avatarSegments = lastResult.segments
    .map((s, index) => ({ ...s, index }))
    .filter((s) => s.renderMode === 'avatar3d' && s.videoUrl);

  if (!avatarSegments.length) return [];

  const res = await fetchAvatarPoses(avatarSegments, 12);
  return res.posesByIndex || [];
}

document.getElementById('convert').addEventListener('click', convert);

document.getElementById('play').addEventListener('click', async () => {
  if (!lastResult) return;
  const reqId = ++playRequestId;
  stopOverlayLoop();

  try {
    status.textContent = 'Extracting full-body pose (MediaPipe)… dit kan even duren bij eerste clip.';
    posesByIndex = await ensureAvatarPoses();
    if (reqId !== playRequestId) return;
    const hasBodyPose = posesByIndex.some((b) =>
      b?.keyframes?.some((k) => Array.isArray(k.pose) && k.pose.length >= 10)
    );
    status.textContent = hasBodyPose
      ? 'Playing…'
      : 'Playing… (geen lichaamspose in deze data — alleen hand/face; controleer API-cache na update.)';

    overlay.setGlobalFit(buildGlobalFitFromPoses(posesByIndex));
  } catch {
    if (reqId !== playRequestId) return;
    status.textContent = 'Avatar extraction failed, playing video only.';
    posesByIndex = [];
    overlay.setKeyframes(null);
  }

  if (reqId !== playRequestId) return;
  player.play();
  startOverlayLoop();
});

document.getElementById('pause').addEventListener('click', () => {
  playRequestId += 1;
  player.pause();
  stopOverlayLoop();
});

document.getElementById('step').addEventListener('click', () => {
  playRequestId += 1;
  player.step();
  startOverlayLoop();
});

document.getElementById('replay').addEventListener('click', () => {
  playRequestId += 1;
  player.replay();
  startOverlayLoop();
});

document.getElementById('speed').addEventListener('input', (e) => player.setSpeed(Number(e.target.value)));

function syncDictionaryVideoVisibility() {
  const show = document.getElementById('showDictionaryVideo');
  if (!videoWrap || !show) return;
  // Default: skeleton only (avatar-only). Checked = show the MP4 signer under the overlay.
  videoWrap.classList.toggle('avatar-only', !show.checked);
}

document.getElementById('showDictionaryVideo').addEventListener('change', syncDictionaryVideoVisibility);
syncDictionaryVideoVisibility();

document.getElementById('stage').addEventListener('dblclick', async () => {
  const frame = player.getCurrentFrame();
  if (!frame) return;
  await sendFeedback({
    input: input.value,
    segmentToken: frame.token,
    note: `videoUrl=${Boolean(frame.videoUrl)}, signId=${frame.signId}`
  });
  status.textContent = 'Feedback sent.';
});

getVideoClips().catch(() => {});
