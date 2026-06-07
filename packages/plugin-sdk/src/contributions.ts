import type { FC } from 'react';
import type { HostApi } from './host-api';
import type { LocalizedText } from './types';

export type { LocalizedText };

/**
 * Contribution shapes a plugin registers in `onload()` to extend the app's UI
 * surfaces (beyond floating widgets). Each is host-agnostic data + callbacks;
 * the desktop hosts render them. Like {@link WidgetContribution}, render-bearing
 * contributions carry a React `FC` — the serializable `ctx.ui.*` path replaces
 * that later for sandbox/mobile.
 */

/** Teardown handle returned by every `Plugin.registerX(...)` call. */
export type ContributionDisposer = () => void;

/**
 * Runtime context handed to an action when it fires. Lazily reflects the live
 * route/project/file (same data as `app.app`), plus the plugin's Host API.
 */
export interface ActionContext {
  app: HostApi;
  projectId?: string;
  fileId?: string;
}

/** File-type headers an action can appear in (mirrors the host's header types). */
export type HeaderFileTypeId = 'document' | 'sheet' | 'plotboard' | 'folder' | 'canvas' | 'task';

/**
 * A button contributed to a file header (e.g. the document toolbar). It rides
 * the existing customizable-header system — users can show/hide and reorder it
 * alongside the built-in header items.
 */
export interface HeaderActionContribution {
  id: string;
  /** i18n key or literal; used as tooltip + label in the customize menu. */
  label: string;
  /** MonoIcon name. */
  icon: string;
  /** Headers it appears in. Defaults to `['document']`. */
  fileTypes?: HeaderFileTypeId[];
  /** Invoked on click. */
  onClick(ctx: ActionContext): void;
  /** Optional pressed/active highlight. */
  isActive?(ctx: ActionContext): boolean;
}

/** Props a custom app-header widget receives. */
export interface AppHeaderActionProps {
  app: HostApi;
  projectId?: string;
  fileId?: string;
}

/** A button contributed to the project app header (where the Timer button is). */
export interface AppHeaderActionContribution {
  id: string;
  /** Tooltip / accessible label. */
  label: string;
  /** MonoIcon name. */
  icon: string;
  /** Invoked on click (for the default icon-button form). */
  onClick?(ctx: ActionContext): void;
  isActive?(ctx: ActionContext): boolean;
  /**
   * Custom live header component (e.g. a Timer button with a countdown + popover).
   * When set, the host renders this instead of the default icon button.
   */
  render?: FC<AppHeaderActionProps>;
}

/** Props a side-pane view receives from the host. */
export interface PaneViewProps {
  app: HostApi;
  projectId?: string;
  fileId?: string;
  /** Close this side pane. */
  close(): void;
}

/**
 * A view a plugin can open in the document side pane (like Notes / Comments).
 * Opened via a header/app-header action that calls `app.ui.openPaneView(id)`
 * (or the host's pane API) — see the implementation docs.
 */
export interface PaneViewContribution {
  id: string;
  /** i18n key or literal title shown in the pane header. */
  title: string;
  /** MonoIcon name. */
  icon: string;
  render: FC<PaneViewProps>;
}

/** Props a full plugin pane (tab) receives. */
export interface PaneProps {
  app: HostApi;
  projectId?: string;
  /** The split-view pane this pane is mounted in. */
  paneId: string;
}

/**
 * A full pane/tab a plugin owns in the split view — like the built-in browser or
 * relationship-graph panes, as opposed to a *side* pane (`PaneViewContribution`).
 * Opened with `app.ui.openPane(id)` (from a command / sidebar item / action).
 *
 * (Panes that need privileged surfaces — e.g. an Electron `<webview>` for a real
 * in-app browser — are possible but host-specific; a plain plugin pane renders
 * design-system UI like any other.)
 */
export interface PaneContribution {
  id: string;
  /** i18n key or literal title shown in the tab. */
  title: string;
  /** MonoIcon name shown in the tab. */
  icon: string;
  render: FC<PaneProps>;
}

/** A `{ value, label }` choice for `select` / `radio` fields. */
export interface SettingOption {
  value: string;
  label: LocalizedText;
}

/**
 * Gates a field's visibility (`visibleWhen`) or enabled state (`disabledWhen`)
 * on the live value of a *sibling* field (same schema level / group). The field
 * is active only while the referenced key's value equals `equals` — e.g. show the
 * goal target only when `enabled` is `true`. Serializable on purpose.
 */
export interface FieldCondition {
  /** Key of a sibling field whose value this condition reads. */
  key: string;
  /** Active only when that field's value equals this. */
  equals: string | number | boolean;
}

/** One or more conditions; an array means **all** must hold (AND). */
export type FieldConditions = FieldCondition | FieldCondition[];

/** Properties shared by every concrete (value-bearing) setting field. */
/**
 * Device form factor the host is rendering on. Coarser than {@link AppApi.platform}
 * (`desktop`/`mobile`/`web`) because the mobile app spans both `tablet` and
 * `phone`; the host resolves the current one when filtering {@link BaseSettingField.formFactors}.
 */
export type PluginFormFactor = 'desktop' | 'tablet' | 'phone' | 'web';

