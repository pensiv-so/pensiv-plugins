import * as React from 'react';
import { createPortal } from 'react-dom';
import type { HostApi } from '@pensiv/plugin-sdk';
import {
  addMonths,
  daysInMonth,
  formatDate,
  parseISO,
  toISO,
  weekdayOf,
  type CivilDate,
  type DateFormat
} from './engine';
import { localeTag, STR, tr } from './i18n';
import { CalendarGlyph, ChevronLeft, ChevronRight, Icon } from './icons';

/**
 * A date field in the app's own idiom: a field-shaped trigger showing the date
 * the way the rest of pensiv writes dates, and a month grid in a popover.
 *
 * `<input type="date">` was the obvious thing and the wrong one. Its editor is
 * the *browser's*, so a Korean UI gets `mm/dd/yyyy` and a US month-first order
 * that nothing else in the app uses, its calendar button is a Chromium glyph, and
 * none of it takes the user's theme. This is a port of the app's own date
 * picker instead — `Calendar` (react-day-picker) inside a popover, `--cell-size`
 * days as ghost buttons, today filled with the accent, the selected day on
 * `muted`.
 */
export interface DateFieldProps {
  app: HostApi;
  label: string;
  /** `YYYY-MM-DD`, or `''` when nothing is chosen yet. */
  value: string;
  onChange: (iso: string) => void;
  /** Shown as a text action on the label row (the app's `link` button). */
  onToday?: () => void;
  format: DateFormat;
  /** Today, from the host clock — highlighted in the grid. */
  today: CivilDate;
  placeholder: string;
}

/** Monday-first is a European habit; both Korea and the US start on Sunday. */
const WEEK_START = 0;

/** Localized weekday initials, taken from a known Sunday so the order is fixed. */
const weekdayLabels = (locale: string): string[] => {
  const base = Date.UTC(2023, 0, 1); // a Sunday
  return Array.from({ length: 7 }, (_, i) =>
    new Date(base + i * 86_400_000).toLocaleDateString(locale, {
      weekday: 'short',
      timeZone: 'UTC'
    })
  );
};

/** The 42 cells of a month grid: leading/trailing days included, like the app's. */
const monthGrid = (year: number, month: number): CivilDate[] => {
  const first: CivilDate = { year, month, day: 1 };
  const lead = (weekdayOf(first) - WEEK_START + 7) % 7;
  const days: CivilDate[] = [];
  const prev = addMonths(first, -1);
  const prevLength = daysInMonth(prev.year, prev.month);
  for (let i = lead; i > 0; i -= 1) {
    days.push({ year: prev.year, month: prev.month, day: prevLength - i + 1 });
  }
  const length = daysInMonth(year, month);
  for (let day = 1; day <= length; day += 1) days.push({ year, month, day });
  const next = addMonths(first, 1);
  for (let day = 1; days.length < 42; day += 1) {
    days.push({ year: next.year, month: next.month, day });
  }
  return days;
};

const sameDate = (a: CivilDate, b: CivilDate): boolean =>
  a.year === b.year && a.month === b.month && a.day === b.day;

