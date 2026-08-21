import osc from 'osc';
import type { OscSendPayload } from '../../shared/types/ipc';
import type { OscFeedbackMessage } from '../../shared/types/runtime';

const PRIMARY = 'primary';

export class OscService {
  private udpPort: osc.UDPPort | null = null;
  private messageCallback: ((msg: OscFeedbackMessage) => void) | null = null;
  private activeConfigKey: string | null = null;
  private configurePromise: Promise<void> | null = null;
  private outputs = new Map<string, { host: string; port: number }>();  // id → destination
  private extraInputs: osc.UDPPort[] = [];  // additional listen-only ports

  configure(
    targetHost: string,
    targetPort: number,
    listenPort: number,
    outputs: Array<{ id: string; host: string; port: number }> = [],
    extraListenPorts: number[] = [],
  ): Promise<void> {
    // Send-time routing table updated eagerly so output changes take effect even
    // when the listen socket doesn't need reopening.
    this.outputs.clear();
    const list = outputs.length ? outputs : [{ id: PRIMARY, host: targetHost, port: targetPort }];
    for (const o of list) {
      const host = (o.host ?? '').trim() || targetHost;
      this.outputs.set(o.id, { host, port: o.port || targetPort });
    }
    if (!this.outputs.has(PRIMARY)) this.outputs.set(PRIMARY, { host: targetHost, port: targetPort });

    const listenPorts = extraListenPorts
      .filter((p, i, arr) => Number.isFinite(p) && p > 0 && p !== listenPort && arr.indexOf(p) === i);

    const key = `${targetHost}:${targetPort}:${listenPort}:${listenPorts.join(',')}`;
    // Return same promise if already configuring or configured with identical listen params
    if (key === this.activeConfigKey && this.configurePromise) return this.configurePromise;

    this.activeConfigKey = key;
    this.configurePromise = this._doOpen(targetHost, targetPort, listenPort, listenPorts)
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

  // Forward a received OSC message to the feedback callback. Shared by the
  // primary listen port and every extra listen port.
  private forwardMessage(oscMsg: osc.OscMessage): void {
    if (!this.messageCallback) return;
    this.messageCallback({
      address: oscMsg.address,
      args: (oscMsg.args ?? []).map((a: osc.MetaArgument) => a.value as number | string | boolean),
      receivedAt: Date.now(),
    });
  }

  private async _doOpen(targetHost: string, targetPort: number, listenPort: number, extraListenPorts: number[]): Promise<void> {
    this.udpPort?.close();
    this.udpPort = null;
    this.closeExtraInputs();

    const port = new osc.UDPPort({
      localAddress: '0.0.0.0',
      localPort: listenPort,
      remoteAddress: targetHost,
      remotePort: targetPort,
      metadata: true,
    });

    port.on('message', (oscMsg: osc.OscMessage) => this.forwardMessage(oscMsg));

    await new Promise<void>((resolve, reject) => {
      port.on('ready', resolve);
      port.on('error', reject);
      port.open();
    });

    this.udpPort = port;

    // Additional listen-only ports — merged into the same feedback stream.
    for (const lp of extraListenPorts) {
      const extra = new osc.UDPPort({ localAddress: '0.0.0.0', localPort: lp, metadata: true });
      extra.on('message', (oscMsg: osc.OscMessage) => this.forwardMessage(oscMsg));
      extra.on('error', () => { /* ignore a bad extra port; primary stays up */ });
      try { extra.open(); this.extraInputs.push(extra); }
      catch { try { extra.close(); } catch { /* */ } }
    }
  }

  private closeExtraInputs(): void {
    for (const p of this.extraInputs) { try { p.close(); } catch { /* */ } }
    this.extraInputs = [];
  }

  close(): void {
    this.udpPort?.close();
    this.udpPort = null;
    this.closeExtraInputs();
    this.messageCallback = null;
    this.activeConfigKey = null;
    this.configurePromise = null;
    this.outputs.clear();
  }

  onMessage(cb: (msg: OscFeedbackMessage) => void): void {
    this.messageCallback = cb;
  }

  send(payload: OscSendPayload): void {
    if (!this.udpPort) return;
    const dest = this.outputs.get(payload.outputId ?? PRIMARY) ?? this.outputs.get(PRIMARY);
    if (!dest) return;
    this.udpPort.send({
      address: payload.address,
      args: payload.args.map((a) => ({ type: a.type, value: a.value })),
    }, dest.host, dest.port);
  }
}
