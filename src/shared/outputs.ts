import type { Connection, MidiConnection, OscConnection, ArtNetConnection, SacnConnection } from './types/project';
import { PRIMARY_OUTPUT_ID } from './types/project';

export interface OutputRef { id: string; name: string; }

export type OutputProtocol = 'midi' | 'osc' | 'artnet' | 'sacn';

// Selectable outputs for a protocol: the primary destination ("out 1") first,
// then any named extra outputs configured in Settings. Used by the per-mapping
// Output selector and to build the service configuration.
export function listOutputs(conns: Connection[], type: OutputProtocol): OutputRef[] {
  const primary: OutputRef = { id: PRIMARY_OUTPUT_ID, name: 'out 1' };
  const conn = conns.find((c) => c.type === type) as { extraOutputs?: Array<{ id: string; name: string }> } | undefined;
  const extras = conn?.extraOutputs?.map((o, i) => ({ id: o.id, name: o.name || `out ${i + 2}` })) ?? [];
  return [primary, ...extras];
}

// Human label for a mapping's current outputId (falls back to "out 1").
export function outputLabel(conns: Connection[], type: OutputProtocol, outputId: string | undefined): string {
  const found = listOutputs(conns, type).find((o) => o.id === (outputId ?? PRIMARY_OUTPUT_ID));
  return found?.name ?? 'out 1';
}

// ─── Service configuration builders ─────────────────────────────────────────
// Convert a connection into the outputs list its main-process service expects
// (primary as PRIMARY_OUTPUT_ID, then named extras).

export function artnetConfigOutputs(conn: ArtNetConnection): Array<{ id: string; host: string }> {
  return [
    { id: PRIMARY_OUTPUT_ID, host: conn.targetHost },
    ...(conn.extraOutputs ?? []).map((o) => ({ id: o.id, host: o.host })),
  ];
}

export function sacnConfigOutputs(conn: SacnConnection): Array<{ id: string; host?: string }> {
  return [
    // Primary: unicast to targetHost, or multicast (no host) when in multicast mode.
    { id: PRIMARY_OUTPUT_ID, host: conn.mode === 'unicast' ? conn.targetHost : undefined },
    ...(conn.extraOutputs ?? []).map((o) => ({ id: o.id, host: o.host })),
  ];
}

export function oscConfigOutputs(conn: OscConnection): Array<{ id: string; host: string; port: number }> {
  return [
    { id: PRIMARY_OUTPUT_ID, host: conn.targetHost, port: conn.targetPort },
    ...(conn.extraOutputs ?? []).map((o) => ({ id: o.id, host: o.host, port: o.port })),
  ];
}

export function midiConfigOutputs(conn: MidiConnection): Array<{ id: string; portName: string }> {
  return (conn.extraOutputs ?? []).map((o) => ({ id: o.id, portName: o.portName }));
}
