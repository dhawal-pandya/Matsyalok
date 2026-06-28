import { TAU } from "../sim/math";
import { FishStyle } from "../sim/world";

/** Top-down fish rendering (D11, §7.10), sprite-cached for scale: each
 *  (size, hue, style, satiety) bucket is pre-rendered once into a filmstrip of
 *  undulation frames (+ one rigid pose for bursts), so drawing a fish is one
 *  rotated drawImage. Seen from above — a slim body, two eyes, a rattling spine,
 *  and a thin line tail. Body colour identifies the species (muted prey, bright
 *  striped hunters, calm whale); the tail fin and eyes warm toward red as the
 *  fish fills toward its split, so hunger reads at a glance. Points +x. */

const FRAMES = 12; // undulation keyframes per bucket (index FRAMES = rigid pose)
const WAVES = 0.5; // < 1 wave: a single tail sweep, not a snake
const SIZE_QUANT = 1.5;
const HUE_QUANT = 12;
const SAT_LEVELS = 6; // quantised satiation buckets (keeps the cache bounded)
const SAMPLES = 16; // points along the centreline
const SUPERSAMPLE = Math.min(2, Math.max(1, Math.round(devicePixelRatio || 1)));

// Per-style body shading: [saturation%, lightness offset]. Muted prey desaturate
// toward grey; vivid hunters are loud; the whale sits calm.
const STYLE_SAT: Record<number, number> = {
  [FishStyle.MUTED]: 26,
  [FishStyle.VIVID]: 82,
  [FishStyle.CALM]: 50,
};

interface Strip {
  frames: HTMLCanvasElement[];
  w: number;
  h: number;
}

const cache = new Map<number, Strip>();

function key(size: number, hue: number, style: number, satQ: number): number {
  const s = Math.round(size / SIZE_QUANT);
  const h = Math.round((((hue % 360) + 360) % 360) / HUE_QUANT);
  return ((s * 1000 + h) * 8 + style) * SAT_LEVELS + satQ;
}

/** Body half-width along the length (t: 0 head → 1 tail): rounded head, widest a
 *  third back, tapering to a slim peduncle. */
function halfWidth(t: number, wMax: number): number {
  return Math.max(0.06, Math.sin(Math.PI * (0.12 + 0.8 * t))) * (1 - 0.55 * t) * wMax;
}

