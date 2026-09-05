import { useEffect, useReducer } from 'react';
import type { ClipboardMode } from './clipboard';

/**
 * The Dangerous Writing session run-state — a module-level singleton, like the
 * Timer plugin's store, so the app-header button + popover and the full-screen
 * overlay read one source of truth and stay in lockstep.
 *
 * It is target-agnostic: it never touches text itself. The caller supplies
 * {@link SessionHooks} — how to count words and how to wipe — which for this
 * plugin always points at the real open document
 * (`editor.setContent('', { resetHistory: true })`).
 *
 * The "danger" is a single rule: a fuse that burns down while you are *not*
 * typing. Every keystroke calls {@link activity} and resets it; if it ever
 * reaches zero, {@link fail} fires and the document is wiped. Reaching the goal
 * (time elapsed, or words written) calls {@link succeed} and the text is safe.
 */
export type Status = 'idle' | 'running' | 'success' | 'failed';
export type GoalType = 'time' | 'words';

export interface SessionConfig {
  goalType: GoalType;
  /** Target duration for a `time` goal, in seconds. */
  durationSec: number;
  /** Target word count for a `words` goal (words added since the session began). */
  wordTarget: number;
  /** Idle limit before a wipe, in seconds (already hardcore-adjusted). */
  fuseSec: number;
  /** Hardcore: shorter fuse + less warning. Surfaces read it to delay the visuals. */
  hardcore: boolean;
  /** How much of the clipboard stays usable during the run (see {@link ClipboardMode}). */
  clipboard: ClipboardMode;
  /** The file the session is armed on, for the safety bail-out. */
  startFileId?: string;
}

export interface SessionHooks {
  /** Current word count of the target document. */
  words(): number;
  /** Erase the target document. Irreversible. */
  wipe(): void;
}

/** End-of-session figures handed to the host feedback callbacks. */
export interface SessionStats {
  goalType: GoalType;
  /** Words written during the session (added since it began). */
  words: number;
  elapsedMs: number;
}

const TICK_MS = 100;
/** How long a finished result lingers on the overlay before it self-clears. */
const AUTO_RESET_MS = 6000;

const DEFAULT_CONFIG: SessionConfig = {
  goalType: 'time',
  durationSec: 600,
  wordTarget: 500,
  fuseSec: 5,
  hardcore: false,
  clipboard: 'all'
};

const safeWords = (hooks: SessionHooks): number => {
  try {
    return Math.max(0, Math.floor(hooks.words()));
  } catch {
    return 0;
  }
};

class DangerStore {
  status: Status = 'idle';
  config: SessionConfig = DEFAULT_CONFIG;
  /** Fraction of the fuse burned since the last keystroke (0 = safe, 1 = wiped). */
  dangerLevel = 0;
  /** Time-goal countdown, in ms. */
  remainingMs = 0;
  /** Live word count of the target document. */
  words = 0;
  wordsAtStart = 0;
  startedAt = 0;
  endedAt = 0;
  /** Whether the launcher popover is open (UI state shared with the overlay). */
  popoverOpen = false;

  /**
   * Host feedback, set once by the plugin in `onload` (mirrors Timer's
   * `onComplete`): e.g. confetti on success. Kept off the hot path so the store
   * stays pure/testable.
   */
  feedback: {
    onSuccess?: (stats: SessionStats) => void;
    onFail?: (stats: SessionStats) => void;
  } = {};

  private hooks: SessionHooks | null = null;
  private lastActivityAt = 0;
  private endsAt = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private autoReset: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Words written so far this session (never negative). */
  get progressWords(): number {
    return Math.max(0, this.words - this.wordsAtStart);
  }

  /** Begin a session against `hooks`'s target document. */
  start(config: SessionConfig, hooks: SessionHooks): void {
    this.clearTimers();
    this.config = config;
    this.hooks = hooks;
    this.status = 'running';
    const now = Date.now();
    this.startedAt = now;
    this.endedAt = 0;
    this.lastActivityAt = now;
    this.wordsAtStart = safeWords(hooks);
    this.words = this.wordsAtStart;
    this.endsAt = config.goalType === 'time' ? now + config.durationSec * 1000 : 0;
    this.remainingMs = config.goalType === 'time' ? config.durationSec * 1000 : 0;
    this.dangerLevel = 0;
    this.interval = setInterval(() => this.tick(), TICK_MS);
    this.notify();
  }

  /** A keystroke landed: reset the fuse and re-read progress. */
  activity(): void {
    if (this.status !== 'running' || !this.hooks) return;
    this.lastActivityAt = Date.now();
    this.words = safeWords(this.hooks);
    this.dangerLevel = 0;
    if (this.config.goalType === 'words' && this.progressWords >= this.config.wordTarget) {
      this.succeed();
      return;
    }
    this.notify();
  }

  /** Open/close the launcher popover (the document-header button toggles it). */
  setPopover(open: boolean): void {
    this.popoverOpen = open;
    this.notify();
  }

  /** End a session safely with no wipe (user bailed, or doc changed under us). */
  cancel(): void {
    if (this.status === 'idle') return;
    this.clearTimers();
    this.status = 'idle';
    this.dangerLevel = 0;
    this.hooks = null;
    this.notify();
  }

  /** Dismiss a finished (success/failed) result back to idle. */
  reset(): void {
    this.clearTimers();
    this.status = 'idle';
    this.dangerLevel = 0;
    this.hooks = null;
    this.notify();
  }

  private tick(): void {
    if (this.status !== 'running' || !this.hooks) return;
    const now = Date.now();
    this.words = safeWords(this.hooks);

    if (this.config.goalType === 'time') {
      this.remainingMs = Math.max(0, this.endsAt - now);
      if (this.remainingMs <= 0) {
        this.succeed();
        return;
      }
    } else if (this.progressWords >= this.config.wordTarget) {
      this.succeed();
      return;
    }

    const fuseMs = Math.max(1, this.config.fuseSec * 1000);
    const idleMs = now - this.lastActivityAt;
    this.dangerLevel = Math.min(1, idleMs / fuseMs);
    if (idleMs >= fuseMs) {
      this.fail();
      return;
    }
    this.notify();
  }

  private succeed(): void {
    this.clearTimers();
    const stats = this.stats();
    this.status = 'success';
    this.dangerLevel = 0;
    this.remainingMs = 0;
    this.endedAt = Date.now();
    this.notify();
    this.feedback.onSuccess?.(stats);
    this.scheduleAutoReset();
  }

  private fail(): void {
    this.clearTimers();
    const stats = this.stats(); // capture words BEFORE the wipe zeroes them
    this.status = 'failed';
    this.dangerLevel = 1;
    this.endedAt = Date.now();
    try {
      this.hooks?.wipe();
    } catch {
      /* no active editor; the run still ends as failed */
    }
    this.notify();
    this.feedback.onFail?.(stats);
    this.scheduleAutoReset();
  }

  private stats(): SessionStats {
    return {
      goalType: this.config.goalType,
      words: this.progressWords,
      elapsedMs: this.startedAt ? Date.now() - this.startedAt : 0
    };
  }

  private scheduleAutoReset(): void {
    this.autoReset = setTimeout(() => this.reset(), AUTO_RESET_MS);
  }

  private clearTimers(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.autoReset) {
      clearTimeout(this.autoReset);
      this.autoReset = null;
    }
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const dwStore = new DangerStore();

/** Subscribe a component to {@link dwStore}; re-renders on every change. */
export function useDangerStore(): DangerStore {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => dwStore.subscribe(force), []);
  return dwStore;
}
