// TypeScript port of the C++ AutoBPM BpmDetector algorithm.
// Algorithm: multi-band onset detection + FFT spectral flux + autocorrelation/IOI histogram scoring + hysteresis lock.

export interface AutoBpmConfig {
  minBpm: number;
  maxBpm: number;
  analysisWindowSec: number;
  attackMs: number;
  releaseMs: number;
  sensitivity: number;
  stability: number;
  clubMode: boolean;
  micMode: boolean;
  autoDropRestart: boolean;
}

export const DEFAULT_AUTO_BPM_CONFIG: AutoBpmConfig = {
  minBpm: 70,
  maxBpm: 180,
  analysisWindowSec: 8,
  attackMs: 3,
  releaseMs: 140,
  sensitivity: 1.1,
  stability: 0.82,
  clubMode: true,
  micMode: false,
  autoDropRestart: true,
};

export interface AutoBpmResult {
  bpm: number;
  rawBpm: number;
  confidence: number;
  locked: boolean;
  beatPhase: number;
  onsetStrength: number;
  dropArmed: boolean;
}

// ── FFT (Cooley-Tukey Radix-2) ────────────────────────────────────────────────

function runFft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
          t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = -Math.PI / half;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1.0, ci = 0.0;
      for (let j = 0; j < half; j++) {
        const ur = re[i+j], ui = im[i+j];
        const vr = re[i+j+half]*cr - im[i+j+half]*ci;
        const vi = re[i+j+half]*ci + im[i+j+half]*cr;
        re[i+j] = ur+vr; im[i+j] = ui+vi;
        re[i+j+half] = ur-vr; im[i+j+half] = ui-vi;
        const nr = cr*wr - ci*wi; ci = cr*wi + ci*wr; cr = nr;
      }
    }
  }
}

