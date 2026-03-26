export class AvatarPlayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.segments = [];
    this.speed = 1;
    this.elapsed = 0;
    this.lastTs = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
    this.onSegmentChange = null;
    this._lastSegmentKey = '';
    this.draw(null);
  }

  setPlan(segments) {
    this.segments = segments || [];
    this.elapsed = 0;
    this._lastSegmentKey = '';
    this.draw(this.currentSegment());
  }

  setSpeed(value) { this.speed = value; }

  totalDuration() {
    if (!this.segments.length) return 0;
    const last = this.segments[this.segments.length - 1];
    return last.startMs + last.durationMs;
  }

  currentSegment() {
    if (!this.segments.length) return null;
    const active = this.segments.find((p) => this.elapsed >= p.startMs && this.elapsed < p.startMs + p.durationMs);
    return active || this.segments[this.segments.length - 1];
  }

  getCurrentFrame() { return this.currentSegment(); }

  play() {
    if (this.running || !this.segments.length) return;
    this.running = true;
    this.lastTs = performance.now();
    requestAnimationFrame(this._tick);
  }

  pause() { this.running = false; }

  replay() {
    this.elapsed = 0;
    this._lastSegmentKey = '';
    this.draw(this.currentSegment());
    this.play();
  }

  step() {
    const cur = this.currentSegment();
    if (!cur) return;
    const idx = this.segments.findIndex((p) => p.startMs === cur.startMs && p.signId === cur.signId);
    if (idx === -1 || idx === this.segments.length - 1) this.elapsed = this.totalDuration();
    else this.elapsed = this.segments[idx + 1].startMs;
    this.draw(this.currentSegment());
  }

  _tick(ts) {
    if (!this.running) return;
    const dt = (ts - this.lastTs) * this.speed;
    this.lastTs = ts;
    this.elapsed += dt;
    const total = this.totalDuration();
    if (this.elapsed >= total) {
      this.elapsed = total;
      this.running = false;
    }
    this.draw(this.currentSegment());
    if (this.running) requestAnimationFrame(this._tick);
  }

  draw(segment) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#f8fafc');
    bg.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, h - 36, w, 36);

    if (!segment) {
      ctx.fillStyle = '#334155';
      ctx.fillText('No segment loaded.', 18, h - 15);
      return;
    }

    if (segment.renderMode === 'human_video') {
      this.drawVideoFallbackPlaceholder(segment);
    } else {
      this.drawAvatarSegment(segment);
    }

    const key = `${segment.startMs}-${segment.signId}-${segment.renderMode}`;
    if (this.onSegmentChange && key !== this._lastSegmentKey) {
      this._lastSegmentKey = key;
      this.onSegmentChange(segment);
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '14px system-ui, Arial';
    ctx.fillText(`Token: ${segment.token} | Sign: ${segment.signId} | Mode: ${segment.renderMode}`, 16, h - 40);
    ctx.fillText(`Time: ${Math.round(this.elapsed)} ms`, 16, h - 17);
  }

  drawVideoFallbackPlaceholder(segment) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    ctx.fillStyle = '#fff7ed';
    ctx.fillRect(130, 40, w - 260, 210);
    ctx.strokeStyle = '#fdba74';
    ctx.lineWidth = 2;
    ctx.strokeRect(130, 40, w - 260, 210);
    ctx.fillStyle = '#9a3412';
    ctx.font = 'bold 18px system-ui, Arial';
    ctx.fillText('Human Video Fallback Segment', 240, 95);
    ctx.font = '14px system-ui, Arial';
    ctx.fillText(`Clip: ${segment.fallback?.clipId || 'unavailable'}`, 240, 130);
    ctx.fillText(`Reason: ${segment.fallback?.reason || 'policy'}`, 240, 154);
    ctx.fillText('In production deploy, this area plays signer video.', 240, 180);
  }

  drawAvatarSegment(segment) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const shoulderY = 128;
    const hipY = 225;

    ctx.fillStyle = '#f1c9a5';
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, 70, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    this.drawFace(cx, 70, segment.nonManual);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx, 100);
    ctx.lineTo(cx, hipY);
    ctx.stroke();

    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - 46, shoulderY);
    ctx.lineTo(cx + 46, shoulderY);
    ctx.stroke();

    this.drawArm('left', segment.manual.left, false);
    this.drawArm('right', segment.manual.right, false);
  }

  drawFace(cx, cy, nonManual) {
    const ctx = this.ctx;
    const mouth = nonManual?.mouth || 'neutral';
    const brows = nonManual?.brows || 'neutral';

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;

    const raise = brows === 'raised' ? 5 : 0;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 17 - raise);
    ctx.lineTo(cx - 6, cy - 18 - raise);
    ctx.moveTo(cx + 6, cy - 18 - raise);
    ctx.lineTo(cx + 18, cy - 17 - raise);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 13, cy - 7);
    ctx.lineTo(cx - 7, cy - 7);
    ctx.moveTo(cx + 7, cy - 7);
    ctx.lineTo(cx + 13, cy - 7);
    ctx.stroke();

    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (mouth === 'oo') {
      ctx.ellipse(cx, cy + 11, 7, 4, 0, 0, Math.PI * 2);
    } else if (mouth === 'open') {
      ctx.ellipse(cx, cy + 11, 6, 6, 0, 0, Math.PI * 2);
    } else if (mouth === 'flat') {
      ctx.moveTo(cx - 9, cy + 12);
      ctx.lineTo(cx + 9, cy + 12);
    } else {
      ctx.moveTo(cx - 8, cy + 11);
      ctx.quadraticCurveTo(cx, cy + 13, cx + 8, cy + 11);
    }
    ctx.stroke();
  }

  drawArm(side, config, isFallback) {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const shoulder = { x: cx + (side === 'left' ? -46 : 46), y: 128 };
    const sign = side === 'left' ? -1 : 1;
    const pose = this.armPose(config.pose, sign);

    const elbow = {
      x: shoulder.x + Math.cos(pose.upper) * 54,
      y: shoulder.y + Math.sin(pose.upper) * 54
    };
    const wrist = {
      x: elbow.x + Math.cos(pose.lower) * 47,
      y: elbow.y + Math.sin(pose.lower) * 47
    };

    ctx.strokeStyle = isFallback ? '#b45309' : '#0f172a';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(wrist.x, wrist.y);
    ctx.stroke();

    this.drawHand(wrist, config.handshape || 'B');
  }

  drawHand(wrist, handshape) {
    const ctx = this.ctx;
    const palmR = 9;
    ctx.fillStyle = '#f1c9a5';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wrist.x, wrist.y, palmR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    let spread = 0.28;
    let length = 9;
    if (handshape === 'B') { spread = 0.33; length = 11; }
    if (handshape === '1') { spread = 0.08; length = 12; }
    if (handshape === 'A') { spread = 0.12; length = 6; }
    if (handshape === 'FS') { spread = 0.4; length = 12; }

    const baseAngle = -Math.PI / 2;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.7;
    for (let i = 0; i < 5; i += 1) {
      const factor = handshape === '1' ? (i === 2 ? 1 : 0.25) : 1;
      const angle = baseAngle + (i - 2) * spread;
      const x2 = wrist.x + Math.cos(angle) * length * factor;
      const y2 = wrist.y + Math.sin(angle) * length * factor;
      ctx.beginPath();
      ctx.moveTo(wrist.x, wrist.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  armPose(gesture, sign) {
    const p = {
      rest: { upper: Math.PI * 0.82, lower: Math.PI * 0.9 },
      self_point: { upper: -Math.PI * 0.72 * sign, lower: -Math.PI * 0.96 * sign },
      point_forward: { upper: -0.16 * sign, lower: -0.08 * sign },
      thumb_up_move: { upper: -Math.PI * 0.42 * sign, lower: -Math.PI * 0.36 * sign },
      cheek_forward: { upper: -Math.PI * 0.82 * sign, lower: -Math.PI * 0.58 * sign },
      chin_forward: { upper: -Math.PI * 0.72 * sign, lower: -Math.PI * 0.53 * sign },
      fingerspell: { upper: -Math.PI * 0.55 * sign, lower: -Math.PI * 0.36 * sign },
      support_hand: { upper: Math.PI * 0.45 * sign, lower: Math.PI * 0.2 * sign }
    };
    return p[gesture] || p.rest;
  }
}
