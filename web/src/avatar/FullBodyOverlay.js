/**
 * Full-body avatar overlay: MediaPipe pose (33), face mesh (478 pts), hands (21 each).
 * Landmark format matches pose_extract.py: stored [x,y,z] with JS inverting to norm 0..1.
 */

const DEFAULT_HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const DEFAULT_POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
  [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
];

function storedToNorm01(x, y) {
  const x01 = x / 2 + 0.5;
  const y01 = 0.5 - y / 2;
  return { x01, y01 };
}

function getObjectFitContainRect(videoEl) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const cw = videoEl.clientWidth;
  const ch = videoEl.clientHeight;
  if (!vw || !vh || !cw || !ch) return null;
  const scale = Math.min(cw / vw, ch / vh);
  const w = vw * scale;
  const h = vh * scale;
  const x = (cw - w) / 2;
  const y = (ch - h) / 2;
  return { x, y, w, h };
}

function lerpPointArrays(a, b, alpha) {
  if (!a || !b || a.length !== b.length) return a || b || null;
  return a.map((av, idx) => {
    const bv = b[idx];
    if (!av || !bv) return av || bv;
    return [
      av[0] + (bv[0] - av[0]) * alpha,
      av[1] + (bv[1] - av[1]) * alpha,
      av[2] + (bv[2] - av[2]) * alpha,
    ];
  });
}

function interpAtTime(keyframes, tMs) {
  if (!keyframes || keyframes.length === 0) return null;
  if (tMs <= keyframes[0].tMs) return keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (tMs >= last.tMs) return last;

  let lo = 0;
  let hi = keyframes.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const a = keyframes[mid];
    if (a.tMs === tMs) return a;
    if (a.tMs < tMs) lo = mid + 1;
    else hi = mid - 1;
  }

  const i1 = Math.max(0, lo - 1);
  const i2 = Math.min(keyframes.length - 1, i1 + 1);
  const k1 = keyframes[i1];
  const k2 = keyframes[i2];
  const span = Math.max(1e-6, (k2.tMs - k1.tMs));
  const alpha = (tMs - k1.tMs) / span;

  const pick = (a, b, lerpFn) => {
    if (a && b) return lerpFn(a, b, alpha);
    return a || b || null;
  };

  return {
    tMs,
    pose: pick(k1.pose, k2.pose, lerpPointArrays),
    face: pick(k1.face, k2.face, lerpPointArrays),
    left: pick(k1.left, k2.left, lerpPointArrays),
    right: pick(k1.right, k2.right, lerpPointArrays),
  };
}

/**
 * Zoom/center so the figure fills the stage.
 * Important: if we include **hands** in the bbox, the box is often tiny (hands are close in frame),
 * so the zoom blows up and the whole screen becomes one hand. When body pose exists, frame using
 * **pose + face only**; hands stay in correct proportion. Hands-only clips get a capped zoom.
 */
function makeBBoxFit(poseFrame, pad = 0.04) {
  const pushPts = (arr, xs, ys) => {
    if (!arr || !Array.isArray(arr)) return;
    for (const p of arr) {
      if (!p || typeof p[0] !== 'number') continue;
      const { x01, y01 } = storedToNorm01(p[0], p[1]);
      if (Number.isFinite(x01) && Number.isFinite(y01)) {
        xs.push(x01);
        ys.push(y01);
      }
    }
  };

  const xs = [];
  const ys = [];
  const hasPose = (poseFrame.pose?.length ?? 0) >= 10;

  if (hasPose) {
    pushPts(poseFrame.pose, xs, ys);
    pushPts(poseFrame.face, xs, ys);
  } else {
    pushPts(poseFrame.pose, xs, ys);
    pushPts(poseFrame.face, xs, ys);
    pushPts(poseFrame.left, xs, ys);
    pushPts(poseFrame.right, xs, ys);
  }

  if (xs.length === 0) {
    return (x01, y01) => ({ x01, y01 });
  }

  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  const inner = 1 - 2 * pad;
  let bw = Math.max(maxX - minX, hasPose ? 0.2 : 0.12);
  let bh = Math.max(maxY - minY, hasPose ? 0.35 : 0.12);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let s = Math.min(inner / bw, inner / bh);

  if (!hasPose) {
    s = Math.min(s, 2.15);
  }
  // Prevent progressive "getting bigger" perception across clips/replays:
  // allow fit to zoom out when needed, but never zoom in past native frame scale.
  s = Math.min(s, 1.0);

  return (x01, y01) => ({
    x01: 0.5 + (x01 - cx) * s,
    y01: 0.5 + (y01 - cy) * s,
  });
}

