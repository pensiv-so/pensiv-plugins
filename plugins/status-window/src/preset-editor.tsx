/**
 * The preset editor — a settings tab the plugin draws itself.
 *
 * ## Why not the declarative schema
 *
 * The other settings tab is a `SettingsSchema` the host renders, which is the
 * right default and looks native for free. This one can't be:
 *
 *  - the lists are **dynamic**. A schema's `select` options are fixed when the
 *    plugin loads, so a preset the writer adds today wouldn't appear until the
 *    next reload — and the attribute library needs per-row expansion with
 *    kind-dependent fields, which no schema field type expresses;
 *  - a template needs its **output beside it**. Editing mustache blind is
 *    guesswork, and the preview is the reason to open this page at all.
 *
 * So the layout is rebuilt from the app's own settings primitives instead (see
 * `ui.tsx`): sections, nested cards, and rows with the label on the left and the
 * control on the right. The attribute library takes the shape of the app's own
 * 템플릿 settings list — grip to drag, chevron to expand, title over a muted
 * description — because that page is the thing a writer will have used the
 * minute before this one.
 *
 * ## Everything here is the writer's
 *
 * The presets and the attribute examples ship as seed data and are copied into
 * storage on first read. From here they can be renamed, retuned, reordered,
 * duplicated and deleted. "Restore defaults" copies the seed in again — the
 * only privilege the built-ins have left.
 *
 * Half-typed templates are unbalanced by definition, so the preview renders
 * through `tryRender` and shows the parse error in place. Throwing here would
 * blank the page and, after three throws, let the host's guard disable the tab
 * for the session.
 */
import * as React from 'react';
import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';
import { createT, type StringKey } from './i18n';
import {
  deleteAttributeTemplate,
  deletePreset,
  duplicatePreset,
  listAttributeTemplates,
  listPresets,
  reorderAttributeTemplate,
  restoreDefaultAttributeTemplates,
  restoreDefaultPresets,
  savePreset,
  upsertAttributeTemplate
} from './library';
import type { AttributeTemplate, Preset } from './presets';
import { renderStatusBlock } from './render';
import { TemplateHelp } from './template-help';
import { KEY_OMIT_EMPTY, KEY_PRESET, readSettings } from './settings';
import { formatValue } from './format';
import {
  newId,
  type AttributeKind,
  type AttributeValue,
  type CharacterSchema,
  type ValueMap
} from './model';
import {
  Card,
  ChoiceOrCustom,
  Dropdown,
  GhostButton,
  IconGhostButton,
  Row,
  Section,
  Switch,
  TextBox
} from './ui';

/**
 * A worked example, so the preview shows something without a manuscript open.
 *
 * The preset's own fields with plausible numbers — enough rows to see the
 * alignment and one moved stat to see the growth arrow.
 */
function sampleFor(preset: Preset): {
  schema: CharacterSchema;
  values: ValueMap;
  previous: ValueMap;
} {
  const attrs = preset.fields.slice(0, 8);
  const values: ValueMap = {};
  const previous: ValueMap = {};

  attrs.forEach((def, index) => {
    const value = sampleValueFor(def, index);
    values[def.id] = value;
    previous[def.id] =
      index === 4 && value.kind === 'stat' ? { ...value, base: value.base - 3 } : value;
  });

  return { schema: { groups: preset.groups, attrs }, values, previous };
}

/** One plausible value per kind — also the library row's "what this prints". */
function sampleValueFor(
  def: { kind: AttributeKind; unit?: string; grades?: string[] },
  index = 0
): AttributeValue {
  switch (def.kind) {
    case 'text':
      return { kind: 'text', text: '—' };
    case 'number':
      return { kind: 'number', n: 10 * (index + 1) };
    case 'stat':
      return {
        kind: 'stat',
        base: 40 + index * 7,
        bonus: index % 2 === 0 ? 12 : undefined,
        grade: def.grades?.[1]
      };
    case 'resource':
      return { kind: 'resource', cur: 70, max: 70, regen: 0.8 };
    case 'gauge':
      return { kind: 'gauge', cur: 1240, max: 2000, unit: def.unit ?? '' };
    case 'rank':
      return { kind: 'rank', grade: def.grades?.[0] ?? 'F' };
    case 'list':
      return { kind: 'list', items: ['A', 'B'] };
  }
}

