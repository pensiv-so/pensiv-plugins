import type { FC } from 'react';
import type { AnyExtension } from '@tiptap/core';
import type { PluginManifest } from './types';
import type { HostApi } from './host-api';
import type { WidgetContribution } from './widget';
import type {
  AppHeaderActionContribution,
  ContributionDisposer,
  EditorExtensionOptions,
  EditorSurfaceId,
  HeaderActionContribution,
  LocalizedText,
  PaneContribution,
  PaneViewContribution,
  SettingsSchema,
  SidebarItemContribution,
  SlashItemContribution
} from './contributions';
import type { SurfaceItemContribution } from './surfaces';
import type { CanvasNodeContribution } from './canvas-node';
import type { AnalyticsSectionContribution } from './analytics';
import type { GraphSourceContribution, GraphFilterContribution } from './graph';

/** A TipTap extension paired with the editors it loads into. @internal */
export interface RegisteredEditorExtension {
  extension: AnyExtension;
  surfaces: EditorSurfaceId[];
}

/** A command a plugin contributes (palette / shortcut target). */
export interface PluginCommand {
  id: string;
  /** Display name. String, or a `{ lang: string }` map for localization. */
  name: LocalizedText;
  /** MonoIcon name for the command palette row. Defaults to the plugin's manifest icon. */
  icon?: string;
  run(): void;
}

/**
 * A settings tab a plugin contributes via `addSettingTab`. Provide a declarative
 * `schema` (the host renders a form, persisting values in this plugin's
 * `app.storage`) — or a trusted `render` component. `title` defaults to the
 * plugin name.
 */
export interface SettingTab {
  id?: string;
  title?: string;
  schema?: SettingsSchema;
  render?: FC<{ app: HostApi }>;
}

/**
 * Base class every plugin extends — deliberately Obsidian-shaped
 * (`onload`/`onunload`, `addCommand`, `registerWidget`, `addSettingTab`, …) so an
 * AI's existing plugin-authoring priors transfer.
 *
 * ```ts
 * import { Plugin } from '@pensiv/plugin-sdk';
 *
 * export default class MyPlugin extends Plugin {
 *   onload() {
 *     this.registerWidget({ id: 'hello', surface: 'any', component: HelloWidget });
 *     this.registerAppHeaderAction({ id: 'ping', label: 'Ping', icon: 'Activity',
 *       onClick: () => this.app.ui.toast('pong') });
 *   }
 * }
 * ```
 *
 * ## Lifecycle
 * `onload()` runs every time the plugin is **enabled** (first load and each
 * re-enable); register all contributions there. Disabling runs `onunload()` then
 * **disposes every contribution** automatically, so the editor extensions,
 * widgets, header actions, etc. disappear cleanly — and a later re-enable
 * re-registers them. Each `registerX` returns a {@link ContributionDisposer} you
 * can also call yourself; use {@link register} to attach extra teardown.
 *
 * The `_`-prefixed arrays are the registry's read surface (it aggregates
 * contributions across enabled plugins); authors never touch them directly.
 */
export abstract class Plugin {
  /** @internal Widgets registered in `onload`. */
  readonly _widgets: WidgetContribution[] = [];
  /** @internal Editor extensions registered in `onload`, with their surfaces. */
  readonly _editorExtensions: RegisteredEditorExtension[] = [];
  /** @internal Commands registered in `onload`. */
  readonly _commands: PluginCommand[] = [];
  /** @internal Editor `/` menu rows registered in `onload`. */
  readonly _slashItems: SlashItemContribution[] = [];
  /** @internal Setting tabs registered in `onload`. */
  readonly _settingTabs: SettingTab[] = [];
  /** @internal File-header actions registered in `onload`. */
  readonly _headerActions: HeaderActionContribution[] = [];
  /** @internal App-header actions registered in `onload`. */
  readonly _appHeaderActions: AppHeaderActionContribution[] = [];
  /** @internal Side-pane views registered in `onload`. */
  readonly _paneViews: PaneViewContribution[] = [];
  /** @internal Full panes (tabs) registered in `onload`. */
  readonly _panes: PaneContribution[] = [];
  /** @internal Sidebar items registered in `onload`. */
  readonly _sidebarItems: SidebarItemContribution[] = [];
  /** @internal Generic surface items (context menus, pane slots) registered in `onload`. */
  readonly _surfaceItems: SurfaceItemContribution[] = [];
  /** @internal Canvas node types registered in `onload`. */
  readonly _canvasNodes: CanvasNodeContribution[] = [];
  /** @internal Analytics sections registered in `onload`. */
  readonly _analyticsSections: AnalyticsSectionContribution[] = [];
  /** @internal Relationship-graph sources registered in `onload`. */
  readonly _graphSources: GraphSourceContribution[] = [];
  /** @internal Relationship-graph filters registered in `onload`. */
  readonly _graphFilters: GraphFilterContribution[] = [];

