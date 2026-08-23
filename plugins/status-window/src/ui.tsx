/**
 * The app's settings primitives, re-stated.
 *
 * pensiv draws its own settings pages as `SettingsSection` → `SettingsCard` →
 * `SettingsRow`: a heading, a nested card, and rows with the label on the left
 * and the control on the right, divided by hairlines. Its own renderer for
 * declarative plugin schemas (`PluginSettingsForm`) uses exactly the same
 * primitives, which is why a schema-driven tab looks native for free.
 *
 * This tab can't be schema-driven — the preset list is dynamic and the template
 * needs a live preview beside it — so the layout is rebuilt here instead. The
 * Tailwind build never scans this repo, so the classes can't be imported, only
 * copied: every measurement below is read off the app's own components rather
 * than chosen.
 *
 *   card      rounded-2xl bg-muted/20 p-1.5 → inner rounded-xl border bg-card
 *   row       px-5 py-4, label left / control right, divide-y hairline
 *   switch    the app default (`sm`): track h-4 w-8, thumb h-3 w-4
 *   button    ghost — rounded-lg text-sm font-normal h-8 p-2, hover bg-muted/80
 *   dropdown  trigger h-10 rounded-lg border-input bg-card shadow-sm;
 *             menu rounded-xl bg-popover p-1 + floating-ring/shadow-xl;
 *             item rounded-lg py-1.5 pl-8 pr-2 with a left check (select.tsx)
 *   input     h-10 rounded-lg border-input bg-muted
 */
import * as React from 'react';

export const Section: React.FC<{
  title: string;
  description?: string;
  /** Right-aligned control beside the heading — the app's `action` slot. */
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, action, children }) => (
  <section className="pnsv-sw-sec">
    <header className="pnsv-sw-sec-head">
      <div className="pnsv-sw-sec-text">
        <h2 className="pnsv-sw-sec-title">{title}</h2>
        {description ? <p className="pnsv-sw-sec-desc">{description}</p> : null}
      </div>
      {action ? <div className="pnsv-sw-sec-action">{action}</div> : null}
    </header>
    <div className="pnsv-sw-sec-body">{children}</div>
  </section>
);

export const Card: React.FC<{ variant?: 'rows' | 'plain'; children: React.ReactNode }> = ({
  variant = 'rows',
  children
}) => (
  <div className="pnsv-sw-card">
    <div className="pnsv-sw-card-inner" data-variant={variant}>
      {children}
    </div>
  </div>
);

export const Row: React.FC<{
  label: string;
  description?: string;
  /** Put the control under the label at full width — for textareas and previews. */
  stacked?: boolean;
  children: React.ReactNode;
}> = ({ label, description, stacked, children }) => (
  <div className="pnsv-sw-srow" data-stacked={stacked ? 'true' : undefined}>
    <div className="pnsv-sw-srow-text">
      <span className="pnsv-sw-srow-label">{label}</span>
      {description ? <p className="pnsv-sw-srow-desc">{description}</p> : null}
    </div>
    <div className="pnsv-sw-srow-control">{children}</div>
  </div>
);

export const Switch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className="pnsv-sw-switch"
    data-on={checked ? 'true' : undefined}
    onClick={() => onChange(!checked)}
  >
    <span className="pnsv-sw-switch-thumb" />
  </button>
);

/**
 * The app's Button, ghost/outline variants at the `sm` size (h-8 p-2).
 *
 * No danger variant on purpose: destructive actions here confirm or are
 * recoverable, and red-at-rest turns a settings page into a page of warnings.
 */
export const GhostButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'ghost' | 'outline';
  disabled?: boolean;
  title?: string;
}> = ({ onClick, children, variant = 'ghost', disabled, title }) => (
  <button
    type="button"
    className="pnsv-sw-ghostbtn"
    data-variant={variant === 'outline' ? 'outline' : undefined}
    disabled={disabled}
    title={title}
    onClick={onClick}
  >
    {children}
  </button>
);

/** Square ghost button for a lone glyph — the app's `typeVariant="icon"` at sm. */
export const IconGhostButton = React.forwardRef<
  HTMLButtonElement,
  {
    label: string;
    children: React.ReactNode;
    className?: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  } & Pick<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'draggable' | 'onDragStart' | 'onDragEnd'
  >
