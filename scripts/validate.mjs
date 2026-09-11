#!/usr/bin/env node
/* Schema gate for /data. The curator agent must pass this before anything
   reaches the site. Run: node scripts/validate.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

const isUrl = (v) => typeof v === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isYear = (v) => Number.isInteger(v) && v >= 1990 && v <= new Date().getFullYear() + 1;
const isMonth = (v) => typeof v === 'string' && /^\d{4}(-\d{2})?$/.test(v);

function load(name) {
  const p = join(ROOT, 'data', `${name}.json`);
  if (!existsSync(p)) { errors.push(`data/${name}.json is missing`); return null; }
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { errors.push(`data/${name}.json is not valid JSON: ${e.message}`); return null; }
}

function eachRecord(name, arr, fn) {
  if (!Array.isArray(arr)) { errors.push(`data/${name}.json must be an array`); return; }
  const seen = new Set();
  arr.forEach((rec, i) => {
    const where = `data/${name}.json[${i}]`;
    if (rec == null || typeof rec !== 'object') { errors.push(`${where} is not an object`); return; }
    if (rec.id !== undefined) {
      if (!isStr(rec.id)) errors.push(`${where} has an empty id`);
      else if (seen.has(rec.id)) errors.push(`${where} duplicates id "${rec.id}"`);
      else seen.add(rec.id);
    }
    /* needsCheck marks a record whose URL has not been fetched and confirmed,
       or one a link check found broken. The curator clears it. */
    if (rec.needsCheck !== undefined && typeof rec.needsCheck !== 'boolean') {
      errors.push(`${where} "needsCheck" must be a boolean`);
    }
    if (rec.url !== undefined && rec.url !== null && !isUrl(rec.url)) {
      errors.push(`${where} url is not a plain http(s) URL: ${JSON.stringify(rec.url)}`);
    }
    fn(rec, where);
  });
}

/* ---- profile ---- */
const profile = load('profile');
if (profile) {
  for (const k of ['name', 'objective', 'strapline', 'longBio']) {
    if (!isStr(profile[k])) errors.push(`data/profile.json: "${k}" must be a non-empty string`);
  }
  if (!Array.isArray(profile.links)) errors.push('data/profile.json: "links" must be an array');
  else profile.links.forEach((l, i) => {
    if (!isStr(l.label)) errors.push(`data/profile.json links[${i}] needs a label`);
    if (!isUrl(l.url)) errors.push(`data/profile.json links[${i}] needs an http(s) url`);
  });
  if (!Array.isArray(profile.genotype)) errors.push('data/profile.json: "genotype" must be an array');
  else profile.genotype.forEach((g, i) => {
    if (!isStr(g.trait)) errors.push(`data/profile.json genotype[${i}] needs a trait`);
    if (!['wet', 'hard', 'soft'].includes(g.class)) {
      errors.push(`data/profile.json genotype[${i}] class must be wet | hard | soft`);
    }
  });
}

/* ---- work ---- */
eachRecord('work', load('work'), (r, where) => {
  for (const k of ['id', 'org', 'role', 'kind', 'tagline']) {
    if (!isStr(r[k])) errors.push(`${where} needs a non-empty "${k}"`);
  }
  if (!isMonth(r.start)) errors.push(`${where} start must be YYYY or YYYY-MM`);
  if (r.end !== null && r.end !== undefined && !isMonth(r.end)) {
    errors.push(`${where} end must be YYYY, YYYY-MM or null`);
  }
  if (typeof r.current !== 'boolean') errors.push(`${where} needs a boolean "current"`);
  if (r.current && r.end) warnings.push(`${where} is marked current but has an end date`);
  if (!Array.isArray(r.highlights)) errors.push(`${where} needs a "highlights" array`);
  /* Impact drives the y axis of the chart, so it must be a real number on a
     fixed scale, and the reasoning must travel with it. */
  if (!Number.isFinite(r.impact) || r.impact < 0 || r.impact > 100) {
    errors.push(`${where} needs an "impact" score between 0 and 100`);
  }
  if (!isStr(r.impactNote)) errors.push(`${where} needs an "impactNote" saying what earns that score`);
  /* Optional: a logo file under assets/logos/, painted monochrome via CSS mask. */
  if (r.logo !== undefined && r.logo !== null && !/^assets\/logos\/[\w.-]+$/.test(r.logo)) {
    errors.push(`${where} logo must be a path like "assets/logos/name.svg"`);
  }
});

