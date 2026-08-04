/**
 * Assemble l'application en un seul fichier HTML autonome.
 *
 *   node tools/bundle.mjs
 *
 * Produit deux sorties dans `dist/` :
 *   - `reflecto.html` : document complet, ouvrable directement depuis le disque,
 *     sans serveur ni dépendance ;
 *   - `fragment.html` : le même contenu sans l'ossature `html`/`head`/`body`,
 *     pour les hébergements qui fournissent eux-mêmes le squelette de page.
 *
 * Les modules ES ne peuvent pas simplement être concaténés : ils partageraient
 * une portée unique et plusieurs noms internes se marchent dessus (`r3`,
 * `circlePath`…). Chaque module est donc enfermé dans sa propre fonction, et
 * les imports deviennent des déstructurations de l'objet qu'elle renvoie.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const IMPORT_RE = /^import\s*\{([\s\S]*?)\}\s*from\s*['"]\.\/([\w.-]+)['"];?[ \t]*$/gm;
const EXPORT_RE = /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

/** Ordre de dépendance, vérifié plus bas contre les imports réels. */
const ORDER = [
  'geometry.js', 'raster.js', 'trace.js', 'shapes.js', 'presets-tabler.js', 'presets.js',
  'pipeline.js', 'sources.js', 'render.js', 'exportSvg.js', 'state.js',
  'library.js', 'controls.js', 'ui.js', 'main.js',
];

function readModule(name) {
  const source = fs.readFileSync(path.join(SRC, name), 'utf8');
  const imports = [];
  for (const m of source.matchAll(IMPORT_RE)) {
    imports.push({
      names: m[1].split(',').map((s) => s.trim()).filter(Boolean),
      from: m[2],
    });
  }
  const exports = [...source.matchAll(EXPORT_RE)].map((m) => m[1]);
  const body = source.replace(IMPORT_RE, '').replace(/^export\s+/gm, '');
  return { name, imports, exports, body };
}

function bundle() {
  const modules = ORDER.map(readModule);
  const seen = new Set();
  const chunks = ['const __mod = Object.create(null);'];

  for (const mod of modules) {
    for (const dep of mod.imports) {
      if (!seen.has(dep.from)) {
        throw new Error(`${mod.name} importe ${dep.from} avant sa définition.`);
      }
      const provided = modules.find((m) => m.name === dep.from).exports;
      const missing = dep.names.filter((n) => !provided.includes(n));
      if (missing.length) {
        throw new Error(`${dep.from} n'exporte pas : ${missing.join(', ')}`);
      }
    }

    const head = mod.imports
      .map((d) => `const { ${d.names.join(', ')} } = __mod[${JSON.stringify(d.from)}];`)
      .join('\n');
    const tail = `return { ${mod.exports.join(', ')} };`;

    chunks.push(
      `__mod[${JSON.stringify(mod.name)}] = (function () {\n` +
      `${head}\n${mod.body}\n${tail}\n})();`,
    );
    seen.add(mod.name);
  }

  return chunks.join('\n\n');
}

function build() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets', 'styles.css'), 'utf8');
  const script = bundle();

  // `</script>` dans une chaîne fermerait la balise qui contient le code.
  const safeScript = script.replace(/<\/script>/gi, '<\\/script>');

  const standalone = html
    .replace('<link rel="stylesheet" href="assets/styles.css">', `<style>\n${css}\n</style>`)
    .replace(
      '<script type="module" src="src/main.js"></script>',
      `<script type="module">\n${safeScript}\n</script>`,
    );

  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, 'Réflecto'])[1];
  const bodyInner = (standalone.match(/<body>([\s\S]*)<\/body>/) || [, ''])[1];
  const fragment = `<title>${title}</title>\n<style>\n${css}\n</style>\n${bodyInner}`;

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'reflecto.html'), standalone);
  fs.writeFileSync(path.join(DIST, 'fragment.html'), fragment);

  const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} ko`;
  console.log(`dist/reflecto.html  ${kb(standalone)}`);
  console.log(`dist/fragment.html  ${kb(fragment)}`);
}

build();