export const DateField: React.FC<DateFieldProps> = ({
  app,
  label,
  value,
  onChange,
  onToday,
  format,
  today,
  placeholder
}) => {
  const locale = localeTag(app);
  const selected = parseISO(value);
  const [open, setOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState<CivilDate>(selected ?? today);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);

  // Re-anchor the month on the selected date when the popover opens, so reopening
  // a 1998 birthday doesn't land the user back on this month. Done in the handler
  // rather than an effect: an effect keyed on the selection would also yank the
  // month back while the user is paging through the calendar.
  const toggle = (): void => {
    if (open) {
      setOpen(false);
      return;
    }
    setCursor(selected ?? today);
    setOpen(true);
  };

  const reposition = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const width = popoverRef.current?.offsetWidth || 17 * rootPx;
    const height = popoverRef.current?.offsetHeight || 20 * rootPx;
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, window.innerWidth - margin - width)
    );
    // Flip above the field when there isn't room below — a side pane near the
    // bottom of the window is the normal case, not the exception.
    const below = rect.bottom + 6;
    const top =
      below + height > window.innerHeight - margin
        ? Math.max(margin, rect.top - height - 6)
        : below;
    setCoords({ top, left });
  }, []);

  React.useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  const days = monthGrid(cursor.year, cursor.month);
  const caption = new Date(Date.UTC(cursor.year, cursor.month - 1, 1)).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC'
  });
  // A birth date is decades back, so month chevrons alone would be a chore —
  // the year is a select, the way the app's calendar offers a dropdown caption.
  const years = Array.from({ length: 141 }, (_, i) => today.year - 120 + i);

  const pick = (date: CivilDate): void => {
    onChange(toISO(date));
    setOpen(false);
  };

  return (
    <div className="pnsv-dc-field">
      <span className="pnsv-dc-field-head">
        <span className="pnsv-dc-label">{label}</span>
        {onToday ? (
          <button type="button" className="pnsv-dc-btn pnsv-dc-btn-link" onClick={onToday}>
            {tr(app, STR.today)}
          </button>
        ) : null}
      </span>

      <button
        type="button"
        ref={triggerRef}
        className={`pnsv-dc-datefield${selected ? '' : ' is-empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="pnsv-dc-datefield-value">
          {selected ? formatDate(selected, format, locale) : placeholder}
        </span>
        <Icon size="0.875rem" className="pnsv-dc-datefield-icon">
          {CalendarGlyph}
        </Icon>
      </button>

      {open && coords
        ? createPortal(
            <div
              ref={popoverRef}
              className="pnsv-dc-cal"
              role="dialog"
              aria-label={label}
              style={{ top: coords.top, left: coords.left }}
            >
              <div className="pnsv-dc-cal-nav">
                <button
                  type="button"
                  className="pnsv-dc-btn pnsv-dc-btn-ghost pnsv-dc-btn-icon"
                  aria-label={tr(app, STR.prevMonth)}
                  onClick={() => setCursor(addMonths(cursor, -1))}
                >
                  <Icon size="1rem">{ChevronLeft}</Icon>
                </button>
                <span className="pnsv-dc-cal-caption">
                  {caption}
                  <select
                    className="pnsv-dc-cal-year"
                    value={cursor.year}
                    aria-label={tr(app, STR.year)}
                    onChange={(event) =>
                      setCursor({ ...cursor, year: Number(event.target.value) || cursor.year })
                    }
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </span>
                <button
                  type="button"
                  className="pnsv-dc-btn pnsv-dc-btn-ghost pnsv-dc-btn-icon"
                  aria-label={tr(app, STR.nextMonth)}
                  onClick={() => setCursor(addMonths(cursor, 1))}
                >
                  <Icon size="1rem">{ChevronRight}</Icon>
                </button>
              </div>

              <div className="pnsv-dc-cal-weekdays">
                {weekdayLabels(locale).map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>

              <div className="pnsv-dc-cal-grid">
                {days.map((date) => {
                  const outside = date.month !== cursor.month;
                  const isToday = sameDate(date, today);
                  const isSelected = selected != null && sameDate(date, selected);
                  return (
                    <button
                      type="button"
                      key={toISO(date)}
                      className="pnsv-dc-btn pnsv-dc-btn-ghost pnsv-dc-cal-day"
                      data-outside={outside || undefined}
                      data-today={isToday || undefined}
                      data-selected={isSelected || undefined}
                      onClick={() => pick(date)}
                    >
                      {date.day}
                    </button>
                  );
                })}
              </div>

              <div className="pnsv-dc-cal-foot">
                <button
                  type="button"
                  className="pnsv-dc-btn pnsv-dc-btn-ghost pnsv-dc-cal-today"
                  onClick={() => pick(today)}
                >
                  {tr(app, STR.today)}
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
