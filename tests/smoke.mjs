/**
 * Test de bout en bout : la chaîne de traitement tourne réellement dans un
 * navigateur, produit des tracés, et le SVG exporté est valide et à l'échelle.
 *
 *   node tests/smoke.mjs
 *
 * Playwright est résolu depuis les modules globaux si le projet ne l'installe
 * pas localement (aucune dépendance n'est requise pour utiliser l'application).
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8177;
const BASE = `http://127.0.0.1:${PORT}`;

let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(process.env.NODE_PATH || '/usr/lib/node_modules', 'playwright'));
}

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  const proc = spawn(process.execPath, ['serve.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return proc;
    } catch { /* pas encore prêt */ }
    await wait(100);
  }
  proc.kill();
  throw new Error('Le serveur ne répond pas.');
}

/** Exécute la chaîne complète dans la page, hors interface. */
async function runPipeline(page, overrides, presetId = 'bike') {
  return page.evaluate(async ({ overrides, presetId }) => {
    const [{ buildModel }, { DEFAULTS }, { sourceFromPreset }, { PRESETS }, { buildSvg }] =
      await Promise.all([
        import('/src/pipeline.js'),
        import('/src/state.js'),
        import('/src/sources.js'),
        import('/src/presets.js'),
        import('/src/exportSvg.js'),
      ]);
    const preset = PRESETS.find((p) => p.id === presetId);
    const source = preset ? sourceFromPreset(preset) : null;
    const model = buildModel({ ...DEFAULTS, ...overrides }, source);

    // Validation syntaxique : un `d` invalide donne une longueur nulle.
    const measure = (d) => {
      if (!d) return 0;
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', d);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.append(el);
      document.body.append(svg);
      const len = el.getTotalLength();
      svg.remove();
      return len;
    };

    return {
      stats: model.stats,
      designLength: measure(model.design),
      outlineLength: measure(model.outline),
      ringLength: measure(model.ring),
      svg: buildSvg(model, { mode: 'cut', cutOutline: true }),
      previewSvg: buildSvg(model, { mode: 'preview' }),
    };
  }, { overrides, presetId });
}

