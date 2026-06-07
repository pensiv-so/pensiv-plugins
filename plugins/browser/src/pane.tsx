import * as React from 'react';
import { createPortal } from 'react-dom';
import type { HostApi, PaneProps } from '@pensiv/plugin-sdk';

const DEFAULT_BROWSER_URL = 'https://www.google.com/';
const GOOGLE_SEARCH = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/** Turn an address-bar entry into a URL (or a Google search), matching native. */
function resolveNavigationTarget(raw: string): string {
  const t = raw.trim();
  if (!t) return DEFAULT_BROWSER_URL;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t;
  if (/^localhost(:\d+)?(\/|$)/i.test(t)) return `http://${t}`;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(t)) return `https://${t}`;
  return GOOGLE_SEARCH(t);
}

/** Minimal Electron `<webview>` surface we drive (no Electron types in the plugin). */
interface WebviewElement extends HTMLElement {
  loadURL(url: string): Promise<void>;
  reload(): void;
  reloadIgnoringCache(): void;
  stop(): void;
  goBack(): void;
  goForward(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  getURL(): string;
  getZoomFactor(): number;
  setZoomFactor(factor: number): void;
}

interface Bookmark {
  title?: string;
  url?: string;
  visible?: boolean;
}

// --- lucide icons (match the native MonoIcon set) -------------------------
const Svg: React.FC<{ children: React.ReactNode; spin?: boolean }> = ({ children, spin }) => (
  <svg
    className={spin ? 'pnsv-br-spin' : undefined}
    style={{ width: '1rem', height: '1rem' }}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);
const IconBack = () => <Svg><path d="M19 12H5M12 19l-7-7 7-7" /></Svg>;
const IconFwd = () => <Svg><path d="M5 12h14M12 5l7 7-7 7" /></Svg>;
const IconReload = () => (
  <Svg>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </Svg>
);
const IconSpinner = () => (
  <Svg spin>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </Svg>
);
const IconMore = () => (
  <Svg>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </Svg>
);
const IconGlobe = () => (
  <Svg>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
  </Svg>
);
const IconCopy = () => (
  <Svg>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Svg>
);
const IconMinus = () => <Svg><path d="M5 12h14" /></Svg>;
const IconPlus = () => <Svg><path d="M5 12h14M12 5v14" /></Svg>;

export const BrowserPane: React.FC<PaneProps> = ({ app }) => {
  const cfg = app.platform.webviewConfig;
  const homepage = (app.storage.get<string>('homepageUrl')?.trim() || DEFAULT_BROWSER_URL) as string;
  const showBookmarkBar = app.storage.get<boolean>('showBookmarkBar') ?? true;
  const bookmarks = (app.storage.get<Bookmark[]>('bookmarks') ?? []).filter(
    (b) => b.visible !== false && b.url
  );

  const initialUrl = React.useRef(homepage);
  const webviewRef = React.useRef<WebviewElement | null>(null);
  const [address, setAddress] = React.useState(homepage);
  const [canBack, setCanBack] = React.useState(false);
  const [canFwd, setCanFwd] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [zoom, setZoom] = React.useState(100);

  const navigate = React.useCallback((raw: string) => {
    const url = resolveNavigationTarget(raw);
    setAddress(url);
    setLoading(true);
    webviewRef.current?.loadURL(url).catch(() => {});
  }, []);

  const setZoomPct = React.useCallback((pct: number) => {
    const clamped = Math.max(30, Math.min(300, Math.round(pct / 10) * 10));
    try {
      webviewRef.current?.setZoomFactor(clamped / 100);
      setZoom(clamped);
    } catch {
      /* not ready */
    }
  }, []);

  React.useEffect(() => {
    const w = webviewRef.current;
    if (!w || !cfg) return;

    const syncNav = () => {
      try {
        setCanBack(w.canGoBack());
        setCanFwd(w.canGoForward());
        setZoom(Math.round(w.getZoomFactor() * 100));
      } catch {
        /* not ready */
      }
    };
    const onStart = () => setLoading(true);
    const onStop = () => {
      setLoading(false);
      syncNav();
    };
    const onNavigate = () => {
      syncNav();
      try {
        const url = w.getURL();
        if (url && url !== 'about:blank') setAddress(url);
      } catch {
        /* ignore */
      }
    };
    const onIpc = (event: Event) => {
      const e = event as Event & { channel?: string; args?: unknown[] };
      if (e.channel !== 'new-window') return;
      const url = e.args?.[0] as string | undefined;
      if (url && url !== 'about:blank') navigate(url);
    };

    w.addEventListener('did-start-loading', onStart);
    w.addEventListener('did-stop-loading', onStop);
    w.addEventListener('did-navigate', onNavigate);
    w.addEventListener('did-navigate-in-page', onNavigate);
    w.addEventListener('ipc-message', onIpc);
    return () => {
      w.removeEventListener('did-start-loading', onStart);
      w.removeEventListener('did-stop-loading', onStop);
      w.removeEventListener('did-navigate', onNavigate);
      w.removeEventListener('did-navigate-in-page', onNavigate);
      w.removeEventListener('ipc-message', onIpc);
    };
  }, [cfg, navigate]);

  if (!cfg) {
    return (
      <div className="pnsv-br-root">
        <div className="pnsv-br-fallback">The in-app browser isn’t available on this platform.</div>
      </div>
    );
  }

  return (
    <div className="pnsv-br-root">
      <div className="pnsv-br-toolbar">
        <button
          className="pnsv-br-iconbtn"
          title="Back"
          aria-label="Back"
          disabled={!canBack}
          onClick={() => webviewRef.current?.goBack()}
        >
          <IconBack />
        </button>
        <button
          className="pnsv-br-iconbtn"
          title="Forward"
          aria-label="Forward"
          disabled={!canFwd}
          onClick={() => webviewRef.current?.goForward()}
        >
          <IconFwd />
        </button>
        <button
          className="pnsv-br-iconbtn"
          title={loading ? 'Stop' : 'Reload'}
          aria-label={loading ? 'Stop' : 'Reload'}
          onClick={() => (loading ? webviewRef.current?.stop() : webviewRef.current?.reload())}
        >
          {loading ? <IconSpinner /> : <IconReload />}
        </button>
        <form
          style={{ display: 'flex', flex: 1, minWidth: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            navigate(address);
          }}
        >
          <input
            className="pnsv-br-address"
            value={address}
            spellCheck={false}
            onChange={(e) => setAddress(e.target.value)}
            onClick={(e) => e.currentTarget.select()}
            placeholder="Search or enter address"
          />
        </form>
        <MoreMenu app={app} webviewRef={webviewRef} zoom={zoom} setZoomPct={setZoomPct} />
      </div>

      {showBookmarkBar && bookmarks.length > 0 && (
        <div className="pnsv-br-bookmarks">
          {bookmarks.map((b, i) => (
            <button
              key={`${b.url}-${i}`}
              className="pnsv-br-bookmark"
              title={b.url}
              onClick={() => navigate(b.url as string)}
            >
              <IconGlobe />
              <span>{b.title?.trim() || b.url}</span>
            </button>
          ))}
        </div>
      )}

      <div className="pnsv-br-viewport">
        {loading && (
          <div className="pnsv-br-progress">
            <div className="pnsv-br-progress-bar" />
          </div>
        )}
        {React.createElement('webview', {
          ref: (el: WebviewElement | null) => {
            webviewRef.current = el;
          },
          class: 'pnsv-br-webview',
          src: initialUrl.current,
          partition: cfg.partition,
          webpreferences: cfg.webpreferences,
          allowpopups: ''
        })}
      </div>
    </div>
  );
};

/** The MoreHorizontal dropdown (hard reload, copy URL, zoom). */
const MoreMenu: React.FC<{
  app: HostApi;
  webviewRef: React.MutableRefObject<WebviewElement | null>;
  zoom: number;
  setZoomPct: (pct: number) => void;
}> = ({ app, webviewRef, zoom, setZoomPct }) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; right: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setCoords({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={triggerRef}
        className="pnsv-br-iconbtn"
        title="More options"
        aria-label="More options"
        onClick={() => setOpen((v) => !v)}
      >
        <IconMore />
      </button>
      {open &&
        coords &&
        createPortal(
          <div ref={menuRef} className="pnsv-br-menu" style={{ top: coords.top, right: coords.right }}>
            <button
              className="pnsv-br-menuitem"
              onClick={() => {
                webviewRef.current?.reloadIgnoringCache();
                close();
              }}
            >
              <IconReload />
              <span>Hard Reload</span>
            </button>
            <button
              className="pnsv-br-menuitem"
              onClick={() => {
                const url = webviewRef.current?.getURL();
                if (url) app.platform.clipboard.writeText(url).catch(() => {});
                close();
              }}
            >
              <IconCopy />
              <span>Copy Current URL</span>
            </button>
            <div className="pnsv-br-sep" />
            <div className="pnsv-br-menurow">
              <button className="pnsv-br-iconbtn" aria-label="Zoom out" onClick={() => setZoomPct(zoom - 10)}>
                <IconMinus />
              </button>
              <span>Zoom {zoom}%</span>
              <button className="pnsv-br-iconbtn" aria-label="Zoom in" onClick={() => setZoomPct(zoom + 10)}>
                <IconPlus />
              </button>
            </div>
            <button
              className="pnsv-br-menuitem"
              onClick={() => {
                setZoomPct(100);
                close();
              }}
            >
              <IconReload />
              <span>Reset Zoom</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
};

/** Build a {@link HostApi}-bound opener (used by the command / sidebar item). */
export const openBrowser = (app: HostApi) => app.ui.openPane('browser');