  /** Teardown callbacks run (LIFO) when the plugin unloads/disables. */
  private _disposers: ContributionDisposer[] = [];

  constructor(
    /** This plugin's grant-checked Host API. */
    readonly app: HostApi,
    /** This plugin's manifest. */
    readonly manifest: PluginManifest
  ) {}

  /** Called every time the plugin loads/enables. Register contributions here. */
  abstract onload(): void | Promise<void>;

  /** Optional teardown run before contributions are disposed on disable/unload. */
  onunload?(): void;

  /** Attach an arbitrary teardown callback to the plugin's lifecycle. */
  register(disposer: ContributionDisposer): void {
    this._disposers.push(disposer);
  }

  /** Push a contribution + auto-register the disposer that removes it. */
  private add<T>(list: T[], item: T): ContributionDisposer {
    list.push(item);
    const dispose: ContributionDisposer = () => {
      const i = list.indexOf(item);
      if (i >= 0) list.splice(i, 1);
    };
    this._disposers.push(dispose);
    return dispose;
  }

  /** Contribute a floating / pane / sheet widget. */
  registerWidget(widget: WidgetContribution): ContributionDisposer {
    return this.add(this._widgets, widget);
  }

  /**
   * Contribute a TipTap editor extension.
   *
   * Loads into the **document editor only** unless `options.surfaces` says
   * otherwise — an editor extension joins the schema and the transaction
   * pipeline, so it is opt-in per editor rather than everywhere-by-default:
   *
   * ```ts
   * this.registerEditorExtension(MyMark);                              // document
   * this.registerEditorExtension(MyMark, { surfaces: ['document', 'sheet'] });
   * ```
   */
  registerEditorExtension(
    extension: AnyExtension,
    options?: EditorExtensionOptions
  ): ContributionDisposer {
    return this.add(this._editorExtensions, {
      extension,
      surfaces: options?.surfaces ?? ['document']
    });
  }

  /** Contribute a command. */
  addCommand(command: PluginCommand): ContributionDisposer {
    return this.add(this._commands, command);
  }

  /**
   * Contribute a row to the editor's `/` menu. Document editor only unless
   * `surfaces` widens it.
   *
   * ```ts
   * this.registerSlashItem({
   *   id: 'timestamp', title: 'Timestamp', icon: 'Clock',
   *   run: (ctx) => ctx.app.editor.insert(new Date().toISOString())
   * });
   * ```
   */
  registerSlashItem(item: SlashItemContribution): ContributionDisposer {
    return this.add(this._slashItems, item);
  }

  /** Contribute a settings tab. */
  addSettingTab(tab: SettingTab): ContributionDisposer {
    return this.add(this._settingTabs, tab);
  }

  /** Contribute a button to a file header (rides the customizable header). */
  registerHeaderAction(action: HeaderActionContribution): ContributionDisposer {
    return this.add(this._headerActions, action);
  }

  /** Contribute a button to the project app header (Timer-button area). */
  registerAppHeaderAction(action: AppHeaderActionContribution): ContributionDisposer {
    return this.add(this._appHeaderActions, action);
  }

  /** Contribute a side-pane view (like Notes / Comments). */
  registerPaneView(view: PaneViewContribution): ContributionDisposer {
    return this.add(this._paneViews, view);
  }

  /** Contribute a full pane/tab (like the browser pane). Open via `app.ui.openPane(id)`. */
  registerPane(pane: PaneContribution): ContributionDisposer {
    return this.add(this._panes, pane);
  }

  /** Contribute an item/section to the project sidebar. */
  registerSidebarItem(item: SidebarItemContribution): ContributionDisposer {
    return this.add(this._sidebarItems, item);
  }