interface BaseSettingField {
  /** Storage key under the plugin's `app.storage`. Unique within the schema. */
  key: string;
  label: LocalizedText;
  description?: LocalizedText;
  /** Optional sample glyph(s) shown in a mono chip next to the label (e.g. `"( )"`). */
  sample?: string;
  /** Render only while this condition (or all, if an array) holds (sibling-driven). */
  visibleWhen?: FieldConditions;
  /** Render but disable (greyed) unless this condition (or all) holds. */
  disabledWhen?: FieldConditions;
  /**
   * Restrict this field to specific device form factors. Omit = every surface.
   * Use for settings that only make sense on some devices — e.g. a "floating
   * widget" toggle or desktop menu-bar option (`['desktop', 'tablet', 'web']`),
   * which the phone settings sheet then hides.
   */
  formFactors?: PluginFormFactor[];
}

/** One editable column of an `object-list` row. */
export interface ObjectListColumn {
  /** Property edited on each row object. */
  key: string;
  label?: LocalizedText;
  type: 'text' | 'number' | 'toggle';
  placeholder?: LocalizedText;
  /**
   * `title` = the row's primary text (shown bold / used as the row label);
   * `visible` = a per-row show/hide toggle (rendered as an eye toggle).
   * Omit for an ordinary inline column.
   */
  role?: 'title' | 'visible';
}

/**
 * One field in a plugin settings schema. The host renders the matching control
 * and persists the value under `key` in the plugin's `app.storage`, so reading
 * it back is `app.storage.get(key) ?? field.default`.
 *
 * Beyond the scalar controls, `radio` is a select rendered as a radio group,
 * `list` is an inline editor for an array of primitives (e.g. Timer presets), and
 * `object-list` is an add/remove/reorder editor for an array of objects (e.g.
 * Browser bookmarks). Use {@link SettingGroup} to box related fields into a
 * titled section.
 */
export type SettingField =
  | (BaseSettingField & { type: 'toggle'; default?: boolean })
  | (BaseSettingField & { type: 'text'; default?: string; placeholder?: LocalizedText })
  | (BaseSettingField & {
      type: 'number';
      default?: number;
      min?: number;
      max?: number;
      step?: number;
    })
  | (BaseSettingField & { type: 'select'; default?: string; options: SettingOption[] })
  | (BaseSettingField & { type: 'radio'; default?: string; options: SettingOption[] })
  | (BaseSettingField & {
      /** A numeric slider. Stores a number. */
      type: 'slider';
      default?: number;
      min?: number;
      max?: number;
      step?: number;
      /** Optional unit suffix shown next to the live value (e.g. `px`, `%`). */
      unit?: string;
    })
  | (BaseSettingField & {
      /** A color picker. Stores a CSS color string (hex). */
      type: 'color';
      default?: string;
    })
  | (BaseSettingField & {
      /** Inline editor for an array of primitives. */
      type: 'list';
      itemType: 'number' | 'text';
      default?: Array<string | number>;
      /** Fixed/min/max item counts. Fixed-length (e.g. Timer's 3 presets): set both equal. */
      minItems?: number;
      maxItems?: number;
      /** Clamp range for `number` items. */
      itemMin?: number;
      itemMax?: number;
      addLabel?: LocalizedText;
    })
  | (BaseSettingField & {
      /**
       * Add/remove/reorder editor for an array of objects. The host assigns each
       * row a stable `id`, and — when `sortable` — a lexorank used for ordering;
       * rows are otherwise the column values. Reads back as `app.storage.get(key)`.
       */
      type: 'object-list';
      columns: ObjectListColumn[];
      default?: Array<Record<string, unknown>>;
      /** Enable drag-to-reorder (lexorank-backed). */
      sortable?: boolean;
      addLabel?: LocalizedText;
      emptyLabel?: LocalizedText;
    });

/**
 * A titled section that boxes related fields together (the bordered groups in the
 * Timer / Goal settings). Not a value itself — it has no `key`; it only groups.
 */
export interface SettingGroup {
  type: 'group';
  title?: LocalizedText;
  description?: LocalizedText;
  /** Items in the group — may include nested groups and dividers. */
  fields: SettingItem[];
  /** Show the whole group only while this condition (or all, if an array) holds. */
  visibleWhen?: FieldConditions;
  /** Dim/disable the whole section unless this condition (or all) holds. */
  disabledWhen?: FieldConditions;
}

/** A thin separator between options inside a section. */
export interface SettingDivider {
  type: 'divider';
  /** Optional caption shown on the divider. */
  label?: LocalizedText;
  visibleWhen?: FieldConditions;
}

/** A standalone heading (title + optional description), not boxed like a group. */
export interface SettingHeader {
  type: 'header';
  title: LocalizedText;
  description?: LocalizedText;
  visibleWhen?: FieldConditions;
}

/** A top-level entry in a schema: a field, a (nested) group, a divider, or a heading. */
export type SettingItem = SettingField | SettingGroup | SettingDivider | SettingHeader;

/**
 * Declarative settings schema a plugin contributes via `addSettingTab`. The host
 * renders it into a form; no plugin UI code needed (and it stays serializable for
 * the sandbox). Values live in the plugin's `app.storage` namespace.
 */
export interface SettingsSchema {
  /** Top-level fields and/or titled groups, rendered top-to-bottom. */
  fields: SettingItem[];
}

/** Props a sidebar section receives. */
export interface SidebarItemProps {
  app: HostApi;
  projectId?: string;
}

/**
 * An item/section a plugin contributes to the project sidebar (the file-tree
 * rail). Either a simple clickable entry (`onClick`) or a rendered section
 * (`render`).
 */
export interface SidebarItemContribution {
  id: string;
  /** i18n key or literal label. */
  title: string;
  /** MonoIcon name. */
  icon: string;
  onClick?(ctx: ActionContext): void;
  render?: FC<SidebarItemProps>;
}