function buildStrip(size: number, hue: number, style: number, satiety: number): Strip {
  const len = size * 3.4;
  const wMax = size * 0.62;
  const amp = size * 0.34; // peak lateral undulation (at the tail)
  const finLen = size * 1.2;

  const padX = len * 0.5 + finLen + 4;
  const padY = amp + wMax + finLen * 0.5 + 4;
  const w = padX * 2;
  const h = padY * 2;

  // Body: hue identifies the species, saturation its archetype; bigger fish read
  // deeper/darker (a size-graded shade).
  const sat = STYLE_SAT[style] ?? 50;
  const L = Math.max(33, 58 - size * 0.55);
  const base = `hsl(${hue}, ${sat}%, ${L}%)`;
  const spine = `hsl(${hue}, ${Math.max(0, sat - 4)}%, ${L - 18}%)`;
  const edge = `hsl(${hue}, ${Math.max(0, sat - 10)}%, ${L - 24}%)`;
  const stripeC = `hsl(${hue}, ${Math.min(100, sat + 10)}%, ${Math.max(13, L - 30)}%)`;

  // Satiation cue (kept subtle): the tail fin and eyes drift from the body hue
  // toward a warm red as the fish fills toward its split.
  const tailHue = hue + (16 - hue) * satiety;
  const tailSat = sat + (62 - sat) * satiety;
  const tailC = `hsl(${tailHue}, ${tailSat}%, ${L - 14 + satiety * 6}%)`;
  const eyeHue = hue + (8 - hue) * satiety;
  const eyeC = `hsl(${eyeHue}, ${45 + satiety * 48}%, ${13 + satiety * 33}%)`;
  const xHead = len * 0.5;

  const cx = new Float32Array(SAMPLES);
  const cy = new Float32Array(SAMPLES);
  const hw = new Float32Array(SAMPLES);

  const renderFrame = (beat: number, ampScale: number): HTMLCanvasElement => {
    for (let n = 0; n < SAMPLES; n++) {
      const t = n / (SAMPLES - 1);
      cx[n] = xHead - t * len;
      cy[n] = ampScale * amp * Math.pow(t, 2.4) * Math.sin(TAU * WAVES * t - beat);
      hw[n] = halfWidth(t, wMax);
    }

    const cv = document.createElement("canvas");
    cv.width = Math.ceil(w * SUPERSAMPLE);
    cv.height = Math.ceil(h * SUPERSAMPLE);
    const ctx = cv.getContext("2d")!;
    ctx.scale(SUPERSAMPLE, SUPERSAMPLE);
    ctx.translate(padX, padY);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const tailX = cx[SAMPLES - 1];
    const tailY = cy[SAMPLES - 1];

    // Body outline (slim, no fin — head→tail along each flank).
    ctx.beginPath();
    ctx.moveTo(cx[0], cy[0] - hw[0]);
    for (let n = 1; n < SAMPLES; n++) ctx.lineTo(cx[n], cy[n] - hw[n]);
    for (let n = SAMPLES - 1; n >= 0; n--) ctx.lineTo(cx[n], cy[n] + hw[n]);
    ctx.closePath();
    ctx.fillStyle = base;
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, size * 0.12);
    ctx.strokeStyle = edge;
    ctx.stroke();

    // Vivid hunters wear vertical tiger bands, clipped to the body.
    if (style === FishStyle.VIVID) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx[0], cy[0] - hw[0]);
      for (let n = 1; n < SAMPLES; n++) ctx.lineTo(cx[n], cy[n] - hw[n]);
      for (let n = SAMPLES - 1; n >= 0; n--) ctx.lineTo(cx[n], cy[n] + hw[n]);
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = stripeC;
      ctx.lineWidth = Math.max(1, size * 0.2);
      const bands = 4;
      for (let b = 1; b <= bands; b++) {
        const xb = xHead - (b / (bands + 1)) * len;
        ctx.beginPath();
        ctx.moveTo(xb, -wMax - amp);
        ctx.lineTo(xb, wMax + amp);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Tail fin: a thin line continuing the body's curve (top-down, edge-on).
    // Warms with satiation.
    const tdx = cx[SAMPLES - 1] - cx[SAMPLES - 2];
    const tdy = cy[SAMPLES - 1] - cy[SAMPLES - 2];
    const tl = finLen / (Math.hypot(tdx, tdy) || 1);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tailX + tdx * tl, tailY + tdy * tl);
    ctx.lineWidth = Math.max(0.8, size * 0.32);
    ctx.strokeStyle = tailC;
    ctx.stroke();

    // Rattling spine line down the centre.
    ctx.beginPath();
    ctx.moveTo(cx[0], cy[0]);
    for (let n = 1; n < SAMPLES; n++) ctx.lineTo(cx[n], cy[n]);
    ctx.lineWidth = Math.max(0.8, size * 0.2);
    ctx.strokeStyle = spine;
    ctx.stroke();

    // Two eyes, one on each side of the head.
    const e = 2;
    const er = Math.max(1, size * 0.16);
    ctx.fillStyle = eyeC;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx[e], cy[e] + s * hw[e] * 0.62, er, 0, TAU);
      ctx.fill();
    }
    return cv;
  };

  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < FRAMES; f++) frames.push(renderFrame((f / FRAMES) * TAU, 1));
  frames.push(renderFrame(0, 0)); // index FRAMES: rigid pose held during a burst
  return { frames, w, h };
}

function strip(size: number, hue: number, style: number, satQ: number): Strip {
  const k = key(size, hue, style, satQ);
  let s = cache.get(k);
  if (!s) {
    s = buildStrip(size, hue, style, satQ / (SAT_LEVELS - 1));
    cache.set(k, s);
  }
  return s;
}

/** Draw a fish at (sx,sy) rotated to `heading`. `animFrac`∈[0,1) sets the
 *  undulation phase; `straight` holds the rigid burst pose instead. `satiety`∈[0,1]
 *  warms the tail/eyes toward red as the fish nears its split. */
export function drawFish(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  heading: number,
  size: number,
  hue: number,
  animFrac: number,
  straight = false,
  style = 0,
  satiety = 0,
): void {
  const satQ = Math.min(SAT_LEVELS - 1, Math.max(0, (satiety * SAT_LEVELS) | 0));
  const s = strip(size, hue, style, satQ);
  const fi = straight ? FRAMES : Math.min(FRAMES - 1, Math.max(0, (animFrac * FRAMES) | 0));
  const frame = s.frames[fi]!;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(heading);
  ctx.drawImage(frame, -s.w * 0.5, -s.h * 0.5, s.w, s.h);
  ctx.restore();
}
