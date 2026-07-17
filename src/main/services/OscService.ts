import osc from 'osc';
import type { OscSendPayload } from '../../shared/types/ipc';
import type { OscFeedbackMessage } from '../../shared/types/runtime';

export class OscService {
  private udpPort: osc.UDPPort | null = null;
  private messageCallback: ((msg: OscFeedbackMessage) => void) | null = null;
  private activeConfigKey: string | null = null;
  private configurePromise: Promise<void> | null = null;

  configure(targetHost: string, targetPort: number, listenPort: number): Promise<void> {
    const key = `${targetHost}:${targetPort}:${listenPort}`;
    // Return same promise if already configuring or configured with identical params
    if (key === this.activeConfigKey && this.configurePromise) return this.configurePromise;

    this.activeConfigKey = key;
    this.configurePromise = this._doOpen(targetHost, targetPort, listenPort)
      .catch((err) => {
        // Reset on failure so the next call retries instead of re-using the rejected promise
        if (this.activeConfigKey === key) {
          this.activeConfigKey = null;
          this.configurePromise = null;
        }
        throw err;
      });
    return this.configurePromise;
  }

  private async _doOpen(targetHost: string, targetPort: number, listenPort: number): Promise<void> {
    this.udpPort?.close();
    this.udpPort = null;

    const port = new osc.UDPPort({
      localAddress: '0.0.0.0',
      localPort: listenPort,
      remoteAddress: targetHost,
      remotePort: targetPort,
      metadata: true,
    });

    port.on('message', (oscMsg: osc.OscMessage) => {
      if (!this.messageCallback) return;
      this.messageCallback({
        address: oscMsg.address,
        args: (oscMsg.args ?? []).map((a: osc.MetaArgument) => a.value as number | string | boolean),
        receivedAt: Date.now(),
      });
    });

    await new Promise<void>((resolve, reject) => {
      port.on('ready', resolve);
      port.on('error', reject);
      port.open();
    });

    this.udpPort = port;
  }

  close(): void {
    this.udpPort?.close();
    this.udpPort = null;
    this.messageCallback = null;
    this.activeConfigKey = null;
    this.configurePromise = null;
  }

  onMessage(cb: (msg: OscFeedbackMessage) => void): void {
    this.messageCallback = cb;
  }

  send(payload: OscSendPayload): void {
    if (!this.udpPort) return;
    this.udpPort.send({
      address: payload.address,
      args: payload.args.map((a) => ({ type: a.type, value: a.value })),
    });
  }
}
