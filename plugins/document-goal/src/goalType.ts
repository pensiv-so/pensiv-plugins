/** A goal's unit: words, or characters. */
export type GoalType = 'words' | 'characters';

/**
 * The goal's unit until the writer picks one. Korean and Japanese are counted in characters
 * (the editor's own counter does, and a word there runs 3 to 4 characters), so their goals
 * start in characters; every other language in words. Read, never written: a default stored
 * on first load would be a settings write from every device (PNSV-244).
 */
export function defaultGoalType(locale: string | undefined): GoalType {
  const language = (locale ?? '').toLowerCase();
  return language.startsWith('ko') || language.startsWith('ja') ? 'characters' : 'words';
}
