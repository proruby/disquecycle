#!/usr/bin/env node
/**
 * Serveur statique minimal, sans dépendance.
 *
 * L'application est faite de modules ES : elle doit être servie en HTTP, le
 * protocole file:// bloquant les imports. `node serve.js` suffit.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(url.parse(req.url).pathname);
  const target = path.normalize(path.join(ROOT, pathname === '/' ? 'index.html' : pathname));

  // Un chemin normalisé qui sort de la racine est une tentative de traversée.
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Introuvable');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    }).end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Réflecto : http://localhost:${PORT}`);
});
