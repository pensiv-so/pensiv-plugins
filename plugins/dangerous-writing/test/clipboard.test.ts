// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HostApi } from '@pensiv/plugin-sdk';
import { installClipboardGuard, toClipboardMode } from '../src/clipboard';

/**
 * The clipboard lock is the other half of the dare: copying the page out is a
 * backup of what might burn, and pasting fills a word goal with text the writer
 * never typed. What matters is that the block is scoped — to the document
 * editor, and to the life of the session — so it never leaks into the rest of
 * the app or outlasts the run.
 */
const toast = vi.fn();
const app = {
  app: { locale: 'en' },
  ui: { toast }
} as unknown as HostApi;

let editor: HTMLElement;
let outside: HTMLElement;
let uninstall = () => {};

/** Dispatch a real clipboard-ish event and report whether the guard killed it. */
function fire(target: EventTarget, type: string): boolean {
  const event = new Event(type, { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('installClipboardGuard', () => {
  beforeEach(() => {
    toast.mockClear();
    document.body.innerHTML = '<div class="ProseMirror"><p>armed</p></div><div id="other"></div>';
    editor = document.querySelector('.ProseMirror p') as HTMLElement;
    outside = document.getElementById('other') as HTMLElement;
  });

  afterEach(() => {
    uninstall();
    uninstall = () => {};
  });

  it('blocks every clipboard route into and out of the editor in `all`', () => {
    uninstall = installClipboardGuard(app, 'all');
    for (const type of ['paste', 'drop', 'copy', 'cut', 'dragstart']) {
      expect(fire(editor, type), type).toBe(true);
    }
  });

  it('blocks only the ways text gets in, in `paste`', () => {
    uninstall = installClipboardGuard(app, 'paste');
    expect(fire(editor, 'paste')).toBe(true);
    expect(fire(editor, 'drop')).toBe(true);
    expect(fire(editor, 'copy')).toBe(false);
    expect(fire(editor, 'cut')).toBe(false);
  });

  // The editor's right-click menu copies and pastes through `navigator.clipboard`,
  // never firing a clipboard event — if the menu opens, the lock is bypassable.
  it('keeps the editor context menu shut in either blocking mode', () => {
    uninstall = installClipboardGuard(app, 'all');
    expect(fire(editor, 'contextmenu')).toBe(true);
    uninstall();
    uninstall = installClipboardGuard(app, 'paste');
    expect(fire(editor, 'contextmenu')).toBe(true);
    expect(fire(outside, 'contextmenu')).toBe(false);
  });

  it('blocks nothing in `off`', () => {
    uninstall = installClipboardGuard(app, 'off');
    expect(fire(editor, 'paste')).toBe(false);
    expect(fire(editor, 'copy')).toBe(false);
  });

  it('leaves the rest of the app alone', () => {
    uninstall = installClipboardGuard(app, 'all');
    expect(fire(outside, 'copy')).toBe(false);
    expect(fire(outside, 'paste')).toBe(false);
  });

  it('leaves other text fields alone', () => {
    uninstall = installClipboardGuard(app, 'all');
    const input = document.createElement('input');
    outside.appendChild(input);
    expect(fire(input, 'copy')).toBe(false);
  });

  it('says why, but only once per cooldown', () => {
    uninstall = installClipboardGuard(app, 'all');
    fire(editor, 'paste');
    fire(editor, 'paste');
    fire(editor, 'copy');
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0]?.[0]).toMatch(/pasting/i);
  });

  it('stops blocking once the session ends', () => {
    installClipboardGuard(app, 'all')();
    expect(fire(editor, 'paste')).toBe(false);
  });

  it('falls back to the strict mode for an unknown stored value', () => {
    expect(toClipboardMode('paste')).toBe('paste');
    expect(toClipboardMode(undefined)).toBe('all');
    expect(toClipboardMode('nonsense')).toBe('all');
  });
});
