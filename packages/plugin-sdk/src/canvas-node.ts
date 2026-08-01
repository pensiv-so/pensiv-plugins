import type { FC } from 'react';
import type { HostApi } from './host-api';

/**
 * **Canvas nodes** — the one place a plugin gets to put its own object on a
 * canvas, rather than decorating one the host already drew.
 *
 * ```ts
 * this.registerCanvasNode({
 *   id: 'kanban',
 *   name: 'Kanban board',
 *   icon: 'Columns3',
 *   defaultSize: { width: 320, height: 240 },
 *   createDefaultState: () => ({ columns: [] }),
 *   render: KanbanNode
 * });
 * ```
 *
 * ## The split
 *
 * The **host** owns everything structural: position, size, selection, z-order,
 * grouping, undo/redo, copy/paste, persistence, sync, cascade delete and export.
 * The **plugin** owns exactly two things: what the inside looks like, and an
 * opaque `state`.
 *
 * That split is why plugins do not widen `CanvasNodeType`. Every plugin node is
 * a host `type: 'plugin'` node carrying `{ pluginId, viewId, state }`, so the
 * dozens of places that compare node kinds — agent tools, export, digest, sync —
 * keep working unchanged, and a node whose plugin is uninstalled degrades to a
 * neutral placeholder with its data intact instead of vanishing.
 *
 * ## State
 *
 * `state` is JSON, and **capped at 16 KB serialized**. Canvas content is stored
 * and synced as one blob that is read and written whole, so per-node state is
 * multiplied by the node count and paid on every load — and on Android an
 * oversized row is a hard crash, not just slowness. Keep anything bigger in
 * `app.storage` and put a key here.
 *
 * Writes go through the canvas's own debounced writer, so they participate in
 * undo and sync like any other node edit.
 */

/** Anything that survives a JSON round-trip. */
export type CanvasNodeState =
  | string
  | number
  | boolean
  | null
  | CanvasNodeState[]
  | { [key: string]: CanvasNodeState };

/** Props the registered node view receives. */
export interface CanvasNodeViewProps {
  app: HostApi;
  projectId?: string;
  /** The canvas file this node lives in. */
  fileId?: string;
  /** This node's id within that canvas. */
  nodeId: string;
  /** Current plugin-owned state. */
  state: CanvasNodeState;
  /**
   * Persist new state. Accepts a value or an updater. Rejected (with a toast)
   * when the result exceeds the 16 KB cap, so a runaway write can't corrupt the
   * canvas — check the boolean if you need to know.
   */
  setState(next: CanvasNodeState | ((prev: CanvasNodeState) => CanvasNodeState)): boolean;
  /** Whether the host currently has this node selected. */
  selected: boolean;
  /**
   * `true` in non-editing contexts — version-history previews and export
   * layouts. Render the value, not the controls.
   */
  readOnly: boolean;
}

/** A node type a plugin adds to the canvas. */
export interface CanvasNodeContribution {
  /** Unique within the plugin. Stored on every node as `viewId`. */
  id: string;
  /** Label in the canvas toolbar. */
  name: string;
  /** MonoIcon name for the toolbar entry. */
  icon?: string;
  /** Size a freshly-dropped node gets. Defaults to 240×160. */
  defaultSize?: { width: number; height: number };
  /** Initial `state` for a new node. Defaults to `{}`. */
  createDefaultState?(): CanvasNodeState;
  render: FC<CanvasNodeViewProps>;
}
