/**
 * Motifs fournis avec l'application, dessinés dans une boîte de 100 × 100.
 *
 * Chaque motif est une liste d'éléments : soit une surface pleine (`fill`,
 * règle pair-impair pour obtenir des trous), soit un trait d'épaisseur donnée.
 * Le même descripteur alimente les vignettes SVG de l'interface et le rendu
 * dans la grille de travail — un motif se comporte donc exactement comme une
 * image importée.
 */

const r2 = (v) => Math.round(v * 100) / 100;

export function circlePath(cx, cy, r) {
  return `M${r2(cx - r)} ${r2(cy)}A${r2(r)} ${r2(r)} 0 1 0 ${r2(cx + r)} ${r2(cy)}` +
         `A${r2(r)} ${r2(r)} 0 1 0 ${r2(cx - r)} ${r2(cy)}Z`;
}

function ellipsePath(cx, cy, rx, ry, rot = 0) {
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const p = (a) => {
    const x = rx * Math.cos(a), y = ry * Math.sin(a);
    return `${r2(cx + x * cos - y * sin)} ${r2(cy + x * sin + y * cos)}`;
  };
  const deg = r2((rot * 180) / Math.PI);
  return `M${p(0)}A${r2(rx)} ${r2(ry)} ${deg} 0 1 ${p(Math.PI)}` +
         `A${r2(rx)} ${r2(ry)} ${deg} 0 1 ${p(0)}Z`;
}

function starPath(cx, cy, outer, inner, branches) {
  let d = '';
  for (let i = 0; i < branches * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / branches;
    d += `${i === 0 ? 'M' : 'L'}${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`;
  }
  return d + 'Z';
}

function rays(cx, cy, r0, r1, count) {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    d += `M${r2(cx + r0 * Math.cos(a))} ${r2(cy + r0 * Math.sin(a))}` +
         `L${r2(cx + r1 * Math.cos(a))} ${r2(cy + r1 * Math.sin(a))}`;
  }
  return d;
}

export const PRESETS = [
  {
    id: 'bike',
    name: 'Vélo',
    items: [
      { d: circlePath(24, 66, 18), stroke: 5 },
      { d: circlePath(76, 66, 18), stroke: 5 },
      {
        d: 'M24 66L42 34L72 34M42 34L52 66M24 66L52 66M52 66L72 34M72 34L76 66M64 30L80 33',
        stroke: 5,
      },
      { d: circlePath(52, 66, 4) },
    ],
  },
  {
    id: 'arrow',
    name: 'Flèche',
    items: [{ d: 'M50 6L88 48L66 48L66 94L34 94L34 48L12 48Z' }],
  },
  {
    id: 'bolt',
    name: 'Éclair',
    items: [{ d: 'M62 4L22 56L44 56L38 96L80 40L56 40Z' }],
  },
  {
    id: 'star',
    name: 'Étoile',
    items: [{ d: starPath(50, 52, 46, 19, 5) }],
  },
  {
    id: 'heart',
    name: 'Cœur',
    items: [{ d: 'M50 90C8 62 10 22 32 16C43 13 50 21 50 30C50 21 57 13 68 16C90 22 92 62 50 90Z' }],
  },
  {
    id: 'mountain',
    name: 'Montagne',
    items: [{ d: 'M4 84L34 30L52 62L64 44L96 84Z' }],
  },
  {
    id: 'paw',
    name: 'Patte',
    items: [
      { d: circlePath(27, 40, 11) },
      { d: circlePath(43, 27, 11) },
      { d: circlePath(61, 27, 11) },
      { d: circlePath(77, 42, 11) },
      { d: ellipsePath(52, 71, 24, 19) },
    ],
  },
  {
    id: 'warning',
    name: 'Attention',
    items: [
      {
        d: 'M50 6L96 88L4 88Z' +
           'M44 36L56 36L54 64L46 64Z' +
           circlePath(50, 76, 6),
      },
    ],
  },
  {
    id: 'sun',
    name: 'Soleil',
    items: [
      { d: circlePath(50, 50, 22) },
      { d: rays(50, 50, 30, 46, 12), stroke: 7 },
    ],
  },
  {
    id: 'target',
    name: 'Cible',
    items: [
      {
        d: circlePath(50, 50, 47) + circlePath(50, 50, 37) +
           circlePath(50, 50, 28) + circlePath(50, 50, 18) +
           circlePath(50, 50, 9),
      },
    ],
  },
];

/** Dessine un motif dans un contexte 2D, mis à l'échelle sur `size` pixels. */
export function drawPreset(ctx, preset, size) {
  const s = size / 100;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const item of preset.items) {
    const p = new Path2D(item.d);
    if (item.stroke) {
      ctx.lineWidth = item.stroke;
      ctx.stroke(p);
    } else {
      ctx.fill(p, 'evenodd');
    }
  }
  ctx.restore();
}

/** Balisage SVG d'un motif, utilisé pour les vignettes de la palette. */
export function presetMarkup(preset) {
  const parts = preset.items.map((item) => (
    item.stroke
      ? `<path d="${item.d}" fill="none" stroke="currentColor" stroke-width="${item.stroke}" stroke-linejoin="round" stroke-linecap="round"/>`
      : `<path d="${item.d}" fill="currentColor" fill-rule="evenodd"/>`
  ));
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${parts.join('')}</svg>`;
}
