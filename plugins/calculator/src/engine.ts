/**
 * The calculator itself — a pure state machine, no React and no host API.
 *
 * Every surface (floating card, sheet, chip) is a view of one {@link CalcState},
 * and every button, every keystroke and every command goes through
 * {@link applyKey}. Keeping the arithmetic here rather than in the components is
 * what makes the four-surface widget cheap: the surfaces only draw, and the part
 * that can actually be wrong is unit-testable on its own.
 */

/** An arithmetic operator, in the order the keypad lays them out. */
export type Operator = 'add' | 'sub' | 'mul' | 'div';

/** Every key the machine understands. Buttons and the keyboard both emit these. */
export type CalcKey =
  | { type: 'digit'; value: string }
  | { type: 'decimal' }
  | { type: 'operator'; value: Operator }
  | { type: 'equals' }
  | { type: 'clear' }
  | { type: 'clearEntry' }
  | { type: 'backspace' }
  | { type: 'negate' }
  | { type: 'percent' }
  | { type: 'memory'; value: 'clear' | 'recall' | 'store' | 'add' | 'sub' };

export interface CalcState {
  /**
   * The digits on the display, as typed — a string, not a number, because
   * `'0.'` and `'1.50'` are states a user can be in and a number can't hold.
   */
  entry: string;
  /** Left operand of the pending operation. */
  accumulator: number | null;
  /** Operator waiting for its right operand. */
  pending: Operator | null;
  /** `true` while `entry` is a result the next digit should replace, not extend. */
  replace: boolean;
  /** Memory register (MS / MR / M+ / M−). Survives `clear`, like every calculator. */
  memory: number;
  /** Whether memory has ever been written — drives the `M` indicator. */
  memorySet: boolean;
  /** Last `operator + right operand`, replayed when `=` is pressed again. */
  repeat: { op: Operator; operand: number } | null;
  /** Set by a division by zero. Only `clear` / `clearEntry` get out of it. */
  error: boolean;
  /** The expression trail shown above the entry, e.g. `12 × 4 =`. */
  trail: string;
}

export const OPERATOR_SYMBOL: Record<Operator, string> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷'
};

/** Longest entry we accept. Past ~16 digits a double stops being exact anyway. */
const MAX_DIGITS = 16;

export const initialState = (): CalcState => ({
  entry: '0',
  accumulator: null,
  pending: null,
  replace: true,
  memory: 0,
  memorySet: false,
  repeat: null,
  error: false,
  trail: ''
});

/**
 * Binary doubles turn `0.1 + 0.2` into `0.30000000000000004`, which is correct
 * and useless on a calculator display. Rounding every intermediate result to 12
 * significant digits hides the noise while leaving far more precision than the
 * display shows.
 */
export const roundResult = (n: number): number =>
  Number.isFinite(n) ? Number.parseFloat(n.toPrecision(12)) : n;

/** The numeric value of the display. `Error` and a bare `-` read as 0. */
export const valueOf = (state: CalcState): number => {
  const n = Number.parseFloat(state.entry);
  return Number.isFinite(n) ? n : 0;
};

const apply = (left: number, op: Operator, right: number): number => {
  switch (op) {
    case 'add':
      return left + right;
    case 'sub':
      return left - right;
    case 'mul':
      return left * right;
    case 'div':
      return left / right;
  }
};

/** A result written back into `entry`, trimmed of the exponent-free long tail. */
const toEntry = (n: number): string => {
  if (!Number.isFinite(n)) return 'Error';
  const s = String(roundResult(n));
  return s === '-0' ? '0' : s;
};

const errored = (state: CalcState): CalcState => ({
  ...state,
  entry: 'Error',
  accumulator: null,
  pending: null,
  repeat: null,
  replace: true,
  error: true,
  trail: ''
});

/**
 * Advance the machine by one key. Always returns a new state — the store swaps
 * it in wholesale, so React sees one changed reference per keypress.
 *
 * While `error` is set only `clear` / `clearEntry` (and the memory keys, which
 * never read the display) do anything: a calculator that silently resumed
 * arithmetic on top of a division by zero would be reporting a number nobody
 * computed.
 */
