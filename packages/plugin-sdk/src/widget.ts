import type { FC } from 'react';
import type { WidgetSurface, WidgetCorner } from './types';
import type { HostApi } from './host-api';

/**
 * Props every widget component receives from the host. Widgets mostly drive
 * themselves through their own hooks, but `projectId` and the typed `app` Host
 * API are always provided so plugin-authored widgets have what they need without
 * reaching into app internals.
 */
export interface WidgetProps {
  /** The project the widget is mounted in, if any. */
  projectId?: string;
  /** This plugin's grant-checked Host API. */
  app: HostApi;
}

/**
 * A widget a plugin contributes, registered via `Plugin.registerWidget`.
 *
 * Carries a React `component` the host mounts. For in-process installs the
 * component runs directly; behind a future sandbox the same shape gains a
 * serializable render path (`ctx.ui.*`) without changing authoring.
 */
export interface WidgetContribution {
  /** Unique within the plugin. */
  id: string;
  /** Where it may mount. `any` lets the host pick per surface. */
  surface: WidgetSurface;
  /** Initial corner for floating surfaces. */
  defaultCorner?: WidgetCorner;
  /** Key for persisted corner / stack order. */
  storageKey?: string;
  /**
   * How the host frames the widget:
   *   - `'floating'` — the host wraps the component in the draggable, corner-
   *     snapping, stackable floating chrome (`FloatingWidget`). The plugin
   *     returns **only its inner content** and never imports the chrome itself,
   *     so it stays self-contained (liftable to its own repo). Uses
   *     `defaultCorner` / `storageKey`.
   *   - `'none'` — the host mounts the component bare; the plugin draws its own
   *     surface (e.g. full-screen portal overlays).
   * Defaults to `'none'`.
   */
  frame?: 'floating' | 'none';
  /**
   * Optional mount gate. When it returns `false` the widget is not mounted at all
   * (no floating chrome, no stack slot) — e.g. a Timer widget hidden by its own
   * "show floating widget" setting, or a project-scoped widget with no project.
   * Re-evaluated as settings / project context change.
   */
  shouldRender?(ctx: { app: HostApi; projectId?: string }): boolean;
  /**
   * In-process React component. For `frame: 'floating'` it returns inner content
   * only; for `frame: 'none'` it renders its own surface.
   */
  component: FC<WidgetProps>;
  /**
   * Optional **compact** render for a host chip/summary surface (e.g. the mobile
   * project widget tray). Returns *only the inner content* of the chip (a live
   * value / icon) — the host owns the pill chrome + tap-to-open behaviour and
   * opens {@link component} (the full widget) on tap. Shares the plugin's state
   * with `component`, so the two stay in sync. Surfaces that have no chip slot
   * ignore this.
   */
  chip?: FC<WidgetProps>;
  /**
   * Optional mount gate for the **chip** surface specifically (host pill, e.g.
   * the mobile project tray). When omitted the host falls back to
   * {@link shouldRender}. Use this when the chip's visibility differs from the
   * floating widget's — e.g. a Timer whose floating widget is off by default
   * (`shouldRender` = "show floating widget") but whose tray chip should always
   * be available. The host evaluates this *before* rendering the pill (so it can
   * omit an empty pill), unlike returning `null` from {@link chip}.
   */
  chipShouldRender?(ctx: { app: HostApi; projectId?: string }): boolean;
  /**
   * Optional accent gate for the chip's host pill (e.g. a goal that's been hit).
   * When it returns `true` the host draws an accent ring around the pill —
   * host-chrome the chip can't paint itself. Re-evaluated by the host as settings
   * / editor content / session totals change, so it tracks live state.
   */
  chipAccent?(ctx: { app: HostApi; projectId?: string }): boolean;
  /**
   * Optional render for a host **bottom-sheet** body (mobile phone). When a chip
   * is tapped the host opens a sheet and renders this; falls back to
   * {@link component} when absent. Lets a widget show a phone-native sheet layout
   * distinct from its floating-card `component` (desktop / tablet).
   */
  sheet?: FC<WidgetProps>;
}
