// Servidor estático mínimo para las pruebas del emulador.
//
// Hace falta porque EJS usa fetch() y workers: con file:// Chromium los bloquea
// (por eso la app usa el origen app:// en vez de file://).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.gba': 'application/octet-stream',
  '.sav': 'application/octet-stream',
  '.data': 'application/octet-stream',
  '.md': 'text/markdown; charset=utf-8',
};

/**
 * @param {string} root directorio raíz del servidor
 * @param {Record<string,string>} [aliases] rutas extra (p.ej. la ROM de prueba)
 * @returns {Promise<{origin:string, close:()=>Promise<void>}>}
 */
export async function serveDir(root, aliases = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

      const file = aliases[rel] ?? join(root, normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ''));

      // Nada de escapar del root: '../' se recorta.
      if (!aliases[rel] && !file.startsWith(root + sep) && file !== root) {
        res.writeHead(403).end('fuera del root');
        return;
      }

      const info = await stat(file);
      if (!info.isFile()) throw new Error('no es un archivo');

      res.writeHead(200, {
        'content-type': MIME[extname(file)] || 'application/octet-stream',
        'content-length': info.size,
        'cache-control': 'no-store',
      });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('404');
    }
  });

  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const { port } = server.address();

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((ok) => server.close(ok)),
  };
}