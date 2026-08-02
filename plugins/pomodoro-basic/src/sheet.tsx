import * as React from 'react';
import type { WidgetProps } from '@pensiv/plugin-sdk';
import {
  SheetActionRow,
  SheetButton,
  SheetGroup,
  SheetSeparator,
  SheetStack,
  SheetStatRow
} from '@pensiv/plugin-ui';
import {
  CycleDots,
  PhaseBadge,
  TickRing,
  phaseColor,
  phaseLabel,
  useSyncedSettings
} from './controls';
import { Icon, RotateCcw, Settings, SkipForward } from './icons';
import { formatClock, usePomodoroStore } from './store';
import { STR, tr } from './i18n';

/**
 * Mobile **bottom-sheet body** (phone tray). The dial is the same component the
 * desktop card uses, just larger — a phone has the room, and a big dial is a big
 * tap target. Everything around it comes from the host UI kit
 * (`@pensiv/plugin-ui`), so it matches every other plugin sheet.
 */
export const PomodoroSheet: React.FC<WidgetProps> = ({ app }) => {
  const store = usePomodoroStore();
  useSyncedSettings(app);

  const shownPhase = store.state === 'completed' ? store.upcomingPhase : store.phase;
  const color = phaseColor(app, shownPhase);
  const seconds =
    store.state === 'completed' ? store.durationFor(store.upcomingPhase) : store.remainingSeconds;
  const badgeLabel = store.state === 'paused' ? tr(app, STR.paused) : phaseLabel(app, shownPhase);

  const primaryLabel =
    store.state === 'running'
      ? tr(app, STR.pause)
      : store.state === 'paused'
        ? tr(app, STR.resume)
        : store.state === 'completed'
          ? tr(app, STR.startNext)
          : tr(app, STR.start);

  return (
    <SheetStack>
      <SheetGroup>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '1rem 0 0.75rem'
          }}
        >
          <button
            type="button"
            className="pnsv-pm-dial"
            aria-label={`${primaryLabel} · ${badgeLabel}`}
            onClick={() => store.toggle()}
          >
            <TickRing
              size="12rem"
              progress={store.state === 'completed' ? 0 : store.progress}
              color={color}
              dimmed={store.state === 'paused'}
            >
              <span className="pnsv-pm-num" style={{ fontSize: '2.25rem' }}>
                {formatClock(seconds)}
              </span>
            </TickRing>
          </button>
          <CycleDots
            done={store.completedFocus}
            total={store.durations.cycleLength}
            color={phaseColor(app, 'focus')}
          />
          <PhaseBadge label={badgeLabel} color={color} />
        </div>
        <SheetSeparator />
        <SheetStatRow
          label={tr(app, STR.cycle)}
          value={`${store.completedFocus} / ${store.durations.cycleLength}`}
        />
        <SheetStatRow label={tr(app, STR.next)} value={phaseLabel(app, store.upcomingPhase)} />
      </SheetGroup>

      <SheetGroup>
        <SheetActionRow
          icon={<Icon size="1.15rem">{SkipForward}</Icon>}
          label={tr(app, STR.skip)}
          onClick={() => store.skip()}
        />
        <SheetSeparator />
        <SheetActionRow
          icon={<Icon size="1.15rem">{RotateCcw}</Icon>}
          label={tr(app, STR.reset)}
          onClick={() => store.reset()}
        />
        <SheetSeparator />
        <SheetActionRow
          icon={<Icon size="1.15rem">{Settings}</Icon>}
          label={tr(app, STR.settings)}
          onClick={() => app.ui.openSettings()}
        />
      </SheetGroup>

      <SheetButton
        variant={store.state === 'running' ? 'outline' : 'primary'}
        label={primaryLabel}
        onClick={() => store.toggle()}
      />
    </SheetStack>
  );
};
