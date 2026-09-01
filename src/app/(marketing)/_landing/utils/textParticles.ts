export interface TextSampleOptions {
  text: string;
  /** viewport-space rect the text visually occupies (e.g. from getBoundingClientRect) */
  rect: { left: number; top: number; width: number; height: number };
  fontFamily: string;
  fontWeight?: string | number;
  /** letter spacing in px, matches CSS letter-spacing applied to the live text */
  letterSpacing?: number;
  /** approximate number of points to sample out of the glyph silhouette */
  targetCount: number;
}

/**
 * Renders text to an offscreen canvas sized to match the live DOM text's
 * bounding box, then samples points inside the glyph silhouette. Returns
 * points in viewport space so a particle system can originate bursts from
 * the actual rendered letterforms.
 */
export function sampleTextPoints(opts: TextSampleOptions): { x: number; y: number }[] {
  const { text, rect, fontFamily, fontWeight = 700, letterSpacing = 0, targetCount } = opts;

  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // Binary-search-ish shrink font size until the text roughly fills rect.width,
  // since we don't know the exact live font-size, only the box it renders into.
  let fontSize = h * 0.82;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  const measure = (size: number) => {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    return ctx.measureText(text).width + letterSpacing * Math.max(0, text.length - 1);
  };

  for (let i = 0; i < 12; i++) {
    const width = measure(fontSize);
    const ratio = w / Math.max(width, 1);
    if (Math.abs(width - w) < w * 0.01) break;
    fontSize *= ratio;
    fontSize = Math.min(fontSize, h * 1.4);
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = "#fff";

  if (letterSpacing > 0) {
    // manual letter-spacing draw since canvas fillText ignores CSS letter-spacing
    const widths = text.split("").map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + letterSpacing * (text.length - 1);
    let x = w / 2 - total / 2;
    ctx.textAlign = "left";
    text.split("").forEach((ch, i) => {
      ctx.fillText(ch, x, h / 2);
      x += widths[i] + letterSpacing;
    });
  } else {
    ctx.fillText(text, w / 2, h / 2);
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const cw = canvas.width;
  const ch = canvas.height;

  const candidates: { x: number; y: number }[] = [];
  const stride = 3; // sample every N device pixels
  for (let y = 0; y < ch; y += stride) {
    for (let x = 0; x < cw; x += stride) {
      const alpha = data[(y * cw + x) * 4 + 3];
      if (alpha > 80) {
        candidates.push({ x: x / dpr, y: y / dpr });
      }
    }
  }

  // shuffle + trim to targetCount
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const picked = candidates.slice(0, targetCount);

  return picked.map((p) => ({ x: rect.left + p.x, y: rect.top + p.y }));
}