function makeStableBBoxFitFromKeyframes(keyframes, pad = 0.04) {
  if (!keyframes?.length) return (x01, y01) => ({ x01, y01 });
  // Sample keyframes for deterministic per-segment framing.
  const xs = [];
  const ys = [];
  const pushPts = (arr) => {
    if (!arr || !Array.isArray(arr)) return;
    for (const p of arr) {
      if (!p || typeof p[0] !== 'number') continue;
      const { x01, y01 } = storedToNorm01(p[0], p[1]);
      if (Number.isFinite(x01) && Number.isFinite(y01)) {
        xs.push(x01);
        ys.push(y01);
      }
    }
  };

  let poseSamples = 0;
  for (let i = 0; i < keyframes.length; i += 2) {
    const k = keyframes[i];
    const hasPose = (k.pose?.length ?? 0) >= 10;
    if (hasPose) {
      pushPts(k.pose);
      pushPts(k.face);
      poseSamples += 1;
    }
  }
  if (poseSamples === 0) {
    for (let i = 0; i < keyframes.length; i += 2) {
      const k = keyframes[i];
      pushPts(k.pose);
      pushPts(k.face);
      pushPts(k.left);
      pushPts(k.right);
    }
  }

  if (!xs.length) return (x01, y01) => ({ x01, y01 });
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const inner = 1 - 2 * pad;
  const hasPose = poseSamples > 0;
  const bw = Math.max(maxX - minX, hasPose ? 0.2 : 0.12);
  const bh = Math.max(maxY - minY, hasPose ? 0.35 : 0.12);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let s = Math.min(inner / bw, inner / bh);
  if (!hasPose) s = Math.min(s, 2.15);
  s = Math.min(s, 1.0);

  return (x01, y01) => ({
    x01: 0.5 + (x01 - cx) * s,
    y01: 0.5 + (y01 - cy) * s,
  });
}