/**
 * Formatting for row summaries only — neutral punctuation, so the settings page
 * reads as the app, not as any one preset's output.
 */
const NEUTRAL_FORMAT = {
  thousands: false,
  regenLabel: '',
  regenSuffix: '',
  arrow: ' → ',
  barChars: ['█', '░'] as [string, string],
  barWidth: 8,
  listJoin: ', '
};

const NEW_PRESET = '__new';

export const PresetEditor: React.FC<{ app: HostApi }> = ({ app }) => {
  const t = React.useMemo(() => createT(app), [app]);
  const [revision, setRevision] = React.useState(0);
  const bump = () => setRevision((n) => n + 1);
  const [showHelp, setShowHelp] = React.useState(false);
  const templateRef = React.useRef<HTMLTextAreaElement | null>(null);

  const settings = React.useMemo(() => readSettings(app), [app, revision]);
  const presets = React.useMemo(() => listPresets(app), [app, revision]);

  const [selectedId, setSelectedId] = React.useState(settings.presetId);
  const preset = presets.find((entry) => entry.id === selectedId) ?? presets[0];

  if (!preset) return null;

  const label = (value: Preset['name']): string => resolveLocalizedText(value, app.app.locale);

  const patch = (next: Partial<Preset>) => {
    savePreset(app, { ...preset, ...next });
    bump();
  };

  /** Patch the format block, which is where most of the convention lives. */
  const patchFormat = (next: Partial<Preset['format']>) => {
    savePreset(app, { ...preset, format: { ...preset.format, ...next } });
    bump();
  };

  const addPreset = () => {
    const copy = duplicatePreset(app, preset.id, `${label(preset.name)} ${t('copySuffix')}`);
    setSelectedId(copy.id);
    bump();
  };

  /** Drop a snippet at the caret, and put the caret after it. */
  const insertSnippet = (snippet: string) => {
    const area = templateRef.current;
    const start = area?.selectionStart ?? preset.template.length;
    const end = area?.selectionEnd ?? preset.template.length;
    patch({ template: preset.template.slice(0, start) + snippet + preset.template.slice(end) });
    requestAnimationFrame(() => {
      const el = templateRef.current;
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = start + snippet.length;
    });
  };

  const sample = sampleFor(preset);
  const preview = renderStatusBlock(preset, {
    ...sample,
    characterName: '—',
    episodeTitle: '—',
    episodeNumber: 1,
    omitEmpty: settings.omitEmpty
  });

  const isDefault = settings.presetId === preset.id;

  return (
    <div className="pnsv-sw" data-variant="settings">
      {/* ── which preset ─────────────────────────────────────────────────── */}
      <Section
        title={t('presets')}
        description={t('presetsHint')}
        action={
          <Dropdown
            label={t('preset')}
            wide
            value={preset.id}
            options={[
              ...presets.map((entry) => ({
                value: entry.id,
                label:
                  settings.presetId === entry.id
                    ? `${label(entry.name)} · ${t('isDefault')}`
                    : label(entry.name)
              })),
              { value: NEW_PRESET, label: `＋ ${t('newPreset')}` }
            ]}
            onChange={(next) => (next === NEW_PRESET ? addPreset() : setSelectedId(next))}
          />
        }
      >
        <Card>
          <Row label={t('presetNameLabel')} description={t('presetNameHint')}>
            <TextBox
              label={t('presetNameLabel')}
              value={label(preset.name)}
              onChange={(name) => patch({ name })}
            />
          </Row>

          <Row label={t('makeDefault')} description={t('settingsPresetHint')}>
            {isDefault ? (
              <span className="pnsv-sw-tag">✓ {t('isDefault')}</span>
            ) : (
              <GhostButton
                onClick={() => {
                  app.storage.set(KEY_PRESET, preset.id, { scope: 'synced' });
                  bump();
                }}
              >
                {t('makeDefault')}
              </GhostButton>
            )}
          </Row>

          <Row label={t('presetActions')} description={t('presetActionsHint')}>
            <GhostButton onClick={addPreset}>{t('duplicatePreset')}</GhostButton>
            <GhostButton
              disabled={presets.length <= 1}
              onClick={() => {
                deletePreset(app, preset.id);
                setSelectedId(presets.find((entry) => entry.id !== preset.id)?.id ?? '');
                bump();
              }}
            >
              {t('deletePreset')}
            </GhostButton>
          </Row>
        </Card>
      </Section>

      {/* ── layout ───────────────────────────────────────────────────────── */}
      <Section title={t('optLayout')}>
        <Card>
          <Row label={t('optColumns')} description={t('optColumnsHint')}>
            <Dropdown
              label={t('optColumns')}
              value={String(preset.columns)}
              options={[
                { value: '1', label: '1' },
                { value: '2', label: '2' }
              ]}
              onChange={(next) => patch({ columns: next === '2' ? 2 : 1 })}
            />
          </Row>
          <Row label={t('optPadChar')} description={t('optPadCharHint')}>
            <Dropdown
              label={t('optPadChar')}
              value={preset.padChar === '　' ? 'wide' : 'space'}
              options={[
                { value: 'space', label: t('padSpace') },
                { value: 'wide', label: t('padIdeographic') }
              ]}
              onChange={(next) => patch({ padChar: next === 'wide' ? '　' : ' ' })}
            />
          </Row>
          <Row label={t('optAlign')} description={t('optAlignHint')}>
            <Switch
              label={t('optAlign')}
              checked={preset.align}
              onChange={(align) => patch({ align })}
            />
          </Row>
          <Row label={t('optAlignValues')} description={t('optAlignValuesHint')}>
            <Switch
              label={t('optAlignValues')}
              checked={preset.alignValues}
              onChange={(alignValues) => patch({ alignValues })}
            />
          </Row>
          {/* The same storage key as the preferences tab's toggle — one value,
              surfaced here too because this is where its effect is visible. */}
          <Row label={t('settingsOmitEmpty')} description={t('settingsOmitEmptyHint')}>
            <Switch
              label={t('settingsOmitEmpty')}
              checked={settings.omitEmpty}
              onChange={(omitEmpty) => {
                app.storage.set(KEY_OMIT_EMPTY, omitEmpty, { scope: 'synced' });
                bump();
              }}
            />
          </Row>
        </Card>
      </Section>

      {/* ── notation ─────────────────────────────────────────────────────── */}
      <Section title={t('optNumbers')}>
        <Card>
          <Row label={t('optThousands')} description={t('optThousandsHint')}>
            <Switch
              label={t('optThousands')}
              checked={preset.format.thousands}
              onChange={(thousands) => patchFormat({ thousands })}
            />
          </Row>
          <Row label={t('optListJoin')} description={t('optListJoinHint')}>
            <ChoiceOrCustom
              label={t('optListJoin')}
              customLabel={t('customValue')}
              value={preset.format.listJoin}
              options={[
                { value: ', ', label: ', ' },
                { value: '、', label: '、' },
                { value: ' · ', label: ' · ' },
                { value: ' / ', label: ' / ' }
              ]}
              onChange={(listJoin) => patchFormat({ listJoin })}
            />
          </Row>
          <Row label={t('optArrow')} description={t('optArrowHint')}>
            <ChoiceOrCustom
              label={t('optArrow')}
              customLabel={t('customValue')}
              value={preset.format.arrow}
              options={[
                { value: ' → ', label: ' → ' },
                { value: ' ⇒ ', label: ' ⇒ ' },
                { value: ' -> ', label: ' -> ' }
              ]}
              onChange={(arrow) => patchFormat({ arrow })}
            />
          </Row>
          <Row label={t('optRegenLabel')} description={t('optRegenHint')}>
            <TextBox
              label={t('optRegenLabel')}
              width="sm"
              value={preset.format.regenLabel}
              onChange={(regenLabel) => patchFormat({ regenLabel })}
            />
            <TextBox
              label={t('optRegenSuffix')}
              width="sm"
              value={preset.format.regenSuffix}
              onChange={(regenSuffix) => patchFormat({ regenSuffix })}
            />
          </Row>
          <Row label={t('optBarWidth')} description={t('optBarWidthHint')}>
            <TextBox
              label={t('optBarWidth')}
              width="sm"
              value={String(preset.format.barWidth)}
              onChange={(raw) => {
                const parsed = Number(raw);
                patchFormat({ barWidth: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 });
              }}
            />
          </Row>
        </Card>
      </Section>

      {/* ── template ─────────────────────────────────────────────────────── */}
      <Section
        title={t('template')}
        description={t('templateHint')}
        action={
          <GhostButton variant="outline" onClick={() => setShowHelp((was) => !was)}>
            {'{ }'} {t('templateHelp')}
          </GhostButton>
        }
      >
        <Card variant="plain">
          <textarea
            ref={templateRef}
            className="pnsv-sw-input2 pnsv-sw-textarea2"
            rows={8}
            spellCheck={false}
            aria-label={t('template')}
            value={preset.template}
            onChange={(event) => patch({ template: event.target.value })}
          />

          {showHelp ? (
            <TemplateHelp app={app} insertLabel={t('insertSnippet')} onInsert={insertSnippet} />
          ) : null}

          {preview.error ? (
            <p className="pnsv-sw-error">
              {t('templateError')}: {preview.error}
            </p>
          ) : (
            <pre className="pnsv-sw-preview">{preview.text || '—'}</pre>
          )}

          <div className="pnsv-sw-card-foot">
            <GhostButton
              onClick={() => {
                if (!globalThis.confirm?.(t('restoreConfirm'))) return;
                restoreDefaultPresets(app);
                bump();
              }}
            >
              ↺ {t('restoreDefaults')}
            </GhostButton>
          </div>
        </Card>
      </Section>

      {/* ── attribute library ────────────────────────────────────────────── */}
      <LibrarySection app={app} t={t} revision={revision} bump={bump} />
    </div>
  );
};

