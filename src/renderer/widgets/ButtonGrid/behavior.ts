// Corner marker so a grid mixing behaviours is readable without opening the
// cell editor. Lives outside the component file: exporting a non-component from
// one breaks React Fast Refresh for the whole module.
export const BEHAVIOR_BADGE: Record<string, string> = {
  momentary: 'M', pulse: 'P', toggle: 'T', radio: 'R',
};
