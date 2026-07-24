/** Word count used by the practice pane (matches the editor's plain split). */
export const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

/** `m:ss` clock for a remaining/elapsed duration in ms. */
export const formatClock = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/** `Xm Ys` human duration for the end-of-session stats. */
export const formatElapsed = (ms: number): string => {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

/**
 * Danger fraction (0..1) at which the visual warning kicks in. Hardcore keeps the
 * screen calm until the very last moment, mirroring the app's "almost no warning".
 */
export const warnThreshold = (hardcore: boolean): number => (hardcore ? 0.7 : 0.25);

/**
 * Eased 0..1 warning intensity from the raw danger level, so the red wash stays
 * invisible until {@link warnThreshold} and then ramps quickly to full.
 */
export const warnIntensity = (danger: number, hardcore: boolean): number => {
  const from = warnThreshold(hardcore);
  if (danger <= from) return 0;
  return Math.min(1, (danger - from) / (1 - from));
};