// ── the attribute library ────────────────────────────────────────────────────

/**
 * The library, in the shape of the app's 템플릿 settings list: a card of rows,
 * each with a grip to drag, a chevron to expand, the label over a one-line
 * description, and what the row prints on the right. Expanding opens the
 * entry's fields in place — a library of seventeen rows is a list to scan, and
 * seventeen open editors is a wall.
 */
const LibrarySection: React.FC<{
  app: HostApi;
  t: (key: StringKey) => string;
  revision: number;
  bump: () => void;
}> = ({ app, t, revision, bump }) => {
  const library = React.useMemo(() => listAttributeTemplates(app), [app, revision]);
  const [openId, setOpenId] = React.useState<string | undefined>();
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const endDrag = () => {
    setDragId(null);
    setOverIndex(null);
  };

  const commitDrop = () => {
    if (dragId !== null && overIndex !== null) {
      const from = library.findIndex((entry) => entry.id === dragId);
      if (from !== -1) {
        // `overIndex` counts positions in the list as shown (moved entry still
        // in place); the store wants the index after the entry is lifted out.
        const to = overIndex > from ? overIndex - 1 : overIndex;
        if (to !== from) reorderAttributeTemplate(app, dragId, to);
      }
    }
    endDrag();
    bump();
  };

  const addEntry = () => {
    const entry: AttributeTemplate = {
      id: newId('t'),
      label: '',
      family: 'any',
      def: { name: '', kind: 'stat' }
    };
    upsertAttributeTemplate(app, entry);
    setOpenId(entry.id);
    bump();
  };

  return (
    <Section
      title={t('attributeLibrary')}
      description={t('attributeLibraryHint')}
      action={
        <GhostButton
          onClick={() => {
            if (!globalThis.confirm?.(t('restoreConfirm'))) return;
            restoreDefaultAttributeTemplates(app);
            bump();
          }}
        >
          ↺ {t('restoreDefaults')}
        </GhostButton>
      }
    >
      <Card>
        {library.length === 0 ? (
          <p className="pnsv-sw-lib-empty">{t('libraryEmpty')}</p>
        ) : (
          library.map((entry, index) => (
            <LibraryRow
              key={entry.id}
              app={app}
              t={t}
              entry={entry}
              open={openId === entry.id}
              onToggle={() =>
                setOpenId((current) => (current === entry.id ? undefined : entry.id))
              }
              onChange={(next) => {
                upsertAttributeTemplate(app, next);
                bump();
              }}
              onDelete={() => {
                deleteAttributeTemplate(app, entry.id);
                bump();
              }}
              dragging={dragId !== null}
              dropEdge={
                dragId === null
                  ? undefined
                  : overIndex === index
                    ? 'top'
                    : index === library.length - 1 && overIndex === library.length
                      ? 'bottom'
                      : undefined
              }
              onDragStart={(event) => {
                setDragId(entry.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', entry.id);
                const row = (event.currentTarget as HTMLElement).closest('.pnsv-sw-librow');
                if (row) event.dataTransfer.setDragImage(row as HTMLElement, 24, 20);
              }}
              onDragEnd={endDrag}
              onDragOver={(event) => {
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                const before = event.clientY < rect.top + rect.height / 2;
                setOverIndex(before ? index : index + 1);
              }}
              onDrop={(event) => {
                event.preventDefault();
                commitDrop();
              }}
            />
          ))
        )}

        <div className="pnsv-sw-lib-add">
          <GhostButton variant="outline" onClick={addEntry}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            {t('libraryNewEntry')}
          </GhostButton>
        </div>
      </Card>
    </Section>
  );
};

/**
 * Comma-separated list editing without the round-trip trap.
 *
 * Parsing on every keystroke and re-rendering `join(', ')` deletes the comma
 * or space the writer just typed (`split → trim → filter` drops it before it
 * ever paints) and clamps the caret to the end of the box. So the box owns its
 * raw text while it is being edited: it parses **outward** on every change but
 * re-reads the canonical value only when unfocused, and normalizes what it
 * shows on blur.
 */
const ListInput: React.FC<{
  label: string;
  value: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}> = ({ label, value, placeholder, onChange }) => {
  const joined = value.join(', ');
  const [text, setText] = React.useState(joined);
  const focused = React.useRef(false);

  // An outside change (restore defaults, another device) lands while the box
  // is idle; while the writer is typing, their raw text wins.
  React.useEffect(() => {
    if (!focused.current) setText(joined);
  }, [joined]);

  return (
    <input
      className="pnsv-sw-input3"
      aria-label={label}
      value={text}
      placeholder={placeholder}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setText(joined);
      }}
      onChange={(event) => {
        setText(event.target.value);
        onChange(
          event.target.value
            .split(',')
            .map((grade) => grade.trim())
            .filter(Boolean)
        );
      }}
    />
  );
};

