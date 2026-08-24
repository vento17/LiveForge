// Content for the Manual widget. Kept as plain data so the view stays dumb and
// entries can be edited without touching layout code.
//
// Row 1 = settings topics + shortcuts. Row 2 = one entry per widget kind.

export interface ManualEntry {
  id: string;
  tab: string;          // short label shown on the tab
  title: string;
  intro: string;
  // Bullet lines: [name, explanation]. Rendered as a two-column list.
  items: [string, string][];
  note?: string;
}

export const SETTINGS_ENTRIES: ManualEntry[] = [
  {
    id: 'project', tab: 'Project', title: 'Project',
    intro: 'Name, save/load and the global re-send. Everything here lives in the ⚙ Settings panel.',
    items: [
      ['Name', 'Project name, stored in the .json save file.'],
      ['Save / Load', 'Writes or reads a project file. Widgets, mappings, cues and links all travel together.'],
      ['Trigger all widgets', 'Re-sends the current value of every control on every page. Use it after connecting, to push the desk state onto a receiver that just came up.'],
      ['Pages all run at once', 'In Live mode every page is alive, not just the one on screen. A timeline started on page 1 keeps playing while you work on page 2, LFOs hold their phase, and a Router source on a hidden page still drives its targets.'],
      ['Editing fields', 'Any numeric field can be cleared and retyped — it will not refill itself with 0 the moment you delete the last digit.'],
    ],
    note: 'Connections are opened once when you enter Live mode and stay up while you change pages. Keyboard shortcuts, though, only reach the page you are looking at.',
  },
  {
    id: 'canvas', tab: 'Canvas', title: 'Canvas Resolution',
    intro: 'The size of the page you are designing, per page.',
    items: [
      ['Preset', 'Common screen sizes. Picking one fills Width and Screen height.'],
      ['Width', 'Page width in pixels.'],
      ['Screen height', 'Your full screen height — the top bar is subtracted automatically to get the usable page height.'],
      ['Live X / Live Y', 'Shifts the whole page inside the Live viewport. Use it to nudge the layout away from a bezel or a notch.'],
    ],
  },
  {
    id: 'frames', tab: 'Frame rate', title: 'Frame rate',
    intro: 'The project-wide frame rate, used wherever time is counted in frames.',
    items: [
      ['Frames per second', '24, 25, 29.97, 30, 50 or 60. Saved with the project.'],
      ['Where it shows up', 'A Timeline ruler switched to FRM counts in these frames, and Shift+←/→ steps by one of them at full zoom.'],
    ],
    note: 'A Timeline carrying its own timecode frame rate uses that instead — chasing an external LTC has to follow the incoming rate, not the project one.',
  },
  {
    id: 'tempo', tab: 'Tempo', title: 'Tempo & Tap',
    intro: 'The master BPM that drives LFOs, step sequencers, graphs and beat ramps.',
    items: [
      ['BPM', 'Master tempo, 20–300. Everything BPM-synced follows this.'],
      ['TAP', 'Tap the beat to set the tempo. Averaged over the last taps.'],
      ['↺ Reset', 'Resets tap averaging and restarts all tempo widgets from phase zero.'],
      ['Tap source', 'Lets an external OSC message or MIDI CC/Note act as the TAP button.'],
      ['Reset source', 'Same, for the ↺ reset.'],
    ],
  },
  {
    id: 'midiout', tab: 'MIDI Out', title: 'MIDI Output',
    intro: 'Sends Note, CC and Pitch Bend to a MIDI port.',
    items: [
      ['Port name', 'Exact name of the destination port — a loopMIDI port, or a hardware device.'],
      ['List available ports', 'Scans and lists ports; click one to select it.'],
      ['Extra outputs (named)', 'Additional ports. Each gets a name you can then pick per mapping, so one control can address a specific device.'],
      ['Connect MIDI', 'Opens the port. The badge next to it turns green when the port is live.'],
    ],
    note: 'A Master Level set to MIDI does not scale buttons — button values are sent as-is.',
  },
  {
    id: 'midiclock', tab: 'MIDI Clock', title: 'MIDI Clock',
    intro: 'Sends MIDI beat clock out of the MIDI output port, locked to the master BPM.',
    items: [
      ['Start / Stop', 'Starts or stops the outgoing clock. Receivers slave their tempo to it.'],
    ],
  },
  {
    id: 'midiin', tab: 'MIDI In', title: 'MIDI Input',
    intro: 'Listens for incoming MIDI so external controllers can drive your widgets.',
    items: [
      ['Port name', 'Exact name of the input port, e.g. a Launchpad.'],
      ['List available ports', 'Scans and lists input ports.'],
      ['Extra input ports', 'Listen on more than one device at once.'],
      ['Learn MIDI CC', 'Right-click any cell in Live mode and pick Learn — the next CC received is bound to that cell.'],
    ],
  },
  {
    id: 'osc', tab: 'OSC', title: 'OSC',
    intro: 'Sends and receives OSC over UDP. This is the usual road to TouchDesigner, Resolume and friends.',
    items: [
      ['Destination IP', 'Where messages are sent. 127.0.0.1 is this same machine.'],
      ['Destination port', 'The port the receiver listens on.'],
      ['Listen port', 'The port LiveForge listens on for incoming OSC (feedback and Learn).'],
      ['Extra outputs (named)', 'More IP/port destinations. Each is named and selectable per mapping.'],
      ['Extra listen ports', 'Receive on more than one local port.'],
      ['Connect OSC', 'Binds the sockets.'],
      ['Address scheme', 'Default addresses are short, because you retype them in the receiving software: /s1/1 = slider bank 1, fader 1. Knob banks use /k1/1, button grids /b1/1.'],
    ],
    note: 'The number comes from the widget\'s own name, so slider3 is always /s3/… and the address matches the cell names (S3.1 ↔ /s3/1). Copy a widget and its addresses follow the copy instead of staying on the original. An OSC mapping with no min/max sends the raw 0.0–1.0 value.',
  },
  {
    id: 'artnet', tab: 'Art-Net', title: 'Art-Net (DMX over Ethernet)',
    intro: 'DMX universes over the network, refreshed about 44 times a second.',
    items: [
      ['Destination IP', 'The receiver address. 255.255.255.255 broadcasts to the whole LAN; a specific IP unicasts to one node.'],
      ['Extra outputs (named)', 'More nodes. Each keeps its own universe state, so a value sent to one never leaks to another.'],
      ['Connect Art-Net', 'Opens the socket and starts the refresh loop.'],
    ],
    note: 'Packets are only sent for universes that actually changed.',
  },
  {
    id: 'sacn', tab: 'sACN', title: 'sACN / E1.31',
    intro: 'The other DMX-over-network standard. Same channel model as Art-Net, different transport.',
    items: [
      ['Mode', 'Multicast computes the destination from the universe number automatically. Unicast sends to one IP you choose.'],
      ['Destination IP', 'Unicast target (unicast mode only).'],
      ['Priority', '1–200. A receiver seeing two sources honours the higher priority. Default 100.'],
      ['Connect sACN', 'Opens the socket and starts the refresh loop.'],
    ],
  },
  {
    id: 'enttec', tab: 'Enttec', title: 'Enttec Open DMX USB',
    intro: 'A single DMX universe straight out of a USB dongle — no network involved.',
    items: [
      ['Scan USB devices', 'Lists the FTDI devices found. Click one to select it.'],
      ['Device index', '0 is the first dongle. Set it manually if you do not want to scan.'],
      ['Connect Enttec', 'Opens the device and starts sending frames continuously.'],
    ],
    note: 'Needs the FTDI D2XX driver installed. This output is one universe only, so there are no named extra outputs.',
  },
  {
    id: 'audioin', tab: 'Audio In', title: 'Audio Input',
    intro: 'The input device used by the Audio Analyser and by timecode sync.',
    items: [
      ['Scan audio inputs', 'Lists the available capture devices.'],
      ['Device', 'The one to use. Leave unset for the default microphone.'],
    ],
  },
  {
    id: 'audioout', tab: 'Audio Out', title: 'Audio Output',
    intro: 'Where the Sound Player and timeline audio tracks play back.',
    items: [
      ['Scan audio outputs', 'Lists the available playback devices.'],
      ['Device', 'The one to use. Leave unset for the system default.'],
    ],
  },
  {
    id: 'network', tab: 'Network', title: 'Network Live',
    intro: 'Serves the live page over the local network, so a phone or tablet becomes a second control surface.',
    items: [
      ['Port', 'The HTTP port to serve on. Set it before starting.'],
      ['Start / ● ON', 'Starts or stops the server.'],
      ['URL', 'Once running, the address to open on the other device. It must be on the same WiFi.'],
    ],
    note: 'Remote clients can drive sliders, buttons, knobs, XY pads, masters and submasters.',
  },
  {
    id: 'shortcuts', tab: '⌨ Shortcuts', title: 'Shortcuts',
    intro: 'Keyboard and touch. Design-mode shortcuts work when the canvas has focus.',
    items: [
      ['Delete / Backspace', 'Deletes the selected widget or widgets.'],
      ['Ctrl + Z', 'Undo.'],
      ['Ctrl + C', 'Copy the selection.'],
      ['Ctrl + X', 'Cut — pasting afterwards is a true move, links keep working.'],
      ['Ctrl + V', 'Paste. A copy gets fresh names and free CC/DMX channels.'],
      ['Shift + click', 'Adds a widget to the selection. Holding Shift also blocks dragging, so you can select without moving.'],
      ['Drag a selection', 'Every selected widget moves with the one you grabbed, live, and the whole group snaps to the grid on drop.'],
      ['Drag on empty canvas', 'Rubber-band selection.'],
      ['Double click on empty canvas', 'Opens the Add Widget picker.'],
      ['Hold 2s (touch)', 'On a widget in Design mode: opens a popup with Delete, so no keyboard is needed.'],
      ['Tab (in ✏ Cells)', 'Moves DOWN the column, not across the row: fill in every name, then every address. Past the last row it carries on at the top of the next column. Shift+Tab goes back up.'],
      ['Right-click a cell', 'Opens the link menu: link to a source, unlink, or Learn MIDI/OSC.'],
      ['Esc', 'Leaves Live mode.'],
      ['— Timeline —', 'The following work while a Timeline widget is on screen.'],
      ['SPACE', 'Play / pause, and continue from a wait point.'],
      ['← / →', 'Nudge the playhead by one ruler step (zoom-dependent).'],
      ['Ctrl + ← / →', 'Previous / next marker.'],
      ['Shift + ← / →', 'Previous / next wait point.'],
      ['Ctrl + M', 'Marker at the playhead.'],
      ['Ctrl + Z', 'Undo inside the timeline.'],
      ['Ctrl + C / V', 'Copy a keyframe or trig marker, paste it at the playhead.'],
    ],
    note: 'Timeline keys only reach the timeline on the page you are looking at — the others stay mounted and keep streaming, but ignore the keyboard. They also stand aside when a Keyboard widget has already claimed the key, so binding SPACE or the arrows there wins over the transport.',
  },
];

