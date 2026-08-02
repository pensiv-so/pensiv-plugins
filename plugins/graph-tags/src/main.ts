import { Plugin, type GraphFilterNode, type PluginGraphNode } from '@pensiv/plugin-sdk';

/**
 * The reference example for the relationship graph: `registerGraphSource`,
 * `registerGraphFilter`, and the `graph.*` surfaces.
 *
 * It reads `#tags` out of document titles and overlays them on the graph as
 * virtual nodes, each linked to the documents carrying it — the "colour groups"
 * shape people ask for, done with data rather than by patching the view.
 *
 * Four things worth copying:
 *
 *  1. **Virtual nodes are not entities.** They live only in the graph: never
 *     written, never synced, inert on click. If you want a node that persists,
 *     don't use a source — create a real entity through `app.project` and the
 *     graph picks it up with no plugin code on the render path at all.
 *  2. **Link endpoints are either your own node ids or raw entity ids.** The
 *     host resolves which, and drops anything that matches neither.
 *  3. **Everything here runs on a hot path.** `nodes()` and `links()` run on
 *     every rebuild, `test()` per node, `paintNode()` per node per frame. Keep
 *     them cheap and allocation-light; see the shared `scan()` below.
 *  4. **Filters start off.** Installing a plugin must never silently hide part
 *     of someone's graph — the user turns it on in the graph preferences.
 */

const TAG_RE = /#([\p{L}\p{N}_-]+)/gu;

interface TagIndex {
  /** tag → the raw ids of every document carrying it. */
  byTag: Map<string, string[]>;
  /** Raw ids of every document that carries at least one tag. */
  tagged: Set<string>;
}

/** An empty index, so callers never branch on `undefined`. */
const EMPTY: TagIndex = { byTag: new Map(), tagged: new Set() };

export default class GraphTagsPlugin extends Plugin {
  /**
   * One scan per graph rebuild, shared by the source and the filter.
   *
   * `nodes()`, `links()` and `test()` are all called within the same rebuild, so
   * scanning in each would walk the project three times. Caching on a
   * monotonically-bumped token would be premature here — the project read is
   * already a cheap frozen snapshot — but sharing one pass is not.
   */
  private scan(): TagIndex {
    if (!this.app.project.available) return EMPTY;

    const byTag = new Map<string, string[]>();
    const tagged = new Set<string>();

    for (const file of this.app.project.query({ type: 'document' })) {
      TAG_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = TAG_RE.exec(file.title)) !== null) {
        const tag = (match[1] ?? '').toLowerCase();
        if (!tag) continue;
        const list = byTag.get(tag);
        if (list) list.push(file.id);
        else byTag.set(tag, [file.id]);
        tagged.add(file.id);
      }
    }

    return { byTag, tagged };
  }

  onload(): void {
    this.registerGraphSource({
      id: 'tags',

      nodes: (): PluginGraphNode[] =>
        Array.from(this.scan().byTag.entries()).map(([tag, ids]) => ({
          id: tag,
          name: `#${tag}`,
          color: colorForTag(tag),
          // Bigger for a tag more documents share. The host clamps this into the
          // range real nodes use, so it can't swallow the viewport.
          size: 1.5 + Math.min(ids.length, 6) * 0.4
        })),

      links: () => {
        const out: Array<{ source: string; target: string }> = [];
        for (const [tag, ids] of this.scan().byTag) {
          // `tag` is this source's own node id; `id` is a raw entity id. The host
          // resolves each endpoint and drops anything it can't place.
          for (const id of ids) out.push({ source: tag, target: id });
        }
        return out;
      },

      // Optional. Runs per node per FRAME — draw and get out. The host wraps this
      // in save()/restore(), so a stray transform can't leak into other nodes,
      // and in its throw guard, so a bad frame disables this hook rather than
      // killing the graph.
      paintNode: (node, ctx, scale) => {
        ctx.beginPath();
        ctx.rect(node.x - node.size, node.y - node.size, node.size * 2, node.size * 2);
        ctx.fillStyle = colorForTag(node.name.slice(1));
        ctx.fill();

        if (scale < 1.5) return; // Too small to read — don't bother with the label.
        ctx.font = `${Math.max(2, 10 / scale)}px sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.name, node.x, node.y + node.size * 2.4);
      }
    });

    // A togglable filter, shown next to the built-ins in graph preferences.
    // Off until the user turns it on.
    this.registerGraphFilter({
      id: 'tagged-only',
      label: 'Tagged documents only',
      test: (node: GraphFilterNode) => {
        // Keep every tag node — hiding those would defeat the point.
        if (node.type === 'plugin') return true;
        // The graph id is `<type>-<uuid>`; the index is keyed by raw id.
        const rawId = node.id.slice(node.id.indexOf('-') + 1);
        return this.scan().tagged.has(rawId);
      }
    });

    // A button in the graph header.
    this.registerSurfaceItem({
      surface: 'graph.toolbar',
      id: 'count',
      label: 'Count tags',
      icon: 'Boxes',
      onClick: (ctx) => {
        const index = this.scan();
        ctx.app.ui.toast(`${index.byTag.size} tag(s) across ${index.tagged.size} document(s)`);
      }
    });

    // A row on right-click of a graph node (desktop). A virtual node reports
    // `graphnode`; a real entity reports its own type and raw id, so it can be
    // looked up through `app.project`.
    this.registerSurfaceItem({
      surface: 'graph.node-menu',
      id: 'describe',
      label: 'What is this?',
      icon: 'HelpCircle',
      onClick: (ctx) => {
        const target = ctx.target;
        if (!target) return;
        if (target.type === 'graphnode') {
          ctx.app.ui.toast(`${target.title} — a tag, not a file.`);
          return;
        }
        const file = ctx.app.project.get(target.id);
        ctx.app.ui.toast(file ? `${file.type}: ${file.title}` : 'Not in this project.');
      }
    });
  }
}

/** Stable hue per tag, so a tag keeps its colour across sessions and devices. */
function colorForTag(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360} 65% 55%)`;
}
