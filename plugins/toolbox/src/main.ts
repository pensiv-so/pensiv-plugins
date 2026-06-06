import { Plugin } from '@pensiv/plugin-sdk';

/**
 * A non-visual example exercising three contribution surfaces at once — useful
 * for verifying the host wiring + the live focus context (`ctx.projectId`/
 * `ctx.fileId` should follow the focused pane):
 *   - a command (command palette)
 *   - an app-header action (button next to the Timer)
 *   - a sidebar item (project sidebar footer)
 *
 * All three just toast, so it needs no permissions.
 */
export default class ToolboxPlugin extends Plugin {
  onload(): void {
    this.addCommand({
      id: 'ping',
      name: 'Toolbox: Ping',
      run: () => this.app.ui.toast('Toolbox: command ran 🛠️')
    });

    this.registerAppHeaderAction({
      id: 'ping',
      label: 'Toolbox Ping',
      icon: 'Sparkles',
      onClick: (ctx) =>
        this.app.ui.toast(`Toolbox header action — project: ${ctx.projectId ?? 'none'}`)
    });

    this.registerSidebarItem({
      id: 'ping',
      title: 'Toolbox',
      icon: 'Box',
      onClick: (ctx) => this.app.ui.toast(`Toolbox sidebar — file: ${ctx.fileId ?? 'none'}`)
    });

    // Document-header action (rides the customizable header; show/hide + reorder
    // it via the header's customize menu like any built-in button).
    this.registerHeaderAction({
      id: 'ping',
      label: 'Toolbox Ping',
      icon: 'Sparkles',
      fileTypes: ['document'],
      onClick: (ctx) =>
        this.app.ui.toast(`Toolbox doc-header — file: ${ctx.fileId ?? 'none'}`)
    });
  }
}
