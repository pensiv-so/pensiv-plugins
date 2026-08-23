/**
 * The side pane — where a status window gets written.
 *
 * ## The shape of the thing
 *
 * Three bands, and the middle one is the work:
 *
 *   character picker  ·  the row the writer is on
 *   ────────────────────────────────────────────
 *   attribute rows (or the preview)
 *   ────────────────────────────────────────────
 *   Insert into text            [preview toggle]
 *
 * A row is one line — name, then the value as the reader will see it. Clicking
 * opens that row's fields underneath, one at a time. Seventeen expanded rows is
 * a wall; seventeen collapsed ones is a status window, which is the thing the
 * writer is trying to look at.
 *
 * ## Carry-forward is visible
 *
 * Every row shows where its value came from. A row edited in this episode gets a
 * dot and its growth arrow (`14 [F] → 16(+2)[F]`); a row inherited from an
 * earlier episode is plain. That distinction is the plugin's whole reason for
 * existing, so it is on the row rather than behind a toggle — and "carry over
 * instead" undoes an edit without the writer having to remember the old number.
 *
 * ## Looking native
 *
 * Every value is the app's own, re-stated in `styles.css` (the Tailwind build
 * never scans this repo): pane inset `1rem`, `text-sm`/`text-xs`, the row hover
 * fill and `rounded-lg` from the task row, inputs at the app's `--input` border
 * and `rounded-md`, the primary button from `Button`. Radii go through
 * `--radius` so a theme that changes it changes this too.
 */
import * as React from 'react';
import { resolveLocalizedText, type HostApi } from '@pensiv/plugin-sdk';
import { insertBlock, refreshBlocks, renderFor } from './blocks';
import { FieldEditor } from './fields';
import { createT, type StringKey } from './i18n';
import {
  emptyValue,
  isLocalCharacter,
  newId,
  valuesEqual,
  type AttributeDef,
  type AttributeKind,
  type AttributeValue,
  type CharacterSchema
} from './model';
import type { AttributeTemplate } from './presets';
import {
  deleteAttributeTemplate,
  getPreset,
  instantiate,
  listAttributeTemplates,
  saveAttributeTemplate
} from './library';
import { formatArrow, formatValue } from './format';
import { CharacterIcon } from './icons';
import {
  addLocalCharacter,
  clearValue,
  episodeOrder,
  foldTo,
  hasEntry,
  pruneDeltas,
  readCharacters,
  readSchema,
  removeLocalCharacter,
  setValue,
  writeSchema
} from './storage';
import { readAutoRefresh, readSettings } from './settings';

/**
 * The seven engine kinds, offered under "blank row".
 *
 * Each has its own formatter, so this list is fixed — a writer can't author a
 * new one. What they *can* own is the library above it, which is where the
 * useful entries live: `근력 (능력치, F–SSS)` beats `stat` every time.
 */
const KINDS: Array<{ kind: AttributeKind; label: StringKey }> = [
  { kind: 'text', label: 'kindText' },
  { kind: 'number', label: 'kindNumber' },
  { kind: 'stat', label: 'kindStat' },
  { kind: 'resource', label: 'kindResource' },
  { kind: 'gauge', label: 'kindGauge' },
  { kind: 'rank', label: 'kindRank' },
  { kind: 'list', label: 'kindList' }
];

export interface PaneBodyProps {
  app: HostApi;
  fileId?: string;
  /** `pane` is the side pane; `sheet` is the host dialog. Drives insets only. */
  variant?: 'pane' | 'sheet';
  /** Open on this character — set when the pane is opened from a live block. */
  initialCharacterId?: string;
}

/** Bump to force a re-read of storage after a write. */
function useRevision(): [number, () => void] {
  const [revision, setRevision] = React.useState(0);
  return [revision, React.useCallback(() => setRevision((n) => n + 1), [])];
}

