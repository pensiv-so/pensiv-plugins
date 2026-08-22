import type { LocalizedText } from '@pensiv/plugin-sdk';

/**
 * The unit tables and the conversion itself — pure data plus two functions, no
 * React and no host API.
 *
 * Every category has one base unit and every unit carries its ratio to that
 * base, so a conversion is `value × from.ratio ÷ to.ratio`. Temperature is the
 * one exception (its scales have different zero points), so it carries explicit
 * to/from-base functions instead.
 *
 * Ratios are written as exact definitions wherever one exists — an inch *is*
 * 0.0254 m, a pound *is* 0.45359237 kg — rather than as rounded decimals, so a
 * round trip comes back to where it started.
 */

export type CategoryId = 'length' | 'mass' | 'area' | 'volume' | 'temperature' | 'speed' | 'time';

export interface Unit {
  id: string;
  /** Short symbol shown in the picker and the result (`km`, `坪`, `°C`). */
  symbol: string;
  name: LocalizedText;
  /** How many base units one of this unit is. Absent for temperature. */
  ratio?: number;
  /** Temperature only: to and from the category's base scale. */
  toBase?: (value: number) => number;
  fromBase?: (value: number) => number;
  /**
   * A historical East Asian unit (尺貫法 / 척관법). Hidden unless the user asks
   * for them — they are indispensable for period fiction and noise for everyone
   * else. The values are the modern Japanese standardisations, which Korea
   * shared administratively from 1902; older regional 尺 differ, and a novel set
   * before that should treat these as an approximation.
   */
  historical?: boolean;
}

export interface Category {
  id: CategoryId;
  name: LocalizedText;
  /** Unit id every ratio in this category is relative to. */
  base: string;
  units: Unit[];
}

const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

/** Exact SI/imperial definitions, so a round trip is lossless. */
const INCH_M = 0.0254;
const FOOT_M = INCH_M * 12;
const YARD_M = FOOT_M * 3;
const MILE_M = FOOT_M * 5280;
const POUND_KG = 0.45359237;

/** 尺貫法 / 척관법: 1 尺 = 10/33 m, 1 貫 = 3.75 kg — the 1891 Japanese definitions. */
const SHAKU_M = 10 / 33;
const KAN_KG = 3.75;
/** 1 坪 = 1 평 = 400/121 m² (a square of 6 尺). */
const TSUBO_M2 = 400 / 121;
/** 1 升 = 2401/1331 L; 1 斗 = 10 升, 1 合 = 1/10 升. */
const SHO_L = 2401 / 1331;

