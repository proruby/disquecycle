/**
 * Rendu à l'écran. Deux lectures du même modèle :
 *  - « atelier » : noir sur blanc, ce que verra la découpeuse ;
 *  - « nuit »    : simulation de la matière rétro-réfléchissante prise dans un
 *                  phare, qui est la seule façon honnête de juger un visuel
 *                  destiné à être vu de nuit.
 */

/** Marge autour du disque, en fraction du côté du canvas. */
export const PAD = 0.06;

function fit(model, w, h) {
  const side = Math.min(w, h) * (1 - 2 * PAD);
  const scale = side / model.size;
  return { scale, ox: (w - model.size * scale) / 2, oy: (h - model.size * scale) / 2 };
}

export function drawModel(ctx, model, w, h, opts = {}) {
  const mode = opts.mode === 'day' ? 'day' : 'night';
  const { scale, ox, oy } = fit(model, w, h);

  ctx.clearRect(0, 0, w, h);

  if (mode === 'day') {
    ctx.fillStyle = '#f4f5f7';
    ctx.fillRect(0, 0, w, h);
  } else {
    const bg = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
    bg.addColorStop(0, '#1c2128');
    bg.addColorStop(1, '#0a0c10');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';

  const outline = model.outline ? new Path2D(model.outline) : null;
  const material = new Path2D();
  if (model.ring) material.addPath(new Path2D(model.ring));
  if (model.design) material.addPath(new Path2D(model.design));

  if (mode === 'day') {
    if (outline) {
      ctx.fillStyle = '#ffffff';
      ctx.fill(outline);
      ctx.lineWidth = 0.25;
      ctx.strokeStyle = '#c9ced6';
      ctx.stroke(outline);
    }
    ctx.fillStyle = '#0b0d10';
    ctx.fill(material, 'evenodd');
  } else {
    if (outline) {
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fill(outline);
      ctx.save();
      ctx.setLineDash([1.2, 1.2]);
      ctx.lineWidth = 0.2;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.stroke(outline);
      ctx.restore();
    }

    // La rétro-réflexion renvoie la lumière vers sa source : la matière paraît
    // presque uniformément lumineuse, avec un léger gradient et un halo.
    const g = ctx.createLinearGradient(0, 0, model.size, model.size);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#eaf3ff');
    g.addColorStop(1, '#c3d6ef');
    ctx.save();
    ctx.shadowColor = 'rgba(200, 228, 255, 0.85)';
    ctx.shadowBlur = model.size * 0.09 * scale;
    ctx.fillStyle = g;
    ctx.fill(material, 'evenodd');
    ctx.restore();
    ctx.fillStyle = g;
    ctx.fill(material, 'evenodd');
  }

  if (opts.showCuts) {
    ctx.lineWidth = Math.max(0.12, 0.5 / scale);
    ctx.strokeStyle = mode === 'day' ? '#e0245e' : '#ff5c8a';
    if (outline && opts.cutOutline) ctx.stroke(outline);
    if (model.ring) ctx.stroke(new Path2D(model.ring));
    if (model.design) ctx.stroke(new Path2D(model.design));
  }

  ctx.restore();
}

/** Ajuste la résolution interne du canvas à l'écran puis dessine. */
export function renderPreview(canvas, model, opts) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawModel(ctx, model, w, h, opts);
}

/** Rendu hors écran pour l'export PNG. */
export function renderToCanvas(model, sizePx, opts) {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  drawModel(canvas.getContext('2d'), model, sizePx, sizePx, opts);
  return canvas;
}