export const StatusWindowPane: React.FC<PaneBodyProps> = ({
  app,
  fileId,
  variant = 'pane',
  initialCharacterId
}) => {
  const t = React.useMemo(() => createT(app), [app]);
  const [revision, bump] = useRevision();
  const [showPreview, setShowPreview] = React.useState(false);
  const [openRow, setOpenRow] = React.useState<string | undefined>();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [addName, setAddName] = React.useState('');
  const pickerRef = React.useRef<HTMLDivElement | null>(null);

  // Light dismiss, same as the Dropdown: a capture-phase press outside closes
  // the list without eating the press, and nothing blocks scrolling while it
  // is open. The listener exists only while open; the effect cleanup also
  // covers the pane unmounting mid-gesture.
  React.useEffect(() => {
    if (!pickerOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [pickerOpen]);

  const settings = React.useMemo(() => readSettings(app), [app, revision]);
  const characters = React.useMemo(() => readCharacters(app), [app, revision]);

  const [selectedId, setSelectedId] = React.useState<string | undefined>(initialCharacterId);
  const characterId = selectedId ?? characters[0]?.id;
  const character = characters.find((c) => c.id === characterId);

  // Follow the host when a live block asks for a particular character.
  React.useEffect(() => {
    if (initialCharacterId) setSelectedId(initialCharacterId);
  }, [initialCharacterId]);

  // Project edits (a renamed sheet, a reordered chapter) change what this pane
  // shows, so re-read rather than hold a stale snapshot.
  React.useEffect(() => {
    if (!app.project.available) return undefined;
    try {
      return app.project.subscribe(() => bump(), ['files']);
    } catch {
      return undefined;
    }
  }, [app, bump]);

  const episodes = React.useMemo(
    () => episodeOrder(app, settings.scope, fileId),
    [app, settings.scope, fileId, revision]
  );

  const preset = React.useMemo(
    () => getPreset(app, settings.presetId),
    [app, settings.presetId, revision]
  );
  const library = React.useMemo(() => listAttributeTemplates(app), [app, revision]);

  const schema: CharacterSchema = React.useMemo(
    () => (characterId ? readSchema(app, characterId, preset) : { groups: [], attrs: [] }),
    [app, characterId, preset, revision]
  );

  const fold = React.useMemo(
    () =>
      characterId && fileId
        ? foldTo(app, episodes, fileId, characterId)
        : { values: {}, previous: {}, index: -1 },
    [app, episodes, fileId, characterId, revision]
  );

  const rendered = React.useMemo(
    () =>
      characterId && fileId
        ? renderFor(app, settings, fileId, characterId)
        : { text: '', error: undefined },
    [app, settings, fileId, characterId, revision]
  );

  const commitSchema = (next: CharacterSchema) => {
    if (!characterId) return;
    writeSchema(app, characterId, next);
    pruneDeltas(app, episodes, characterId, next);
    bump();
  };

  /** Write a value, then rewrite live blocks if the writer asked for that. */
  const commitValue = (attrId: string, next: AttributeValue) => {
    if (!characterId || !fileId) return;
    setValue(app, fileId, characterId, attrId, next, fold.previous[attrId]);
    bump();
    if (readAutoRefresh(app) && settings.liveBlocks) refreshBlocks(app, settings, fileId);
  };

  const onInsert = () => {
    if (!characterId || !fileId) {
      app.ui.toast(t('noEpisode'));
      return;
    }
    app.ui.toast(insertBlock(app, settings, fileId, characterId) ? t('inserted') : t('cannotInsertHere'));
  };

  const onAddAttribute = (kind: AttributeKind) => {
    const def: AttributeDef = { id: newId('a'), name: '', kind };
    commitSchema({ ...schema, attrs: [...schema.attrs, def] });
    // A blank row has no name yet, so open it — otherwise the writer is looking
    // at an empty line with no obvious way in.
    setOpenRow(def.id);
  };

  /** Add a ready-made row. Already named and configured, so leave it collapsed. */
  const onAddFromLibrary = (entry: AttributeTemplate) => {
    commitSchema({ ...schema, attrs: [...schema.attrs, instantiate(entry)] });
  };

  if (!fileId) {
    return (
      <div className="pnsv-sw" data-variant={variant}>
        <p className="pnsv-sw-empty">{t('noEpisode')}</p>
      </div>
    );
  }

  return (
    <div className="pnsv-sw" data-variant={variant}>
      {/* ── character picker ─────────────────────────────────────────────── */}
      <div className="pnsv-sw-top">
        <div className="pnsv-sw-picker" ref={pickerRef}>
          <button
            type="button"
            className="pnsv-sw-picker-button"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
          >
            <span className="pnsv-sw-picker-label">
              {character ? <CharacterIcon character={character} /> : null}
              <span className="pnsv-sw-picker-name">{character?.name ?? t('character')}</span>
            </span>
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

          {pickerOpen ? (
            <ul className="pnsv-sw-menu" role="listbox">
                {characters.length === 0 ? (
                  <li className="pnsv-sw-menu-empty">{t('noCharacters')}</li>
                ) : null}
                {characters.map((entry) => {
                  const written = hasEntry(app, fileId, entry.id);
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={entry.id === characterId}
                        className="pnsv-sw-menu-item"
                        data-active={entry.id === characterId ? 'true' : undefined}
                        onClick={() => {
                          setSelectedId(entry.id);
                          setPickerOpen(false);
                          setOpenRow(undefined);
                        }}
                      >
                        <span className="pnsv-sw-menu-main">
                          {/* The sheet's own face — portrait, emoji or category
                              glyph — exactly as the file tree draws it. */}
                          <CharacterIcon character={entry} />
                          <span className="pnsv-sw-menu-name">{entry.name}</span>
                        </span>
                        <span className="pnsv-sw-badge" data-written={written ? 'true' : undefined}>
                          {written ? t('written') : t('notWritten')}
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li className="pnsv-sw-menu-foot">
                  {adding ? (
                    <form
                      className="pnsv-sw-add"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const name = addName.trim();
                        if (!name) return;
                        const id = addLocalCharacter(app, name);
                        writeSchema(app, id, {
                          groups: [...preset.groups],
                          attrs: [...preset.fields]
                        });
                        setAddName('');
                        setAdding(false);
                        setSelectedId(id);
                        setPickerOpen(false);
                        bump();
                      }}
                    >
                      <input
                        className="pnsv-sw-input"
                        autoFocus
                        value={addName}
                        placeholder={t('characterNamePlaceholder')}
                        onChange={(event) => setAddName(event.target.value)}
                      />
                      <button type="submit" className="pnsv-sw-button" data-variant="primary">
                        {t('addCharacter')}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="pnsv-sw-menu-item"
                      onClick={() => setAdding(true)}
                    >
                      <span className="pnsv-sw-menu-name">＋ {t('addCharacter')}</span>
                    </button>
                  )}
                </li>
            </ul>
          ) : null}
        </div>

        {character && isLocalCharacter(character.id) ? (
          <button
            type="button"
            className="pnsv-sw-icon-button"
            title={t('removeCharacter')}
            aria-label={t('removeCharacter')}
            onClick={() => {
              removeLocalCharacter(app, character.id);
              setSelectedId(undefined);
              bump();
            }}
          >
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
          </button>
        ) : null}
      </div>

      {/* ── body ─────────────────────────────────────────────────────────── */}
      <div className="pnsv-sw-body">
        {rendered.error ? (
          <p className="pnsv-sw-error">
            {t('templateError')}: {rendered.error}
          </p>
        ) : null}

        {showPreview ? (
          <pre className="pnsv-sw-preview">{rendered.text || '—'}</pre>
        ) : !characterId ? (
          <p className="pnsv-sw-empty">{t('noCharacters')}</p>
        ) : (
          <AttributeList
            app={app}
            t={t}
            schema={schema}
            values={fold.values}
            previous={fold.previous}
            openRow={openRow}
            onToggleRow={(id) => setOpenRow((current) => (current === id ? undefined : id))}
            onChangeValue={commitValue}
            onChangeSchema={commitSchema}
            onRevert={(attrId) => {
              if (!characterId) return;
              clearValue(app, fileId, characterId, attrId);
              bump();
            }}
            onSaveToLibrary={(def) => {
              saveAttributeTemplate(app, def);
              app.ui.toast(t('savedToLibrary'));
              bump();
            }}
          />
        )}

        {!showPreview && characterId ? (
          <div className="pnsv-sw-add-row">
            <details className="pnsv-sw-kinds">
              <summary className="pnsv-sw-button" data-variant="ghost">
                ＋ {t('addAttribute')}
              </summary>
              <div className="pnsv-sw-kind-menu">
                {/* The library first: these are named and configured, so one
                    click gives a usable row. The bare kinds are the fallback
                    for something the library doesn't cover yet. */}
                {library.map((entry) => (
                  <div key={entry.id} className="pnsv-sw-kind-row">
                    <button
                      type="button"
                      className="pnsv-sw-kind-item"
                      onClick={(event) => {
                        onAddFromLibrary(entry);
                        event.currentTarget.closest('details')?.removeAttribute('open');
                      }}
                    >
                      <span className="pnsv-sw-kind-title">
                        {resolveLocalizedText(entry.label, app.app.locale)}
                      </span>
                      {entry.description ? (
                        <span className="pnsv-sw-kind-desc">
                          {resolveLocalizedText(entry.description, app.app.locale)}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="pnsv-sw-kind-remove"
                      title={t('removeFromLibrary')}
                      aria-label={t('removeFromLibrary')}
                      onClick={() => {
                        deleteAttributeTemplate(app, entry.id);
                        bump();
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className="pnsv-sw-kind-divider">{t('blankRow')}</div>
                {KINDS.map(({ kind, label }) => (
                  <button
                    key={kind}
                    type="button"
                    className="pnsv-sw-kind-item"
                    onClick={(event) => {
                      onAddAttribute(kind);
                      event.currentTarget.closest('details')?.removeAttribute('open');
                    }}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </details>
          </div>
        ) : null}
      </div>

      {/* ── footer ───────────────────────────────────────────────────────── */}
      <div className="pnsv-sw-foot">
        <button
          type="button"
          className="pnsv-sw-button"
          data-variant="primary"
          disabled={!characterId}
          onClick={onInsert}
        >
          {t('insert')}
        </button>
        <button
          type="button"
          className="pnsv-sw-icon-button"
          data-active={showPreview ? 'true' : undefined}
          title={t('preview')}
          aria-label={t('preview')}
          aria-pressed={showPreview}
          onClick={() => setShowPreview((on) => !on)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ── the rows ────────────────────────────────────────────────────────────────

interface ListProps {
  app: HostApi;
  t: (key: StringKey) => string;
  schema: CharacterSchema;
  values: Record<string, AttributeValue>;
  previous: Record<string, AttributeValue>;
  openRow?: string;
  onToggleRow: (id: string) => void;
  onChangeValue: (attrId: string, value: AttributeValue) => void;
  onChangeSchema: (schema: CharacterSchema) => void;
  onRevert: (attrId: string) => void;
  onSaveToLibrary: (def: AttributeDef) => void;
}

const AttributeList: React.FC<ListProps> = (props) => {
  const { schema } = props;
  const ungrouped = schema.attrs.filter((attr) => !attr.groupId);
  const groups = [...schema.groups].sort((a, b) => a.order - b.order);

  return (
    <div className="pnsv-sw-list">
      {ungrouped.map((def) => (
        <Row key={def.id} def={def} {...props} />
      ))}
      {groups.map((group) => {
        const members = schema.attrs.filter((attr) => attr.groupId === group.id);
        if (members.length === 0) return null;
        return (
          <section key={group.id} className="pnsv-sw-group">
            <h3 className="pnsv-sw-group-title">{group.name}</h3>
            {members.map((def) => (
              <Row key={def.id} def={def} {...props} />
            ))}
          </section>
        );
      })}
    </div>
  );
};

const Row: React.FC<ListProps & { def: AttributeDef }> = ({
  def,
  t,
  schema,
  values,
  previous,
  openRow,
  onToggleRow,
  onChangeValue,
  onChangeSchema,
  onRevert,
  onSaveToLibrary
}) => {
  const value = values[def.id] ?? emptyValue(def.kind);
  const before = previous[def.id];
  const changed = before !== undefined && !valuesEqual(before, value);
  const open = openRow === def.id;

  // The preset's own format is close enough for the row summary — this is the
  // pane, not the output, and the preview button shows the real thing.
  const display = changed
    ? formatArrow(before, value, PANE_FORMAT)
    : formatValue(value, PANE_FORMAT);

  return (
    <div className="pnsv-sw-row-wrap" data-open={open ? 'true' : undefined}>
      <button
        type="button"
        className="pnsv-sw-row"
        aria-expanded={open}
        onClick={() => onToggleRow(def.id)}
      >
        <span className="pnsv-sw-row-name">
          {changed ? <span className="pnsv-sw-dot" title={t('changedHere')} /> : null}
          {def.name || <em className="pnsv-sw-unnamed">{t('attributeName')}</em>}
        </span>
        <span className="pnsv-sw-row-value" data-changed={changed ? 'true' : undefined}>
          {display || '—'}
        </span>
      </button>

      {open ? (
        <div className="pnsv-sw-editor">
          <div className="pnsv-sw-fields">
            <label className="pnsv-sw-cell" data-grow="true">
              <span className="pnsv-sw-cell-label">{t('attributeName')}</span>
              <input
                className="pnsv-sw-input"
                value={def.name}
                onChange={(event) =>
                  onChangeSchema({
                    ...schema,
                    attrs: schema.attrs.map((attr) =>
                      attr.id === def.id ? { ...attr, name: event.target.value } : attr
                    )
                  })
                }
              />
            </label>
          </div>

          <FieldEditor
            def={def}
            value={value}
            t={t}
            onChange={(next) => onChangeValue(def.id, next)}
          />

          <div className="pnsv-sw-row-actions">
            {changed ? (
              <button type="button" className="pnsv-sw-ghostbtn" onClick={() => onRevert(def.id)}>
                {t('revert')}
              </button>
            ) : (
              <span className="pnsv-sw-hint">{before !== undefined ? t('inherited') : ''}</span>
            )}
            <span className="pnsv-sw-row-actions-end">
              {/* How the library actually grows: the fastest way to get
                  `기술 (능력치, F–SSS)` into the picker is to have built one. */}
              {def.name.trim() ? (
                <button
                  type="button"
                  className="pnsv-sw-ghostbtn"
                  onClick={() => onSaveToLibrary(def)}
                >
                  {t('saveToLibrary')}
                </button>
              ) : null}
              <button
                type="button"
                className="pnsv-sw-ghostbtn"
                onClick={() =>
                  onChangeSchema({
                    ...schema,
                    attrs: schema.attrs.filter((attr) => attr.id !== def.id)
                  })
                }
              >
                {t('removeAttribute')}
              </button>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Formatting for the row summary only. Neutral punctuation on purpose: the row
 * is UI chrome, and borrowing the preset's fullwidth colons or comma grouping
 * here would make the pane look like output rather than like the app.
 */
const PANE_FORMAT = {
  thousands: false,
  regenLabel: '',
  regenSuffix: '',
  arrow: ' → ',
  barChars: ['█', '░'] as [string, string],
  barWidth: 8,
  listJoin: ', '
};
