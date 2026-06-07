/**
 * Tiny self-contained confetti burst — a dependency-free stand-in for the app's
 * `canvas-confetti`, so the goal widgets celebrate on completion without the
 * plugin bundling a third-party lib. Same call shape as the native usage
 * (`{ particleCount, angle, spread, origin }`); angle follows canvas-confetti's
 * convention (90 = up, 0 = right).
 */
type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface BurstOptions {
  particleCount?: number;
  angle?: number;
  spread?: number;
  origin?: { x: number; y: number };
}

const COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Confetti origin + launch angle for a widget docked in `corner` (native parity). */
export function confettiConfigForCorner(corner: Corner): { origin: { x: number; y: number }; angle: number } {
  switch (corner) {
    case 'top-left':
      return { origin: { x: 0.1, y: 0.1 }, angle: 315 };
    case 'top-right':
      return { origin: { x: 0.9, y: 0.1 }, angle: 225 };
    case 'bottom-left':
      return { origin: { x: 0.1, y: 0.9 }, angle: 45 };
    case 'bottom-right':
    default:
      return { origin: { x: 0.9, y: 0.9 }, angle: 135 };
  }
}

/** Read the FloatingWidget's persisted corner from `localStorage`. */
export function readWidgetCorner(storageKey: string, fallback: Corner = 'bottom-right'): Corner {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(saved)) {
      return saved as Corner;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function confettiBurst(opts: BurstOptions = {}): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const { particleCount = 50, angle = 90, spread = 55, origin = { x: 0.5, y: 0.5 } } = opts;

  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const ox = origin.x * canvas.width;
  const oy = origin.y * canvas.height;
  const particles = Array.from({ length: particleCount }).map(() => {
    const a = rad(angle + (Math.random() - 0.5) * spread);
    const v = 6 + Math.random() * 7;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(a) * v,
      vy: -Math.sin(a) * v,
      color: COLORS[(Math.random() * COLORS.length) | 0] ?? COLORS[0]!,
      size: 5 + Math.random() * 4,
      life: 0,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 20
    };
  });

  const GRAVITY = 0.25;
  const DRAG = 0.98;
  const MAX_LIFE = 120;
  let frame = 0;

  const tick = () => {
    frame += 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.life += 1;
      if (p.life > MAX_LIFE) continue;
      alive = true;
      p.vx *= DRAG;
      p.vy = p.vy * DRAG + GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.life / MAX_LIFE);
      ctx.translate(p.x, p.y);
      ctx.rotate(rad(p.rot));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (alive && frame < MAX_LIFE + 10) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}
