import type { FC } from 'react';
import type { AnyExtension } from '@tiptap/core';
import type { PluginManifest } from './types';
import type { HostApi } from './host-api';
import type { WidgetContribution } from './widget';
import type {
  AppHeaderActionContribution,
  ContributionDisposer,
  HeaderActionContribution,
  LocalizedText,
  PaneContribution,
  PaneViewContribution,
  SettingsSchema,
  SidebarItemContribution
} from './contributions';

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
 * Base class every plugin extends — a familiar plugin shape
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
  /** @internal Editor extensions registered in `onload`. */
  readonly _editorExtensions: AnyExtension[] = [];
  /** @internal Commands registered in `onload`. */
  readonly _commands: PluginCommand[] = [];
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

  /** Contribute a TipTap editor extension. */
  registerEditorExtension(extension: AnyExtension): ContributionDisposer {
    return this.add(this._editorExtensions, extension);
  }

  /** Contribute a command. */
  addCommand(command: PluginCommand): ContributionDisposer {
    return this.add(this._commands, command);
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
