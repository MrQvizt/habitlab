// Runs every browser walkthrough against the production build served with production headers
// (tools/serve.mjs), plus the native-bridge tests on the packaged file. Exits non-zero on any failure.
// Usage: node tools/browser-tests.mjs   (after `npm run build`)
import { spawn, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = 8771;
const base = `http://localhost:${port}/`;
const server = spawn(process.execPath, [join(root, 'tools/serve.mjs'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const suites = [
  ['e2e', [base]], ['demo', [base]], ['journey', [base]], ['wrap', [base]], ['flow', [base]],
  ['xss', [base]], ['web', [base]], ['a11y', [base]], ['robust', [base]], ['native', []], ['alarms', []], ['calendar', [base]], ['account', [base]], ['session', [base]], ['food', [base]],
];
let failed = 0;
for (const [name, args] of suites) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(root, 'tests', `${name}.cjs`), ...args], { cwd: root, encoding: 'utf8', timeout: 300000 });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? '✔' : '✖'} ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (!ok) console.log((r.stdout + r.stderr).split('\n').filter((l) => !/^\s+at /.test(l)).slice(-15).join('\n'));
}
server.kill();
console.log(failed ? `${failed} suite(s) failed` : `all ${suites.length} browser suites passed`);
process.exit(failed ? 1 : 0);
