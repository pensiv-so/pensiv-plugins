import type { FC } from 'react';
import type { HostApi } from './host-api';
import type { ProjectEntityType } from './project-api';
import type { SurfaceScope } from './contributions';

/**
 * **Surface items** — one generic slot mechanism instead of a bespoke API per
 * menu.
 *
 * A plugin names a surface from the catalogue below and gets a row/button there;
 * the host renders every surface through the same `<PluginSlot surface="…" />`
 * primitive. Adding "plot card badge" later is one `<PluginSlot>` in the host
 * plus one row in {@link PluginSurfaceId} — not new SDK plumbing, not a new
 * `registerX` method, and not a version bump for plugins that don't use it.
 *
 * ```ts
 * this.registerSurfaceItem({
 *   surface: 'file.menu',
 *   id: 'word-count',
 *   label: 'Count words',
 *   icon: 'Hash',
 *   when: (ctx) => ctx.target?.type === 'document',
 *   onClick: (ctx) => ctx.app.ui.toast(`${ctx.target?.title}`)
 * });
 * ```
 *
 * Every callback here (`when`, `onClick`, `render`) runs inside the host's guard
 * (`plugins/guard.ts`): a throw is caught and reported, and a repeatedly-throwing
 * item is disabled for the session rather than being allowed to take down the
 * menu it lives in.
 */

/**
 * The surface catalogue — stable ids a plugin may target. Deliberately a closed
 * union so authors get autocomplete and a typo is a compile error rather than an
 * item that silently never appears.
 *
 * Menu surfaces (`*.menu`) put a row at the bottom of an existing context /
 * dropdown menu, under a separator — a bottom-sheet row on phones, where those
 * menus are sheets. The rest are slots: inline strips of icon buttons, or custom
 * `render` output.
 *
 * | id | Where it appears | `target` |
 * | --- | --- | --- |
 * | `file.menu` | right-click a file in the project tree **or** the folder grid | the file |
 * | `editor.menu` | right-click inside the document / sheet editor | the selection |
 * | `plotcard.menu` | a plot card's "…" menu | the plot card |
 * | `plotpartcard.menu` | a plot part card's "…" menu | the part card |
 * | `canvas.selection` | the canvas selection toolbar, when node(s) are selected | the selected node(s) |
 * | `graph.toolbar` | the relationship graph's header | — |
 * | `graph.node-menu` | right-click a node in the relationship graph (desktop) | the node |
 * | `pane.toolbar` | a strip above the pane's content | the pane's file |
 * | `pane.statusbar` | a strip below the pane's content | the pane's file |
 *
 * `file.menu` covers both the sidebar tree and the folder grid on purpose — they
 * share one menu component, and a plugin that means "act on this file" should not
 * have to know which listing the user right-clicked.
 */
export type PluginSurfaceId =
  | 'file.menu'
  | 'editor.menu'
  | 'plotcard.menu'
  | 'plotpartcard.menu'
  | 'canvas.selection'
  | 'graph.toolbar'
  | 'graph.node-menu'
  | 'pane.toolbar'
  | 'pane.statusbar';

/**
 * What a surface item is acting on.
 *
 * `canvasnode` is not a `ProjectEntityType` because canvas nodes are not
 * entities — they live inside one canvas's `content` blob (see D2 in the plan),
 * so their `id` is only meaningful together with the containing canvas `fileId`.
 * `selection` likewise identifies a text range, not a row in a table, and
 * `graphnode` a *virtual* graph node contributed by a source — it exists only in
 * that view, so its id resolves to nothing through `app.project`.
 *
 * A `graph.node-menu` opened on a **real** entity reports that entity's own type
 * and raw id, not `graphnode`; only virtual nodes use it.
 */
export type SurfaceTargetType =
  | ProjectEntityType
  | 'canvasnode'
  | 'selection'
  | 'graphnode';

/** The thing a surface item was invoked on. */
export interface SurfaceTarget {
  /**
   * Entity id — or, for `canvasnode`, the node's id within its canvas; for
   * `selection`, the id of the file being edited.
   */
  id: string;
  type: SurfaceTargetType;
  /** Display title, when the host has one (file name, card title). */
  title?: string;
  /** The selected text, on `editor.menu`. Empty string when nothing is selected. */
  text?: string;
  /**
   * Host sub-kind, when the type alone is too coarse: the canvas node kind
   * (`note` / `image` / …) or the sheet category. Compare defensively — the host
   * may add values.
   */
  subtype?: string;
}

/** Runtime context handed to a surface item's callbacks. */
export interface SurfaceItemContext {
  app: HostApi;
  projectId?: string;
  /** The file the surface belongs to (the pane's file, the editor's document). */
  fileId?: string;
  /** The split-view pane the surface is rendered in, when it is pane-scoped. */
  paneId?: string;
  /** What the item was invoked on. `undefined` when the surface has no target. */
  target?: SurfaceTarget;
  /**
   * Every target in the host's current multi-selection, in host order, with
   * `target` as the first entry. A single-select surface gives a one-item array;
   * a surface with no selection concept gives an empty one.
   */
  targets: SurfaceTarget[];
}

/** Props a surface item's custom `render` receives. */
export interface SurfaceItemProps {
  ctx: SurfaceItemContext;
}

/**
 * One item contributed to a surface.
 *
 * Scoping follows the same **omit-to-allow** rule as header actions and pane
 * views ({@link SurfaceScope}): declaring no `fileTypes` / `viewModes` means the
 * item appears wherever its surface does, including file types pensiv gains
 * later. Narrow with `when` for anything dynamic — it is re-evaluated every time
 * the surface renders, so it can read the live target.
 */
export interface SurfaceItemContribution extends SurfaceScope {
  /** Which surface this item belongs to. */
  surface: PluginSurfaceId;
  /** Unique within the plugin **and** the surface. */
  id: string;
  /** Row label / button tooltip. */
  label: string;
  /** MonoIcon name. */
  icon?: string;
  /**
   * Sort key within the plugin block, ascending. Ties keep registration order.
   * Items never interleave with the host's own rows — plugin items always come
   * last, after a separator.
   */
  order?: number;
  /** Renders in the destructive style (menus only). */
  variant?: 'default' | 'destructive';
  /**
   * Visibility predicate, re-evaluated on every render. Omit = always visible.
   * A throw hides the item (fail closed) and counts toward auto-disable.
   */
  when?(ctx: SurfaceItemContext): boolean;
  /** Invoked on click/tap. */
  onClick?(ctx: SurfaceItemContext): void;
  /**
   * Custom rendering, for surfaces where a label+icon row is not enough (a live
   * counter in `pane.statusbar`, say). Ignored on menu surfaces, which must own
   * their row markup for keyboard nav and dismissal to work.
   */
  render?: FC<SurfaceItemProps>;
}