  /**
   * Contribute an item to any surface in the catalogue — context menus and pane
   * slots — rather than through a method per surface.
   *
   * ```ts
   * this.registerSurfaceItem({
   *   surface: 'file.menu',
   *   id: 'reveal',
   *   label: 'Show links',
   *   icon: 'Waypoints',
   *   when: (ctx) => ctx.target?.type !== 'folder',
   *   onClick: (ctx) => this.app.ui.toast(String(ctx.target?.title))
   * });
   * ```
   *
   * See {@link SurfaceItemContribution} for the catalogue and the scoping rules.
   * Callbacks run inside the host's guard, so a throw disables this one item
   * rather than the menu around it.
   */
  registerSurfaceItem(item: SurfaceItemContribution): ContributionDisposer {
    return this.add(this._surfaceItems, item);
  }

  /**
   * Contribute a section to Settings → Analytics.
   *
   * Unlike every other surface, this one is **declarative**: return the figures,
   * chart and rows from `data()` and the host renders them with the analytics
   * page's own cards, palette, hover and motion — identically on desktop and
   * phone. See {@link AnalyticsSectionContribution} for why, and for who owns
   * formatting.
   *
   * ```ts
   * this.registerAnalyticsSection({
   *   id: 'writing-time',
   *   async data({ app, range }) {
   *     const days = await app.session.history(range);
   *     return { stats: [{ label: 'Total', value: fmt(sum(days)) }] };
   *   }
   * });
   * ```
   *
   * `data()` runs inside the host's guard: a rejection renders an error line in
   * the card instead of taking the page down, and a section that keeps throwing
   * is disabled for the session.
   */
  registerAnalyticsSection(section: AnalyticsSectionContribution): ContributionDisposer {
    return this.add(this._analyticsSections, section);
  }

  /**
   * Contribute a canvas node type — the plugin's own object on a canvas, added
   * from the canvas toolbar like any built-in node.
   *
   * ```ts
   * this.registerCanvasNode({
   *   id: 'kanban',
   *   name: 'Kanban board',
   *   icon: 'Columns3',
   *   createDefaultState: () => ({ columns: [] }),
   *   render: KanbanNode
   * });
   * ```
   *
   * The host owns position, size, selection, undo, persistence and export; the
   * plugin owns the inner render and an opaque, size-capped `state`. See
   * {@link CanvasNodeContribution}.
   */
  registerCanvasNode(node: CanvasNodeContribution): ContributionDisposer {
    return this.add(this._canvasNodes, node);
  }

  /**
   * Contribute nodes and links to the relationship graph — a tag overlay, a
   * cluster view, references to something outside the project.
   *
   * ```ts
   * this.registerGraphSource({
   *   id: 'tags',
   *   nodes: () => [{ id: 'magic', name: '#magic' }],
   *   links: () => [{ source: 'magic', target: documentId }]
   * });
   * ```
   *
   * These nodes are **virtual**: never written to the project, never synced,
   * inert on click. For a node that persists, create a real entity through
   * `app.project` instead and the graph picks it up with no plugin code on the
   * render path. See {@link GraphSourceContribution}.
   */
  registerGraphSource(source: GraphSourceContribution): ContributionDisposer {
    return this.add(this._graphSources, source);
  }

  /**
   * Contribute a togglable graph filter. It appears as a switch in the graph
   * preferences popover, alongside the built-in ones, and starts **off** unless
   * `defaultEnabled` says otherwise — installing a plugin must never silently
   * hide part of the user's graph.
   */
  registerGraphFilter(filter: GraphFilterContribution): ContributionDisposer {
    return this.add(this._graphFilters, filter);
  }

  /**
   * @internal Called by the registry on disable/unload: runs `onunload()` then
   * disposes every contribution (LIFO), leaving the contribution arrays empty.
   */
  _teardown(): void {
    try {
      this.onunload?.();
    } catch (error) {
      console.error(`[plugin:${this.manifest.id}] onunload threw`, error);
    }
    for (const dispose of this._disposers.splice(0).reverse()) {
      try {
        dispose();
      } catch (error) {
        console.error(`[plugin:${this.manifest.id}] disposer threw`, error);
      }
    }
  }
}
