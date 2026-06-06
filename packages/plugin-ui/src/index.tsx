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
    '.pnsv-ui-btn{transition:filter .12s ease,background-color .12s ease}',
    '.pnsv-ui-btn:active{filter:brightness(.96)}'
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

/** Full-width primary action at the foot of a sheet. */
export const SheetButton: React.FC<SheetButtonProps> = ({
  label,
  onClick,
  variant = 'primary',
  disabled
}) => {
  useKitStyles();
  const base: React.CSSProperties = {
    height: '3rem',
    width: '100%',
    borderRadius: 'calc(var(--radius) + 0.25rem)',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1
  };
  const style: React.CSSProperties =
    variant === 'primary'
      ? { ...base, border: 'none', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }
      : { ...base, border: '1px solid hsl(var(--border))', background: 'transparent', color: 'hsl(var(--foreground))' };
  return (
    <button type="button" className="pnsv-ui-btn" onClick={onClick} disabled={disabled} style={style}>
      {label}
    </button>
  );
};

/** Vertical stack with the sheet's standard gap — the body's top-level layout. */
export const SheetStack: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{children}</div>
);
