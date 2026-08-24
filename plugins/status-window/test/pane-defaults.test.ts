/**
 * Which character the pane opens on.
 *
 * Reported 2026-08: "상태창이 기본적으로 현재 열려있는 문서에 적용되면 편할 것
 * 같습니다." The recording opens a character sheet named `C`, opens the pane, and
 * gets `세계관` — the first sheet in the project — then has to pick `C` by hand.
 *
 * Sheet-backed characters *are* project files, so when the open file is one of
 * them the answer is already on screen.
 */
import { describe, expect, it } from 'vitest';
import { defaultCharacterId } from '../src/storage';
import type { Character } from '../src/model';

const CHARACTERS: Character[] = [
  { id: 'f-world', name: '세계관', fileId: 'f-world' },
  { id: 'f-status', name: '상태창', fileId: 'f-status' },
  { id: 'f-a', name: 'A', fileId: 'f-a' },
  { id: 'f-b', name: 'B', fileId: 'f-b' },
  { id: 'f-c', name: 'C', fileId: 'f-c' },
  { id: 'local:1', name: '무진' }
];

describe('the pane opens on the file the writer is looking at', () => {
  it('picks the open sheet when it is one of the characters', () => {
    expect(defaultCharacterId(CHARACTERS, 'f-c')).toBe('f-c');
    expect(defaultCharacterId(CHARACTERS, 'f-a')).toBe('f-a');
  });

  /**
   * A chapter is not a character. There is nothing better to offer than the
   * first entry, and offering nothing would leave the pane empty on the surface
   * it is mainly used from.
   */
  it('falls back to the first character in a chapter', () => {
    expect(defaultCharacterId(CHARACTERS, 'doc-31')).toBe('f-world');
    expect(defaultCharacterId(CHARACTERS, undefined)).toBe('f-world');
  });

  it('a local character is never mistaken for the open file', () => {
    expect(defaultCharacterId(CHARACTERS, 'local:1')).toBe('local:1');
    expect(defaultCharacterId([{ id: 'local:1', name: '무진' }], 'doc-31')).toBe('local:1');
  });

  it('has no answer when the project has no characters', () => {
    expect(defaultCharacterId([], 'f-c')).toBeUndefined();
    expect(defaultCharacterId([], undefined)).toBeUndefined();
  });
});