async function main() {
  const server = await startServer();
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('#stats .chip', { timeout: 10000 });

    check('la page se charge sans erreur', errors.length === 0, errors[0] || '');
    check('l’aperçu affiche des statistiques', (await page.locator('#stats .chip').count()) >= 3);

    // --- vectorisation d'un motif
    const bike = await runPipeline(page, { text: 'RÉFLECTO' });
    check('le motif produit des tracés', bike.stats.designPaths > 0, `${bike.stats.designPaths} tracés`);
    check('les tracés du motif sont des chemins valides', bike.designLength > 100,
      `${Math.round(bike.designLength)} mm`);
    check('le contour extérieur fait bien π×D', Math.abs(bike.outlineLength - Math.PI * 80) < 1,
      `${bike.outlineLength.toFixed(1)} mm`);
    check('l’anneau est présent', bike.ringLength > 0);
    check('le SVG est à l’échelle réelle', bike.svg.includes('width="80mm"') && bike.svg.includes('viewBox="0 0 80 80"'));
    check('le SVG de découpe n’a pas de remplissage', bike.svg.includes('fill="none"'));
    check('le SVG d’aperçu est rempli', bike.previewSvg.includes('fill="#000000"'));

    const parsed = await page.evaluate((svg) => {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      return {
        error: Boolean(doc.querySelector('parsererror')),
        paths: doc.querySelectorAll('path').length,
      };
    }, bike.svg);
    check('le SVG exporté est un XML valide', !parsed.error, `${parsed.paths} chemins`);

    // --- variantes
    const negative = await runPipeline(page, { negative: true });
    check('le mode négatif remplit le disque',
      negative.stats.areaMm2 > bike.stats.areaMm2,
      `${Math.round(negative.stats.areaMm2)} contre ${Math.round(bike.stats.areaMm2)} mm²`);

    for (const shape of ['rounded', 'hexagon', 'octagon']) {
      const res = await runPipeline(page, { shape });
      check(`forme « ${shape} » vectorisée`, res.outlineLength > 0 && res.designLength > 0);
    }

    const textOnly = await runPipeline(page, { text: 'VÉLO', textPlace: 'arcTop' }, null);
    check('le texte seul est vectorisé', textOnly.stats.designPaths >= 4,
      `${textOnly.stats.designPaths} tracés`);

    // Un texte trop long pour la circonférence doit être réduit, pas enroulé
    // sur lui-même : dans ce cas les lettres fusionneraient en une bouillie et
    // le nombre de tracés s'effondrerait.
    const longText = await runPipeline(page, { text: 'ASSOCIATION CYCLOTOURISTE DE LA VALLEE 2026' }, null);
    check('un texte trop long est réduit pour tenir sur l’arc',
      longText.stats.designPaths >= 30, `${longText.stats.designPaths} tracés`);

    const empty = await runPipeline(page, { text: '' }, null);
    check('sans visuel ni texte, rien n’est découpé', empty.stats.designPaths === 0);

    const despeckled = await runPipeline(page, { minArea: 400 });
    check('le seuil de miettes supprime les petits éléments',
      despeckled.stats.dropped > 0, `${despeckled.stats.dropped} supprimés`);

    // --- import de fichiers
    const hostile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <script>window.__pwned = true;<\/script>
      <image href="https://example.invalid/pixel.png" width="100" height="100"/>
      <rect x="20" y="20" width="60" height="60" fill="#111"/>
    </svg>`;
    const cleaned = await page.evaluate(async (markup) => {
      const { sanitizeSvg } = await import('/src/sources.js');
      return sanitizeSvg(markup).markup;
    }, hostile);
    check('le nettoyage retire les scripts', !/<script/i.test(cleaned));
    check('le nettoyage retire les références réseau', !cleaned.includes('example.invalid'));

    await page.setInputFiles('#file', {
      name: 'motif.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(hostile),
    });
    await page.waitForTimeout(900);
    check('un SVG importé devient la source',
      (await page.textContent('#source-name')) === 'motif.svg');
    check('le SVG importé ne déclenche aucun script',
      (await page.evaluate(() => window.__pwned)) === undefined);
    check('le SVG importé produit une découpe',
      (await page.locator('#stats .chip').count()) >= 3 && errors.length === 0, errors[0] || '');

    const png = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(100, 100, 70, 0, 7); ctx.fill();
      return c.toDataURL('image/png').split(',')[1];
    });
    await page.setInputFiles('#file', {
      name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
    });
    await page.waitForTimeout(900);
    check('une image matricielle est acceptée',
      (await page.textContent('#source-name')) === 'photo.png' && errors.length === 0, errors[0] || '');

    // --- interface
    await page.click('.preset[data-preset="bolt"]');
    await page.waitForTimeout(500);
    check('choisir un motif l’active', await page.locator('.preset[data-preset="bolt"].is-active').count() === 1);

    await page.click('[data-mode="day"]');
    await page.waitForTimeout(200);
    check('le mode atelier s’active', await page.locator('[data-mode="day"].is-active').count() === 1);

    await page.fill('#f-text', 'CLUB CYCLO');
    await page.waitForTimeout(600);
    check('le texte se répercute sur l’aperçu', errors.length === 0, errors[0] || '');

    // La molette au-dessus de l'aperçu doit faire défiler la page, pas zoomer.
    await page.evaluate(() => window.scrollTo(0, 0));
    const zoomAvant = await page.inputValue('#f-zoom');
    const box = await page.locator('#preview').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(400);
    check('la molette ne modifie pas le zoom',
      (await page.inputValue('#f-zoom')) === zoomAvant, `zoom ${zoomAvant} %`);
    check('la molette fait défiler la page',
      (await page.evaluate(() => window.scrollY)) > 0);
    check('l’aperçu ne capture pas le défilement tactile',
      (await page.evaluate(() => getComputedStyle(document.getElementById('preview')).touchAction)) !== 'none');

    // …mais le déplacement direct à la souris doit rester intact.
    await page.evaluate(() => window.scrollTo(0, 0));
    const decalageAvant = await page.inputValue('#f-offsetX');
    const zone = await page.locator('#preview').boundingBox();
    await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2);
    await page.mouse.down();
    await page.mouse.move(zone.x + zone.width / 2 + 60, zone.y + zone.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    check('le glisser à la souris déplace toujours le visuel',
      (await page.inputValue('#f-offsetX')) !== decalageAvant,
      `${decalageAvant} % → ${await page.inputValue('#f-offsetX')} %`);

    const download = page.waitForEvent('download', { timeout: 8000 });
    await page.click('#btn-svg-cut');
    const file = await download;
    check('le bouton d’export télécharge un SVG', file.suggestedFilename().endsWith('.svg'),
      file.suggestedFilename());

    // --- réglages mis en avant
    check('le zoom est sous l’aperçu et non dans le panneau',
      (await page.locator('#framing #f-zoom').count()) === 1
      && (await page.locator('#panel #f-zoom').count()) === 0);
    check('le déplacement est sous l’aperçu',
      (await page.locator('#framing #f-offsetX').count()) === 1
      && (await page.locator('#framing #f-offsetY').count()) === 1);
    check('la préparation à la découpe est dans son propre bloc',
      (await page.locator('#cut-panel #f-grow').count()) === 1
      && (await page.locator('#panel #f-grow').count()) === 0);

    const zoomInit = Number(await page.inputValue('#f-zoom'));
    await page.locator('[data-key="zoom"] .stepper__btn').last().click();
    await page.waitForTimeout(300);
    check('les boutons pas à pas règlent le zoom',
      Number(await page.inputValue('#f-zoom')) === zoomInit + 5,
      `${zoomInit} % → ${await page.inputValue('#f-zoom')} %`);

    await page.click('#btn-recenter');
    await page.waitForTimeout(400);
    check('« Recentrer » remet le cadrage à zéro',
      (await page.inputValue('#f-zoom')) === '100'
      && (await page.inputValue('#f-offsetX')) === '0'
      && (await page.inputValue('#f-rotation')) === '0');

    // --- bibliothèque de versions
    page.on('dialog', (d) => d.accept('Version renommée'));

    await page.click('.preset[data-preset="star"]');
    await page.fill('#f-text', 'VERSION A');
    await page.waitForTimeout(700);
    await page.click('#btn-save');
    await page.waitForTimeout(900);
    check('une version est enregistrée', (await page.locator('.version').count()) === 1);
    check('la version porte un nom lisible',
      (await page.locator('.version__name').first().textContent()) === 'VERSION A');
    check('la vignette est produite',
      (await page.locator('.version__thumb').first().getAttribute('src'))?.startsWith('blob:'));
    check('la version ouverte est signalée', (await page.locator('.badge--current').count()) === 1);

    await page.fill('#f-text', 'VERSION A RETOUCHEE');
    await page.waitForTimeout(700);
    check('une retouche est signalée comme telle', (await page.locator('.badge--dirty').count()) === 1);

    await page.click('.preset[data-preset="heart"]');
    await page.fill('#f-text', 'VERSION B');
    await page.waitForTimeout(700);
    await page.click('#btn-save');
    await page.waitForTimeout(900);
    check('une seconde version coexiste', (await page.locator('.version').count()) === 2);

    const carteA = page.locator('.version').filter({ hasText: 'VERSION A' }).first();
    await carteA.getByRole('button', { name: 'Ouvrir' }).click();
    await page.waitForTimeout(1200);
    check('ouvrir une version restaure son texte',
      (await page.inputValue('#f-text')) === 'VERSION A',
      await page.inputValue('#f-text'));
    check('ouvrir une version restaure son motif',
      (await page.locator('.preset[data-preset="star"].is-active').count()) === 1);
    check('ouvrir une version restaure ses réglages',
      (await page.locator('.badge--current').count()) === 1);

    await page.locator('.version.is-current').getByRole('button', { name: 'Renommer' }).click();
    await page.waitForTimeout(600);
    check('renommer une version fonctionne',
      (await page.locator('.version.is-current .version__name').textContent()) === 'Version renommée');

    await page.locator('.version').first().getByRole('button', { name: 'Supprimer' }).click();
    await page.waitForTimeout(600);
    check('supprimer une version fonctionne', (await page.locator('.version').count()) === 1);

    // Une version enregistrée doit survivre au rechargement de la page.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#stats .chip', { timeout: 10000 });
    await page.waitForTimeout(700);
    check('les versions survivent au rechargement', (await page.locator('.version').count()) === 1);

    await page.click('[data-mode="night"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ROOT, 'tests', 'apercu.png'), fullPage: false });
  } finally {
    await browser.close();
    server.kill();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} vérifications passées.`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