export function applyKey(state: CalcState, key: CalcKey): CalcState {
  if (state.error && key.type !== 'clear' && key.type !== 'clearEntry' && key.type !== 'memory') {
    return state;
  }

  switch (key.type) {
    case 'digit': {
      if (state.replace) return { ...state, entry: key.value, replace: false };
      if (state.entry.replace(/[-.]/g, '').length >= MAX_DIGITS) return state;
      const entry = state.entry === '0' ? key.value : state.entry + key.value;
      return { ...state, entry, replace: false };
    }

    case 'decimal': {
      if (state.replace) return { ...state, entry: '0.', replace: false };
      if (state.entry.includes('.')) return state;
      return { ...state, entry: `${state.entry}.`, replace: false };
    }

    case 'operator': {
      const symbol = OPERATOR_SYMBOL[key.value];
      // Pressing another operator before typing the right operand just swaps the
      // operator — `5 + ×` should mean `5 ×`, not `5 + 5 ×`.
      if (state.pending !== null && state.replace && state.accumulator !== null) {
        return {
          ...state,
          pending: key.value,
          trail: `${toEntry(state.accumulator)} ${symbol}`
        };
      }
      const right = valueOf(state);
      const left =
        state.pending !== null && state.accumulator !== null
          ? apply(state.accumulator, state.pending, right)
          : right;
      if (!Number.isFinite(left)) return errored(state);
      return {
        ...state,
        entry: toEntry(left),
        accumulator: roundResult(left),
        pending: key.value,
        repeat: null,
        replace: true,
        trail: `${toEntry(left)} ${symbol}`
      };
    }

    case 'equals': {
      // `=` with a pending operation closes it; `=` again replays the last
      // operator + right operand, the way every pocket calculator does.
      const op = state.pending ?? state.repeat?.op ?? null;
      if (op === null) return { ...state, replace: true };
      const left = state.pending !== null ? (state.accumulator ?? valueOf(state)) : valueOf(state);
      const right = state.pending !== null ? valueOf(state) : (state.repeat?.operand ?? 0);
      const result = apply(left, op, right);
      if (!Number.isFinite(result)) return errored(state);
      return {
        ...state,
        entry: toEntry(result),
        accumulator: null,
        pending: null,
        repeat: { op, operand: right },
        replace: true,
        trail: `${toEntry(left)} ${OPERATOR_SYMBOL[op]} ${toEntry(right)} =`
      };
    }

    case 'clear':
      return { ...initialState(), memory: state.memory, memorySet: state.memorySet };

    case 'clearEntry':
      return { ...state, entry: '0', replace: true, error: false };

    case 'backspace': {
      if (state.replace) return state;
      const next = state.entry.slice(0, -1);
      return { ...state, entry: next === '' || next === '-' ? '0' : next };
    }

    case 'negate': {
      if (state.entry === '0' || state.entry === 'Error') return state;
      const entry = state.entry.startsWith('-') ? state.entry.slice(1) : `-${state.entry}`;
      return { ...state, entry };
    }

    case 'percent': {
      // `200 + 10 %` is 10% *of 200* — the pending left operand is the base.
      // Standalone, `%` is just "divide by a hundred".
      const v = valueOf(state);
      const base =
        (state.pending === 'add' || state.pending === 'sub') && state.accumulator !== null
          ? state.accumulator
          : 1;
      return { ...state, entry: toEntry(roundResult((v / 100) * base)), replace: true };
    }

    case 'memory': {
      switch (key.value) {
        case 'clear':
          return { ...state, memory: 0, memorySet: false };
        case 'store':
          return { ...state, memory: roundResult(valueOf(state)), memorySet: true, replace: true };
        case 'add':
          return {
            ...state,
            memory: roundResult(state.memory + valueOf(state)),
            memorySet: true,
            replace: true
          };
        case 'sub':
          return {
            ...state,
            memory: roundResult(state.memory - valueOf(state)),
            memorySet: true,
            replace: true
          };
        case 'recall':
          return state.memorySet
            ? { ...state, entry: toEntry(state.memory), replace: true, error: false }
            : state;
      }
    }
  }
}

/** Map a physical keystroke to a key, or `null` when we don't own that press. */
export function keyFromEvent(event: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): CalcKey | null {
  // Never swallow a shortcut — `Cmd+C` on a calculator is still "copy".
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const k = event.key;
  if (k >= '0' && k <= '9') return { type: 'digit', value: k };
  switch (k) {
    case '.':
    case ',':
      return { type: 'decimal' };
    case '+':
      return { type: 'operator', value: 'add' };
    case '-':
      return { type: 'operator', value: 'sub' };
    case '*':
    case 'x':
    case 'X':
      return { type: 'operator', value: 'mul' };
    case '/':
      return { type: 'operator', value: 'div' };
    case '=':
    case 'Enter':
      return { type: 'equals' };
    case 'Backspace':
      return { type: 'backspace' };
    case 'Delete':
      return { type: 'clearEntry' };
    case 'Escape':
      return { type: 'clear' };
    case '%':
      return { type: 'percent' };
    default:
      return null;
  }
}

export interface FormatOptions {
  /** Group thousands with the locale's separator. */
  group: boolean;
  /** Maximum fraction digits shown. The stored value keeps full precision. */
  decimals: number;
  /** BCP-47 tag for the separators — the app's live UI language. */
  locale: string;
}

/**
 * Format the display. Only *shown* precision is capped: the state keeps the full
 * value, so chaining off a rounded-looking number still computes exactly.
 *
 * Numbers too large or too small for a readable fixed form fall back to
 * exponential rather than printing twenty zeros in a 16 rem card.
 */
export function formatDisplay(entry: string, options: FormatOptions): string {
  if (entry === 'Error') return entry;
  const n = Number.parseFloat(entry);
  if (!Number.isFinite(n)) return entry;
  // A trailing `.` or `-` is mid-typing state; formatting it would delete the
  // very character the user just pressed.
  if (/[.]$/.test(entry) || entry === '-') return entry;
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e16 || abs < 1e-9)) return n.toExponential(6).replace('e', 'e ');
  const [, fraction = ''] = entry.split('.');
  return n.toLocaleString(options.locale, {
    useGrouping: options.group,
    // Keep the zeros the user actually typed (`1.50` stays `1.50`), but never
    // invent more than `decimals`.
    minimumFractionDigits: Math.min(fraction.length, options.decimals),
    maximumFractionDigits: options.decimals
  });
}
