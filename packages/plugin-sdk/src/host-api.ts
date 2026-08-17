/**
 * Host API v1 — the single, stable, fully-typed surface a plugin talks to.
 *
 * A plugin never touches raw TipTap / Jotai / DOM objects; it only ever calls
 * through this interface, reached as `this.app` (on the {@link Plugin} base
 * class) or `props.app` (inside a widget component). The concrete object is
 * built per-plugin by a host *adapter* — `src/desktop/renderer/app/lib/plugins/
 * host-api.ts` on desktop — which is responsible for enforcing the plugin's
 * granted {@link PluginPermission}s on every gated call.
 *
 * Methods marked `[permission]` in their docs throw if the plugin did not
 * declare and was not granted that permission. The dispatcher is synchronous for
 * in-process installs today; the shape is chosen so it can become an async RPC
 * bridge when a sandbox lands (deferred phase) without changing call sites.
 *
 * Every member is JSDoc'd on purpose: for an external coding AI the types *are*
 * the documentation, so each name + comment must let it pick the right call.
 */

/** Cancels a subscription created by an `on(...)` / `decorate(...)` call. */
export type Unsub = () => void;

/** A document position range, in ProseMirror absolute positions. */
export interface EditorRange {
  from: number;
  to: number;
}

/** `[scope]` controls whether a value rides settings sync or stays on-device. */
export interface StorageOptions {
  /** `synced` rides Firebase/SQLite/CRDT sync; `local` stays on this device. */
  scope?: 'local' | 'synced';
}

/**
 * Counting options for {@link EditorApi.count}. `character` mode honors the
 * include flags (whether spaces / indents / quotes / parentheses / other special
 * characters count); `word` mode ignores them. The quote / parenthesis records
 * are keyed by glyph group (e.g. `straightDouble`, `curlyDouble`, `guillemets`;
 * `round`, `square`, `curlyBraces`, `angle`, `cjk`) — omit a key to keep the
 * host default (counted). Serializable; mirrors the editor's word-counter config.
 */
export interface CountOptions {
  countType?: 'word' | 'character';
  includeSpace?: boolean;
  includeIndent?: boolean;
  includeSpecialChars?: boolean;
  includeQuotes?: Record<string, boolean>;
  includeParentheses?: Record<string, boolean>;
}

export interface EditorApi {
  /** Plain text of the active document. */
  getText(): string;
  /**
   * Count the active document. With no `options`, uses the user's configured
   * editor word-counter (the "inherit" path). With `options`, counts per those
   * rules — e.g. `{ countType: 'word' }` for words, or `{ countType: 'character',
   * includeSpace: false }` for a custom character count. `[editor.read]`
   */
  count(options?: CountOptions): number;
  /** The user's configured editor word-counter as {@link CountOptions} (for "inherit"). `[editor.read]` */
  wordCounter(): CountOptions;
  /** ProseMirror document as JSON. Opaque on purpose — keeps the contract stable. */
  getDoc(): unknown;
  /** Current selection as an absolute-position range. */
  getSelection(): EditorRange;
  /** Insert text at the cursor. `[editor.write]` */
  insert(text: string): void;
  /** Replace the current selection with text. `[editor.write]` */
  replaceSelection(text: string): void;
  /**
   * Replace the whole document with `doc` — a ProseMirror JSON document
   * (as returned by {@link getDoc}) or a plain string; pass `''` to empty it.
   *
   * `options.resetHistory: true` also clears the undo/redo stack, so the change
   * cannot be recovered with undo — e.g. "dangerous writing" wiping the document
   * for real. `[editor.write]`
   */
  setContent(doc: unknown, options?: { resetHistory?: boolean }): void;
  /**
   * Run a named editor command (e.g. `toggleBold`), optionally with arguments.
   *
   * The arguments are how a plugin drives **its own** commands — the ones its
   * `registerEditorExtension` added — with data the command needs but the
   * selection can't carry, e.g. `runCommand('setMyAnchor', { id }, range)` from a
   * menu item that must act on the span the user had highlighted rather than on
   * wherever the caret ended up. Keep them JSON-serializable: the in-process host
   * passes them through untouched, but a sandboxed one has to send them across a
   * boundary. `[editor.write]`
   */
  runCommand(name: string, ...args: unknown[]): void;
  /** Subscribe to editor events. Returns an unsubscribe. */
  on(event: 'update' | 'selectionUpdate', cb: () => void): Unsub;
  /** Add read-only decorations over ranges; returns an unsubscribe. `[editor.read]` */
  decorate(ranges: EditorRange[]): Unsub;
}

