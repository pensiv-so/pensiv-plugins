import { Plugin, type PaneViewProps, type PaneProps } from '@pensiv/plugin-sdk';

const box: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '1rem',
  fontSize: '0.8125rem',
  color: 'hsl(var(--foreground))'
};

/** Document side-pane view (opens from a toggle button in the document header). */
function DemoSideView({ app, fileId }: PaneViewProps) {
  return (
    <div style={box}>
      <strong>Side pane view</strong>
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>file: {fileId ?? 'none'}</span>
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>
        words: {(() => {
          try {
            return app.editor.count({ countType: 'word' });
          } catch {
            return 0;
          }
        })()}
      </span>
    </div>
  );
}

/** Full split-view tab pane (opened via app.ui.openPane / a command). */
function DemoTabPane({ projectId }: PaneProps) {
  return (
    <div style={{ ...box, height: '100%' }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Panes Demo — full tab</h2>
      <p style={{ color: 'hsl(var(--muted-foreground))' }}>
        This is a full split-view pane owned by a plugin (project: {projectId ?? 'none'}).
      </p>
    </div>
  );
}

export default class PanesDemoPlugin extends Plugin {
  onload(): void {
    this.registerPaneView({
      id: 'demo-side',
      title: 'Panes Demo',
      icon: 'Boxes',
      render: DemoSideView
    });

    this.registerPane({
      id: 'demo-tab',
      title: 'Panes Demo',
      icon: 'Boxes',
      render: DemoTabPane
    });

    this.addCommand({
      id: 'open-pane',
      name: 'Panes Demo: Open full pane',
      run: () => this.app.ui.openPane('demo-tab')
    });
  }
}