export const CATEGORIES: Category[] = [
  {
    id: 'length',
    name: L('Length', '길이', '長さ'),
    base: 'm',
    units: [
      { id: 'mm', symbol: 'mm', name: L('Millimetre', '밀리미터', 'ミリメートル'), ratio: 0.001 },
      { id: 'cm', symbol: 'cm', name: L('Centimetre', '센티미터', 'センチメートル'), ratio: 0.01 },
      { id: 'm', symbol: 'm', name: L('Metre', '미터', 'メートル'), ratio: 1 },
      { id: 'km', symbol: 'km', name: L('Kilometre', '킬로미터', 'キロメートル'), ratio: 1000 },
      { id: 'in', symbol: 'in', name: L('Inch', '인치', 'インチ'), ratio: INCH_M },
      { id: 'ft', symbol: 'ft', name: L('Foot', '피트', 'フィート'), ratio: FOOT_M },
      { id: 'yd', symbol: 'yd', name: L('Yard', '야드', 'ヤード'), ratio: YARD_M },
      { id: 'mi', symbol: 'mi', name: L('Mile', '마일', 'マイル'), ratio: MILE_M },
      {
        id: 'nmi',
        symbol: 'nmi',
        name: L('Nautical mile', '해리', '海里'),
        ratio: 1852
      },
      {
        id: 'chi',
        symbol: '尺',
        name: L('Shaku / chi', '자(척)', '尺'),
        ratio: SHAKU_M,
        historical: true
      },
      {
        id: 'chon',
        symbol: '寸',
        name: L('Sun / chon', '치(촌)', '寸'),
        ratio: SHAKU_M / 10,
        historical: true
      },
      {
        id: 'gan',
        symbol: '間',
        name: L('Ken / gan', '칸(간)', '間'),
        ratio: SHAKU_M * 6,
        historical: true
      },
      {
        id: 'ri-ko',
        symbol: '里',
        name: L('Ri (Korean, 393 m)', '리(里)', '里（朝鮮）'),
        // 1 리 = 1,296 尺 — the Korean ri, about a tenth of the Japanese one.
        ratio: SHAKU_M * 1296,
        historical: true
      },
      {
        id: 'ri-ja',
        symbol: '里',
        name: L('Ri (Japanese, 3.9 km)', '리(일본, 3.9km)', '里（日本）'),
        ratio: SHAKU_M * 12960,
        historical: true
      }
    ]
  },
  {
    id: 'mass',
    name: L('Weight', '무게', '重さ'),
    base: 'kg',
    units: [
      { id: 'mg', symbol: 'mg', name: L('Milligram', '밀리그램', 'ミリグラム'), ratio: 1e-6 },
      { id: 'g', symbol: 'g', name: L('Gram', '그램', 'グラム'), ratio: 0.001 },
      { id: 'kg', symbol: 'kg', name: L('Kilogram', '킬로그램', 'キログラム'), ratio: 1 },
      { id: 't', symbol: 't', name: L('Tonne', '톤', 'トン'), ratio: 1000 },
      { id: 'oz', symbol: 'oz', name: L('Ounce', '온스', 'オンス'), ratio: POUND_KG / 16 },
      { id: 'lb', symbol: 'lb', name: L('Pound', '파운드', 'ポンド'), ratio: POUND_KG },
      {
        id: 'st',
        symbol: 'st',
        name: L('Stone', '스톤', 'ストーン'),
        ratio: POUND_KG * 14
      },
      {
        id: 'geun',
        symbol: '斤',
        name: L('Geun / kin (600 g)', '근(斤)', '斤'),
        // The market 근 — 160 돈. Meat and produce are still sold by it in Korea.
        ratio: 0.6,
        historical: true
      },
      {
        id: 'don',
        symbol: '錢',
        name: L('Don / momme (3.75 g)', '돈(錢)', '匁'),
        ratio: KAN_KG / 1000,
        historical: true
      },
      {
        id: 'gwan',
        symbol: '貫',
        name: L('Gwan / kan (3.75 kg)', '관(貫)', '貫'),
        ratio: KAN_KG,
        historical: true
      }
    ]
  },
  {
    id: 'area',
    name: L('Area', '넓이', '面積'),
    base: 'm2',
    units: [
      {
        id: 'cm2',
        symbol: 'cm²',
        name: L('Square centimetre', '제곱센티미터', '平方センチメートル'),
        ratio: 0.0001
      },
      { id: 'm2', symbol: 'm²', name: L('Square metre', '제곱미터', '平方メートル'), ratio: 1 },
      {
        id: 'km2',
        symbol: 'km²',
        name: L('Square kilometre', '제곱킬로미터', '平方キロメートル'),
        ratio: 1e6
      },
      { id: 'ha', symbol: 'ha', name: L('Hectare', '헥타르', 'ヘクタール'), ratio: 10000 },
      {
        id: 'ft2',
        symbol: 'ft²',
        name: L('Square foot', '제곱피트', '平方フィート'),
        ratio: FOOT_M ** 2
      },
      { id: 'ac', symbol: 'ac', name: L('Acre', '에이커', 'エーカー'), ratio: YARD_M ** 2 * 4840 },
      {
        id: 'pyeong',
        symbol: '坪',
        name: L('Pyeong / tsubo (3.31 m²)', '평(坪)', '坪'),
        // Still how Korean and Japanese property is spoken about, legal metric
        // labelling notwithstanding.
        ratio: TSUBO_M2,
        historical: true
      },
      {
        id: 'danbo',
        symbol: '段',
        name: L('Dan / tan (992 m²)', '단보(段)', '段'),
        ratio: TSUBO_M2 * 300,
        historical: true
      },
      {
        id: 'jeongbo',
        symbol: '町',
        name: L('Jeongbo / chō (9,917 m²)', '정보(町)', '町'),
        ratio: TSUBO_M2 * 3000,
        historical: true
      }
    ]
  },
  {
    id: 'volume',
    name: L('Volume', '부피', '体積'),
    base: 'l',
    units: [
      { id: 'ml', symbol: 'mL', name: L('Millilitre', '밀리리터', 'ミリリットル'), ratio: 0.001 },
      { id: 'l', symbol: 'L', name: L('Litre', '리터', 'リットル'), ratio: 1 },
      { id: 'm3', symbol: 'm³', name: L('Cubic metre', '세제곱미터', '立方メートル'), ratio: 1000 },
      {
        id: 'cup',
        symbol: 'cup',
        name: L('Cup (US)', '컵(미국)', 'カップ（米）'),
        ratio: 0.2365882365
      },
      {
        id: 'pt',
        symbol: 'pt',
        name: L('Pint (US)', '파인트(미국)', 'パイント（米）'),
        ratio: 0.473176473
      },
      {
        id: 'gal',
        symbol: 'gal',
        name: L('Gallon (US)', '갤런(미국)', 'ガロン（米）'),
        ratio: 3.785411784
      },
      {
        id: 'floz',
        symbol: 'fl oz',
        name: L('Fluid ounce (US)', '액량온스(미국)', '液量オンス（米）'),
        ratio: 0.0295735295625
      },
      {
        id: 'hop',
        symbol: '合',
        name: L('Hop / gō (180 mL)', '홉(合)', '合'),
        ratio: SHO_L / 10,
        historical: true
      },
      {
        id: 'seung',
        symbol: '升',
        name: L('Seung / shō (1.8 L)', '되(升)', '升'),
        ratio: SHO_L,
        historical: true
      },
      {
        id: 'mal',
        symbol: '斗',
        name: L('Mal / to (18 L)', '말(斗)', '斗'),
        ratio: SHO_L * 10,
        historical: true
      }
    ]
  },
  {
    id: 'temperature',
    name: L('Temperature', '온도', '温度'),
    base: 'c',
    units: [
      {
        id: 'c',
        symbol: '°C',
        name: L('Celsius', '섭씨', '摂氏'),
        toBase: (v) => v,
        fromBase: (v) => v
      },
      {
        id: 'f',
        symbol: '°F',
        name: L('Fahrenheit', '화씨', '華氏'),
        toBase: (v) => ((v - 32) * 5) / 9,
        fromBase: (v) => (v * 9) / 5 + 32
      },
      {
        id: 'k',
        symbol: 'K',
        name: L('Kelvin', '켈빈', 'ケルビン'),
        toBase: (v) => v - 273.15,
        fromBase: (v) => v + 273.15
      }
    ]
  },
  {
    id: 'speed',
    name: L('Speed', '속도', '速さ'),
    base: 'ms',
    units: [
      {
        id: 'ms',
        symbol: 'm/s',
        name: L('Metres per second', '초속 미터', 'メートル毎秒'),
        ratio: 1
      },
      {
        id: 'kmh',
        symbol: 'km/h',
        name: L('Kilometres per hour', '시속 킬로미터', 'キロメートル毎時'),
        ratio: 1000 / 3600
      },
      {
        id: 'mph',
        symbol: 'mph',
        name: L('Miles per hour', '시속 마일', 'マイル毎時'),
        ratio: MILE_M / 3600
      },
      { id: 'kn', symbol: 'kn', name: L('Knot', '노트', 'ノット'), ratio: 1852 / 3600 }
    ]
  },
  {
    id: 'time',
    name: L('Time', '시간', '時間'),
    base: 'min',
    units: [
      { id: 's', symbol: 's', name: L('Second', '초', '秒'), ratio: 1 / 60 },
      { id: 'min', symbol: 'min', name: L('Minute', '분', '分'), ratio: 1 },
      { id: 'h', symbol: 'h', name: L('Hour', '시간', '時間'), ratio: 60 },
      { id: 'd', symbol: 'd', name: L('Day', '일', '日'), ratio: 1440 },
      { id: 'wk', symbol: 'wk', name: L('Week', '주', '週'), ratio: 10080 }
    ]
  }
];