/** Badge text for a kind — the full labels carry a parenthetical the badge doesn't need. */
function kindBadgeKey(kind: AttributeKind): StringKey {
  switch (kind) {
    case 'stat':
      return 'kindShortStat';
    case 'resource':
      return 'kindShortResource';
    case 'gauge':
      return 'kindShortGauge';
    case 'text':
      return 'kindText';
    case 'number':
      return 'kindNumber';
    case 'rank':
      return 'kindRank';
    case 'list':
      return 'kindList';
  }
}

const KIND_KEYS: Array<{ kind: AttributeKind; label: StringKey }> = [
  { kind: 'text', label: 'kindText' },
  { kind: 'number', label: 'kindNumber' },
  { kind: 'stat', label: 'kindStat' },
  { kind: 'resource', label: 'kindResource' },
  { kind: 'gauge', label: 'kindGauge' },
  { kind: 'rank', label: 'kindRank' },
  { kind: 'list', label: 'kindList' }
];

const LibraryRow: React.FC<{
  app: HostApi;
  t: (key: StringKey) => string;
  entry: AttributeTemplate;
  open: boolean;
  onToggle: () => void;
  onChange: (next: AttributeTemplate) => void;
  onDelete: () => void;
  dragging: boolean;
  dropEdge?: 'top' | 'bottom';
  onDragStart: React.DragEventHandler;
  onDragEnd: React.DragEventHandler;
  onDragOver: React.DragEventHandler;
  onDrop: React.DragEventHandler;
}> = ({
  app,
  t,
  entry,
  open,
  onToggle,
  onChange,
  onDelete,
  dragging,
  dropEdge,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}) => {
  const locale = app.app.locale;
  const plain = (value: LocalizedText | undefined): string =>
    value === undefined ? '' : resolveLocalizedText(value, locale);

  const title = plain(entry.label) || entry.def.name;
  const description = plain(entry.description);
  const sample = formatValue(sampleValueFor(entry.def), NEUTRAL_FORMAT);

  const patchDef = (next: Partial<AttributeTemplate['def']>) =>
    onChange({ ...entry, def: { ...entry.def, ...next } });

  // Editing a seeded (localized) label rewrites it as a plain string — from
  // that keystroke on it is the writer's text, not ours to translate.
  return (
    <div
      className="pnsv-sw-librow-wrap"
      data-drop={dropEdge}
      onDragOver={dragging ? onDragOver : undefined}
      onDrop={dragging ? onDrop : undefined}
    >
      <div className="pnsv-sw-librow" data-open={open ? 'true' : undefined}>
        <IconGhostButton
          label={t('dragToReorder')}
          className="pnsv-sw-grip"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="9" cy="5" r="1" />
            <circle cx="9" cy="12" r="1" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="5" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="15" cy="19" r="1" />
          </svg>
        </IconGhostButton>

        <button type="button" className="pnsv-sw-librow-trigger" aria-expanded={open} onClick={onToggle}>
          <svg
            className="pnsv-sw-librow-chevron"
            data-open={open ? 'true' : undefined}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span className="pnsv-sw-librow-text">
            <span className="pnsv-sw-librow-title">
              {title || <em className="pnsv-sw-unnamed">{t('libraryNewEntry')}</em>}
            </span>
            {description ? <span className="pnsv-sw-librow-desc">{description}</span> : null}
          </span>
        </button>

        <span className="pnsv-sw-librow-side">
          <span className="pnsv-sw-librow-sample">{sample}</span>
          <span className="pnsv-sw-badge">{t(kindBadgeKey(entry.def.kind))}</span>
          <IconGhostButton label={t('removeFromLibrary')} onClick={() => onDelete()}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </IconGhostButton>
        </span>
      </div>

      {open ? (
        <div className="pnsv-sw-libbody">
          <div className="pnsv-sw-fields">
            <label className="pnsv-sw-cell" data-grow="true">
              <span className="pnsv-sw-cell-label">{t('libraryLabel')}</span>
              <input
                className="pnsv-sw-input3"
                value={plain(entry.label)}
                placeholder={entry.def.name}
                onChange={(event) => onChange({ ...entry, label: event.target.value })}
              />
            </label>
            <label className="pnsv-sw-cell" data-grow="true">
              <span className="pnsv-sw-cell-label">{t('attributeName')}</span>
              <input
                className="pnsv-sw-input3"
                value={entry.def.name}
                onChange={(event) => patchDef({ name: event.target.value })}
              />
            </label>
            {/* A `<div>`, not a `<label>` — a label would re-dispatch every
                click inside the cell (panel included) back to the trigger. */}
            <div className="pnsv-sw-cell">
              <span className="pnsv-sw-cell-label">{t('fieldKind')}</span>
              {/* `end`: this cell sits at the row's right edge, and a panel
                  hanging start-ward would walk out of the card. */}
              <Dropdown
                label={t('fieldKind')}
                size="sm"
                align="end"
                value={entry.def.kind}
                options={KIND_KEYS.map(({ kind, label }) => ({ value: kind, label: t(label) }))}
                onChange={(kind) => patchDef({ kind: kind as AttributeKind })}
              />
            </div>
          </div>

          <div className="pnsv-sw-fields">
            <label className="pnsv-sw-cell" data-grow="true">
              <span className="pnsv-sw-cell-label">{t('fieldDescription')}</span>
              <input
                className="pnsv-sw-input3"
                value={description}
                onChange={(event) => onChange({ ...entry, description: event.target.value })}
              />
            </label>
            {entry.def.kind === 'stat' || entry.def.kind === 'rank' ? (
              <label className="pnsv-sw-cell" data-grow="true">
                <span className="pnsv-sw-cell-label">{t('fieldGrades')}</span>
                <ListInput
                  label={t('fieldGrades')}
                  value={entry.def.grades ?? []}
                  placeholder={t('gradesHint')}
                  onChange={(grades) => patchDef({ grades: grades.length > 0 ? grades : undefined })}
                />
              </label>
            ) : null}
            {entry.def.kind === 'gauge' ? (
              <label className="pnsv-sw-cell">
                <span className="pnsv-sw-cell-label">{t('fieldUnit')}</span>
                <input
                  className="pnsv-sw-input3"
                  data-width="sm"
                  value={entry.def.unit ?? ''}
                  onChange={(event) => patchDef({ unit: event.target.value || undefined })}
                />
              </label>
            ) : null}
          </div>

          <p className="pnsv-sw-lib-example">
            {t('exampleLine')} · <span>{entry.def.name || '—'}</span> : <span>{sample}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
};