export const WIDGET_ENTRIES: ManualEntry[] = [
  {
    id: 'w-slider', tab: 'Slider Bank', title: 'Slider Bank',
    intro: 'A bank of faders. Each fader is its own cell with its own output mapping.',
    items: [
      ['Count X / Y', 'How many faders, in columns and rows.'],
      ['Horizontal sliders', 'A tick in the Grid section lays the faders on their side — the travel becomes left-to-right. The layout changes, nothing is rotated, so labels and values stay upright and readable.'],
      ['✏ Cells', 'Per-cell editor: label, colour, mapping and feedback rules. Tab walks down a column, so you can type all the names in one pass and all the addresses in the next.'],
      ['Drag', 'Sets the value. Each cell sends on its own mapping.'],
      ['Cell names', 'Default names carry the bank number — slider2 gets S2.1…S2.8 — so two banks side by side are never both "1". ↺ Reset names rebuilds them.'],
    ],
    note: 'Copying a bank renumbers its cell names and its default OSC addresses to the copy. Names and addresses you typed by hand are left alone.',
  },
  {
    id: 'w-knob', tab: 'Knob Bank', title: 'Knob Bank',
    intro: 'A bank of rotary knobs. Same cell model as the Slider Bank.',
    items: [
      ['Drag up / right', 'Raises the value. Down or left lowers it.'],
      ['Min / Max angle', 'The arc the knob sweeps, in degrees.'],
      ['✏ Cells', 'Per-cell label, colour and mapping.'],
    ],
  },
  {
    id: 'w-button', tab: 'Button Grid', title: 'Button Grid',
    intro: 'A grid of buttons. Behaviour is set for the whole grid in the Inspector, then overridden cell by cell in ✏ Cells. The letter in the bottom-left corner of each button shows which mode it is in.',
    items: [
      ['M — Momentary', 'Sends 1 on press and 0 on release. Stays on for as long as you hold it. This is the default.'],
      ['P — Pulse', 'A short 1 followed by 0, whatever you do with your finger. Use it to trigger, not to hold.'],
      ['T — Toggle', 'Each press flips the state and it stays there.'],
      ['R — Radio', 'Only one radio button in the grid stays on; pressing another releases the previous one.'],
      ['On / Off value', 'The values sent for the two states, already in protocol range.'],
      ['✏ Cells', 'Per-cell editor: label, colour, behaviour, on/off values and mapping.'],
    ],
    note: 'A Master Level does not scale buttons mapped to MIDI — those values are sent as-is.',
  },
  {
    id: 'w-xy', tab: 'XY Pad', title: 'XY Pad',
    intro: 'A two-axis touch surface. X and Y are two separate cells with two separate mappings.',
    items: [
      ['Drag', 'Moves both axes at once.'],
      ['Invert X / Y', 'Flips an axis direction.'],
      ['Show crosshair', 'Draws guide lines through the handle.'],
    ],
  },
  {
    id: 'w-keyboard', tab: 'Keyboard', title: 'Keyboard',
    intro: 'Turns computer keys into buttons. Press the physical key or tap the cap on screen — both do the same thing.',
    items: [
      ['＋ Add key', 'In the Inspector: click it, then press the key you want. It is captured by physical position, so the layout does not matter.'],
      ['Name', 'A label shown under the key cap — what it does, not what it is.'],
      ['Behavior', 'Momentary, pulse, toggle or radio, per key. The letter in the corner shows which.'],
      ['On / Off value', 'The values sent for the two states.'],
      ['Keys per row', 'How the caps are laid out on screen.'],
      ['Link', 'Right-click a key in Live mode to link it, or to Learn MIDI/OSC — each key is a cell like any other.'],
    ],
    note: 'Keys only fire in Live mode, and never while you are typing in a field. Esc cannot be bound: it leaves Live mode. Holding a key does not re-fire it, and a key held while the window loses focus is released for you.',
  },
  {
    id: 'w-lfo', tab: 'LFO', title: 'LFO',
    intro: 'A free-running oscillator. Its output is one cell you can map or link to anything.',
    items: [
      ['Waveform', 'Sine, square, saw, triangle or random (sample and hold).'],
      ['Rate mode', 'BPM locks the cycle to the master tempo; Hz runs at a fixed frequency.'],
      ['Rate multiplier', 'In BPM mode, beats per cycle.'],
      ['Amplitude', 'How far the output swings, centred on the offset.'],
      ['Offset', 'The centre point of the swing.'],
      ['Phase', 'Shifts the starting point of the cycle.'],
      ['▶ / ■', 'Play or freeze. Freezing holds the last value instead of jumping to zero.'],
    ],
  },
  {
    id: 'w-graph', tab: 'Graph', title: 'Graph',
    intro: 'A curve you draw yourself, played back as an envelope.',
    items: [
      ['Points', 'Drag to shape the curve. Each point chooses how it interpolates to the next.'],
      ['Linear / Bezier / Square', 'Straight ramp, curved with handles, or a hard step.'],
      ['Timing mode', 'BPM ties the cycle to the tempo; Manual runs over a duration in seconds.'],
      ['Play mode', 'Loop repeats forever; Once runs one pass and stops.'],
      ['Play / Stop mappings', 'External MIDI or OSC triggers to start and stop it.'],
    ],
    note: 'On stop the output is driven to zero.',
  },
  {
    id: 'w-seq', tab: 'Step Seq', title: 'Step Sequencer',
    intro: 'A step sequencer locked to the master BPM. Its output is one cell.',
    items: [
      ['Step count', '4, 8, 16 or 32 steps.'],
      ['Speed', 'Multiplier against the master tempo, from ×0.125 to ×8.'],
      ['Step value', 'Each step holds its own level, not just on/off.'],
      ['Smooth', 'Zero gives hard jumps between steps; higher values slew the output.'],
      ['RND / MAX / ZERO', 'Fill all steps randomly, at full, or at zero.'],
    ],
    note: 'On stop the output is driven to zero.',
  },
  {
    id: 'w-timeline', tab: 'Timeline', title: 'Timeline',
    intro: 'A multi-track sequencer over a fixed duration in seconds.',
    items: [
      ['Value track', 'Keyframes with linear, step or bezier easing. Sends on the track mapping.'],
      ['Colour track', 'Colour keyframes sent as an OSC address with R, G, B.'],
      ['Trig track', 'Markers that fire a pulse as the playhead crosses them. Each marker is its own linkable cell.'],
      ['Cue track', 'Blocks covering the whole timeline — see the Cue track tab.'],
      ['Wait track', 'Points that pause playback until you continue — see the Wait track tab.'],
      ['Sound track', 'An audio file placed on the timeline, with trim and volume.'],
      ['Markers', 'Grey droplets in their own thin lane under the ruler, so their names never cover the time numbers. They act as snap targets. +M or Ctrl+M drops one at the playhead; drag to move, click to rename.'],
      ['Loop mode', 'Play once or loop.'],
      ['Timecode', 'Chase incoming LTC or MTC instead of the internal clock.'],
      ['Mute', 'Silences one track without deleting it.'],
      ['SEC / FRM', 'Switches the ruler between seconds and timecode frames (m:ss:ff, at the timecode frame rate).'],
      ['Ruler detail', 'The tick spacing follows the zoom: zoom in and the ruler subdivides down to hundredths of a second, or to single frames.'],
      ['SPACE', 'Play / pause, and continue from a wait point.'],
      ['← / →', 'Nudges the playhead by one ruler subdivision — the step gets finer as you zoom in, down to a single frame in FRM.'],
      ['Ctrl + ← / →', 'Jumps to the previous / next marker.'],
      ['Shift + ← / →', 'Jumps to the previous / next wait point, bypassed ones included.'],
      ['Ctrl + M', 'Drops a ruler marker at the playhead.'],
      ['Ctrl + Z', 'Undo, within the timeline.'],
      ['Ctrl + C / V', 'Copy and paste the selected keyframe or trig marker at the playhead.'],
    ],
    note: 'A paused timeline holds its last values and is not rescaled by a Master Level.',
  },
  {
    id: 'w-tl-cue', tab: 'Cue track', title: 'Timeline · Cue track',
    intro: 'A track cut into blocks that cover the whole timeline. Unlike a trig, a cue is a state rather than an edge: whichever block the playhead sits in is the one being sent.',
    items: [
      ['Cut a block', 'Double-click or Ctrl-click anywhere on the row. The block you cut ends there and a new one runs to the next cut.'],
      ['Select', 'A plain click selects the block under the cursor so you can edit it on the right.'],
      ['Name / Colour', 'Per block, so a show reads at a glance.'],
      ['Output mapping', 'Held at 1 for as long as the playhead is inside the block, back to 0 when it leaves.'],
      ['Starts at', 'The block boundary in seconds. The opening block is pinned to 0.'],
      ['Delete block', 'Removes a cut; the previous block grows to fill the gap. The opening block cannot be deleted.'],
    ],
    note: 'It fires from ANY frame inside the block, so scrubbing or jumping into the middle of cue 3 sends cue 3 — you do not have to play over its start. Nothing is stored in the block: it only says "we are in cue 3", it is not a snapshot like the Cues widget.',
  },
  {
    id: 'w-tl-wait', tab: 'Wait track', title: 'Timeline · Wait track',
    intro: 'Points where playback stops and waits for you. Lets a timeline run as a series of steps — animate a stretch, hold for the actor, carry on.',
    items: [
      ['Add a point', 'Click anywhere on the row.'],
      ['Name', 'Optional label shown on the point, e.g. "wait for actor".'],
      ['Time', 'Where it sits, in seconds.'],
      ['Continue', 'SPACE, or the ▶ button. Playback resumes from the point without re-triggering it.'],
      ['Bypass', 'Greys the point out: the transport runs straight through it, but Ctrl+←/→ still jumps to it. Use it to disarm one stop without losing the landmark.'],
      ['Mute', 'Silences the whole track so a rehearsal can run through without stopping anywhere.'],
    ],
    note: 'Moving the playhead by hand abandons the wait. A wait point does not stop a timeline that is chasing timecode — external time keeps running.',
  },
  {
    id: 'w-audio', tab: 'Audio Analyser', title: 'Audio Analyser',
    intro: 'Listens to an audio input and turns it into control signals.',
    items: [
      ['Kick / Snare', 'Transient detection. Each has a centre frequency, a bandwidth and a threshold.'],
      ['Bass / Mid / High', 'Continuous band levels, each with its own frequency and width.'],
      ['BPM trig ×N', 'A pulse every N beats, for eight divisors.'],
      ['BPM ramp ×N', 'A 0→1 sawtooth over N beats, for the same divisors.'],
      ['Device', 'Which input to listen to. Defaults to the system microphone.'],
    ],
  },
  {
    id: 'w-sound', tab: 'Sound Player', title: 'Sound Player',
    intro: 'A playlist of audio files with per-track transport.',
    items: [
      ['Tracks', 'Each has a file, a label and its own volume.'],
      ['Play / Pause / Stop', 'Per-track transport buttons.'],
      ['Master Volume', 'Scales the whole player.'],
      ['Play mapping', 'A MIDI or OSC message sent when a track starts.'],
    ],
    note: 'A track is also a cell: a Router setting it to 1 starts playback, so cues can fire audio.',
  },
  {
    id: 'w-spout', tab: 'Spout', title: 'Spout Input',
    intro: 'Live video from a Spout sender on the same machine. Windows only.',
    items: [
      ['Sender name', 'Which Spout sender to receive.'],
      ['Target FPS', 'Caps the refresh rate. Zero means no limit.'],
      ['Border', 'Optional frame width and colour.'],
    ],
    note: 'Needs the video sidecar running, which in turn needs CPython 3.14 exactly — the numpy and Pillow binaries shipped in the repo are built for that ABI. If a widget says "stream unavailable", open the log (the badge at the bottom right): the sidecar reports there why, e.g. a missing NDI runtime or a numpy/Pillow mismatch. On macOS and Linux this widget is unavailable.',
  },
  {
    id: 'w-ndi', tab: 'NDI', title: 'NDI Input',
    intro: 'Live video from an NDI source anywhere on the network. Windows only.',
    items: [
      ['Source name', 'Which NDI source to receive. Discovered sources are listed for you.'],
      ['Target FPS', 'Caps the refresh rate. Zero means no limit.'],
      ['Border', 'Optional frame width and colour.'],
    ],
    note: 'Needs the NDI Runtime installed separately — it is not shipped with the app.',
  },
  {
    id: 'w-router', tab: 'Router', title: 'Router',
    intro: 'Takes one signal and sends it to many places. It is also where right-click links are stored.',
    items: [
      ['Input: widget', 'A cell from any widget on any page.'],
      ['Input: MIDI CC / Note', 'An incoming MIDI message. Channel 0 means any channel.'],
      ['Input: OSC', 'An incoming OSC address.'],
      ['Outputs', 'Each row can drive several outputs: a protocol mapping, or another widget cell.'],
      ['✳ ALL cells (output)', 'Drives every cell of the target widget from one output — a whole slider bank, a whole button grid. Saves adding one output per fader.'],
      ['✳ ALL cells (input)', 'Listens to every cell of the source widget, each as its own signal.'],
      ['ALL → ALL', 'The pair that mirrors a bank onto another one, fader 1 to fader 1, fader 2 to fader 2. Point a MIDI bank at an OSC bank and the same moves go out on both protocols.'],
      ['One cell → ALL', 'The other useful pair: a single fader drives the whole target bank at once.'],
      ['Range (per output)', 'In min/max and Out min/max on each output. The same source can then drive one output over its full travel and another over just part of it — or over the opposite one, by putting Out max below Out min.'],
      ['Negative output', 'An output range like -1…1 reaches the wire on OSC, which is just a float. MIDI and DMX are clamped to their protocol range instead, and the router shows those values in amber to say so.'],
    ],
    note: 'Right-click linking creates one router row per slaved cell, so unlinking is always clean. Widget cells always hold 0–1, so a negative headed for another widget lands at 0 — a fader has nowhere below the bottom to go. Point the negative at an OSC mapping instead.',
  },
  {
    id: 'w-math', tab: 'Math', title: 'Math / Merge',
    intro: 'Combines two cell sources into one result cell.',
    items: [
      ['Operation', 'add, subtract, multiply, min, max, avg, invert or abs.'],
      ['Source A / B', 'Any cell from any widget, listed by its real name. invert and abs use A only.'],
      ['Input range', 'The span the operation result is read against. Leave 0–1 to pass it through.'],
      ['Output range', 'Where that lands. Put Max below Min to invert.'],
      ['Clamp output', 'Keeps the final result inside 0–1.'],
    ],
  },
  {
    id: 'w-master', tab: 'Master Level', title: 'Master Level',
    intro: 'A master fader that multiplies everything going out on one protocol.',
    items: [
      ['Scales protocol', 'Which protocol this master governs: MIDI, OSC, Enttec, Art-Net or sACN.'],
      ['Orientation', 'Vertical or horizontal.'],
      ['Level', '100% passes values through untouched; 0% silences the protocol.'],
    ],
    note: 'It works across all pages, and moving it re-sends parked values so faders sitting still follow it. Two masters on the same protocol: the last one wins.',
  },
  {
    id: 'w-sub', tab: 'Submasters', title: 'Submasters',
    intro: 'A bank of scene faders, each holding a snapshot of the widgets it controls.',
    items: [
      ['Scenes', 'One column per scene, each with its own fader.'],
      ['Record', 'Stores the current state of the linked widgets into that scene.'],
      ['Flash', 'Momentarily takes the scene to full.'],
      ['HTP', 'Highest takes precedence — the strongest scene wins per channel.'],
      ['LTP', 'Latest takes precedence — the most recent move wins.'],
      ['Linked widgets', 'Which widgets this bank controls.'],
    ],
  },
  {
    id: 'w-cues', tab: 'Cues', title: 'Cues',
    intro: 'Snapshots of the whole desk, recalled with a fade.',
    items: [
      ['Record', 'Stores every widget value, the current link state, and the play/stop of anything with its own transport (LFO, Graph, Step Sequencer) into a cue.'],
      ['Scope · Pages', 'All pages by default, so a cue is a snapshot of the whole desk. Pick one page to narrow it.'],
      ['Scope · Widgets', 'ALL WIDGETS by default; the list follows the page above, so you can point a Cues widget at a single fader bank. Both dropdowns are in the Inspector and in the Live sidebar.'],
      ['Fade time', 'Seconds to cross-fade into the cue. Zero snaps instantly. The − and + buttons either side step it by 0.1s.'],
      ['Colour', 'The launch button colour.'],
      ['First / Prev / Next / Random / Last', 'Navigation, each with its own mapping so a footswitch can drive the show.'],
    ],
    note: 'Each cue is also a cell, so a cue can be fired from a Router or a button. The scope applies to cues you record from then on — ones already saved keep exactly what they captured. Transport state snaps on recall rather than fading, since it is on or off.',
  },
  {
    id: 'w-instance', tab: 'Instance', title: 'Instance',
    intro: 'A bound copy of another widget. Both show and drive the exact same value.',
    items: [
      ['Source widget', 'The widget being mirrored.'],
      ['Use', 'Put the original on one page and instances on the others, so one control appears everywhere.'],
    ],
    note: 'It has no runtime cells of its own — it reads and writes the source.',
  },
  {
    id: 'w-value', tab: 'Value Display', title: 'Value Display',
    intro: 'A read-only numeric readout of any cell.',
    items: [
      ['Source', 'Which widget and cell to read.'],
      ['Format', 'Percent, raw 0–1, or the value scaled through the cell mapping.'],
      ['Decimals', 'How many decimal places to show, 0 to 3.'],
    ],
  },
  {
    id: 'w-image', tab: 'Image', title: 'Image',
    intro: 'A picture layer. Click-through, so it never steals a touch.',
    items: [
      ['Source', 'A PNG or JPG, embedded into the project file.'],
      ['Layer', 'Under or over the other widgets.'],
      ['Blend mode', 'Screen, multiply, overlay and the rest of the CSS blend set.'],
      ['Opacity', 'Overall transparency.'],
    ],
  },
  {
    id: 'w-text', tab: 'Text', title: 'Text',
    intro: 'A static label, for titling and grouping your layout.',
    items: [
      ['Text', 'The content.'],
      ['Font', 'Family, weight, style, colour and alignment.'],
      ['Layer', 'Under or over the other widgets.'],
      ['Frame', 'None, outline or underline, with its own colour and thickness.'],
    ],
  },
  {
    id: 'w-manual', tab: 'Manual', title: 'Manual',
    intro: 'This widget. Drop it on a page to keep the documentation on the desk.',
    items: [
      ['Top row', 'Settings topics, one tab per connection, plus the shortcuts list.'],
      ['Bottom row', 'One tab per widget kind.'],
      ['Text size', 'Scales the body text — useful when the screen is lying flat on a table.'],
      ['Open tab', 'Which tab it shows when the project loads.'],
    ],
    note: 'Read-only: it sends nothing and has no cells, so it never shows up as a link source.',
  },
];
