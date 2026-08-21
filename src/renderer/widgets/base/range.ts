// Shared input→output range mapping, used by the Math widget and by Router
// outputs. Reads `raw` as a position inside [inMin, inMax] and expresses it in
// [outMin, outMax]. Leaving both at 0–1 passes the value straight through;
// reversing the output pair (outMin > outMax) inverts.
export interface RangeSpec {
  inMin?: number;
  inMax?: number;
  outMin?: number;
  outMax?: number;
}

export function remapRange(raw: number, r: RangeSpec): number {
  const inMin  = r.inMin  ?? 0;
  const inMax  = r.inMax  ?? 1;
  const outMin = r.outMin ?? 0;
  const outMax = r.outMax ?? 1;
  const span = inMax - inMin;
  // A zero-width input range would divide by zero — treat it as "always at the
  // bottom" rather than sending NaN down the wire.
  const t = span === 0 ? 0 : (raw - inMin) / span;
  return outMin + t * (outMax - outMin);
}

// True when the spec does nothing, so callers can skip the work entirely.
export function isIdentityRange(r: RangeSpec): boolean {
  return (r.inMin ?? 0) === 0 && (r.inMax ?? 1) === 1
      && (r.outMin ?? 0) === 0 && (r.outMax ?? 1) === 1;
}
