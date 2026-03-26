/**
 * Plays dictionary MP4 clips in sequence (real signer video), not canvas abstraction.
 */
export class SignVideoPlayer {
  constructor(videoEl) {
    this.video = videoEl;
    this.segments = [];
    this.idx = 0;
    this.speed = 1;
    this.autoAdvance = false;
    this.onSegmentChange = null;
    this._onTimeUpdate = null;

    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('preload', 'auto');
  }

  setPlan(segments) {
    this.segments = segments || [];
    this.idx = 0;
    this._clearHandlers();
    this._loadSegment(0, false);
  }

  setSpeed(value) {
    this.speed = value;
    this.video.playbackRate = value;
  }

  getCurrentSegment() {
    return this.segments[this.idx] || null;
  }

  getCurrentFrame() {
    return this.getCurrentSegment();
  }

  _clearHandlers() {
    if (this._onTimeUpdate) {
      this.video.removeEventListener('timeupdate', this._onTimeUpdate);
      this._onTimeUpdate = null;
    }
    this.video.onended = null;
  }

  _emitSegment() {
    const seg = this.getCurrentSegment();
    if (this.onSegmentChange) this.onSegmentChange(seg);
  }

  _loadSegment(index, autoplay) {
    this.idx = Math.max(0, Math.min(index, this.segments.length - 1));
    const seg = this.segments[this.idx];
    this._clearHandlers();

    if (!seg?.videoUrl) {
      this.video.removeAttribute('src');
      this.video.load();
      this._emitSegment();
      if (autoplay) {
        window.setTimeout(() => this._advanceOrStop(), 400);
      }
      return;
    }

    this.video.src = seg.videoUrl;
    this.video.playbackRate = this.speed;
    this.video.load();
    this._emitSegment();

    if (autoplay) {
      this._playLoadedSegment();
    }
  }

  _playLoadedSegment() {
    const seg = this.getCurrentSegment();
    if (!seg?.videoUrl) return;

    const maxSec = seg.durationMs / 1000;

    this._onTimeUpdate = () => {
      if (this.video.currentTime >= maxSec - 0.04) {
        this.video.pause();
        this._clearHandlers();
        this._advanceOrStop();
      }
    };

    this.video.addEventListener('timeupdate', this._onTimeUpdate);
    this.video.onended = () => {
      this._clearHandlers();
      this._advanceOrStop();
    };

    this.video.currentTime = 0;
    this.video.play().catch(() => {});
  }

  _advanceOrStop() {
    if (this.idx >= this.segments.length - 1) {
      this.autoAdvance = false;
      return;
    }
    this._loadSegment(this.idx + 1, this.autoAdvance);
  }

  play() {
    this.autoAdvance = true;
    const seg = this.getCurrentSegment();
    if (!this.segments.length) return;
    if (!seg?.videoUrl) {
      this._loadSegment(this.idx, true);
      return;
    }
    this._playLoadedSegment();
  }

  pause() {
    this.autoAdvance = false;
    this._clearHandlers();
    this.video.pause();
  }

  replay() {
    this.autoAdvance = true;
    this._loadSegment(0, true);
  }

  step() {
    this.pause();
    if (this.idx >= this.segments.length - 1) return;
    this._loadSegment(this.idx + 1, false);
  }
}