export class FullBodyOverlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    /** @type {{ keyframes: any[], poseConnections: number[][], handConnections: number[][] } | null} */
    this.bundle = null;
    this.tMs = 0;
    this.videoEl = null;
    this.globalFitNorm = null;
    this.zoomFactor = 1;
    this._lastDebug = { fitScale: 1, dpr: window.devicePixelRatio || 1 };
    // Fixed mapping to avoid any replay/segment growth drift.
    this.fitNorm = (x01, y01) => ({ x01, y01 });
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
  }

  setVideoElement(videoEl) {
    this.videoEl = videoEl || null;
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  resize() {
    this._resize();
  }

  /**
   * @param {any} data — full cache JSON { keyframes, poseConnections, handConnections } or legacy keyframes[]
   */
  setKeyframes(data) {
    if (!data) {
      this.bundle = null;
      return;
    }
    if (Array.isArray(data)) {
      this.bundle = {
        keyframes: data,
        poseConnections: DEFAULT_POSE_CONNECTIONS,
        handConnections: DEFAULT_HAND_CONNECTIONS,
      };
    } else {
      this.bundle = {
        keyframes: data.keyframes?.length ? data.keyframes : [],
        poseConnections: data.poseConnections?.length ? data.poseConnections : DEFAULT_POSE_CONNECTIONS,
        handConnections: data.handConnections?.length ? data.handConnections : DEFAULT_HAND_CONNECTIONS,
      };
    }
    // Keep overlay scale deterministic across replays and segment changes.
    this.fitNorm = (x01, y01) => ({ x01, y01 });
  }

  /**
   * Optional transform shared across all segments in the current sentence,
   * used to keep scale/position visually consistent from first clip to last.
   */
  setGlobalFit(transformFn) {
    this.globalFitNorm = typeof transformFn === 'function' ? transformFn : null;
  }

  setZoom(factor) {
    const z = Number(factor);
    this.zoomFactor = Number.isFinite(z) ? Math.max(0.8, Math.min(1.4, z)) : 1;
  }

  getDebugInfo() {
    const dpr = window.devicePixelRatio || 1;
    return {
      canvasW: this.canvas.width,
      canvasH: this.canvas.height,
      dpr,
      zoom: this.zoomFactor,
      fitScale: this._lastDebug?.fitScale ?? 1,
    };
  }

  setTimeMs(tMs) {
    this.tMs = tMs;
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cssW = this.canvas.clientWidth || 1;
    const cssH = this.canvas.clientHeight || 1;
    const sx = w / cssW;
    const sy = h / cssH;

    ctx.clearRect(0, 0, w, h);

    if (!this.bundle?.keyframes?.length) return;

    const poseFrame = interpAtTime(this.bundle.keyframes, this.tMs);
    if (!poseFrame) return;

    const baseFit = this.globalFitNorm || this.fitNorm || ((x01, y01) => ({ x01, y01 }));
    const fitNorm = (x01, y01) => {
      const p = baseFit(x01, y01);
      const z = this.zoomFactor || 1;
      this._lastDebug.fitScale = z;
      return {
        x01: 0.5 + (p.x01 - 0.5) * z,
        y01: 0.5 + (p.y01 - 0.5) * z,
      };
    };

    const norm01ToCanvasPx = (x01, y01) => {
      const vr = this.videoEl && getObjectFitContainRect(this.videoEl);
      let pxCss = x01 * cssW;
      let pyCss = y01 * cssH;
      if (vr) {
        pxCss = vr.x + x01 * vr.w;
        pyCss = vr.y + y01 * vr.h;
      }
      return { x: pxCss * sx, y: pyCss * sy };
    };

    const mapPoint = (p) => {
      if (!p || typeof p[0] !== 'number' || typeof p[1] !== 'number') return null;
      if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
      let { x01, y01 } = storedToNorm01(p[0], p[1]);
      ({ x01, y01 } = fitNorm(x01, y01));
      const q = norm01ToCanvasPx(x01, y01);
      return Number.isFinite(q.x) && Number.isFinite(q.y) ? q : null;
    };

    const mapHandPoints = (hand) => {
      if (!hand?.length) return [];
      // Keep original landmark indices (0..20). Do NOT filter nulls,
      // or hand-connection indices will point to wrong vertices and produce blobs.
      return hand.map((p) => mapPoint(p));
    };

    const drawConnected = (landmarks, connections, strokeStyle, lineW, dotR) => {
      if (!landmarks?.length) return;
      const pts = landmarks.map(mapPoint);
      ctx.strokeStyle = strokeStyle;
      ctx.fillStyle = strokeStyle;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = lineW;

      for (const [ia, ib] of connections) {
        const pa = pts[ia];
        const pb = pts[ib];
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      for (const p of pts) {
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawFaceCloud = (landmarks, fillStyle, dotR) => {
      if (!landmarks?.length) return;
      ctx.fillStyle = fillStyle;
      for (const p of landmarks) {
        const q = mapPoint(p);
        if (!q) continue;
        ctx.beginPath();
        ctx.arc(q.x, q.y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawHandInset = (pts, rect, strokeStyle) => {
      if (!pts?.length) return;
      const valid = pts.filter(Boolean);
      if (!valid.length) return;
      const xs = valid.map((p) => p.x);
      const ys = valid.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const bw = Math.max(26, maxX - minX);
      const bh = Math.max(26, maxY - minY);
      const scale = Math.min(4.2, Math.min((rect.w * 0.84) / bw, (rect.h * 0.84) / bh));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const tx = rect.x + rect.w / 2;
      const ty = rect.y + rect.h / 2;
      const tPts = pts.map((p) => (
        p
          ? {
              x: tx + (p.x - cx) * scale,
              y: ty + (p.y - cy) * scale,
            }
          : null
      ));

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
      ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.0025);
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, Math.max(8, rect.w * 0.08));
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = strokeStyle;
      ctx.fillStyle = strokeStyle;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2.5, Math.min(w, h) * 0.006);
      for (const [ia, ib] of this.bundle.handConnections) {
        const pa = tPts[ia];
        const pb = tPts[ib];
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      const r = Math.max(3.5, Math.min(w, h) * 0.009);
      for (const p of tPts) {
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const lw = Math.max(2, Math.min(w, h) * 0.005);
    const lwPose = Math.max(2.5, lw * 1.45);
    const joint = Math.max(2.5, Math.min(w, h) * 0.008);
    const jointPose = Math.max(3, joint * 1.15);
    const faceDot = Math.max(1.2, Math.min(w, h) * 0.0028);

    drawConnected(poseFrame.pose, this.bundle.poseConnections, 'rgba(34, 211, 238, 1)', lwPose, jointPose);
    drawFaceCloud(poseFrame.face, 'rgba(250, 204, 21, 0.55)', faceDot);
    drawConnected(poseFrame.left, this.bundle.handConnections, 'rgba(147, 197, 253, 0.95)', lw, joint);
    drawConnected(poseFrame.right, this.bundle.handConnections, 'rgba(249, 168, 212, 0.95)', lw, joint);

    // Insets disabled for stability; they can be reintroduced behind a manual fixed-scale toggle.
  }
}
