// Turns a KeyboardEvent.code into something readable on a key cap.
// We key off `code` (physical position) rather than `key` so a binding does not
// change meaning with the keyboard layout or when Shift is held.

const NAMED: Record<string, string> = {
  Space: 'SPACE',
  Enter: 'ENTER',
  NumpadEnter: 'NUM ENTER',
  Tab: 'TAB',
  Backspace: 'BKSP',
  CapsLock: 'CAPS',
  ShiftLeft: 'L SHIFT', ShiftRight: 'R SHIFT',
  ControlLeft: 'L CTRL', ControlRight: 'R CTRL',
  AltLeft: 'L ALT', AltRight: 'R ALT',
  MetaLeft: 'L WIN', MetaRight: 'R WIN',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Semicolon: ';', Quote: "'", Backquote: '`',
  Comma: ',', Period: '.', Slash: '/',
  NumpadAdd: 'NUM +', NumpadSubtract: 'NUM -',
  NumpadMultiply: 'NUM *', NumpadDivide: 'NUM /', NumpadDecimal: 'NUM .',
  PageUp: 'PG UP', PageDown: 'PG DN', Home: 'HOME', End: 'END',
  Insert: 'INS', Delete: 'DEL',
  ScrollLock: 'SCRL', Pause: 'PAUSE', PrintScreen: 'PRTSC', NumLock: 'NUM LK',
};

export function keyCapLabel(code: string): string {
  if (NAMED[code]) return NAMED[code];
  if (code.startsWith('Key')) return code.slice(3);          // KeyA → A
  if (code.startsWith('Digit')) return code.slice(5);        // Digit1 → 1
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  if (/^F\d{1,2}$/.test(code)) return code;                  // F1…F12
  return code;
}

// Keys the app itself owns in Live mode. Binding them would either be swallowed
// or fight with the app, so the editor refuses them.
export const RESERVED_CODES = new Set(['Escape']);
