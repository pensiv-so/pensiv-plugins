import type { HostApi, SettingsSchema } from '@pensiv/plugin-sdk';

import type { AnalyzeOptions, ParagraphKind, QuoteGroup } from './analyze';
import { DEFAULT_MAPPING } from './analyze';
import { STR } from './i18n';

/**
 * Storage keys. Flat strings rather than an object blob: the host's declarative
 * settings form writes one key per field, and reading them back is
 * `app.storage.get(key) ?? DEFAULTS[key]`.
 */
export const KEYS = {
  includeHeadings: 'includeHeadings',
  splitOnHardBreak: 'splitOnHardBreak',
  dashDialogue: 'dashDialogue',
  countSpaces: 'countSpaces',
  excludeEmptyFromAverage: 'excludeEmptyFromAverage',
  mobileLineChars: 'mobileLineChars',
  mapSingle: 'mapSingle',
  mapRound: 'mapRound',
  mapDoubleCorner: 'mapDoubleCorner',
  mapBrackets: 'mapBrackets',
  mapAngles: 'mapAngles',
  scope: 'scope'
} as const;

export const DEFAULTS = {
  includeHeadings: false,
  splitOnHardBreak: true,
  dashDialogue: false,
  countSpaces: true,
  excludeEmptyFromAverage: true,
  mobileLineChars: 28,
  mapSingle: DEFAULT_MAPPING.curlySingle,
  mapRound: DEFAULT_MAPPING.round,
  mapDoubleCorner: DEFAULT_MAPPING.doubleCorner,
  mapBrackets: DEFAULT_MAPPING.square,
  mapAngles: DEFAULT_MAPPING.angle
} as const;

/**
 * Which glyph groups each settings row governs. Speech marks are deliberately
 * absent: `“ ”`, `" "`, `「 」` and `« »` mean speech in every manuscript that
 * uses them, and making them configurable would only invite a setting that
 * breaks the pane.
 */
const MAP_FIELDS: Record<string, QuoteGroup[]> = {
  [KEYS.mapSingle]: ['curlySingle', 'straightSingle'],
  [KEYS.mapRound]: ['round', 'fullwidthRound'],
  [KEYS.mapDoubleCorner]: ['doubleCorner'],
  [KEYS.mapBrackets]: ['square', 'fullwidthSquare', 'lenticular', 'tortoise', 'curlyBrace'],
  [KEYS.mapAngles]: ['angle', 'doubleAngle']
};

const KINDS = new Set<ParagraphKind>(['narration', 'dialogue', 'monologue', 'special']);

const readKind = (app: HostApi, key: string, fallback: ParagraphKind): ParagraphKind => {
  const stored = app.storage.get<string>(key);
  return stored && KINDS.has(stored as ParagraphKind) ? (stored as ParagraphKind) : fallback;
};

const readBool = (app: HostApi, key: string, fallback: boolean): boolean => {
  const stored = app.storage.get<boolean>(key);
  return typeof stored === 'boolean' ? stored : fallback;
};

/** The live settings, as the shape {@link AnalyzeOptions} wants. */
export const readOptions = (app: HostApi): AnalyzeOptions => {
  const mapping: Partial<Record<QuoteGroup, ParagraphKind>> = {};
  for (const [key, groups] of Object.entries(MAP_FIELDS)) {
    const kind = readKind(app, key, DEFAULTS[key as keyof typeof DEFAULTS] as ParagraphKind);
    for (const group of groups) mapping[group] = kind;
  }

  const lineChars = app.storage.get<number>(KEYS.mobileLineChars);

  return {
    mapping,
    includeHeadings: readBool(app, KEYS.includeHeadings, DEFAULTS.includeHeadings),
    splitOnHardBreak: readBool(app, KEYS.splitOnHardBreak, DEFAULTS.splitOnHardBreak),
    dashDialogue: readBool(app, KEYS.dashDialogue, DEFAULTS.dashDialogue),
    countSpaces: readBool(app, KEYS.countSpaces, DEFAULTS.countSpaces),
    excludeEmptyFromAverage: readBool(
      app,
      KEYS.excludeEmptyFromAverage,
      DEFAULTS.excludeEmptyFromAverage
    ),
    mobileLineChars:
      typeof lineChars === 'number' && Number.isFinite(lineChars) && lineChars > 0
        ? lineChars
        : DEFAULTS.mobileLineChars
  };
};

const kindOptions = () => [
  { value: 'dialogue', label: STR.optDialogue },
  { value: 'monologue', label: STR.optMonologue },
  { value: 'special', label: STR.optSpecial },
  { value: 'narration', label: STR.optNarration }
];

/** The declarative form the host renders — no settings UI of our own. */
export const settingsSchema = (): SettingsSchema => ({
  fields: [
    {
      type: 'group',
      title: STR.settingsCounting,
      fields: [
        {
          key: KEYS.splitOnHardBreak,
          type: 'toggle',
          label: STR.splitOnHardBreak,
          description: STR.splitOnHardBreakHint,
          default: DEFAULTS.splitOnHardBreak
        },
        {
          key: KEYS.excludeEmptyFromAverage,
          type: 'toggle',
          label: STR.excludeEmpty,
          description: STR.excludeEmptyHint,
          default: DEFAULTS.excludeEmptyFromAverage
        },
        {
          key: KEYS.countSpaces,
          type: 'toggle',
          label: STR.countSpaces,
          description: STR.countSpacesHint,
          default: DEFAULTS.countSpaces
        },
        {
          key: KEYS.includeHeadings,
          type: 'toggle',
          label: STR.includeHeadings,
          description: STR.includeHeadingsHint,
          default: DEFAULTS.includeHeadings
        },
        {
          key: KEYS.mobileLineChars,
          type: 'number',
          label: STR.mobileLineChars,
          description: STR.mobileLineCharsHint,
          default: DEFAULTS.mobileLineChars,
          min: 10,
          max: 120,
          step: 1
        }
      ]
    },
    {
      type: 'group',
      title: STR.settingsQuotes,
      description: STR.settingsQuotesHint,
      fields: [
        {
          key: KEYS.mapSingle,
          type: 'select',
          label: STR.mapSingle,
          sample: "‘ ’  ' '",
          options: kindOptions(),
          default: DEFAULTS.mapSingle
        },
        {
          key: KEYS.mapRound,
          type: 'select',
          label: STR.mapRound,
          sample: '( )  （ ）',
          options: kindOptions(),
          default: DEFAULTS.mapRound
        },
        {
          key: KEYS.mapDoubleCorner,
          type: 'select',
          label: STR.mapDoubleCorner,
          sample: '『 』',
          options: kindOptions(),
          default: DEFAULTS.mapDoubleCorner
        },
        {
          key: KEYS.mapBrackets,
          type: 'select',
          label: STR.mapBrackets,
          sample: '[ ]  【 】  〔 〕',
          options: kindOptions(),
          default: DEFAULTS.mapBrackets
        },
        {
          key: KEYS.mapAngles,
          type: 'select',
          label: STR.mapAngles,
          sample: '〈 〉  《 》',
          options: kindOptions(),
          default: DEFAULTS.mapAngles
        },
        {
          key: KEYS.dashDialogue,
          type: 'toggle',
          label: STR.dashDialogue,
          description: STR.dashDialogueHint,
          sample: '— ',
          default: DEFAULTS.dashDialogue
        }
      ]
    }
  ]
});
