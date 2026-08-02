import * as React from 'react';
import { Plugin, type SurfaceItemContext, type SurfaceItemProps } from '@pensiv/plugin-sdk';

/**
 * The reference example for `registerSurfaceItem()` — one call that puts an item
 * into any surface in the catalogue, instead of a different API per menu.
 *
 * Four things worth copying:
 *
 *  1. **The surface id is the whole routing decision.** `'file.menu'` lands in
 *     the project tree *and* the folder grid; `'plotcard.menu'` is a dropdown on
 *     desktop and a bottom-sheet row on phones. You write the item once.
 *  2. **`when` narrows dynamically, `fileTypes` narrows statically.** Use
 *     `fileTypes` for "this only makes sense on canvases" and `when` for
 *     anything that depends on what the user actually clicked.
 *  3. **`target` is a convenience; `app.project` is the truth.** `target.title`
 *     is whatever the host had at hand. Read the entity when it matters.
 *  4. **Throwing is survivable but not free.** The host catches, and disables an
 *     item that keeps throwing. See {@link crashCount} at the bottom.
 */

/** Shared toast helper — every item below ends in some feedback. */
function say(ctx: SurfaceItemContext, message: string): void {
  ctx.app.ui.toast(message);
}

/**
 * A `pane.statusbar` item with custom `render`. Slot surfaces accept a component
 * when a label + icon is not enough; menu surfaces ignore it, because they have
 * to own their row markup for keyboard navigation and dismissal to work.
 */
function WordCountStatus({ ctx }: SurfaceItemProps) {
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    const read = () => setCount(ctx.app.editor.count({ countType: 'word' }));
    read();
    // The editor stream, not a timer: this only recomputes when the text changes.
    return ctx.app.editor.on('update', read);
  }, [ctx.app]);

  if (count === null) return null;
  return (
    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
      {count.toLocaleString()} words
    </span>
  );
}

export default class SurfaceActionsPlugin extends Plugin {
  onload(): void {
    // ---------------------------------------------------------------- file.menu
    // No `fileTypes` ⇒ every file type, including ones pensiv adds later. One
    // registration covers both the sidebar tree and the folder grid.
    this.registerSurfaceItem({
      surface: 'file.menu',
      id: 'copy-id',
      label: 'Copy file id',
      icon: 'Copy',
      onClick: (ctx) => {
        const id = ctx.target?.id;
        if (!id) return;
        void ctx.app.platform.clipboard.writeText(id).then(() => say(ctx, `Copied ${id}`));
      }
    });

    // `when` sees the live target, so it can narrow on anything the host knows.
    // Note it does NOT special-case folders as containers: any file type can
    // have children, so "count children" is meaningful on all of them.
    this.registerSurfaceItem({
      surface: 'file.menu',
      id: 'count-children',
      label: 'Count children',
      icon: 'FolderOpen',
      when: (ctx) => Boolean(ctx.target && ctx.app.project.available),
      onClick: (ctx) => {
        const id = ctx.target?.id;
        if (!id) return;
        const children = ctx.app.project.children(id);
        // `target.title` is a convenience — go to the store for anything real.
        const file = ctx.app.project.get(id);
        say(ctx, `${file?.title || 'untitled'}: ${children.length} child file(s)`);
      }
    });

    // -------------------------------------------------------------- editor.menu
    // Scoped to documents. Omitting `fileTypes` would put it in the sheet
    // editor's menu too, which is often right — narrow only when it isn't.
    this.registerSurfaceItem({
      surface: 'editor.menu',
      id: 'selection-stats',
      label: 'Selection stats',
      icon: 'ChartNoAxesColumn',
      fileTypes: ['document'],
      // The host resolves the selection when the menu OPENS, not when the row is
      // clicked — by click time the portal has taken focus and the selection may
      // be gone. So `target.text` is always the text the user right-clicked on.
      when: (ctx) => (ctx.target?.text?.length ?? 0) > 0,
      onClick: (ctx) => {
        const text = ctx.target?.text ?? '';
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        say(ctx, `${words} words, ${text.length} characters`);
      }
    });

    // ----------------------------------------------------------- plotcard.menu
    // Renders as a dropdown row on desktop and a bottom-sheet row on phones.
    // Same registration; the host picks the presentation.
    this.registerSurfaceItem({
      surface: 'plotcard.menu',
      id: 'card-title',
      label: 'Announce card',
      icon: 'Megaphone',
      onClick: (ctx) => say(ctx, ctx.target?.title || 'Untitled card'),
      order: 10
    });

    // ------------------------------------------------------- canvas.selection
    // A slot, not a menu: the canvas selection toolbar has no "…" to hang rows
    // off. `targets` carries the whole multi-selection, `target` its first entry.
    this.registerSurfaceItem({
      surface: 'canvas.selection',
      id: 'describe-selection',
      label: 'Describe selection',
      icon: 'HelpCircle',
      onClick: (ctx) => {
        const kinds = ctx.targets.map((t) => t.subtype ?? 'node');
        say(ctx, `${ctx.targets.length} selected: ${kinds.join(', ')}`);
      }
    });

    // ------------------------------------------------------------ pane.toolbar
    this.registerSurfaceItem({
      surface: 'pane.toolbar',
      id: 'pane-info',
      label: 'Pane info',
      icon: 'HelpCircle',
      onClick: (ctx) => say(ctx, `pane ${ctx.paneId ?? '?'} · file ${ctx.fileId ?? 'none'}`)
    });

    // ---------------------------------------------------------- pane.statusbar
    // A custom `render` for a live value. Only the document and sheet editors
    // report a word count, so it is scoped rather than left everywhere.
    this.registerSurfaceItem({
      surface: 'pane.statusbar',
      id: 'word-count',
      label: 'Word count',
      fileTypes: ['document', 'sheet'],
      render: WordCountStatus
    });

    // ------------------------------------------------------------- the guard
    // Deliberately broken, to show what a throw actually costs. The host catches
    // it, shows the fallback, and after three throws disables THIS ITEM for the
    // session — not the plugin, and not the menu. Disable and re-enable the
    // plugin to re-arm it.
    let crashCount = 0;
    this.registerSurfaceItem({
      surface: 'file.menu',
      id: 'crash-demo',
      label: 'Crash on purpose',
      icon: 'AlertCircle',
      variant: 'destructive',
      order: 99,
      onClick: () => {
        crashCount += 1;
        throw new Error(`deliberate failure #${crashCount}`);
      }
    });
  }
}
