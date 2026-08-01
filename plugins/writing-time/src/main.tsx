import * as React from 'react';
import { Plugin, type WidgetProps } from '@pensiv/plugin-sdk';

/**
 * The reference example for the session lifecycle — `app.session.activeMs()`
 * plus the `write-start` / `write-stop` / `tick` events, and `app.ui.openSheet`.
 *
 * Worth copying:
 *
 *  1. **`activeMs` is *writing* time, not app-open time.** The host accumulates
 *     wall clock between consecutive edits and drops any gap longer than its idle
 *     window, so a coffee break is not counted. It is device-local and resets at
 *     local midnight.
 *  2. **`tick` only fires while the user is actually writing.** That is what
 *     makes a live counter cheap: no interval of your own, and nothing running
 *     while the user is reading.
 *  3. **One shared hook, three surfaces.** The chip, the floating card and the
 *     phone sheet all read the same state, so they can never disagree.
 */

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/** Live active-writing-time, re-read on every host tick. */
function useActiveMs(app: WidgetProps['app']): { ms: number; writing: boolean } {
  const [ms, setMs] = React.useState(() => app.session.activeMs());
  const [writing, setWriting] = React.useState(false);

  React.useEffect(() => {
    const read = () => setMs(app.session.activeMs());
    // `tick` fires roughly once a second, but only during a writing stretch —
    // so this is a live counter that costs nothing while the user is idle.
    const offTick = app.session.on('tick', read);
    const offStart = app.session.on('write-start', () => {
      setWriting(true);
      read();
    });
    const offStop = app.session.on('write-stop', () => {
      setWriting(false);
      read();
    });
    return () => {
      offTick();
      offStart();
      offStop();
    };
  }, [app]);

  return { ms, writing };
}

/** Compact tray pill content (mobile). The host owns the pill chrome. */
function TimeChip({ app }: WidgetProps) {
  const { ms, writing } = useActiveMs(app);
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {writing ? '✍️ ' : ''}
      {formatDuration(ms)}
    </span>
  );
}

/** Full card (desktop floating widget / mobile sheet body). */
function TimeCard({ app }: WidgetProps) {
  const { ms, writing } = useActiveMs(app);
  const today = app.session.today();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        fontSize: '0.8125rem',
        color: 'hsl(var(--foreground))'
      }}
    >
      <strong style={{ fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(ms)}
      </strong>
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>
        {writing ? 'writing now' : 'idle'} · {today.net.words} words today
      </span>
    </div>
  );
}

export default class WritingTimePlugin extends Plugin {
  onload(): void {
    this.registerWidget({
      id: 'writing-time',
      surface: 'floating',
      frame: 'floating',
      defaultCorner: 'bottom-right',
      storageKey: 'writing-time-widget',
      component: TimeCard,
      chip: TimeChip,
      sheet: TimeCard,
      // Floating card is opt-in; the tray chip is always offered.
      shouldRender: ({ app }) => app.storage.get<boolean>('floating') ?? false,
      chipShouldRender: () => true
    });

    this.addSettingTab({
      title: 'Writing Time',
      schema: {
        fields: [
          {
            key: 'floating',
            type: 'toggle',
            label: 'Show floating widget',
            description: 'Pin a live timer card to a screen corner.',
            default: false,
            // Phones use the tray chip instead of a floating card.
            formFactors: ['desktop', 'tablet', 'web']
          }
        ]
      }
    });

    // `openSheet` hands the host a body and lets it pick the surface — a dialog
    // on desktop, a real bottom sheet on mobile.
    this.addCommand({
      id: 'show-today',
      name: "Writing Time: Today's summary",
      run: () => this.app.ui.openSheet(<TimeCard app={this.app} />)
    });
  }
}
