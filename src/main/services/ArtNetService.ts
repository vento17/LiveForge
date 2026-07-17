import dgram from 'dgram';

// Raw Art-Net sender — bypasses the artnet npm library which always pads to 512 channels.
// Builds ArtDmx (OpCode 0x5000) packets with data length = highest channel used.

const ART_NET_PORT = 6454;
const FLUSH_INTERVAL_MS = 23; // ~44 Hz

export class ArtNetService {
  private socket: dgram.Socket | null = null;
  private host = '255.255.255.255';
  private universes = new Map<number, Map<number, number>>(); // universe → (1-indexed ch → value)
  private dirty = new Set<number>();
  private timer: NodeJS.Timeout | null = null;
  private seq = 0;

  configure(targetHost: string): void {
    this.cleanup();
    this.host = targetHost;
    const sock = dgram.createSocket('udp4');
    sock.bind(0, () => {
      try { sock.setBroadcast(true); } catch { /* unicast target, no broadcast needed */ }
    });
    this.socket = sock;
    this.startFlushLoop();
  }

  setChannel(universe: number, channel: number, value: number): void {
    this.getOrCreate(universe).set(channel, value);
    this.dirty.add(universe);
  }

  setChannels(universe: number, channels: Record<number, number>): void {
    const m = this.getOrCreate(universe);
    for (const [ch, val] of Object.entries(channels)) m.set(Number(ch), val);
    this.dirty.add(universe);
  }

  private getOrCreate(universe: number): Map<number, number> {
    if (!this.universes.has(universe)) this.universes.set(universe, new Map());
    return this.universes.get(universe)!;
  }

  private startFlushLoop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  private flush(): void {
    if (!this.socket || this.dirty.size === 0) return;
    for (const universe of this.dirty) {
      const chMap = this.universes.get(universe);
      if (chMap && chMap.size > 0) this.sendPacket(universe, chMap);
    }
    this.dirty.clear();
  }

  private sendPacket(universe: number, chMap: Map<number, number>): void {
    if (!this.socket) return;

    const maxCh = Math.max(...chMap.keys());
    // Art-Net spec: data length must be even and at least 2
    const dataLen = Math.max(2, maxCh % 2 === 0 ? maxCh : maxCh + 1);
    const buf = Buffer.alloc(18 + dataLen, 0);

    buf.write('Art-Net\0', 0, 'ascii');           // ID (8 bytes, includes null)
    buf.writeUInt16LE(0x5000, 8);                 // OpCode ArtDmx (lo-hi per Art-Net spec)
    buf.writeUInt16BE(14, 10);                    // Protocol version 14
    buf[12] = this.seq = (this.seq + 1) & 0xff;  // Sequence (1–255, 0 = disable)
    buf[13] = 0;                                   // Physical
    buf.writeUInt16LE(universe, 14);              // Universe (lo-hi)
    buf.writeUInt16BE(dataLen, 16);               // Length (hi-lo)
    // DMX data starts at byte 18; channel N (1-indexed) → buf[18 + N - 1] = buf[17 + N]
    for (const [ch, val] of chMap) {
      if (ch >= 1 && ch <= dataLen) buf[17 + ch] = val;
    }

    this.socket.send(buf, ART_NET_PORT, this.host);
  }

  private cleanup(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.socket) { try { this.socket.close(); } catch { /* */ } this.socket = null; }
  }
}
