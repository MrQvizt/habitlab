// Serves www/ with the same headers Vercel applies (from vercel.json), so tests run under the real
// Content-Security-Policy. Usage: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'www');
const port = Number(process.argv[2] || 8770);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css' };

function headersFor(path) {
  const cfg = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const out = {};
  for (const rule of cfg.headers || []) {
    const re = new RegExp('^' + rule.source.replace('(.*)', '.*') + '$');
    if (re.test(path)) for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(dir, url));
  if (!file.startsWith(dir)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', ...headersFor(url) });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`serving www/ with production headers on http://localhost:${port}/`));
