/**
 * Tiny self-contained confetti burst — a dependency-free stand-in for the app's
 * `canvas-confetti`, so the goal widgets celebrate on completion without the
 * plugin bundling a third-party lib. Same call shape as the native usage
 * (`{ particleCount, angle, spread, origin }`); angle follows canvas-confetti's
 * convention (90 = up, 0 = right).
 *
 * The physics below are a faithful port of canvas-confetti's own particle model
 * (startVelocity 45, decay 0.9, gravity ×3, ticks 200, ~10px wobbling quads) so
 * the burst matches the original native widgets piece-for-piece — earlier the
 * hand-rolled version used much weaker velocity/size and the confetti looked
 * noticeably smaller than the long-standing built-in one.
 */
type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface BurstOptions {
  particleCount?: number;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  scalar?: number;
  ticks?: number;
  origin?: { x: number; y: number };
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

const COLORS = ['#26ccff', '#a25afd', '#fcff42', '#ff36ff', '#ff5e7e', '#88ff5a', '#ffa62d'];
const rad = (deg: number) => (deg * Math.PI) / 180;

const hexToRgb = (hex: string): RGB => {
  const v = hex.replace('#', '');
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16)
  };
};

const RGB_COLORS = COLORS.map(hexToRgb);

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

interface Fetti {
  x: number;
  y: number;
  wobble: number;
  wobbleSpeed: number;
  wobbleX: number;
  wobbleY: number;
  velocity: number;
  angle2D: number;
  tiltAngle: number;
  tiltSin: number;
  tiltCos: number;
  color: RGB;
  tick: number;
  totalTicks: number;
  decay: number;
  gravity: number;
  scalar: number;
  random: number;
}

export function confettiBurst(opts: BurstOptions = {}): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const {
    particleCount = 50,
    angle = 90,
    spread = 55,
    startVelocity = 45,
    decay = 0.9,
    gravity = 1,
    scalar = 1,
    ticks = 200,
    origin = { x: 0.5, y: 0.5 }
  } = opts;

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
  const radAngle = rad(angle);
  const radSpread = rad(spread);

  const particles: Fetti[] = Array.from({ length: particleCount }).map(() => ({
    x: ox,
    y: oy,
    wobble: Math.random() * 10,
    wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
    wobbleX: 0,
    wobbleY: 0,
    velocity: startVelocity * 0.5 + Math.random() * startVelocity,
    angle2D: -radAngle + (0.5 * radSpread - Math.random() * radSpread),
    tiltAngle: (Math.random() * (0.75 - 0.25) + 0.25) * Math.PI,
    tiltSin: 0,
    tiltCos: 0,
    color: RGB_COLORS[(Math.random() * RGB_COLORS.length) | 0] ?? RGB_COLORS[0]!,
    tick: 0,
    totalTicks: ticks,
    decay,
    gravity: gravity * 3,
    scalar,
    random: Math.random() + 2
  }));

  const updateFetti = (p: Fetti): boolean => {
    p.x += Math.cos(p.angle2D) * p.velocity;
    p.y += Math.sin(p.angle2D) * p.velocity + p.gravity;
    p.velocity *= p.decay;

    p.wobble += p.wobbleSpeed;
    p.wobbleX = p.x + 10 * p.scalar * Math.cos(p.wobble);
    p.wobbleY = p.y + 10 * p.scalar * Math.sin(p.wobble);
    p.tiltAngle += 0.1;
    p.tiltSin = Math.sin(p.tiltAngle);
    p.tiltCos = Math.cos(p.tiltAngle);
    p.random = Math.random() + 2;

    const progress = p.tick++ / p.totalTicks;

    const x1 = p.x + p.random * p.tiltCos;
    const y1 = p.y + p.random * p.tiltSin;
    const x2 = p.wobbleX + p.random * p.tiltCos;
    const y2 = p.wobbleY + p.random * p.tiltSin;

    ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${1 - progress})`;
    ctx.beginPath();
    ctx.moveTo(Math.floor(p.x), Math.floor(p.y));
    ctx.lineTo(Math.floor(p.wobbleX), Math.floor(y1));
    ctx.lineTo(Math.floor(x2), Math.floor(y2));
    ctx.lineTo(Math.floor(x1), Math.floor(p.wobbleY));
    ctx.closePath();
    ctx.fill();

    return p.tick < p.totalTicks;
  };

  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      if (p.tick < p.totalTicks) {
        if (updateFetti(p)) alive = true;
      }
    }
    if (alive) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}
