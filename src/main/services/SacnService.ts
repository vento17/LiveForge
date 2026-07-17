import dgram from 'dgram';
import { randomBytes } from 'crypto';

// Raw E1.31 (sACN) sender — bypasses the sacn npm library which always pads to 512 channels.
// Packet length = 126 + N where N = highest channel used (partial universe per spec §6.2.6).

const SACN_PORT = 5568;
const FLUSH_INTERVAL_MS = 23; // ~44 Hz

// Multicast address for universe U: 239.255.hi.lo (E1.31 §9.3.1)
function universeToMulticast(u: number): string {
  return `239.255.${(u >> 8) & 0xff}.${u & 0xff}`;
}

// Fixed 12-byte ACN Packet Identifier
const ACN_ID = Buffer.from([0x41,0x53,0x43,0x2d,0x45,0x31,0x2e,0x31,0x37,0x00,0x00,0x00]);

export class SacnService {
  private socket: dgram.Socket | null = null;
  private mode: 'multicast' | 'unicast' = 'multicast';
  private targetHost: string | undefined;
  private defaultPriority = 100;
  private cid = randomBytes(16);
  private seq = 0;
  private universes = new Map<number, Map<number, number>>(); // universe → (1-indexed ch → value)
  private dirty = new Set<number>();
  private timer: NodeJS.Timeout | null = null;

  configure(mode: 'multicast' | 'unicast', priority: number, targetHost?: string): void {
    this.cleanup();
    this.mode = mode;
    this.targetHost = targetHost;
    this.defaultPriority = priority;
    const sock = dgram.createSocket('udp4');
    sock.bind(0, () => {
      try { sock.setMulticastTTL(64); } catch { /* */ }
    });
    this.socket = sock;
    this.startFlushLoop();
  }

  setChannel(universe: number, channel: number, value: number, _priority?: number): void {
    this.getOrCreate(universe).set(channel, value);
    this.dirty.add(universe);
  }

  setChannels(universe: number, channels: Record<number, number>, _priority?: number): void {
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

    const N = Math.max(...chMap.keys()); // highest 1-indexed channel used
    const totalLen = 126 + N;
    const buf = Buffer.alloc(totalLen, 0);

    // ── Preamble (bytes 0–15) ────────────────────────────────────────────────
    buf.writeUInt16BE(0x0010, 0);   // Preamble Size
    buf.writeUInt16BE(0x0000, 2);   // Post-amble Size
    ACN_ID.copy(buf, 4);            // ACN Packet Identifier

    // ── Root layer (bytes 16–37) ─────────────────────────────────────────────
    buf.writeUInt16BE(0x7000 | (110 + N), 16); // Flags+Length
    buf.writeUInt32BE(0x00000004, 18);          // Vector: VECTOR_ROOT_E131_DATA
    this.cid.copy(buf, 22);                     // CID (16 bytes)

    // ── Framing layer (bytes 38–114) ─────────────────────────────────────────
    buf.writeUInt16BE(0x7000 | (88 + N), 38);  // Flags+Length
    buf.writeUInt32BE(0x00000002, 40);          // Vector: VECTOR_E131_DATA_PACKET
    buf.write('LiveForge', 44, 'utf8');         // Source Name (64 bytes, rest = 0)
    buf[108] = this.defaultPriority;            // Priority
    // Synchronization Address [109–110]: 0 (no sync)
    buf[111] = this.seq = (this.seq + 1) & 0xff; // Sequence Number
    // Options [112]: 0
    buf.writeUInt16BE(universe, 113);           // Universe

    // ── DMP layer (bytes 115–125 + data) ─────────────────────────────────────
    buf.writeUInt16BE(0x7000 | (11 + N), 115); // Flags+Length
    buf[117] = 0x02;                            // Vector: VECTOR_DMP_SET_PROPERTY
    buf[118] = 0xa1;                            // Address Type and Data Type
    buf.writeUInt16BE(0x0000, 119);             // First Property Address
    buf.writeUInt16BE(0x0001, 121);             // Address Increment
    buf.writeUInt16BE(N + 1, 123);              // Property Count (start code + N)
    buf[125] = 0x00;                            // DMX512 Start Code

    // DMX data: channel ch (1-indexed) → buf[125 + ch]
    for (const [ch, val] of chMap) {
      if (ch >= 1 && ch <= N) buf[125 + ch] = val;
    }

    const host = this.mode === 'unicast' && this.targetHost
      ? this.targetHost
      : universeToMulticast(universe);

    this.socket.send(buf, SACN_PORT, host);
  }

  private cleanup(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.socket) { try { this.socket.close(); } catch { /* */ } this.socket = null; }
  }
}
