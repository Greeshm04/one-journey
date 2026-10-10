#!/usr/bin/env node
/**
 * translate-stops.js
 *
 * Translates all stop/station names from the journey dataset into Gujarati (gu)
 * and Hindi (hi) using the Google Cloud Translation API (v2 / Basic).
 *
 * Usage:
 *   GOOGLE_TRANSLATE_API_KEY=<your-key> node scripts/translate-stops.js
 *
 * Output:
 *   src/data/stop_names_i18n.json
 *
 * The output is committed to the repo so the browser never calls the API.
 * Re-run this script only when stop names change in journey_demo_data.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────────
const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const TARGET_LANGS = ['gu', 'hi'];
const BATCH_SIZE = 128; // Google Translate v2 limit per request
const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const OUT_FILE = resolve(ROOT, 'src/data/stop_names_i18n.json');
const DATA_FILE = resolve(ROOT, 'src/data/journey_demo_data.json');

if (!API_KEY) {
  console.error('Error: GOOGLE_TRANSLATE_API_KEY environment variable is not set.');
  console.error('Usage: GOOGLE_TRANSLATE_API_KEY=<key> node scripts/translate-stops.js');
  process.exit(1);
}

// ── Collect all unique stop/station names ────────────────────────────────────
const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
const nameSet = new Set();
for (const s of raw.stops || [])       nameSet.add(s[1]);
for (const s of raw.metroStops || [])  nameSet.add(s[1]);
const names = [...nameSet].sort();
console.log(`Found ${names.length} unique stop names.`);

// ── Load existing output (for incremental runs) ───────────────────────────────
let existing = {};
if (existsSync(OUT_FILE)) {
  existing = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
  console.log('Loaded existing translations for incremental update.');
}

// ── Google Translate helper ───────────────────────────────────────────────────
async function translateBatch(texts, targetLang) {
  const url = `${ENDPOINT}?key=${API_KEY}`;
  const body = JSON.stringify({ q: texts, target: targetLang, source: 'en', format: 'text' });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Translate API error (${res.status}): ${err}`);
  }
  const json = await res.json();
  return json.data.translations.map((t) => t.translatedText);
}

// ── Translate all names for a target language ─────────────────────────────────
async function translateAll(targetLang) {
  const result = {};

  // Carry over already-translated names to avoid re-billing
  const toTranslate = [];
  for (const name of names) {
    if (existing[name]?.[targetLang]) {
      result[name] = existing[name][targetLang];
    } else {
      toTranslate.push(name);
    }
  }

  if (toTranslate.length === 0) {
    console.log(`  [${targetLang}] All ${names.length} names already translated — skipping API call.`);
    return result;
  }

  console.log(`  [${targetLang}] Translating ${toTranslate.length} names (${Math.ceil(toTranslate.length / BATCH_SIZE)} batch(es))…`);

  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    const batch = toTranslate.slice(i, i + BATCH_SIZE);
    const translated = await translateBatch(batch, targetLang);
    for (let j = 0; j < batch.length; j++) {
      result[batch[j]] = translated[j];
    }
    process.stdout.write(`    ${Math.min(i + BATCH_SIZE, toTranslate.length)}/${toTranslate.length}\r`);
  }
  console.log(`  [${targetLang}] Done.`);
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const output = {};

// Pre-populate English (identity) so the lookup function works uniformly
for (const name of names) {
  output[name] = { en: name };
}

for (const lang of TARGET_LANGS) {
  console.log(`\nTranslating to: ${lang}`);
  const translations = await translateAll(lang);
  for (const name of names) {
    output[name][lang] = translations[name] ?? name;
  }
}

writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
console.log(`\nWrote ${names.length} entries to ${OUT_FILE}`);