export type {
  ProjectApi,
  ProjectFile,
  ProjectFileContent,
  ProjectFileType,
  ProjectEntityType,
  ProjectPlotCard,
  ProjectPlotPartCard,
  ProjectRelationship,
  ProjectQuery,
  ProjectFilePatch,
  ProjectFileDraft,
  ProjectLinkDraft,
  ProjectChangeKind
} from './project-api';

/** Words + characters, used for both targets and progress counts. */
export interface SessionProgress {
  words: number;
  chars: number;
}

/** Today's writing totals: what was added, removed, and the net (added − removed). */
export interface SessionTotals {
  added: SessionProgress;
  removed: SessionProgress;
  /** `added − removed`, floored at 0 per field. */
  net: SessionProgress;
  /**
   * Pasted content, tracked separately from typed `added` (pastes aren't typed
   * prose). Absent on hosts from before this feature; granular character rules
   * (`countToday`) don't filter pasted text — it counts in full.
   */
  pasted?: SessionProgress;
}

export interface SessionApi {
  /** Net words written today (added − removed), across the account. `[session]` */
  wordsToday(): number;
  /** Active writing time today, in milliseconds. `[session]` */
  activeMs(): number;
  /**
   * Today's added / removed / net words & characters, aggregated across all of the
   * user's devices (server baseline + local + in-flight edits). Read synchronously
   * from a short-TTL cache the host keeps warm; subscribe with `on('change')` to
   * re-read after typing or cross-device sync. `[session]`
   */
  today(): SessionTotals;
  /**
   * Like {@link today}, but counts characters under granular rules — the same
   * {@link CountOptions} shape as `editor.count`, so a plugin can mirror the
   * user's word-counter (e.g. exclude spaces or curly quotes). `words` are
   * unaffected by character rules; `chars` reflect the rules. Deltas captured
   * before this feature (or by older clients/devices) can't be filtered
   * retroactively and count in full. With no `options`, equals {@link today}.
   * Read synchronously from the same warm cache. `[session]`
   */
  countToday(options?: CountOptions): SessionTotals;
  /**
   * Per-day writing history, oldest first and zero-filled — characters, words,
   * active writing time and session count for each local calendar day in the
   * window. `[session]`
   *
   * Async, unlike the rest of this API: history is served by the account's
   * server-side session record (local storage keeps roughly a week), cached
   * briefly per window. The window defaults to the trailing 30 days; pass
   * `days` for a trailing window or `from`/`to` (`YYYY-MM-DD`, inclusive, local
   * days) for an explicit one. Windows longer than 400 days are trimmed from the
   * `from` end.
   *
   * The last day is overlaid with the same live numbers {@link today} returns, so
   * a widget showing both can't disagree with itself. Rejects when offline or
   * signed out — catch it and render a placeholder.
   *
   * ```ts
   * const days = await app.session.history({ days: 7 });
   * const minutes = days.reduce((sum, d) => sum + d.activeMs, 0) / 60000;
   * ```
   */
  history(range?: { from?: string; to?: string; days?: number }): Promise<SessionHistoryDay[]>;
  /**
   * Subscribe to writing-session events. `'change'` fires whenever today's totals
   * change (the common case for a progress widget); the others mark write
   * start/stop and a periodic tick. Returns an unsubscribe. `[session]`
   */
  on(event: 'change' | 'write-start' | 'write-stop' | 'tick', cb: () => void): Unsub;
}

