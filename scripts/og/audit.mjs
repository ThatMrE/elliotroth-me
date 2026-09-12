#!/usr/bin/env node
/* Checks the page against what LinkedIn, X and Slack actually require of a link
   preview. Not a substitute for LinkedIn's Post Inspector — only LinkedIn can
   flush LinkedIn's cache — but it catches every fault the Inspector reports.

   node scripts/og/audit.mjs [path/to/index.html] */
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(process.argv[2] || join(ROOT, 'index.html'), 'utf8');

const meta = {};
for (const m of html.matchAll(/<meta\s+(?:property|name)=["']([^"']+)["']\s+content=["']([^"']*)["']/gi)) {
  (meta[m[1]] ||= []).push(m[2]);
}
const one = (k) => (meta[k] || [])[0];

const fail = [], warn = [], pass = [];
const check = (ok, msg, soft) => (ok ? pass : soft ? warn : fail).push(msg);

/* --- the tags every crawler reads ------------------------------------- */
check(!!one('og:title'), 'og:title present');
check(!!one('og:description'), 'og:description present');
check(!!one('og:url'), 'og:url present');
check(!!one('og:type'), 'og:type present');
check(/^https:\/\//.test(one('og:url') || ''), 'og:url is an absolute https URL');

/* Duplicates make crawlers pick unpredictably. */
for (const k of ['og:title', 'og:description', 'og:image', 'og:url']) {
  if ((meta[k] || []).length > 1) fail.push(`${k} declared ${meta[k].length} times — crawlers pick unpredictably`);
}

/* --- the image -------------------------------------------------------- */
const img = one('og:image');
check(!!img, 'og:image present');
if (img) {
  check(/^https:\/\//.test(img), 'og:image is absolute https — a relative path yields no preview at all');
  const w = +one('og:image:width'), h = +one('og:image:height');
  check(w >= 1200 && h >= 627, `og:image dimensions declared ${w}x${h} (LinkedIn wants >= 1200x627)`);
  const ratio = w / h;
  check(ratio > 1.85 && ratio < 1.95, `aspect ratio ${ratio.toFixed(3)} (1.91:1 is the target)`, true);
  check(!!one('og:image:alt'), 'og:image:alt present', true);

  /* The file itself, if it lives in this repo. */
  const local = img.replace(/^https?:\/\/[^/]+\//, '');
  const p = join(ROOT, local);
  if (existsSync(p)) {
    const mb = statSync(p).size / 1048576;
    check(mb < 5, `image is ${mb.toFixed(2)} MB (LinkedIn caps at 5 MB)`);
    check(mb < 1, `image is ${mb.toFixed(2)} MB (under 1 MB keeps previews snappy)`, true);
  } else {
    warn.push(`could not find ${local} locally to size-check`);
  }
}

/* --- X / Twitter ------------------------------------------------------ */
const card = one('twitter:card');
check(card === 'summary_large_image', `twitter:card is "${card}"`);
if (card === 'summary_large_image') {
  check(!!one('twitter:image'), 'twitter:image present — summary_large_image without one degrades to a text card');
}

/* --- crawlers do not run JavaScript ----------------------------------- */
check(/<title>[^<]+<\/title>/.test(html), '<title> is in the static HTML, not injected by JS');
check(!!one('description'), 'meta description is static');

/* --- identity --------------------------------------------------------- */
const ld = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i.exec(html);
if (ld) {
  try {
    const data = JSON.parse(ld[1]);
    check(data['@type'] === 'Person', 'JSON-LD describes a Person');
    check(Array.isArray(data.sameAs) && data.sameAs.length > 0,
      `JSON-LD sameAs links ${(data.sameAs || []).length} profiles — this is what ties the site to the LinkedIn account`);
  } catch (e) { fail.push('JSON-LD block is not valid JSON: ' + e.message); }
} else {
  warn.push('no JSON-LD Person block — crawlers cannot tie this site to a LinkedIn profile');
}

const line = (s, xs) => xs.length && console.log(`\n${s} (${xs.length})\n` + xs.map((x) => '  ' + x).join('\n'));
line('PASS', pass);
line('WARN', warn);
line('FAIL', fail);
console.log(`\n${fail.length ? '✗ ' + fail.length + ' blocking problem(s)' : '✓ nothing blocking a rich preview'}`);
process.exit(fail.length ? 1 : 0);
