/**
 * `@pensiv/plugin-ui` — the host-provided UI kit plugins compose their surfaces
 * from (bottom-sheet bodies today; widget cards / panes later). It is exposed to
 * plugin bundles through the same import-map that shares `react` / `@pensiv/plugin-sdk`
 * (see {@link file://./bundle-loader.ts}), so plugins render the *host's* live
 * components — one source of truth, no per-plugin inline-style drift, automatically
 * theme-correct on every platform.
 *
 * Implementation notes:
 *  - Pure presentational primitives, styled with the app's CSS variables
 *    (`--card`, `--border`, `--foreground`, …) so they track the active theme.
 *  - Interaction states (press / hover) come from a one-time injected stylesheet
 *    (inline styles can't express `:active`).
 *  - Keep this the single authoritative copy; the plugin-repo `@pensiv/plugin-ui`
 *    package mirrors only the public surface for type-checking (like `plugin-sdk`).
 */
import * as React from 'react';

const STYLE_ID = 'pnsv-plugin-ui';

/** Inject the kit's interaction styles once (press/hover can't be inline). */
function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = [
    '.pnsv-ui-row{transition:background-color .12s ease}',
    '.pnsv-ui-row:active{background:hsl(var(--muted) / 0.8)}',
    '@media(hover:hover){.pnsv-ui-row:hover{background:hsl(var(--muted) / 0.8)}}',
    // `SheetButton`, restated from the app's `Button` (`components/ui/button.tsx`).
    // It lives here rather than inline because the whole point is the states an
    // inline style can't express — and because a flat fill was what made these
    // read as someone else's control: the app's default variant is a primary/95
    // hairline over a gradient that darkens toward the bottom, with shadow-sm.
    '.pnsv-ui-btn{display:inline-flex;align-items:center;justify-content:center;' +
      'gap:.375rem;white-space:nowrap;align-self:flex-end;height:2.5rem;padding:0 .75rem;' +
      'border:1px solid transparent;border-radius:calc(var(--radius) + .1rem);' +
      'font:inherit;font-size:.875rem;font-weight:400;line-height:1;' +
      'color:hsl(var(--foreground));background:transparent;cursor:pointer;user-select:none;' +
      '-webkit-app-region:no-drag;transition:all .15s ease}',
    '.pnsv-ui-btn:active:not(:disabled){transform:scale(.98)}',
    '.pnsv-ui-btn:disabled{opacity:.2;pointer-events:none}',
    '.pnsv-ui-btn:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:2px}',
    // variant="outline": `border bg-card hover:bg-muted/50 shadow-sm`.
    '.pnsv-ui-btn[data-variant="outline"]{border-color:hsl(var(--border));' +
      'background:hsl(var(--card));box-shadow:var(--shadow-sm)}',
    '@media(hover:hover){.pnsv-ui-btn[data-variant="outline"]:hover' +
      '{background:hsl(var(--muted) / 0.5)}}',
    // variant="primary" = the app's `default`. The flat fill stays as the
    // fallback for engines without relative colour syntax.
    '.pnsv-ui-btn[data-variant="primary"]{font-weight:500;' +
      'color:hsl(var(--primary-foreground));border-color:hsl(var(--primary) / 0.95);' +
      'background:hsl(var(--primary));background:linear-gradient(180deg,' +
      'hsl(var(--primary)),hsl(from hsl(var(--primary)) h s calc(l * 0.9)));' +
      'box-shadow:var(--shadow-sm)}',
    // Hover darkens the same gradient one step — the native hover, no colour shift.
    '@media(hover:hover){.pnsv-ui-btn[data-variant="primary"]:hover' +
      '{background:hsl(var(--primary) / 0.9);background:linear-gradient(180deg,' +
      'hsl(from hsl(var(--primary)) h s calc(l * 0.9)),' +
      'hsl(from hsl(var(--primary)) h s calc(l * 0.85)))}}'
  ].join('');
  document.head.appendChild(el);
}

function useKitStyles(): void {
  React.useEffect(ensureStyles, []);
}