/** One day of {@link SessionApi.history}. */
export interface SessionHistoryDay {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  added: SessionProgress;
  removed: SessionProgress;
  /** `added − removed`, floored at 0 per field — the same rule the daily goal uses. */
  net: SessionProgress;
  /** Active writing time that day, in milliseconds. */
  activeMs: number;
  /** Writing sessions started that day. */
  sessions: number;
}

export interface StorageApi {
  /** Read a per-plugin value. Namespaced to this plugin; never leaks across plugins. */
  get<T = unknown>(key: string, options?: StorageOptions): T | undefined;
  /** Write a per-plugin value. `synced` scope requires `[storage.synced]`. */
  set(key: string, value: unknown, options?: StorageOptions): void;
  /**
   * Subscribe to changes of `key` from **any pane or window** — fires when this
   * plugin writes the key in another split pane (same window) or another app
   * window. Lets a pane/widget stay in sync with the same plugin elsewhere.
   * Returns an unsubscribe.
   */
  on(key: string, callback: (value: unknown) => void): Unsub;
}

/** Options for {@link UiApi.openFile}. */
export interface OpenFileOptions {
  /**
   * A span to reveal once the file's editor is ready — it is scrolled into view
   * and briefly pulse-highlighted, the same feedback the app uses for its own
   * jump-to-text navigation. Positions are ProseMirror absolute positions, as
   * handed out by {@link SurfaceTarget.range} and `editor.getSelection()`.
   *
   * The request is held until that file's editor mounts, so it works whether the
   * file was already open, in a background tab, or not open at all. A range that
   * no longer exists (the text was deleted) is dropped without an error.
   */
  range?: EditorRange;
  /** Open beside the current pane instead of in it. */
  split?: boolean;
}

/** Options for {@link UiApi.openSheet}. */
export interface OpenSheetOptions {
  /**
   * Header title for the host's sheet chrome (a dialog on desktop, a bottom
   * sheet on mobile). Falls back to a generic host label when omitted.
   */
  title?: string;
}

export interface UiApi {
  /** Show a transient toast. */
  toast(message: string): void;
  /**
   * Open a host-rendered sheet with the given content node. One at a time — a
   * second call replaces the first. The host draws the chrome (title, close);
   * the plugin supplies only the body.
   */
  openSheet(node: unknown, options?: OpenSheetOptions): void;
  /**
   * Close the sheet this plugin opened with {@link openSheet} — for pickers,
   * where choosing a row is also the dismissal. No-op when nothing is open.
   */
  closeSheet(): void;
  /** Open a plugin-contributed full pane/tab (see `Plugin.registerPane`) in the split view. */
  openPane(pluginPaneId: string): void;
  /**
   * Open one of the project's files in the split view — the navigation half of
   * `app.project`, so a plugin's list of results can behave like the app's own
   * (click a row, land on the text).
   *
   * The file's type is resolved by the host, so an id is enough. Pass
   * `options.range` to land on a specific span. No-op (with a console warning)
   * when no project view is mounted or the id isn't a file in it. `[project.read]`
   *
   * ```ts
   * app.ui.openFile(anchor.fileId, { range: anchor.range });
   * ```
   */
  openFile(fileId: string, options?: OpenFileOptions): void;
  /** Open this plugin's own settings page (its `addSettingTab` form). */
  openSettings(): void;
}

export interface ClipboardApi {
  readText(): Promise<string>;
  /** `[clipboard]` */
  writeText(text: string): Promise<void>;
}

