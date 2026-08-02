# Graph Tags

Reference example for the **relationship graph** — `registerGraphSource`,
`registerGraphFilter`, and the `graph.toolbar` / `graph.node-menu` surfaces.

It reads `#tags` out of document titles and overlays them on the graph as nodes,
each linked to the documents carrying it. That's the "colour groups" shape people
ask for, done with data instead of by patching the view.

## Use it

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/graph-tags
```

Install `graph-tags.pnsv-plugin`, put `#something` in a few document titles, and
open the relationship graph.

## Why data seams instead of view internals

The graph is a `react-force-graph-2d` canvas — there are no child components to
slot into, and the usual community answer (monkey-patch the view) breaks on every
release. pensiv exposes the two seams that actually matter instead:

| Seam                                | What it decides         |
| ----------------------------------- | ----------------------- |
| `registerGraphSource`               | what is in the graph    |
| `registerGraphFilter`               | what stays visible      |
| `paintNode` (optional, on a source) | how your own nodes look |

## Virtual nodes are not entities

A source's nodes exist only in the graph. They are never written to the project,
never sync, and clicking one navigates nowhere — the host namespaces their ids
(`plugin-<pluginId>:<localId>`) so they can't collide with a real entity, and its
navigation path ignores that prefix by construction.

**If you want a node that persists, don't use a source.** Create a real entity and
a real relationship through `app.project`; the graph picks them up for free, with
no plugin code on the render path at all. Sources are for overlays that would be
noise as entities.

## Link endpoints

Each endpoint is either one of your own node ids **or** a raw entity id (a UUID as
`app.project` reports it). The host resolves which, and drops anything that
matches neither — the same treatment a dangling entity relationship gets.

```ts
links: () => [{ source: 'magic', target: someDocumentId }];
//               ^ my node id    ^ a raw entity id
```

## Everything here is a hot path

| Callback              | Called                  |
| --------------------- | ----------------------- |
| `nodes()` / `links()` | every graph rebuild     |
| `test()`              | per node, per rebuild   |
| `paintNode()`         | **per node, per frame** |

Hence the shared `scan()` in this plugin: the source and the filter both need the
tag index within one rebuild, and scanning in each would walk the project three
times.

`paintNode` gets two containments from the host, both mandatory at 60fps:

- a `save()` / `restore()` pair, so a plugin that leaves a transform, clip or
  stroke style applied can't corrupt every node drawn after it;
- the usual throw guard, so a bad frame disables that one hook instead of killing
  the graph. Once disabled the host stops calling it at all.

## Filters start off

An enabled filter _narrows_: several enabled at once intersect, they don't union,
and a node hidden by one takes its links with it. So a filter that defaults to on
could silently empty someone's graph the moment they install a plugin. Yours is
off until the user turns it on in graph preferences, and that choice is stored
per device rather than synced.

A filter that throws keeps its node — a broken filter must not be able to hide
anything.
