/**
 * Project-data API — the plugin's view of the file tree, the plot sub-entities
 * and the relationship graph.
 *
 * ## Shape of the data
 *
 * There are three layers, and they are **not** the same thing:
 *
 *  1. **Files.** `document | sheet | plotboard | folder | canvas` are five peers.
 *     A folder is not a special container — it is just one of the five, and
 *     *any* file can be the parent of *any* other via `parentId`/`parentType`.
 *     A document can hold a sheet; a canvas can hold a document. Never assume
 *     "parent ⇒ folder", and never skip folders when iterating "all files".
 *  2. **Plot sub-entities.** `PlotCard` belongs to a plotboard (`boardId`), and
 *     `PlotPartCard` belongs to a plot card (`cardId`). They are *not* in the
 *     file tree and have no `parentId`.
 *  3. **Relationships.** A directed link between any two of the above. This is
 *     the cross-cutting graph *on top of* the containment tree.
 *
 * ## Snapshots, not live objects
 *
 * Every read returns a **frozen plain snapshot**, never a live store object. So
 * a plugin can hold one across a render without accidentally mutating app state,
 * and mutating the returned object throws in strict mode instead of silently
 * corrupting the store. Re-read (or use {@link ProjectApi.subscribe}) for fresh
 * data rather than caching a snapshot and expecting it to update itself.
 *
 * ## Writes
 *
 * Writes go through the app's own optimistic local-first paths — the same ones
 * the UI uses — so cascade rules, rank ordering, sync markers and version
 * history all behave exactly as if the user had done it by hand. They are
 * `async` and resolve once the local write has been applied (the server call
 * continues in the background, as everywhere else in the app).
 */

/** Every file type. A folder is one of these, not a separate concept. */
export type ProjectFileType = 'document' | 'sheet' | 'plotboard' | 'folder' | 'canvas';

/** Everything a relationship can point at — files plus the plot sub-entities. */
export type ProjectEntityType = ProjectFileType | 'plotcard' | 'plotpartcard';

/** A file entity, flattened to the fields that are stable across all five types. */
export interface ProjectFile {
  id: string;
  projectId: string;
  type: ProjectFileType;
  title: string;
  description?: string;
  /** Parent entity id, or `null` at the project root. */
  parentId: string | null;
  /** Parent's type — **any** file type, not just `folder`. `null` at the root. */
  parentType: ProjectFileType | null;
  /** Lexorank string used for sibling ordering. Compare, don't parse. */
  rank: string;
  labelId?: string | null;
  statusId?: string | null;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  /** Set when the file is in the trash. Trashed files are excluded unless asked for. */
  deletedAt?: string | null;
}

