/**
 * Vérifie que le fichier autonome produit par `tools/bundle.mjs` fonctionne
 * réellement, y compris ouvert depuis le disque en `file://` — c'est tout
 * l'intérêt de cette sortie.
 *
 *   node tools/bundle.mjs && node tests/bundle.mjs
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(process.env.NODE_PATH || '/usr/lib/node_modules', 'playwright'));
}

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push(ok);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};

execFileSync(process.execPath, ['tools/bundle.mjs'], { cwd: ROOT, stdio: 'ignore' });

const file = path.join(ROOT, 'dist', 'reflecto.html');
const html = fs.readFileSync(file, 'utf8');
check('le fichier ne référence aucune ressource externe',
  !/(src|href)="(?!data:)[^"]*\.(js|css)"/.test(html));
check('le CSS est intégré', html.includes('--accent: #d8ff3e'));
check('le fragment ne contient pas d’ossature de page',
  !/<html|<body|<!doctype/i.test(fs.readFileSync(path.join(ROOT, 'dist', 'fragment.html'), 'utf8')));

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
// Une requête réseau depuis un fichier local trahirait une ressource oubliée.
const external = [];
page.on('request', (r) => { if (!r.url().startsWith('file:')) external.push(r.url()); });

try {
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.waitForSelector('#stats .chip', { timeout: 10000 });

  check('l’application démarre depuis le disque', errors.length === 0, errors[0] || '');
  check('aucune requête réseau', external.length === 0, external[0] || '');
  check('l’aperçu est calculé', (await page.locator('#stats .chip').count()) >= 3);

  const painted = await page.evaluate(() => {
    const c = document.getElementById('preview');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i] > 200) lit++;
    return lit;
  });
  check('le disque est bien dessiné', painted > 50, `${painted} pixels clairs échantillonnés`);

  await page.click('.preset[data-preset="star"]');
  await page.fill('#f-text', 'NUIT');
  await page.waitForTimeout(700);
  check('les réglages restent réactifs',
    (await page.locator('.preset[data-preset="star"].is-active').count()) === 1 && errors.length === 0,
    errors[0] || '');

  const download = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.click('#btn-svg-cut');
  const got = await download;
  check('l’export fonctionne hors serveur', Boolean(got), got ? got.suggestedFilename() : 'aucun téléchargement');
} finally {
  await browser.close();
}

const failed = checks.filter((ok) => !ok).length;
console.log(`\n${checks.length - failed}/${checks.length} vérifications passées.`);
if (failed) process.exit(1);
