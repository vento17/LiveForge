# LiveForge

A modular touch-controller builder for live use — Electron + React + zustand.

Build layouts of sliders, knobs, buttons, XY pads, LFOs, envelopes, step
sequencers, a multi-track timeline, cues, submasters and more, then drive them
out over **MIDI, OSC, Art-Net, sACN** and **Enttec Open DMX**. Right-click any
control to link it (master/slave via a Router), record cues, sync to LTC/MTC
timecode, and control everything remotely from a phone or tablet browser.

## Build

```bash
npm install
npm run dev        # run in development
npm run typecheck  # type-check main + renderer (should be clean)
npm run dist       # Windows portable .exe (needs Python + PyInstaller for the sidecar)
```

macOS: see [BUILD_MAC.md](BUILD_MAC.md). Windows `.exe` and macOS `.dmg`
(without Spout/NDI) are also built by GitHub Actions — see
`.github/workflows/build.yml`.

## Notes

- **Spout / NDI** video input is **Windows-only**; those widgets are disabled on
  other platforms. NDI requires the separately-installed NDI runtime — it is not
  redistributed with the app.

## License

Copyright (C) 2026 vento17.

LiveForge is free software: you can redistribute it and/or modify it under the
terms of the **GNU General Public License v3.0 or later** — see [LICENSE](LICENSE).
It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY.
