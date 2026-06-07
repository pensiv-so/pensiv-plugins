import { useEffect, useState } from 'react';
import { Plugin, type WidgetProps } from '@pensiv/plugin-sdk';

/**
 * A visible example: a floating widget that shows the active document's live word
 * count. Demonstrates a React widget, the `editor.read` permission, and
 * subscribing to editor updates through the typed Host API.
 *
 * The host owns the floating chrome (`frame: 'floating'`), so this component
 * returns only its inner content.
 */
function WordCountWidget({ app }: WidgetProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => {
      try {
        setCount(app.editor.count({ countType: 'word' }));
      } catch {
        setCount(0);
      }
    };
    update();
    const unsub = app.editor.on('update', update);
    return unsub;
  }, [app]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${count} words in the active document`}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.5rem',
        padding: '0.625rem 0.875rem',
        borderRadius: 'calc(var(--radius) + 0.25rem)',
        background: 'hsl(var(--card) / 0.7)',
        color: 'hsl(var(--card-foreground))',
        border: '1px solid hsl(var(--border) / 0.6)',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(12px) saturate(140%)',
        WebkitBackdropFilter: 'blur(12px) saturate(140%)',
        fontFamily: 'inherit',
        userSelect: 'none',
        lineHeight: 1
      }}
    >
      <span
        style={{
          fontSize: '1.25rem',
          fontWeight: 650,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {count.toLocaleString()}
      </span>
      <span
        style={{
          fontSize: '0.625rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'hsl(var(--muted-foreground))'
        }}
      >
        words
      </span>
    </div>
  );
}

export default class WordCountWidgetPlugin extends Plugin {
  onload(): void {
    this.registerWidget({
      id: 'word-count',
      surface: 'floating',
      frame: 'floating',
      defaultCorner: 'bottom-right',
      storageKey: 'pensiv:word-count-widget:corner',
      component: WordCountWidget
    });
  }
}