/** A card on a plotboard. Always belongs to a board; never in the file tree. */
export interface ProjectPlotCard {
  id: string;
  projectId: string;
  boardId: string;
  title: string;
  description?: string;
  rank: string;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/** A part card. Always belongs to a plot card (and through it, a board). */
export interface ProjectPlotPartCard {
  id: string;
  projectId: string;
  boardId: string;
  cardId: string;
  title: string;
  description?: string;
  tags?: string[];
  rank: string;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * A directed link between two entities.
 *
 * `relationshipType` is `related` (an explicit link) or `mention` (created by an
 * `@` reference in text). `direction` is `bidirectional` by default. Keep plugin
 * links to plain `related` + `bidirectional` unless you have a reason not to.
 */
export interface ProjectRelationship {
  id: string;
  projectId: string;
  sourceId: string;
  sourceType: ProjectEntityType;
  targetId: string;
  targetType: ProjectEntityType;
  relationshipType: 'related' | 'mention';
  direction: 'bidirectional' | 'unidirectional';
  createdAt: string;
  updatedAt: string;
}

/** Filter for {@link ProjectApi.query}. Every field is optional and ANDed. */
export interface ProjectQuery {
  /** Restrict to one or more file types. Omit = all five. */
  type?: ProjectFileType | ProjectFileType[];
  /** Direct children of this parent; `null` means project-root files. */
  parentId?: string | null;
  /** Defaults to the project currently in view. */
  projectId?: string;
  /** Case-insensitive substring match on the title. */
  titleContains?: string;
  labelId?: string;
  statusId?: string;
  /** Include trashed files. Defaults to `false`. */
  includeTrashed?: boolean;
}

/** Fields a plugin may change on an existing file. */
export interface ProjectFilePatch {
  title?: string;
  description?: string;
  labelId?: string | null;
  statusId?: string | null;
  icon?: string;
}

/** What {@link ProjectApi.create} needs to make a new file. */
export interface ProjectFileDraft {
  type: ProjectFileType;
  title: string;
  /** Defaults to the project currently in view. */
  projectId?: string;
  /** Parent to file it under. Omit or `null` for the project root. */
  parentId?: string | null;
  /** Parent's type. Required whenever `parentId` is set. */
  parentType?: ProjectFileType | null;
  description?: string;
}

/** What {@link ProjectApi.link} needs to connect two entities. */
export interface ProjectLinkDraft {
  sourceId: string;
  sourceType: ProjectEntityType;
  targetId: string;
  targetType: ProjectEntityType;
  /** Defaults to `related`. */
  relationshipType?: 'related' | 'mention';
  /** Defaults to `bidirectional`. */
  direction?: 'bidirectional' | 'unidirectional';
}

/**
 * What changed, so a subscriber can decide whether it cares. `files` covers all
 * five file types (folders included).
 */
export type ProjectChangeKind = 'files' | 'plotcards' | 'plotpartcards' | 'relationships';

export interface ProjectApi {
  /**
   * `true` when the host can serve project data. Read this before calling
   * anything else — a host that predates the project API leaves it `false` and
   * every other method throws.
   */
  readonly available: boolean;

  // ── read ──────────────────────────────────────────────────────────────────

  /** One file by id, or `undefined`. Trashed files included. `[project.read]` */
  get(id: string): ProjectFile | undefined;
  /**
   * Direct children of `parentId`, rank-ordered. Pass `null` for project-root
   * files. Works for **any** parent type, not just folders. `[project.read]`
   */
  children(parentId: string | null, options?: { includeTrashed?: boolean }): ProjectFile[];
  /** Files matching a filter, rank-ordered. `[project.read]` */
  query(filter?: ProjectQuery): ProjectFile[];
  /** Cards on a plotboard, rank-ordered. `[project.read]` */
  plotCards(boardId: string): ProjectPlotCard[];
  /** Part cards belonging to a plot card, rank-ordered. `[project.read]` */
  plotPartCards(cardId: string): ProjectPlotPartCard[];
  /**
   * Every relationship touching this entity, in either direction. Pass
   * `entityType` when the id could be a plot card — file ids and card ids live
   * in different spaces. `[project.read]`
   */
  relationships(entityId: string, entityType?: ProjectEntityType): ProjectRelationship[];
  /**
   * Fire `cb` after any project data changes. `kinds` narrows it (e.g. only
   * `['relationships']`); omit for all. Returns an unsubscribe. `[project.read]`
   */
  subscribe(cb: (kind: ProjectChangeKind) => void, kinds?: ProjectChangeKind[]): () => void;

  // ── write ─────────────────────────────────────────────────────────────────

  /**
   * Create a file and return its snapshot. It is appended after its siblings.
   * `[project.write]`
   */
  create(draft: ProjectFileDraft): Promise<ProjectFile>;
  /** Patch an existing file. `[project.write]` */
  update(id: string, patch: ProjectFilePatch): Promise<void>;
  /**
   * Reparent a file. `parentId: null` moves it to the project root. Moving a
   * file under itself or one of its own descendants would orphan a subtree, so
   * the host rejects it. `[project.write]`
   */
  move(id: string, parentId: string | null, parentType?: ProjectFileType | null): Promise<void>;
  /**
   * Move a file to the trash, cascading to its children exactly like the UI's
   * delete. Recoverable by the user from the trash. `[project.write]`
   */
  remove(id: string): Promise<void>;
  /** Link two entities. `[project.write]` */
  link(draft: ProjectLinkDraft): Promise<ProjectRelationship | undefined>;
  /**
   * Remove a relationship. This is a **hard delete** — the row is gone, not
   * deactivated, and there is no undo. `[project.write]`
   */
  unlink(relationshipId: string): Promise<void>;
}
