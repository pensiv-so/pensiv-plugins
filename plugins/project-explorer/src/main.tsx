import * as React from 'react';
import {
  Plugin,
  type PaneViewProps,
  type ProjectFile,
  type ProjectRelationship
} from '@pensiv/plugin-sdk';

/**
 * The reference example for `app.project` — reading and writing the project's
 * file tree, and reacting to changes.
 *
 * Three things worth copying out of here:
 *
 *  1. **Any file can parent any file.** The tree walk below never checks for
 *     `type === 'folder'`; it just asks for `children(id)`. A document can hold
 *     a sheet, a canvas can hold a document, and a folder is simply one of the
 *     five file types rather than a special container.
 *  2. **Subscribe, don't poll.** `app.project.subscribe` fires on any project
 *     change; narrow it with the `kinds` argument so a relationship edit doesn't
 *     re-render a view that only shows files.
 *  3. **Snapshots are frozen.** Everything a read returns is an immutable copy,
 *     so you can hold it across a render — but it will not update itself. Re-read
 *     when notified.
 */

const wrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  fontSize: '0.8125rem',
  color: 'hsl(var(--foreground))'
};

const muted: React.CSSProperties = { color: 'hsl(var(--muted-foreground))' };

const rowButton: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  padding: '0.25rem 0',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer'
};

/** Re-render whenever the project data this view reads has changed. */
function useProjectVersion(app: PaneViewProps['app'], kinds?: Parameters<
  typeof app.project.subscribe
>[1]): number {
  const [version, setVersion] = React.useState(0);
  // Depend on the *contents* of `kinds`, not the array identity — a literal at
  // the call site is a new array on every render and would resubscribe forever.
  const kindsKey = kinds?.join(',') ?? '';
  React.useEffect(() => {
    if (!app.project.available) return;
    const wanted = kindsKey ? (kindsKey.split(',') as typeof kinds) : undefined;
    return app.project.subscribe(() => setVersion((v) => v + 1), wanted);
  }, [app, kindsKey]);
  return version;
}

function Tree({ app, parentId, depth }: { app: PaneViewProps['app']; parentId: string | null; depth: number }) {
  // No `type === 'folder'` check anywhere: every file type can have children.
  const children = app.project.children(parentId);
  if (children.length === 0) return null;

  return (
    <ul style={{ listStyle: 'none', margin: 0, paddingLeft: depth === 0 ? 0 : '0.75rem' }}>
      {children.map((file) => (
        <li key={file.id}>
          <span>
            <span style={muted}>{file.type.slice(0, 1).toUpperCase()}</span>{' '}
            {file.title || '(untitled)'}
          </span>
          <Tree app={app} parentId={file.id} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

function Backlinks({ app, file }: { app: PaneViewProps['app']; file: ProjectFile }) {
  const rels: ProjectRelationship[] = app.project.relationships(file.id, file.type);
  if (rels.length === 0) return <span style={muted}>No links yet.</span>;

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {rels.map((rel) => {
        // A relationship is directed, so figure out which end is the *other* one.
        const otherId = rel.sourceId === file.id ? rel.targetId : rel.sourceId;
        const other = app.project.get(otherId);
        return (
          <li key={rel.id}>
            <button
              style={rowButton}
              onClick={() => {
                void app.project.unlink(rel.id).catch(() => {
                  app.ui.toast('Could not remove that link.');
                });
              }}
              title="Click to remove this link"
            >
              {other?.title ?? otherId} <span style={muted}>({rel.relationshipType})</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ExplorerPane({ app, fileId }: PaneViewProps) {
  // Files and relationships change independently; subscribing to both keeps the
  // whole pane honest without polling.
  useProjectVersion(app);

  if (!app.project.available) {
    return <div style={wrap}>This pensiv version has no project API.</div>;
  }

  const current = fileId ? app.project.get(fileId) : undefined;
  const selection = app.pane.selection;

  return (
    <div style={wrap}>
      <section>
        <strong>Project tree</strong>
        <Tree app={app} parentId={null} depth={0} />
      </section>

      <section>
        <strong>Selected in this pane</strong>
        <div style={muted}>
          {selection.length === 0
            ? 'nothing'
            : selection.map((item) => `${item.type}:${item.id}`).join(', ')}
        </div>
      </section>

      {current ? (
        <section>
          <strong>Links for “{current.title || 'untitled'}”</strong>
          <Backlinks app={app} file={current} />
        </section>
      ) : null}
    </div>
  );
}

export default class ProjectExplorerPlugin extends Plugin {
  onload(): void {
    // No `fileTypes` / `viewModes` ⇒ offered on every file type, in both the
    // file and folder views. List them only to narrow.
    this.registerPaneView({
      id: 'explorer',
      title: 'Project Explorer',
      icon: 'Waypoints',
      render: ExplorerPane
    });

    // A write example: create a sibling of whatever is focused. Note it does not
    // assume the parent is a folder — it reuses the focused file's own parent,
    // whatever type that is.
    this.addCommand({
      id: 'new-sibling',
      name: 'Explorer: New document beside this one',
      run: () => {
        const fileId = this.app.app.fileId;
        const current = fileId ? this.app.project.get(fileId) : undefined;
        void this.app.project
          .create({
            type: 'document',
            title: 'Untitled',
            parentId: current?.parentId ?? null,
            parentType: current?.parentType ?? null
          })
          .then((created) => this.app.ui.toast(`Created “${created.title}”`))
          .catch((error: unknown) => {
            this.app.ui.toast(error instanceof Error ? error.message : 'Create failed.');
          });
      }
    });

    // Link the two files the user has multi-selected in the focused pane.
    this.addCommand({
      id: 'link-selection',
      name: 'Explorer: Link the two selected files',
      run: () => {
        const [a, b] = this.app.pane.selection;
        if (!a || !b) {
          this.app.ui.toast('Select exactly two files first.');
          return;
        }
        void this.app.project
          .link({
            sourceId: a.id,
            sourceType: a.type as never,
            targetId: b.id,
            targetType: b.type as never
          })
          .then(() => this.app.ui.toast('Linked.'))
          .catch(() => this.app.ui.toast('Could not link those.'));
      }
    });
  }
}