/* ---- press ---- */
const PRESS_TYPES = ['article', 'podcast', 'video', 'profile', 'paper', 'talk'];
eachRecord('press', load('press'), (r, where) => {
  for (const k of ['id', 'title', 'outlet']) {
    if (!isStr(r[k])) errors.push(`${where} needs a non-empty "${k}"`);
  }
  if (!isUrl(r.url)) errors.push(`${where} needs a working http(s) url — press items without a link do not belong here`);
  if (!isYear(r.year)) errors.push(`${where} year must be an integer between 1990 and next year`);
  if (!PRESS_TYPES.includes(r.type)) errors.push(`${where} type must be one of: ${PRESS_TYPES.join(', ')}`);
  if (r.new !== undefined && typeof r.new !== 'boolean') errors.push(`${where} "new" must be a boolean`);
});

/* ---- awards ---- */
eachRecord('awards', load('awards'), (r, where) => {
  if (!isStr(r.id)) errors.push(`${where} needs an id`);
  if (!isStr(r.title)) errors.push(`${where} needs a title`);
  if (!isYear(r.year)) errors.push(`${where} needs a plausible year`);
});

/* ---- talks / teaching / writing / artifacts / communities ---- */
eachRecord('talks', load('talks'), (r, where) => {
  if (!isStr(r.id)) errors.push(`${where} needs an id`);
  if (!isStr(r.title)) errors.push(`${where} needs a title`);
  if (r.year !== null && r.year !== undefined && !isYear(r.year)) errors.push(`${where} year is implausible`);
});
eachRecord('teaching', load('teaching'), (r, where) => {
  if (!isStr(r.id)) errors.push(`${where} needs an id`);
  if (!isStr(r.title)) errors.push(`${where} needs a title`);
  if (!isStr(r.role)) errors.push(`${where} needs a role`);
});
eachRecord('writing', load('writing'), (r, where) => {
  if (!isStr(r.title)) errors.push(`${where} needs a title`);
  if (!isUrl(r.url)) errors.push(`${where} needs a url`);
});
eachRecord('artifacts', load('artifacts'), (r, where) => {
  if (!isStr(r.name)) errors.push(`${where} needs a name`);
  if (!isStr(r.blurb)) errors.push(`${where} needs a blurb`);
  if (!['wet', 'hard', 'soft', 'infra'].includes(r.class)) {
    errors.push(`${where} class must be wet | hard | soft | infra`);
  }
});
eachRecord('communities', load('communities'), (r, where) => {
  if (!isStr(r.name)) errors.push(`${where} needs a name`);
});

/* ---- workbench (things built with Claude) ---- */
const WB_KINDS = ['tool', 'playbook', 'research', 'toy', 'site'];
eachRecord('workbench', load('workbench'), (r, where) => {
  if (!isStr(r.id)) errors.push(`${where} needs an id`);
  if (!isStr(r.name)) errors.push(`${where} needs a name`);
  if (!isStr(r.blurb)) errors.push(`${where} needs a blurb`);
  if (!WB_KINDS.includes(r.kind)) errors.push(`${where} kind must be one of: ${WB_KINDS.join(', ')}`);
  if (!['public', 'private'].includes(r.visibility)) {
    errors.push(`${where} visibility must be "public" or "private" — it decides whether the link is rendered at all`);
  }
  if (r.visibility === 'public' && !isUrl(r.url)) {
    errors.push(`${where} is marked public but has no url`);
  }
  if (!isYear(r.year)) errors.push(`${where} needs a plausible year`);
});

/* ---- changelog ---- */
const log = load('changelog');
if (log) {
  if (!Array.isArray(log.entries)) errors.push('data/changelog.json: "entries" must be an array');
  else log.entries.forEach((e, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) errors.push(`changelog entries[${i}] date must be YYYY-MM-DD`);
    if (!isStr(e.summary)) errors.push(`changelog entries[${i}] needs a summary`);
  });
}

/* ---- cross-file: the same link should not be filed twice ---- */
const norm = (u) => u.replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
const urlHome = new Map();
for (const name of ['press', 'writing', 'awards', 'talks', 'artifacts', 'workbench', 'communities', 'teaching']) {
  const arr = load(name);
  if (!Array.isArray(arr)) continue;
  for (const r of arr) {
    if (!isUrl(r.url)) continue;
    const key = norm(r.url);
    const label = `${name}:${r.id || r.name || r.title}`;
    const prior = urlHome.get(key);
    if (prior) {
      /* Cross-collection reuse is fine (an award page is often also press).
         The same link twice inside one collection is a duplicate. */
      if (prior.split(':')[0] === name) errors.push(`duplicate URL inside ${name}: ${r.url} (already at ${prior})`);
    } else {
      urlHome.set(key, label);
    }
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
if (errors.length) {
  console.error(`\n✗ ${errors.length} problem${errors.length === 1 ? '' : 's'} in /data:\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error('\nFix these before the culture gets passaged.\n');
  process.exit(1);
}
console.log(`✓ /data validates${warnings.length ? ` (${warnings.length} warning${warnings.length === 1 ? '' : 's'})` : ''}`);
