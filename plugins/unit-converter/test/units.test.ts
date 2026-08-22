import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  categoryById,
  convert,
  formatValue,
  unitById,
  unitsOf,
  type Unit
} from '../src/units';

/**
 * The tables are the plugin: a wrong ratio is a wrong number in someone's novel,
 * and nothing in the UI would ever reveal it. So these tests check the ratios
 * against their published definitions, and check that every unit round-trips.
 */
const unit = (categoryId: string, unitId: string): Unit => {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) throw new Error(`no category ${categoryId}`);
  const found = unitById(category, unitId);
  if (!found) throw new Error(`no unit ${unitId} in ${categoryId}`);
  return found;
};

const near = (value: number | null, expected: number, epsilon = 1e-9): void => {
  expect(value).not.toBeNull();
  expect(Math.abs((value as number) - expected)).toBeLessThan(epsilon);
};

describe('table integrity', () => {
  it('gives every category a base unit whose ratio is exactly 1', () => {
    for (const category of CATEGORIES) {
      const base = unitById(category, category.base);
      expect(base, `${category.id} has no base unit`).toBeDefined();
      if (category.id !== 'temperature') expect(base?.ratio).toBe(1);
    }
  });

  it('gives every unit either a ratio or a temperature pair, and a unique id', () => {
    for (const category of CATEGORIES) {
      const ids = new Set<string>();
      for (const u of category.units) {
        expect(ids.has(u.id), `duplicate id ${u.id} in ${category.id}`).toBe(false);
        ids.add(u.id);
        const scaled = u.ratio !== undefined;
        const affine = u.toBase !== undefined && u.fromBase !== undefined;
        expect(scaled || affine, `${u.id} has no conversion`).toBe(true);
      }
    }
  });

  it('round-trips every unit through the base and back', () => {
    for (const category of CATEGORIES) {
      const base = unitById(category, category.base)!;
      for (const u of category.units) {
        const there = convert(7, u, base);
        const back = convert(there as number, base, u);
        near(back, 7, 1e-9);
      }
    }
  });
});

describe('metric and imperial', () => {
  it('uses the exact definitions, not rounded decimals', () => {
    near(convert(1, unit('length', 'in'), unit('length', 'cm')), 2.54);
    near(convert(1, unit('length', 'mi'), unit('length', 'km')), 1.609344);
    near(convert(1, unit('mass', 'lb'), unit('mass', 'kg')), 0.45359237);
    near(convert(1, unit('mass', 'oz'), unit('mass', 'g')), 28.349523125, 1e-8);
    near(convert(1, unit('length', 'nmi'), unit('length', 'm')), 1852);
  });

  it('converts area and speed', () => {
    near(convert(1, unit('area', 'ha'), unit('area', 'm2')), 10000);
    near(convert(1, unit('area', 'ac'), unit('area', 'm2')), 4046.8564224, 1e-6);
    near(convert(100, unit('speed', 'kmh'), unit('speed', 'ms')), 27.7777777778, 1e-9);
    near(convert(1, unit('speed', 'kn'), unit('speed', 'kmh')), 1.852, 1e-12);
  });
});

describe('temperature', () => {
  it('handles the different zero points, not just a ratio', () => {
    near(convert(100, unit('temperature', 'c'), unit('temperature', 'f')), 212, 1e-9);
    near(convert(32, unit('temperature', 'f'), unit('temperature', 'c')), 0, 1e-9);
    near(convert(-40, unit('temperature', 'c'), unit('temperature', 'f')), -40, 1e-9);
    near(convert(0, unit('temperature', 'c'), unit('temperature', 'k')), 273.15, 1e-9);
    near(convert(0, unit('temperature', 'k'), unit('temperature', 'f')), -459.67, 1e-9);
  });
});

describe('historical East Asian units (척관법 / 尺貫法)', () => {
  it('measures length by the 1891 definitions', () => {
    // 1 尺 = 10/33 m ≈ 30.303 cm
    near(convert(1, unit('length', 'chi'), unit('length', 'cm')), 30.3030303, 1e-6);
    // 1 寸 is a tenth of that, 1 間 is six 尺
    near(convert(10, unit('length', 'chon'), unit('length', 'chi')), 1, 1e-9);
    near(convert(1, unit('length', 'gan'), unit('length', 'm')), 1.8181818, 1e-6);
    // The Korean 里 is ~393 m; the Japanese one is ten times longer
    near(convert(1, unit('length', 'ri-ko'), unit('length', 'm')), 392.727272, 1e-5);
    near(convert(1, unit('length', 'ri-ja'), unit('length', 'km')), 3.9272727, 1e-6);
  });

  it('measures weight, area and volume', () => {
    near(convert(1, unit('mass', 'gwan'), unit('mass', 'kg')), 3.75, 1e-12);
    near(convert(1000, unit('mass', 'don'), unit('mass', 'gwan')), 1, 1e-9);
    near(convert(1, unit('mass', 'geun'), unit('mass', 'g')), 600, 1e-9);
    // 1 坪 = 400/121 m² ≈ 3.3058 m²
    near(convert(1, unit('area', 'pyeong'), unit('area', 'm2')), 3.30578512, 1e-8);
    near(convert(300, unit('area', 'pyeong'), unit('area', 'danbo')), 1, 1e-9);
    // A 30 평 flat, the standard Korean apartment size, is ~99 m²
    near(convert(30, unit('area', 'pyeong'), unit('area', 'm2')), 99.1735537, 1e-6);
    // 1 升 ≈ 1.804 L, 1 되 = 10 홉, 1 말 = 10 되
    near(convert(1, unit('volume', 'seung'), unit('volume', 'l')), 1.80390684, 1e-8);
    near(convert(10, unit('volume', 'hop'), unit('volume', 'seung')), 1, 1e-9);
    near(convert(1, unit('volume', 'mal'), unit('volume', 'l')), 18.0390684, 1e-7);
  });

  it('hides the old units unless they are asked for', () => {
    const length = categoryById('length');
    const modern = unitsOf(length, false);
    const all = unitsOf(length, true);
    expect(modern.some((u) => u.id === 'chi')).toBe(false);
    expect(all.some((u) => u.id === 'chi')).toBe(true);
    expect(all.length).toBeGreaterThan(modern.length);
  });
});

describe('formatValue', () => {
  it('drops the zeros a fixed rounding would pad with', () => {
    expect(formatValue(2.5, 4, 'en')).toBe('2.5');
    expect(formatValue(1000, 4, 'en')).toBe('1,000');
  });

  it('rounds to the requested precision', () => {
    expect(formatValue(1.23456789, 3, 'en')).toBe('1.235');
    expect(formatValue(1.23456789, 0, 'en')).toBe('1');
  });

  it('keeps small magnitudes legible instead of rounding them to zero', () => {
    // 4 decimals would show 0.0000 — worse than useless.
    expect(formatValue(0.0000254, 4, 'en')).not.toBe('0');
    expect(formatValue(1e-9, 4, 'en')).toContain('e');
  });

  it('falls back to exponential for very large results', () => {
    expect(formatValue(1e18, 4, 'en')).toContain('e');
  });

  it('reports a non-number as a dash rather than NaN', () => {
    expect(formatValue(Number.NaN, 4, 'en')).toBe('—');
    expect(convert(Number.NaN, unit('length', 'm'), unit('length', 'km'))).toBeNull();
  });
});
