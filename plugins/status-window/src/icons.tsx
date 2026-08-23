/**
 * The character's icon, drawn the way the project tree draws a sheet's.
 *
 * Same priority as the tree: **portrait thumbnail → custom emoji → glyph**,
 * where the glyph is the sheet's category icon (a character sheet gets the
 * person, a location sheet the map pin) and `Layers` is the sheet default.
 * A writer who set a portrait or an emoji on their sheet should see the same
 * thing here that the sidebar shows them — anything else reads as a different
 * character.
 *
 * The SVGs are the app's own sprite set (Lucide re-stroked to 1.5), inlined
 * because the host doesn't expose its icon component to plugins. The emoji test
 * is the app's `isEmoji` verbatim, single-codepoint quirks included — matching
 * its behaviour matters more than improving on it.
 */
import * as React from 'react';
import type { Character } from './model';

/** The app's `isEmoji` — a single emoji character, not ZWJ sequences. */
export function isEmoji(value: string | undefined): boolean {
  if (!value) return false;
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?|\p{Emoji_Modifier_Base})$/u;
  return emojiRegex.test(value.trim());
}

/** Paths from the app's sprite files, keyed by sheet category. */
const GLYPHS: Record<string, React.ReactNode> = {
  character: (
    <>
      <path d="M18 20a6 6 0 0 0-12 0" />
      <circle cx="12" cy="10" r="4" />
      <circle cx="12" cy="12" r="10" />
    </>
  ),
  event: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  organization: (
    <>
      <path d="M10 12h4" />
      <path d="M10 8h4" />
      <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
      <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    </>
  ),
  item: (
    <>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  location: (
    <>
      <path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0" />
      <circle cx="12" cy="8" r="2" />
      <path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712" />
    </>
  ),
  worldbuilding: (
    <>
      <path d="M21.54 15H17a2 2 0 0 0-2 2v4.54" />
      <path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17" />
      <path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05" />
      <circle cx="12" cy="12" r="10" />
    </>
  )
};

/** The sheet default (`Layers`) — also `other`, also anything unrecognised. */
const LAYERS = (
  <>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
    <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
    <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
  </>
);

export const CharacterIcon: React.FC<{ character: Character }> = ({ character }) => {
  if (character.portraitUrl) {
    return <img className="pnsv-sw-charicon-img" src={character.portraitUrl} alt="" />;
  }
  if (isEmoji(character.icon)) {
    return <span className="pnsv-sw-charicon-emoji">{character.icon}</span>;
  }
  // A local character isn't a sheet — it gets the person outright. A sheet
  // without a portrait or emoji gets its category's glyph, like the tree.
  // (A custom *named* icon can't be honoured here — the sprite set lives in the
  // host — so it degrades to the category glyph, which is the tree's own
  // fallback for an unrecognised name.)
  const glyph = character.fileId
    ? (GLYPHS[character.sheetCategory ?? ''] ?? LAYERS)
    : GLYPHS['character'];
  return (
    <svg
      className="pnsv-sw-charicon-glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
};
