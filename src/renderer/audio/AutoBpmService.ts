import { BpmDetectorEngine } from './BpmDetectorEngine';
import type { AutoBpmConfig, AutoBpmResult } from './BpmDetectorEngine';

export type { AutoBpmConfig, AutoBpmResult };

export class AutoBpmService {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private engine: BpmDetectorEngine | null = null;

  constructor(
    private readonly onResult: (r: AutoBpmResult) => void,
    private readonly onError:  (msg: string) => void,
  ) {}

  async start(deviceId: string | null, config: AutoBpmConfig): Promise<void> {
    await this.stop();
    try {
      this.ctx = new AudioContext({ latencyHint: 'balanced' });
      this.engine = new BpmDetectorEngine(this.ctx.sampleRate, config);

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } : { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });

      const source = this.ctx.createMediaStreamSource(this.stream);
      this.processor = this.ctx.createScriptProcessor(4096, 2, 1);

      this.processor.onaudioprocess = (e) => {
        const c0  = e.inputBuffer.getChannelData(0);
        const nch = e.inputBuffer.numberOfChannels;
        const c1  = nch > 1 ? e.inputBuffer.getChannelData(1) : null;
        const mono = new Float32Array(c0.length);
        if (c1) { for (let i = 0; i < c0.length; i++) mono[i] = (c0[i] + c1[i]) * 0.5; }
        else     { mono.set(c0); }
        this.engine!.processBlock(mono);
        this.onResult(this.engine!.getResult());
      };

      source.connect(this.processor);
      this.processor.connect(this.ctx.destination);
    } catch (e) {
      await this.stop();
      this.onError(e instanceof Error ? e.message : String(e));
    }
  }

  async stop(): Promise<void> {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null as unknown as never;
      this.processor = null;
    }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.ctx)    { await this.ctx.close().catch(() => {}); this.ctx = null; }
    this.engine = null;
  }

  updateConfig(cfg: AutoBpmConfig): void { this.engine?.setConfig(cfg); }
  resetHistory(): void { this.engine?.reset(); }
  restartBar(): void   { this.engine?.restartBar(); }
  get running(): boolean { return this.engine !== null; }
}