function addBilinear(arr: Float64Array, pos: number, w: number): void {
  const b = Math.floor(pos);
  const f = pos - b;
  if (b >= 0 && b < arr.length)     arr[b]     += w * (1 - f);
  if (b + 1 >= 0 && b + 1 < arr.length) arr[b+1] += w * f;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── Main engine ───────────────────────────────────────────────────────────────

const ONSET_RATE = 200; // frames per second, matches C++ default

interface PeakEvent { fi: number; strength: number; }

export class BpmDetectorEngine {
  private readonly sampleRate: number;
  private config: AutoBpmConfig;

  // Filter coefficients (recomputed on config change)
  private dcAlpha = 0;
  private lpLowAlpha = 0;
  private lpMidAlpha = 0;
  private attackAlpha = 0;
  private releaseAlpha = 0;

  // Filter state
  private prevSample = 0;
  private dcState = 0;
  private lowBandState = 0;
  private midBandState = 0;

  // Envelope followers
  private envLow = 0; private prevEnvLow = 0;
  private envMid = 0; private prevEnvMid = 0;
  private envHigh = 0; private prevEnvHigh = 0;

  // Frame accumulation
  private frameAccum = 0;
  private frameWeight = 0;
  private frameProgress = 0;

  // Spectral analysis
  private readonly fftSize: number;
  private readonly fftHop: number;
  private readonly fftWin: Float64Array;
  private readonly fftRe: Float64Array;
  private readonly fftIm: Float64Array;
  private readonly fftSampleBuf: Float64Array; // ring buffer
  private fftBufHead = 0;
  private fftBufFilled = false;
  private fftHopCounter = 0;
  private prevMag: Float64Array;
  private spectralFluxAccum = 0;
  private spectralFluxFrames = 0;
  private lastSpectralFlux = 0;

  // Novelty circular buffer
  private maxFrames: number;
  private readonly noveltyBuf: Float64Array;
  private noveltyHead = 0;
  private noveltyCount = 0;
  private noveltyFrameCounter = 0;

  // Drop detection
  private dropShortMean = 0;
  private dropLongMean = 0;
  private dropQuietFrames = 0;
  private dropCooldownFrames = 0;
  private dropArmed = false;
  private dropArmedFrame = 0;

  // Peak history
  private peaks: PeakEvent[] = [];

  // Estimation timing
  private framesUntilEstimate = 0;
  private readonly estimationStride: number;

  // Lock state (persists between estimates, reflects result)
  private bpm = 0;
  private rawBpm = 0;
  private confidence = 0;
  private locked = false;
  private relockCandidateBpm = 0;
  private relockCandidateWeight = 0;
  private recentMean = 0;
  private recentStd = 0;

  // Beat clock
  private beatClockSec = 0;
  private completedBeats = 0;

  // Published result
  private result: AutoBpmResult = { bpm: 0, rawBpm: 0, confidence: 0, locked: false, beatPhase: 0, onsetStrength: 0, dropArmed: false };

  constructor(sampleRate: number, config: AutoBpmConfig) {
    this.sampleRate = sampleRate;
    this.config = { ...config };

    this.fftSize = sampleRate >= 88200 ? 2048 : 1024;
    this.fftHop  = this.fftSize >> 2;
    this.fftWin  = new Float64Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++)
      this.fftWin[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (this.fftSize - 1));
    this.fftRe = new Float64Array(this.fftSize);
    this.fftIm = new Float64Array(this.fftSize);
    this.fftSampleBuf = new Float64Array(this.fftSize);
    this.prevMag = new Float64Array(this.fftSize / 2 + 1);

    this.maxFrames = Math.ceil(config.analysisWindowSec * ONSET_RATE);
    this.noveltyBuf = new Float64Array(Math.max(this.maxFrames, 1600));

    this.estimationStride = Math.max(1, Math.floor(ONSET_RATE / 18));

    this.updateCoeffs();
  }

  setConfig(cfg: AutoBpmConfig): void {
    this.config = { ...cfg };
    this.maxFrames = Math.ceil(cfg.analysisWindowSec * ONSET_RATE);
    this.updateCoeffs();
  }

  reset(): void {
    this.prevSample = this.dcState = this.lowBandState = this.midBandState = 0;
    this.envLow = this.prevEnvLow = this.envMid = this.prevEnvMid = this.envHigh = this.prevEnvHigh = 0;
    this.frameAccum = this.frameWeight = this.frameProgress = 0;
    this.fftSampleBuf.fill(0); this.fftBufHead = 0; this.fftBufFilled = false; this.fftHopCounter = 0;
    this.prevMag.fill(0); this.spectralFluxAccum = this.spectralFluxFrames = this.lastSpectralFlux = 0;
    this.noveltyBuf.fill(0); this.noveltyHead = this.noveltyCount = this.noveltyFrameCounter = 0;
    this.peaks = [];
    this.framesUntilEstimate = 0;
    this.bpm = this.rawBpm = this.confidence = 0;
    this.locked = false;
    this.relockCandidateBpm = this.relockCandidateWeight = 0;
    this.recentMean = this.recentStd = 0;
    this.beatClockSec = 0; this.completedBeats = 0;
    this.dropShortMean = this.dropLongMean = 0;
    this.dropQuietFrames = this.dropCooldownFrames = 0;
    this.dropArmed = false; this.dropArmedFrame = 0;
    this.result = { bpm: 0, rawBpm: 0, confidence: 0, locked: false, beatPhase: 0, onsetStrength: 0, dropArmed: false };
  }

  restartBar(): void {
    this.beatClockSec = 0;
    this.completedBeats = 0;
  }

  processBlock(samples: Float32Array): void {
    let maxOnset = 0;
    for (let i = 0; i < samples.length; i++) {
      const onset = this.processSample(samples[i]);
      if (onset > maxOnset) maxOnset = onset;
    }
    const period = this.bpm > 0 ? 60.0 / this.bpm : 0;
    const beatPhase = period > 0 ? clamp(this.beatClockSec / period, 0, 1) : 0;
    this.result = {
      bpm: this.bpm,
      rawBpm: this.rawBpm,
      confidence: this.confidence,
      locked: this.locked,
      beatPhase,
      onsetStrength: maxOnset,
      dropArmed: this.dropArmed,
    };
  }

  getResult(): AutoBpmResult { return this.result; }

  // ── Private ─────────────────────────────────────────────────────────────────

  private updateCoeffs(): void {
    const sr = this.sampleRate;
    this.dcAlpha       = 1.0 / (1.0 + 1.0 / (2 * Math.PI * 25 * sr));
    this.lpLowAlpha    = 1 - Math.exp(-2 * Math.PI * 180  / sr);
    this.lpMidAlpha    = 1 - Math.exp(-2 * Math.PI * 1400 / sr);
    this.attackAlpha   = Math.exp(-1.0 / (this.config.attackMs  / 1000 * sr));
    this.releaseAlpha  = Math.exp(-1.0 / (this.config.releaseMs / 1000 * sr));
  }

  private processSample(x: number): number {
    // DC high-pass
    const hp = this.dcAlpha * (this.dcState + x - this.prevSample);
    this.prevSample = x;
    this.dcState = hp;

    // Spectral ring buffer + FFT hop
    this.fftSampleBuf[this.fftBufHead] = hp;
    this.fftBufHead = (this.fftBufHead + 1) % this.fftSize;
    if (!this.fftBufFilled && this.fftBufHead === 0) this.fftBufFilled = true;
    this.fftHopCounter++;
    if (this.fftBufFilled && this.fftHopCounter >= this.fftHop) {
      this.fftHopCounter = 0;
      this.processSpectralFrame();
    }

    // 1st-order IIR band split
    this.lowBandState += this.lpLowAlpha * (hp - this.lowBandState);
    this.midBandState += this.lpMidAlpha * (hp - this.midBandState);
    const low  = this.lowBandState;
    const mid  = this.midBandState - this.lowBandState;
    const high = hp - this.midBandState;

    // Envelope followers
    const aL = Math.abs(low), aM = Math.abs(mid), aH = Math.abs(high);
    const atk = this.attackAlpha, rel = this.releaseAlpha;
    this.envLow  = aL > this.envLow  ? atk*this.envLow  + (1-atk)*aL  : rel*this.envLow  + (1-rel)*aL;
    this.envMid  = aM > this.envMid  ? atk*this.envMid  + (1-atk)*aM  : rel*this.envMid  + (1-rel)*aM;
    this.envHigh = aH > this.envHigh ? atk*this.envHigh + (1-atk)*aH  : rel*this.envHigh + (1-rel)*aH;

    // Onset novelty (sqrt of positive delta per band, band-weighted)
    const dL = Math.max(0, this.envLow  - this.prevEnvLow);
    const dM = Math.max(0, this.envMid  - this.prevEnvMid);
    const dH = Math.max(0, this.envHigh - this.prevEnvHigh);
    this.prevEnvLow = this.envLow;
    this.prevEnvMid = this.envMid;
    this.prevEnvHigh = this.envHigh;

    const mic = this.config.micMode;
    const bw = mic ? [1.65, 1.10, 0.30] : [1.35, 1.05, 0.60];
    let novelty = Math.sqrt(dL)*bw[0] + Math.sqrt(dM)*bw[1] + Math.sqrt(dH)*bw[2];
    const activeBands = (dL>1e-9?1:0) + (dM>1e-9?1:0) + (dH>1e-9?1:0);
    if (activeBands >= 2) novelty *= mic ? 1.03 : 1.08;

    this.frameAccum += novelty;
    this.frameWeight++;
    this.frameProgress += ONSET_RATE / this.sampleRate;

    let onsetOut = 0;
    if (this.frameProgress >= 1.0) {
      const framesToEmit = Math.floor(this.frameProgress);
      const tdVal = this.frameWeight > 0 ? this.frameAccum / this.frameWeight : 0;
      let sfVal = this.spectralFluxFrames > 0
        ? this.spectralFluxAccum / this.spectralFluxFrames
        : this.lastSpectralFlux * 0.92;
      sfVal = Math.sqrt(Math.max(0, sfVal));
      const frameValue = tdVal * (mic ? 0.68 : 0.58) + sfVal * (mic ? 0.72 : 0.92);

      for (let f = 0; f < framesToEmit; f++) onsetOut = Math.max(onsetOut, this.pushNoveltyFrame(frameValue));

      this.frameProgress -= framesToEmit;
      this.frameAccum = this.frameWeight = 0;
      this.spectralFluxAccum = this.spectralFluxFrames = 0;
    }

    // Beat clock advance per sample
    if (this.bpm > 0) {
      const period = 60.0 / this.bpm;
      this.beatClockSec += 1.0 / this.sampleRate;
      while (this.beatClockSec >= period) {
        this.beatClockSec -= period;
        this.completedBeats++;
      }
    }

    return onsetOut;
  }

  private processSpectralFrame(): void {
    // Copy ring buffer in time order with Hann window
    const re = this.fftRe, im = this.fftIm;
    im.fill(0);
    for (let i = 0; i < this.fftSize; i++) {
      const idx = (this.fftBufHead - this.fftSize + i + this.fftSize) % this.fftSize;
      re[i] = this.fftSampleBuf[idx] * this.fftWin[i];
    }
    runFft(re, im);

    const maxBin = this.fftSize >> 1;
    const binHz  = this.sampleRate / this.fftSize;
    let flux = 0;
    for (let k = 1; k <= maxBin; k++) {
      const freq = k * binHz;
      if (freq < 30 || freq > 6000) continue;
      const mag = Math.log1p(Math.sqrt(re[k]*re[k] + im[k]*im[k]));
      const delta = mag - this.prevMag[k];
      this.prevMag[k] = mag;
      if (delta <= 0) continue;
      const w = freq < 180 ? (this.config.micMode ? 1.40 : 1.20)
              : freq < 1600 ? (this.config.micMode ? 0.90 : 1.00)
              : (this.config.micMode ? 0.42 : 0.65);
      flux += delta * w;
    }
    flux /= maxBin;
    this.lastSpectralFlux = flux;
    this.spectralFluxAccum += flux;
    this.spectralFluxFrames++;
  }

  // Returns normalized onset strength for this frame
  private pushNoveltyFrame(value: number): number {
    this.noveltyBuf[this.noveltyHead] = value;
    this.noveltyHead = (this.noveltyHead + 1) % this.noveltyBuf.length;
    if (this.noveltyCount < this.maxFrames) this.noveltyCount++;
    this.noveltyFrameCounter++;

    // Prune stale peaks
    const cutoff = this.noveltyFrameCounter - this.maxFrames;
    while (this.peaks.length > 0 && this.peaks[0].fi < cutoff) this.peaks.shift();

    // Recent stats (last 48 frames)
    const { mean, stddev } = this.computeRecentStats(Math.min(48, this.noveltyCount));
    this.recentMean = mean; this.recentStd = stddev;
    const onsetStrength = stddev > 1e-9 ? clamp((value - mean) / (stddev * 2.5), 0, 1) : 0;

    this.updateDropState(value);
    this.detectPeakFromTail();
    this.maybeSnapBeat(value);

    this.framesUntilEstimate++;
    if (this.framesUntilEstimate >= this.estimationStride) {
      this.framesUntilEstimate = 0;
      this.estimateTempo();
    }

    return onsetStrength;
  }

  private getNoveltyAt(offsetFromNewest: number): number {
    // offset 0 = newest = head-1
    const idx = (this.noveltyHead - 1 - offsetFromNewest + this.noveltyBuf.length * 2) % this.noveltyBuf.length;
    return this.noveltyBuf[idx];
  }

  private computeRecentStats(count: number): { mean: number; stddev: number } {
    if (count < 1) return { mean: 0, stddev: 0 };
    let sum = 0, sumSq = 0;
    for (let i = 0; i < count; i++) { const v = this.getNoveltyAt(i); sum += v; sumSq += v*v; }
    const mean = sum / count;
    const stddev = Math.sqrt(Math.max(0, sumSq / count - mean * mean));
    return { mean, stddev };
  }

  private detectPeakFromTail(): void {
    if (this.noveltyCount < 3) return;
    const prev   = this.getNoveltyAt(2);
    const center = this.getNoveltyAt(1);
    const next   = this.getNoveltyAt(0);
    if (!(center > prev && center >= next)) return;

    const { mean, stddev } = this.computeRecentStats(Math.min(64, this.noveltyCount));
    const mic = this.config.micMode;
    const threshold = Math.max(
      mean + stddev * (this.config.sensitivity + (mic ? 0.32 : 0)),
      mean * (mic ? 1.50 : 1.35) + 1e-6
    );
    if (center < threshold) return;

    const refractoryFrames = Math.max(
      1,
      Math.floor(ONSET_RATE * Math.max(mic ? 0.11 : 0.08, 60 / this.config.maxBpm * (mic ? 0.30 : 0.22)))
    );
    const peakFi = this.noveltyFrameCounter - 2;
    const last = this.peaks[this.peaks.length - 1];

    if (last && peakFi - last.fi < refractoryFrames) {
      if (center > last.strength) { last.strength = center; last.fi = peakFi; }
      this.maybeTriggerDropRestart(last, threshold);
      this.maybeSnapBeatByPeak(last);
      return;
    }

    const peak: PeakEvent = { fi: peakFi, strength: center };
    this.peaks.push(peak);
    this.maybeTriggerDropRestart(peak, threshold);
    this.maybeSnapBeatByPeak(peak);
  }

  private maybeSnapBeat(_frameValue: number): void {
    // beat snapping happens per-peak in maybeSnapBeatByPeak
  }

  private maybeSnapBeatByPeak(peak: PeakEvent): void {
    if (!this.locked || this.bpm <= 0) return;
    const period = 60.0 / this.bpm;
    const distToBeat = Math.min(this.beatClockSec, Math.abs(period - this.beatClockSec));
    const mic = this.config.micMode;
    const tol = peak.strength > this.recentMean + this.recentStd * (this.config.sensitivity + 0.15)
      ? (mic ? 0.16 : 0.22) : (mic ? 0.12 : 0.16);
    if (distToBeat <= period * tol || this.beatClockSec >= period * (1 - tol)) {
      this.beatClockSec = 0;
      this.completedBeats++;
    }
  }

  private updateDropState(frameValue: number): void {
    const mic = this.config.micMode;
    const shortA = 1 - Math.exp(-1 / Math.max(1, ONSET_RATE * (mic ? 0.14 : 0.18)));
    const longA  = 1 - Math.exp(-1 / Math.max(1, ONSET_RATE * (mic ? 2.2  : 2.8)));
    this.dropShortMean = this.dropShortMean <= 0 ? frameValue : this.dropShortMean + (frameValue - this.dropShortMean)*shortA;
    this.dropLongMean  = this.dropLongMean  <= 0 ? frameValue : this.dropLongMean  + (frameValue - this.dropLongMean) *longA;
    if (this.dropCooldownFrames > 0) this.dropCooldownFrames--;

    if (!this.config.autoDropRestart || !this.locked || this.bpm <= 0 || this.confidence < (mic ? 0.30 : 0.22)) {
      this.dropArmed = false; this.dropQuietFrames = 0; return;
    }

    const beatFrames = ONSET_RATE * 60 / Math.max(1, this.bpm);
    const requiredQ = Math.max(1, Math.round(Math.max(ONSET_RATE * (mic ? 0.60 : 0.45), beatFrames * (mic ? 1.35 : 1.00))));
    const quietThr = Math.max(1e-6, this.dropLongMean * (mic ? 0.44 : 0.38));

    if (!this.dropArmed) {
      if (this.dropLongMean > 1e-4 && this.dropShortMean < quietThr) this.dropQuietFrames++;
      else if (this.dropQuietFrames > 0) this.dropQuietFrames--;
      if (this.dropCooldownFrames <= 0 && this.dropQuietFrames >= requiredQ) {
        this.dropArmed = true; this.dropArmedFrame = this.noveltyFrameCounter; this.dropQuietFrames = 0;
      }
    } else {
      const maxArmFrames = Math.max(1, Math.round(Math.max(ONSET_RATE * 3, beatFrames * (mic ? 8 : 6))));
      if (this.noveltyFrameCounter - this.dropArmedFrame > maxArmFrames) this.dropArmed = false;
    }
  }

  private maybeTriggerDropRestart(peak: PeakEvent, threshold: number): void {
    if (!this.config.autoDropRestart || !this.dropArmed) return;
    const armedFrames = this.noveltyFrameCounter - this.dropArmedFrame;
    const minArm = Math.round(ONSET_RATE * (this.config.micMode ? 0.10 : 0.06));
    if (armedFrames < minArm) return;

    const { mean: lm, stddev: ls } = this.computeRecentStats(Math.min(64, this.noveltyCount));
    const mic = this.config.micMode;
    const lowThr = Math.max(lm + ls * (mic ? 1.35 : 1.10), lm * (mic ? 1.45 : 1.30) + 1e-6);
    if (peak.strength < threshold * (mic ? 1.10 : 1.04)) return;
    // Simplified: no per-band low threshold check (no separate lowBandHistory in this port)
    if (peak.strength < lowThr) return;

    this.restartBar();
    this.dropArmed = false;
    this.dropCooldownFrames = Math.max(1, Math.round(Math.max(ONSET_RATE * 1.5, ONSET_RATE * 60 / Math.max(1, this.bpm) * 2)));
  }

  private estimateTempo(): void {
    const N = this.noveltyCount;
    const mic = this.config.micMode;
    const minFrames = Math.floor(ONSET_RATE * (mic ? 3 : 2));
    if (N < minFrames) { this.confidence = 0; this.locked = false; return; }

    const prevBpm = this.bpm;
    const prevConf = this.confidence;
    const wasLocked = this.locked;

    // Linearize novelty buffer (oldest first)
    const novelty = new Float64Array(N);
    for (let i = 0; i < N; i++) novelty[i] = this.getNoveltyAt(N - 1 - i);

    // Compute mean + stddev, then normalize and square
    let mean = 0;
    for (let i = 0; i < N; i++) mean += novelty[i];
    mean /= N;
    let variance = 0;
    for (let i = 0; i < N; i++) { const c = novelty[i] - mean; variance += c*c; }
    const stddev = Math.sqrt(Math.max(variance / N, 1e-12));
    for (let i = 0; i < N; i++) { const v = Math.max(0, (novelty[i] - mean) / stddev); novelty[i] = v*v; }

    const { minBpm, maxBpm } = this.config;
    const minLag = Math.max(1, Math.floor(ONSET_RATE * 60 / maxBpm));
    const maxLag = Math.max(minLag + 1, Math.ceil(ONSET_RATE * 60 / minBpm));
    if (maxLag >= N) { this.confidence = 0; this.locked = false; return; }

    // Autocorrelation
    const acf = new Float64Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      for (let i = lag; i < N; i++) s += novelty[i] * novelty[i - lag];
      acf[lag] = s / (N - lag);
    }
    let acfMax = 0;
    for (let lag = minLag; lag <= maxLag; lag++) if (acf[lag] > acfMax) acfMax = acf[lag];

    // IOI interval evidence
    const intervalEv      = new Float64Array(maxLag + 1);
    const strongIntervalEv = new Float64Array(maxLag + 1);
    if (this.peaks.length >= 2) {
      let peakMean = 0;
      for (const p of this.peaks) peakMean += p.strength;
      peakMean /= this.peaks.length;
      let peakVar = 0;
      for (const p of this.peaks) { const c = p.strength - peakMean; peakVar += c*c; }
      const peakStd = Math.sqrt(Math.max(peakVar / this.peaks.length, 0));
      const strongThr = peakMean + peakStd * 0.35;
      const newestFi = this.peaks[this.peaks.length - 1].fi;

      for (let li = 1; li < this.peaks.length; li++) {
        const later = this.peaks[li];
        const ageFrames = newestFi - later.fi;
        const freshness = Math.exp(-ageFrames / (this.config.analysisWindowSec * ONSET_RATE * 0.75));
        const firstEarlier = li > 8 ? li - 8 : 0;
        for (let ei = li - 1; ei >= firstEarlier; ei--) {
          const earlier = this.peaks[ei];
          const interval = later.fi - earlier.fi;
          if (interval < minLag * 0.5 || interval > maxLag * 4) continue;
          const gapPenalty = 1 + 0.35 * (li - ei - 1);
          const weight = freshness * Math.sqrt(Math.max(1e-9, earlier.strength * later.strength)) / gapPenalty;
          for (let div = 1; div <= 4; div++) {
            const beatLag = interval / div;
            if (beatLag >= minLag && beatLag <= maxLag)
              addBilinear(intervalEv, beatLag, weight / Math.sqrt(div));
          }
          if (later.strength >= strongThr && earlier.strength >= strongThr) {
            for (let div = 1; div <= 2; div++) {
              const beatLag = interval / div;
              if (beatLag >= minLag && beatLag <= maxLag)
                addBilinear(strongIntervalEv, beatLag, weight * 1.45 / div);
            }
          }
        }
      }
    }
    let intervalMax = 0, strongIntervalMax = 0;
    for (let l = minLag; l <= maxLag; l++) {
      if (intervalEv[l] > intervalMax) intervalMax = intervalEv[l];
      if (strongIntervalEv[l] > strongIntervalMax) strongIntervalMax = strongIntervalEv[l];
    }

    // Combined score per lag
    const combined = new Float64Array(maxLag + 1);
    const acfW  = mic ? 0.34 : 0.40;
    const intW  = mic ? 0.22 : 0.28;
    const strW  = mic ? 0.44 : 0.32;
    let bestScore = 0, secondScore = 0, bestLag = minLag;

    for (let lag = minLag; lag <= maxLag; lag++) {
      const acfN = acfMax  > 1e-9 ? acf[lag]          / acfMax  : 0;
      const intN = intervalMax > 1e-9 ? intervalEv[lag] / intervalMax : 0;
      const strN = strongIntervalMax > 1e-9 ? strongIntervalEv[lag] / strongIntervalMax : 0;
      let harmonic = 0;
      if (lag*2 <= maxLag && acfMax > 1e-9)       harmonic += (acf[lag*2]/acfMax) * 0.18;
      if (lag%2===0 && lag/2>=minLag && intervalMax>1e-9) harmonic += (intervalEv[lag/2]/intervalMax) * 0.10;
      if (lag*3 <= maxLag && intervalMax > 1e-9)  harmonic += (intervalEv[lag*3]/intervalMax) * 0.08;
      const score = acfN*acfW + intN*intW + strN*strW + harmonic;
      combined[lag] = score;
      if (score > bestScore) { secondScore = bestScore; bestScore = score; bestLag = lag; }
      else if (score > secondScore) secondScore = score;
    }

    // Score a lag variant (includes prior biases and continuity)
    const scoreVariant = (lag: number): number => {
      if (lag < minLag || lag > maxLag) return -1e9;
      const bpm = 60 * ONSET_RATE / lag;
      const bpmNorm = clamp((bpm - minBpm) / (maxBpm - minBpm), 0, 1);
      let score = combined[lag];
      if (lag*2 <= maxLag) score += combined[lag*2] * 0.10;
      if (lag%2===0 && lag/2>=minLag) score += combined[lag/2] * 0.05;
      score += (1 - bpmNorm) * 0.08; // prefer slower in ambiguous cases
      score += this.clubTempoPrior(bpm);
      const preferredUpper = Math.min(maxBpm, Math.max(minBpm + 20, 145));
      if (maxBpm <= 170 && bpm > preferredUpper && maxBpm > preferredUpper) {
        score -= clamp((bpm - preferredUpper) / (maxBpm - preferredUpper), 0, 1) * 0.16;
      }
      if (prevBpm > 0) score += (1 - clamp(Math.abs(Math.log(bpm/prevBpm)) / 0.35, 0, 1)) * 0.10;
      if (strongIntervalMax > 1e-9) {
        score += (strongIntervalEv[lag] / strongIntervalMax) * 0.18;
        if (lag*2 <= maxLag) {
          const slowerStr = strongIntervalEv[lag*2] / strongIntervalMax;
          if (slowerStr > strongIntervalEv[lag]/strongIntervalMax + 0.12)
            score -= (slowerStr - strongIntervalEv[lag]/strongIntervalMax) * 0.35;
        }
      }
      return score;
    };

    const ri = (v: number) => Math.round(v);
    const variants = [bestLag, bestLag*2, Math.floor(bestLag/2), bestLag*4, Math.floor(bestLag/4),
      ri(bestLag*4/3), ri(bestLag*3/2), ri(bestLag*2/3), ri(bestLag*3/4)];
    let selectedLag = bestLag, selectedScore = scoreVariant(bestLag);
    for (const v of variants) {
      const s = scoreVariant(v);
      if (s > selectedScore) { selectedLag = v; selectedScore = s; }
    }
    bestLag = selectedLag;

    // Confidence
    const left  = bestLag > minLag ? combined[bestLag-1] : combined[bestLag];
    const right = bestLag < maxLag ? combined[bestLag+1] : combined[bestLag];
    const contrast  = combined[bestLag] > 1e-9 ? clamp((combined[bestLag] - 0.5*(left+right)) / combined[bestLag], 0, 1) : 0;
    const separation = bestScore > 1e-9 ? clamp((bestScore - secondScore) / bestScore, 0, 1) : 0;
    const coverage  = clamp(N / (this.config.analysisWindowSec * ONSET_RATE), 0, 1);
    const peakCov   = clamp(this.peaks.length / Math.max(4, this.config.analysisWindowSec * (minBpm/60) * 0.5), 0, 1);
    const acfN2 = acfMax > 1e-9 ? acf[bestLag] / acfMax : 0;
    const intN2 = intervalMax > 1e-9 ? intervalEv[bestLag] / intervalMax : 0;
    const consensus = 1 - Math.min(1, Math.abs(acfN2 - intN2));

    const newConf = clamp(separation*0.34 + contrast*0.24 + peakCov*0.20 + coverage*0.10 + consensus*0.12, 0, 1);
    const rawBpmVal = clamp(60 * ONSET_RATE / bestLag, minBpm, maxBpm);
    let candidateBpm = rawBpmVal;

    // BPM update with hysteresis lock
    if (prevBpm <= 0) {
      this.bpm = candidateBpm;
    } else if (!wasLocked) {
      const blend = clamp(0.18 + newConf * 0.32, 0.10, 0.42);
      this.bpm = prevBpm + (candidateBpm - prevBpm) * blend;
    } else {
      const dist = prevBpm > 0 ? Math.abs(Math.log(Math.max(1e-9, candidateBpm / prevBpm))) : 0;
      const confJump = newConf - prevConf;
      const acceptDist = mic ? 0.12 : 0.16;
      const acceptConf = mic ? 0.24 : 0.18;
      const octaveFlip = Math.abs(Math.log(Math.max(1e-9, rawBpmVal*2/prevBpm))) < 0.12
                      || Math.abs(Math.log(Math.max(1e-9, rawBpmVal*0.5/prevBpm))) < 0.12;

      if (octaveFlip && newConf >= (mic ? 0.36 : 0.28)) {
        if (this.relockCandidateBpm <= 0 || Math.abs(Math.log(this.relockCandidateBpm / rawBpmVal)) > 0.09) {
          this.relockCandidateBpm = rawBpmVal;
          this.relockCandidateWeight = newConf * (mic ? 0.72 : 0.85);
        } else {
          this.relockCandidateBpm += (rawBpmVal - this.relockCandidateBpm) * (mic ? 0.22 : 0.34);
          this.relockCandidateWeight = clamp(this.relockCandidateWeight + newConf*(mic ? 0.36 : 0.58), 0, 2);
        }
      } else if (dist > (mic ? 0.10 : 0.12) && newConf >= (mic ? 0.42 : 0.34)) {
        if (this.relockCandidateBpm <= 0 || Math.abs(Math.log(this.relockCandidateBpm / candidateBpm)) > 0.09) {
          this.relockCandidateBpm = candidateBpm;
          this.relockCandidateWeight = newConf * (mic ? 0.42 : 0.55);
        } else {
          this.relockCandidateBpm += (candidateBpm - this.relockCandidateBpm) * (mic ? 0.18 : 0.28);
          this.relockCandidateWeight = clamp(this.relockCandidateWeight + newConf*(mic ? 0.28 : 0.42), 0, 2);
        }
      } else {
        this.relockCandidateWeight *= mic ? 0.88 : 0.80;
        if (this.relockCandidateWeight < 0.08) { this.relockCandidateBpm = 0; this.relockCandidateWeight = 0; }
      }

      if (this.relockCandidateWeight >= (mic ? 1.18 : 1.0) && this.relockCandidateBpm > 0) {
        this.bpm = prevBpm + (this.relockCandidateBpm - prevBpm) * (mic ? 0.48 : 0.65);
        this.locked = false;
        this.relockCandidateWeight = 0; this.relockCandidateBpm = 0;
        this.rawBpm = rawBpmVal; this.confidence = newConf;
        return;
      }

      const acceptCandidate = dist < acceptDist || confJump > acceptConf;
      if (acceptCandidate) {
        const blend = clamp((1-this.config.stability)*(mic?0.14:0.24) + newConf*(mic?0.08:0.12), mic?0.008:0.015, mic?0.06:0.10);
        this.bpm = prevBpm + (candidateBpm - prevBpm) * blend;
      }
    }

    this.bpm = clamp(this.bpm, minBpm, maxBpm);
    if (this.bpm > 0 && this.config.clubMode) this.bpm = Math.round(this.bpm);
    this.rawBpm = rawBpmVal;
    this.confidence = newConf;
    this.locked = (wasLocked && newConf >= (mic ? 0.30 : 0.22)) || newConf >= (mic ? 0.55 : 0.45);
  }

  private clubTempoPrior(bpm: number): number {
    if (!this.config.clubMode || bpm <= 0) return 0;
    const rounded = Math.round(bpm);
    const closeness = 1 - clamp(Math.abs(bpm - rounded) / 0.5, 0, 1);
    let prior = closeness * 0.10;
    if (bpm >= 118 && bpm <= 128) prior += 0.12;
    else if (bpm >= 128 && bpm <= 135) prior += 0.05;
    if (rounded === 120 || rounded === 124 || rounded === 126 || rounded === 128) prior += 0.04;
    if (bpm >= 160 && bpm <= 220 && this.config.maxBpm >= 170) prior += 0.08;
    return prior;
  }
}