export const categoryById = (id: CategoryId): Category =>
  CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[0]!;

/** Units of a category, with the historical ones filtered out unless asked for. */
export const unitsOf = (category: Category, includeHistorical: boolean): Unit[] =>
  includeHistorical ? category.units : category.units.filter((unit) => !unit.historical);

export const unitById = (category: Category, id: string): Unit | undefined =>
  category.units.find((unit) => unit.id === id);

/**
 * Which two units a category opens on before the user has picked. These are the
 * conversion people actually reach for in that category — not the first two rows
 * of the table.
 */
const DEFAULT_PAIRS: Record<CategoryId, [string, string]> = {
  length: ['cm', 'in'],
  mass: ['kg', 'lb'],
  area: ['m2', 'pyeong'],
  volume: ['l', 'gal'],
  temperature: ['c', 'f'],
  speed: ['kmh', 'mph'],
  time: ['h', 'min']
};

/**
 * Resolve a stored pair against the units actually on offer right now. Lives here
 * rather than in the panel because the chip has to answer the same question, and
 * a chip showing a different pair from the sheet it opens would be a bug.
 *
 * A stored unit can genuinely vanish — switching the historical units off takes
 * 坪 out of the area list — so each side falls back to the category default, then
 * to whatever is left, rather than rendering an empty select.
 */
