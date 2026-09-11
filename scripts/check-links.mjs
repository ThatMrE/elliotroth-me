#!/usr/bin/env node
/* Walks every URL in /data and reports the dead ones.
   Run: node scripts/check-links.mjs [--json]
   Networked and therefore flaky by nature — treat a single failure as a
   question, not a verdict. Nothing here deletes anything. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const asJson = process.argv.includes('--json');
const TIMEOUT = 15000;
const CONCURRENCY = 6;

const targets = [];
for (const f of readdirSync(DATA).filter((f) => f.endsWith('.json'))) {
  const raw = JSON.parse(readFileSync(join(DATA, f), 'utf8'));
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'url' && typeof v === 'string' && /^https?:\/\//i.test(v)) {
          targets.push({ file: f, at: node.id || node.name || node.title || path, url: v });
        } else walk(v, `${path}.${k}`);
      }
    }
  };
  walk(raw, f);
}

async function probe(t) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const opts = {
    signal: ctrl.signal,
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; elliotroth.me link-checker)' }
  };
  try {
    let res = await fetch(t.url, { ...opts, method: 'HEAD' });
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(t.url, { ...opts, method: 'GET' });
    }
    return { ...t, status: res.status, ok: res.ok };
  } catch (err) {
    return { ...t, status: 0, ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
const queue = targets.slice();
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) results.push(await probe(queue.shift()));
}));

const bad = results.filter((r) => !r.ok);
if (asJson) {
  console.log(JSON.stringify({ checked: results.length, bad }, null, 2));
} else {
  console.log(`checked ${results.length} links · ${bad.length} did not respond OK`);
  for (const b of bad) console.log(`  ${String(b.status || b.error).padEnd(10)} ${b.file} · ${b.at}\n             ${b.url}`);
  if (!bad.length) console.log('every link resolves.');
}
/* Never fail the build on a network hiccup. */
process.exit(0);
