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
  /** Run a named editor command (e.g. `toggleBold`). `[editor.write]` */
  runCommand(name: string): void;
  /** Subscribe to editor events. Returns an unsubscribe. */
  on(event: 'update' | 'selectionUpdate', cb: () => void): Unsub;
  /** Add read-only decorations over ranges; returns an unsubscribe. `[editor.read]` */
  decorate(ranges: EditorRange[]): Unsub;
}

/**
 * Project-data API (file tree, episodes, characters, comments, …). Gated and
 * intentionally a stub in v1 — the full surface arrives in a later phase
 * (`app.project.query/subscribe/write`). Declared here so the contract is
 * visible and `this.app.project` is always present.
 */
export interface ProjectApi {
  /** `true` once the project-data API is available (false in v1). */
  readonly available: boolean;
}

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
   * Subscribe to writing-session events. `'change'` fires whenever today's totals
   * change (the common case for a progress widget); the others mark write
   * start/stop and a periodic tick. Returns an unsubscribe. `[session]`
   */
  on(event: 'change' | 'write-start' | 'write-stop' | 'tick', cb: () => void): Unsub;
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

export interface UiApi {
  /** Show a transient toast. */
  toast(message: string): void;
  /** Open a host-rendered sheet with the given content node. */
  openSheet(node: unknown): void;
  /** Open a plugin-contributed full pane/tab (see `Plugin.registerPane`) in the split view. */
  openPane(pluginPaneId: string): void;
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
   * platform-appropriate UI — e.g. a widget that draws a desktop floating card
   * vs. a mobile bottom-sheet layout.
   */
  readonly platform: 'desktop' | 'mobile' | 'web';
}

/**
 * The whole plugin-facing surface. Semver'd as a unit (see `HOST_API_VERSION`).
 * Sub-objects are always present; gated calls throw without the right grant.
 */
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
}
