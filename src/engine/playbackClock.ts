type Tick = (time: number) => void;

/**
 * A single authoritative clock for the whole timeline. Video/audio elements
 * are corrected to follow THIS time (see syncEngine) rather than being
 * trusted as the timing source themselves — that's what keeps many layers
 * in sync during playback and scrubbing.
 */
class PlaybackClock {
  private _time = 0;
  private playing = false;
  private rafId: number | null = null;
  private lastFrameAt = 0;
  private listeners = new Set<Tick>();
  private duration = 0;

  get time() {
    return this._time;
  }
  get isPlaying() {
    return this.playing;
  }

  setDuration(d: number) {
    this.duration = d;
  }

  subscribe(fn: Tick) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l(this._time));
  }

  seek(t: number) {
    this._time = Math.max(0, Math.min(t, this.duration || Infinity));
    this.emit();
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.lastFrameAt = performance.now();
    this.loop();
  }

  pause() {
    this.playing = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  togglePlay() {
    this.playing ? this.pause() : this.play();
  }

  stepFrame(fps: number, direction: 1 | -1) {
    this.seek(this._time + direction / fps);
  }

  private loop = () => {
    if (!this.playing) return;
    const now = performance.now();
    const dt = (now - this.lastFrameAt) / 1000;
    this.lastFrameAt = now;
    this._time += dt;
    if (this.duration > 0 && this._time >= this.duration) {
      this._time = this.duration;
      this.playing = false;
      this.emit();
      return;
    }
    this.emit();
    this.rafId = requestAnimationFrame(this.loop);
  };
}

export const playbackClock = new PlaybackClock();