export function resolvePair(
  category: Category,
  stored: { from: string; to: string } | undefined,
  available: Unit[]
): { from: Unit; to: Unit } {
  const fallback = DEFAULT_PAIRS[category.id];
  const pick = (id: string | undefined, index: number): Unit =>
    available.find((unit) => unit.id === id) ??
    available.find((unit) => unit.id === fallback[index]) ??
    available[Math.min(index, available.length - 1)] ??
    category.units[0]!;
  return { from: pick(stored?.from, 0), to: pick(stored?.to, 1) };
}

/**
 * Convert between two units of the same category. Ratio units go through the
 * base; temperature uses its own to/from-base pair, because °C and °F disagree
 * about where zero is and a ratio can't express that.
 *
 * Returns `null` when either unit is unknown or the input isn't finite — the
 * caller shows a placeholder rather than `NaN`.
 */
export function convert(value: number, from: Unit, to: Unit): number | null {
  if (!Number.isFinite(value)) return null;
  if (from.toBase && to.fromBase) return to.fromBase(from.toBase(value));
  if (from.ratio === undefined || to.ratio === undefined) return null;
  return (value * from.ratio) / to.ratio;
}

/**
 * Round to `precision` significant-ish decimals, then drop trailing zeros.
 *
 * Fixed decimals alone are wrong at both ends — `0.0000254` shows as `0.00` and
 * `1234567.891` carries noise nobody asked for — so very small magnitudes fall
 * back to significant digits and very large ones to exponential.
 */
export function formatValue(value: number, precision: number, locale: string): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs !== 0 && abs < 1e-6) return value.toExponential(Math.min(precision, 6));
  if (abs >= 1e15) return value.toExponential(Math.min(precision, 6));
  // `toFixed` first so the rounding is decimal-exact, then re-parse to drop the
  // zeros it pads with, then group for display.
  const rounded = Number.parseFloat(
    value.toFixed(abs !== 0 && abs < 1 ? precision + 2 : precision)
  );
  return rounded.toLocaleString(locale, { maximumFractionDigits: 20 });
}
