import type { HostApi } from './host-api';

/**
 * **Graph contributions** — the relationship graph's extension points.
 *
 * The graph is a `react-force-graph-2d` canvas, not a React tree: there are no
 * child components to slot into, and the community's usual answer (monkey-patch
 * the view) is exactly what this API exists to avoid. So instead of exposing the
 * view, pensiv exposes the two seams that actually matter — **what data is in
 * the graph** and **how a node is painted**:
 *
 * ```ts
 * this.registerGraphSource({
 *   id: 'tags',
 *   nodes: () => [{ id: 'magic', name: '#magic', color: '#a855f7' }],
 *   links: () => [{ source: 'magic', target: someDocumentId }]
 * });
 *
 * this.registerGraphFilter({
 *   id: 'chapters-only',
 *   label: 'Chapters only',
 *   test: (node) => node.name.startsWith('Chapter')
 * });
 * ```
 *
 * ## Virtual nodes are not entities
 *
 * A source's nodes exist only in the graph. They are never written to the
 * project, never sync, and clicking one navigates nowhere — the host namespaces
 * their ids so they cannot collide with a real entity, and the navigation path
 * ignores them by construction.
 *
 * If you want a node that *persists*, don't use a source: create a real entity
 * and a real relationship through `app.project`, and the graph picks it up for
 * free with no plugin code on the render path at all. Sources are for overlays
 * (tags, clusters, external references) that would be noise as entities.
 *
 * ## Everything here runs on a hot path
 *
 * `nodes()` / `links()` run whenever the graph rebuilds; `test()` runs per node
 * per rebuild; `paintNode()` runs **per node per frame**. All of them go through
 * the host's guard: a throw is caught, and a callback that throws repeatedly is
 * disabled for the session rather than being allowed to take the graph down.
 * `paintNode` additionally runs inside a `save()`/`restore()` pair, so a plugin
 * that leaves a transform or clip applied can't corrupt the nodes drawn after it.
 */

/** A node a source adds to the graph. */
export interface PluginGraphNode {
  /**
   * Unique within this plugin. The host namespaces it, so it can be anything —
   * a tag name, a hash, whatever the source is keyed by.
   */
  id: string;
  /** Label drawn next to the node. */
  name: string;
  /** CSS colour. Defaults to the host's neutral node colour. */
  color?: string;
  /** Relative size; the host clamps it to the range real nodes use. */
  size?: number;
  /** MonoIcon name drawn inside the node disc. */
  icon?: string;
}

/**
 * A link a source adds. Each endpoint is either one of this source's own node
 * ids, or a **raw entity id** (a document/sheet/plot-card UUID as `app.project`
 * reports it) — the host resolves which. An endpoint that matches neither is
 * dropped, exactly as a dangling entity link would be.
 */
export interface PluginGraphLink {
  source: string;
  target: string;
}

/** Context handed to a source when the graph rebuilds. */
export interface GraphSourceContext {
  app: HostApi;
  projectId?: string;
}

/** A node as a filter sees it. Covers both real entities and virtual nodes. */
export interface GraphFilterNode {
  /** The graph's node id, already namespaced. */
  id: string;
  name: string;
  /** Entity type (`document`, `plotcard`, …) or `plugin` for a virtual node. */
  type: string;
  /** Set only on virtual nodes: which plugin contributed it. */
  pluginId?: string;
}

/** A source of extra nodes and links. */
export interface GraphSourceContribution {
  /** Unique within the plugin. */
  id: string;
  /** Nodes to add. Called on every graph rebuild — keep it cheap. */
  nodes(ctx: GraphSourceContext): PluginGraphNode[];
  /** Links to add. Endpoints may be this source's node ids or raw entity ids. */
  links?(ctx: GraphSourceContext): PluginGraphLink[];
  /**
   * Paint this source's own nodes instead of the host's default disc.
   *
   * Runs per node per frame at 60fps, inside a `save()`/`restore()` pair. The
   * node's centre is at `(node.x, node.y)` in graph space; `scale` is the
   * current zoom. Return nothing — draw and get out. Do not start async work,
   * allocate per call, or read the DOM here.
   */
  paintNode?(
    node: { id: string; name: string; x: number; y: number; size: number },
    ctx: CanvasRenderingContext2D,
    scale: number
  ): void;
}

/** A user-togglable filter, shown in the graph preferences popover. */
export interface GraphFilterContribution {
  /** Unique within the plugin. */
  id: string;
  /** Label for the toggle. */
  label: string;
  /**
   * Return `false` to hide the node. Links touching a hidden node are dropped
   * with it. Runs per node per rebuild.
   */
  test(node: GraphFilterNode): boolean;
  /**
   * Whether the filter starts on. Defaults to **off** — installing a plugin
   * should never silently hide part of the user's graph.
   */
  defaultEnabled?: boolean;
}
