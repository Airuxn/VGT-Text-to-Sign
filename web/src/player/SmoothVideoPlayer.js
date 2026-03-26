/**
 * Smooth continuous playback for segment playlists.
 * Uses 2 layered <video> elements and crossfades between segment clips.
 */
export class SmoothVideoPlayer {
  constructor(videoA, videoB) {
    this.videos = [videoA, videoB];
    this.activeIdx = 0;
    this.segments = [];
    this.idx = 0;
    this.speed = 1;
    this.transitionMs = 120;
    this.autoAdvance = false;
    this.transitioning = false;
    this.onSegmentChange = null;

    this._onTimeUpdate = this._onTimeUpdate.bind(this);

    for (const v of this.videos) {
      v.setAttribute('playsinline', '');
      v.muted = true;
      v.preload = 'auto';
    }

    this.videos[0].classList.add('active');
    this.videos[1].classList.remove('active');
  }

  setPlan(segments) {
    this.segments = segments || [];
    this.idx = 0;
    this.transitioning = false;
    this.autoAdvance = false;
    this._stopBoth();
    this._setActive(this.activeIdx);
    this._loadSegmentToVideo(this.idx, this.activeIdx);
    this._emitSegment();
  }

  setSpeed(value) {
    this.speed = value;
    for (const v of this.videos) v.playbackRate = this.speed;
  }

  getCurrentFrame() {
    return this.segments[this.idx] || null;
  }

  getCurrentSegment() {
    return this.getCurrentFrame();
  }

  getCurrentSegmentIndex() {
    return this.idx;
  }

  getActiveVideoIndex() {
    return this.activeIdx;
  }

  getActiveVideoElement() {
    return this.videos[this.activeIdx];
  }

  play() {
    if (!this.segments.length) return;
    this.autoAdvance = true;
    this.transitioning = false;
    this._ensureEventListeners();
    this._playActiveLoaded();
  }

  pause() {
    this.autoAdvance = false;
    this.transitioning = false;
    this._removeTimeListener();
    for (const v of this.videos) v.pause();
  }

  replay() {
    if (!this.segments.length) return;
    this.pause();
    this.idx = 0;
    this.activeIdx = 0;
    this._setActive(this.activeIdx);
    this._loadSegmentToVideo(this.idx, this.activeIdx);
    this._emitSegment();
    this.autoAdvance = true;
    this._ensureEventListeners();
    this._playActiveLoaded();
  }

  step() {
    if (!this.segments.length) return;
    this.pause();
    if (this.idx >= this.segments.length - 1) return;
    this.idx += 1;
    this.activeIdx = 0;
    this._setActive(this.activeIdx);
    this._loadSegmentToVideo(this.idx, this.activeIdx);
    this._emitSegment();
  }

  _ensureEventListeners() {
    this._removeTimeListener();
    this.videos[this.activeIdx].addEventListener('timeupdate', this._onTimeUpdate);
  }

  _removeTimeListener() {
    for (const v of this.videos) v.removeEventListener('timeupdate', this._onTimeUpdate);
  }

  _emitSegment() {
    const seg = this.getCurrentSegment();
    if (this.onSegmentChange) this.onSegmentChange(seg);
  }

  _setActive(activeIndex) {
    const nextInactive = 1 - activeIndex;
    this.activeIdx = activeIndex;
    this.videos[activeIndex].classList.add('active');
    this.videos[nextInactive].classList.remove('active');
  }

  _stopBoth() {
    this.transitioning = false;
    this._removeTimeListener();
    for (const v of this.videos) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  }

  _loadSegmentToVideo(segmentIdx, videoIdx) {
    const seg = this.segments[segmentIdx];
    const v = this.videos[videoIdx];

    if (!seg || !seg.videoUrl) {
      v.pause();
      v.removeAttribute('src');
      v.load();
      return;
    }

    v.src = seg.videoUrl;
    v.playbackRate = this.speed;
    v.currentTime = 0;
    v.load();
  }

  _playActiveLoaded() {
    const seg = this.getCurrentSegment();
    if (!seg || !seg.videoUrl) return;
    const v = this.videos[this.activeIdx];
    v.currentTime = 0;
    v.play().catch(() => {});
  }

  _onTimeUpdate() {
    if (!this.autoAdvance || this.transitioning) return;

    const seg = this.getCurrentSegment();
    if (!seg || !seg.videoUrl) return;

    const v = this.videos[this.activeIdx];
    // Prefer the real MP4 duration; planner durationMs is only an estimate.
    const durSec = Number.isFinite(v.duration) && v.duration > 0
      ? v.duration
      : (seg.durationMs / 1000);
    // Transition only at the actual end so we don't cut sign completion.
    const nearEndSec = Math.max(0.06, durSec - 0.02);

    // Start the crossfade near the end of the segment.
    if (v.currentTime >= nearEndSec) {
      this.transitioning = true;
      this._startTransition();
    }
  }

  _startTransition() {
    if (this.idx >= this.segments.length - 1) {
      this.autoAdvance = false;
      return;
    }

    const nextIdx = this.idx + 1;
    const nextSeg = this.segments[nextIdx];
    const currentVid = this.videos[this.activeIdx];
    const nextVidIdx = 1 - this.activeIdx;
    const nextVid = this.videos[nextVidIdx];

    if (!nextSeg || !nextSeg.videoUrl) {
      // If there is no video for the next segment, just skip it.
      this.idx = nextIdx;
      this.transitioning = false;
      this._setActive(0);
      this.activeIdx = 0;
      this._loadSegmentToVideo(this.idx, this.activeIdx);
      this._emitSegment();
      this._ensureEventListeners();
      this._playActiveLoaded();
      return;
    }

    this._loadSegmentToVideo(nextIdx, nextVidIdx);
    nextVid.playbackRate = this.speed;
    nextVid.play().catch(() => {});

    // Crossfade visually using the existing CSS opacity transition.
    nextVid.classList.add('active');
    currentVid.classList.remove('active');

    window.setTimeout(() => {
      currentVid.pause();
      this.activeIdx = nextVidIdx;
      this.idx = nextIdx;
      this.transitioning = false;
      this._emitSegment();
      this._ensureEventListeners();
    }, this.transitionMs + 60);
  }
}