// ─── Group ───────────────────────────────────────────────────────────────────
const groupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  borderRadius: 'calc(var(--radius) + 0.25rem)',
  background: 'hsl(var(--card))',
  padding: '0.5rem',
  boxShadow: '0 0 24px 0 rgba(0, 0, 0, 0.05)'
};

export interface SheetGroupProps {
  children: React.ReactNode;
  /** Escape hatch for one-off layout tweaks (rarely needed). */
  style?: React.CSSProperties;
}

/** A grouped block of rows — the native `SheetItemGroup` card. */
export const SheetGroup: React.FC<SheetGroupProps> = ({ children, style }) => (
  <div style={style ? { ...groupStyle, ...style } : groupStyle}>{children}</div>
);

// ─── Rows ────────────────────────────────────────────────────────────────────
const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: '2.75rem',
  borderRadius: 'calc(var(--radius) + 0.1rem)',
  padding: '0 0.625rem'
};

export interface SheetStatRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
}

/** A non-interactive `label — value` row (e.g. a goal stat). */
export const SheetStatRow: React.FC<SheetStatRowProps> = ({ label, value }) => (
  <div style={{ ...rowBase, justifyContent: 'space-between', gap: '1rem' }}>
    <span
      style={{ minWidth: 0, flexShrink: 1, fontSize: '1rem', color: 'hsl(var(--muted-foreground))' }}
    >
      {label}
    </span>
    <span
      style={{
        flexShrink: 0,
        textAlign: 'right',
        fontSize: '1rem',
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color: 'hsl(var(--foreground))'
      }}
    >
      {value}
    </span>
  </div>
);

export interface SheetActionRowProps {
  /** Optional leading glyph (a plugin-supplied SVG/element). */
  icon?: React.ReactNode;
  label: React.ReactNode;
  onClick?: () => void;
  /** Optional trailing content (e.g. a chevron or value). */
  trailing?: React.ReactNode;
  tone?: 'default' | 'destructive';
  disabled?: boolean;
}

/** A tappable row — the native ghost `SheetItem` (icon + label, press feedback). */
export const SheetActionRow: React.FC<SheetActionRowProps> = ({
  icon,
  label,
  onClick,
  trailing,
  tone = 'default',
  disabled
}) => {
  useKitStyles();
  const color = tone === 'destructive' ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))';
  return (
    <button
      type="button"
      className="pnsv-ui-row"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...rowBase,
        gap: '0.75rem',
        width: '100%',
        border: 'none',
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        font: 'inherit',
        fontSize: '1rem',
        fontWeight: 500,
        color,
        textAlign: 'left'
      }}
    >
      {icon != null ? (
        <span
          style={{
            display: 'inline-flex',
            flexShrink: 0,
            color: tone === 'destructive' ? color : 'hsl(var(--muted-foreground))'
          }}
        >
          {icon}
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {trailing != null ? <span style={{ flexShrink: 0, marginLeft: 'auto' }}>{trailing}</span> : null}
    </button>
  );
};

/** Hairline divider between rows in a {@link SheetGroup} (native `SheetItemSeparator`). */
export const SheetSeparator: React.FC = () => (
  <div style={{ height: 1, background: 'hsl(var(--border))' }} aria-hidden />
);

export interface SheetButtonProps {
  label: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
}

/**
 * The action at the foot of a sheet — the app's `Button`, `default` /`outline`.
 *
 * Sized and aligned for the host that renders it. On desktop a plugin sheet is a
 * dialog, and a dialog's confirm button is a right-aligned control at its natural
 * width, not a full-bleed bar — so it takes the app's default `sizeVariant`
 * (h-10, p-3) and `align-self: flex-end` inside {@link SheetStack}. The app's
 * mobile override keeps it full-width, because there the sheet is a real bottom
 * sheet and a full-width action is that surface's own convention.
 */
export const SheetButton: React.FC<SheetButtonProps> = ({
  label,
  onClick,
  variant = 'primary',
  disabled
}) => {
  useKitStyles();
  return (
    <button
      type="button"
      className="pnsv-ui-btn"
      data-variant={variant}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

/** Vertical stack with the sheet's standard gap — the body's top-level layout. */
export const SheetStack: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{children}</div>
);