export interface PlatformApi {
  clipboard: ClipboardApi;
  /** Post an OS / in-app notification. `[notifications]` */
  notify(title: string, body?: string): void;
  /** Play a bundled sound by name (e.g. `Ping`). */
  playSound(name: string): void;
  /** High-resolution-ish current time in ms (host clock). */
  now(): number;
  /** Run `cb` after `ms`. Returns an unsubscribe that cancels it. */
  timer(ms: number, cb: () => void): Unsub;
  /**
   * Fetch a URL. `[net:<host>]` — only hosts the plugin declared are allowed.
   * `init` / the result are kept loosely typed here so the shared contract
   * stays free of DOM lib types; the desktop adapter resolves them to the real
   * `RequestInit` / `Response`.
   */
  fetch(url: string, init?: unknown): Promise<unknown>;
  /** Open a URL in the user's default OS browser. */
  openExternal(url: string): void;
  /**
   * Config for embedding a live web page via an Electron `<webview>` (the
   * in-app browser). `undefined` when the host can't host a webview (web /
   * mobile), so a pane can degrade gracefully. The `partition` is a host-managed
   * session (its preload + new-window IPC are wired by the host) — render
   * `<webview partition={cfg.partition} webpreferences={cfg.webpreferences}
   * allowpopups />` and drive it with the element's own methods/events.
   * Privileged: gated to verified-tier plugins.
   */
  readonly webviewConfig?: { partition: string; webpreferences: string };
}

/** One file selected in the focused pane. */
export interface PaneSelectionItem {
  id: string;
  /** The content type — a file type, or a route-ish pane content like `tasks`. */
  type: string;
}

/**
 * The focused split-view pane. Distinct from {@link AppApi}, which answers "what
 * is the user looking at"; this answers "in which pane, and what is selected
 * there" — the context a pane-scoped surface (side pane, pane toolbar, context
 * menu) needs to act on the right thing.
 */
export interface PaneApi {
  /** Id of the focused pane, or `undefined` outside a project view. */
  readonly id?: string;
  /**
   * Every file selected in the focused pane, in pane order. One entry in the
   * ordinary case; more when the user multi-selects. The first entry is the
   * pane's primary content and matches `app.app.fileId`.
   */
  readonly selection: PaneSelectionItem[];
  /**
   * Fires when the focused pane, its file, or its selection changes. Returns an
   * unsubscribe.
   */
  on(event: 'change', cb: () => void): Unsub;
}

export interface AppApi {
  /** The project currently in view, if any. */
  readonly projectId?: string;
  /** The file currently in view, if any. */
  readonly fileId?: string;
  /**
   * The focused file's type — `document` | `sheet` | `plotboard` | `folder` |
   * `canvas` | `task` (or undefined when no file is focused). Use it to scope a
   * widget to one kind of pane, e.g. a per-document goal that only shows while a
   * document editor is focused (`app.app.fileType === 'document'`).
   */
  readonly fileType?: string;
  /** The current app route. */
  readonly route: string;
  /**
   * The active UI language as a base BCP-47 code (`en`, `ko`, `ja`). Use it to
   * resolve a {@link LocalizedText} for the plugin's own rendered strings via
   * `resolveLocalizedText(text, app.app.locale)` — the same resolution the host
   * uses for schema labels.
   */
  readonly locale: string;
  /**
   * The host surface the plugin is running on. Use it to render
   * platform-appropriate UI (Obsidian-style `Platform.isMobile`) — e.g. a widget
   * that draws a desktop floating card vs. a mobile bottom-sheet layout.
   */
  readonly platform: 'desktop' | 'mobile' | 'web';
}

/**
 * The whole plugin-facing surface. Semver'd as a unit (see `HOST_API_VERSION`).
 * Sub-objects are always present; gated calls throw without the right grant.
 */
import type { ProjectApi } from './project-api';

export interface HostApi {
  /** Host API semver this object implements. Matches `manifest.sdk` range. */
  readonly version: string;
  editor: EditorApi;
  project: ProjectApi;
  session: SessionApi;
  storage: StorageApi;
  ui: UiApi;
  platform: PlatformApi;
  app: AppApi;
  /** The focused split-view pane (id + file selection). */
  pane: PaneApi;
}
