/**
 * The row editors — one per value kind.
 *
 * ## Compact by default, expanded on demand
 *
 * A sheet is seventeen rows. Showing every field of every row at once turns the
 * side pane into a wall, so a row is one line — name on the left, the value as
 * the reader will see it on the right — and clicking it opens the fields for
 * that row underneath. Only one row is open at a time.
 *
 * The collapsed line shows the *formatted* value, not the raw fields. That is
 * the point of the whole plugin: the writer should be looking at `415(+566)`,
 * not at three numbers they have to assemble in their head.
 *
 * ## Everything here is the app's own control
 *
 * The Tailwind build never scans this repo, so the classes can't be imported —
 * only re-stated in `styles.css` against the host's tokens (`--input`,
 * `--border`, `--radius`, `--muted-foreground`). Sizes and radii come from the
 * app's input and button components; nothing is invented.
 */
import * as React from 'react';
import type { AttributeDef, AttributeValue } from './model';
import type { StringKey } from './i18n';
import { Dropdown } from './ui';

export interface FieldProps {
  def: AttributeDef;
  value: AttributeValue;
  onChange: (next: AttributeValue) => void;
  t: (key: StringKey) => string;
}

/** Parse a number input without letting an empty box become `NaN`. */
const toNumber = (raw: string): number => {
  const parsed = Number(raw.replace(/[，,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * A labelled cell inside a row editor.
 *
 * `interactive` renders a `<div>` instead of a `<label>`. A label re-dispatches
 * any click on itself to its first button descendant, so wrapping a custom
 * dropdown in one makes every press inside the cell — including the panel the
 * trigger opened — toggle the trigger again. Only real form controls get the
 * label element.
 */
const Cell: React.FC<{
  label: string;
  children: React.ReactNode;
  grow?: boolean;
  interactive?: boolean;
}> = ({ label, children, grow, interactive }) => {
  const Element: 'div' | 'label' = interactive ? 'div' : 'label';
  return (
    <Element className="pnsv-sw-cell" data-grow={grow ? 'true' : undefined}>
      <span className="pnsv-sw-cell-label">{label}</span>
      {children}
    </Element>
  );
};

const NumberInput: React.FC<{
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <input
    className="pnsv-sw-input"
    type="text"
    inputMode="numeric"
    value={String(value)}
    placeholder={placeholder}
    onChange={(event) => onChange(toNumber(event.target.value))}
    // Select-on-focus: these are almost always overwritten, not appended to.
    onFocus={(event) => event.target.select()}
  />
);

const TextInput: React.FC<{
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <input
    className="pnsv-sw-input"
    type="text"
    value={value}
    placeholder={placeholder}
    onChange={(event) => onChange(event.target.value)}
  />
);

/** The fields for one attribute, dispatched on the value's kind. */
export const FieldEditor: React.FC<FieldProps> = ({ def, value, onChange, t }) => {
  switch (value.kind) {
    case 'text':
      return (
        <div className="pnsv-sw-fields">
          <Cell label={def.name} grow>
            <TextInput value={value.text} onChange={(text) => onChange({ ...value, text })} />
          </Cell>
        </div>
      );

    case 'number':
      return (
        <div className="pnsv-sw-fields">
          <Cell label={def.name}>
            <NumberInput value={value.n} onChange={(n) => onChange({ ...value, n })} />
          </Cell>
          {def.unit ? <span className="pnsv-sw-unit">{def.unit}</span> : null}
        </div>
      );

    case 'stat':
      return (
        <div className="pnsv-sw-fields">
          <Cell label={t('fieldBase')}>
            <NumberInput value={value.base} onChange={(base) => onChange({ ...value, base })} />
          </Cell>
          <Cell label={t('fieldBonus')}>
            <NumberInput value={value.bonus ?? 0} onChange={(bonus) => onChange({ ...value, bonus })} />
          </Cell>
          {/* A ladder if the attribute defines one, free text otherwise — plenty
              of serials use grades the plugin has never heard of. */}
          <Cell label={t('fieldGrade')} interactive={Boolean(def.grades?.length)}>
            {def.grades && def.grades.length > 0 ? (
              <Dropdown
                label={t('fieldGrade')}
                size="sm"
                align="start"
                value={value.grade ?? ''}
                options={[
                  { value: '', label: '—' },
                  ...def.grades.map((grade) => ({ value: grade, label: grade }))
                ]}
                onChange={(grade) => onChange({ ...value, grade })}
              />
            ) : (
              <TextInput value={value.grade ?? ''} onChange={(grade) => onChange({ ...value, grade })} />
            )}
          </Cell>
          <Cell label={t('fieldNote')} grow>
            <TextInput
              value={value.note ?? ''}
              onChange={(note) => onChange({ ...value, note })}
              placeholder="밸런스 한계치"
            />
          </Cell>
        </div>
      );

    case 'resource':
      return (
        <div className="pnsv-sw-fields">
          <Cell label={t('fieldCur')}>
            <NumberInput value={value.cur} onChange={(cur) => onChange({ ...value, cur })} />
          </Cell>
          <Cell label={t('fieldMax')}>
            <NumberInput value={value.max} onChange={(max) => onChange({ ...value, max })} />
          </Cell>
          <Cell label={t('fieldRegen')}>
            <NumberInput value={value.regen ?? 0} onChange={(regen) => onChange({ ...value, regen })} />
          </Cell>
        </div>
      );

    case 'gauge':
      return (
        <div className="pnsv-sw-fields">
          <Cell label={t('fieldCur')}>
            <NumberInput value={value.cur} onChange={(cur) => onChange({ ...value, cur })} />
          </Cell>
          <Cell label={t('fieldMax')}>
            <NumberInput value={value.max} onChange={(max) => onChange({ ...value, max })} />
          </Cell>
          <Cell label={t('fieldUnit')} grow>
            <TextInput
              value={value.unit ?? def.unit ?? ''}
              onChange={(unit) => onChange({ ...value, unit })}
              placeholder="에센스"
            />
          </Cell>
        </div>
      );

    case 'rank':
      return (
        <div className="pnsv-sw-fields">
          <Cell label={t('fieldGrade')} grow interactive={Boolean(def.grades?.length)}>
            {def.grades && def.grades.length > 0 ? (
              <Dropdown
                label={t('fieldGrade')}
                size="sm"
                align="start"
                value={value.grade}
                options={[
                  { value: '', label: '—' },
                  ...def.grades.map((grade) => ({ value: grade, label: grade }))
                ]}
                onChange={(grade) => {
                  const ladder = def.grades ?? [];
                  // Offer the next rung automatically — a rank line almost
                  // always names what comes after it.
                  const next = ladder[ladder.indexOf(grade) + 1] ?? '';
                  onChange({ ...value, grade, next });
                }}
              />
            ) : (
              <TextInput value={value.grade} onChange={(grade) => onChange({ ...value, grade })} />
            )}
          </Cell>
        </div>
      );

    case 'list':
      return (
        <div className="pnsv-sw-fields">
          <Cell label={t('fieldItems')} grow>
            <textarea
              className="pnsv-sw-input pnsv-sw-textarea"
              rows={Math.min(8, Math.max(3, value.items.length + 1))}
              value={value.items.join('\n')}
              onChange={(event) =>
                onChange({ ...value, items: event.target.value.split('\n') })
              }
            />
          </Cell>
        </div>
      );
  }
};