>(({ label, children, className, onClick, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    className={`pnsv-sw-ghostbtn${className ? ` ${className}` : ''}`}
    data-icon="true"
    aria-label={label}
    title={label}
    onClick={onClick}
    {...rest}
  >
    {children}
  </button>
));
IconGhostButton.displayName = 'IconGhostButton';

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * The app's Select, re-drawn: outline trigger with a chevron, a popover panel
 * on the floating-ring shadow, and a check beside the current value. A native
 * `<select>` can't be styled into this — the panel is OS chrome — so the panel
 * is ours.
 *
 * Dismissal is a **capture-phase `pointerdown` listener**, not a full-screen
 * scrim. The scrim looked safe and wasn't: it blocked scrolling and every
 * other control while open, and inside a `<label>` its click was re-dispatched
 * to the trigger by label activation — close, reopen, and the panel reads as
 * stuck. The listener closes on any press outside without eating it, exists
 * only while open, and unregisters on unmount via the effect cleanup.
 */
export const Dropdown: React.FC<{
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<DropdownOption>;
  label: string;
  /** w-56 rather than w-44 — for lists with long names, like the presets. */
  wide?: boolean;
  /** h-8 trigger for dense homes, like the library row editor. */
  size?: 'default' | 'sm';
  /** Which trigger edge the panel hangs from. Row controls sit right: `end`. */
  align?: 'start' | 'end';
}> = ({ value, onChange, options, label, wide, size = 'default', align = 'end' }) => {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLSpanElement | null>(null);
  const current = options.find((option) => option.value === value);

  React.useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  return (
    <span className="pnsv-sw-dd" ref={rootRef}>
      <button
        type="button"
        className="pnsv-sw-dd-trigger"
        data-wide={wide ? 'true' : undefined}
        data-size={size === 'sm' ? 'sm' : undefined}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <span className="pnsv-sw-dd-value">{current?.label ?? value}</span>
        {/* The app's ChevronDown at opacity-50, from its own sprite. */}
        <svg
          className="pnsv-sw-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <ul
          className="pnsv-sw-dd-menu"
          data-align={align}
          role="listbox"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="pnsv-sw-dd-item"
                onClick={() => {
                  setOpen(false);
                  onChange(option.value);
                }}
              >
                {option.value === value ? (
                  <svg
                    className="pnsv-sw-dd-check"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
                <span className="pnsv-sw-dd-item-label">{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  );
};

export const TextBox: React.FC<{
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder?: string;
  width?: 'sm' | 'md';
  mono?: boolean;
}> = ({ value, onChange, label, placeholder, width = 'md', mono }) => (
  <input
    className="pnsv-sw-input2"
    data-width={width}
    data-mono={mono ? 'true' : undefined}
    type="text"
    aria-label={label}
    value={value}
    placeholder={placeholder}
    onChange={(event) => onChange(event.target.value)}
  />
);

/**
 * A dropdown of common values with an escape to free text.
 *
 * The separators and arrows are conventions with three or four real answers
 * each — a bare text box makes the writer invent one, and a bare dropdown boxes
 * in anyone whose serial uses something else. Picking "직접 입력" swaps in an
 * input; typing a value the list already has switches back to the dropdown on
 * the next render, so the two never disagree.
 */
export const ChoiceOrCustom: React.FC<{
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<DropdownOption>;
  label: string;
  customLabel: string;
}> = ({ value, onChange, options, label, customLabel }) => {
  const known = options.some((option) => option.value === value);
  const [custom, setCustom] = React.useState(!known);

  // A value pasted in from elsewhere (or restored from defaults) decides the
  // mode; only an explicit pick of "직접 입력" keeps the input open on a value
  // that happens to be in the list.
  React.useEffect(() => {
    if (!known) setCustom(true);
  }, [known]);

  return (
    <>
      <Dropdown
        label={label}
        value={custom ? '__custom' : value}
        onChange={(next) => {
          if (next === '__custom') {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(next);
        }}
        options={[...options, { value: '__custom', label: customLabel }]}
      />
      {custom ? (
        <TextBox label={label} value={value} onChange={onChange} width="sm" mono />
      ) : null}
    </>
  );
};
