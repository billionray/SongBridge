import assert from 'node:assert/strict';
import {unzipSync, strFromU8} from 'fflate';
import worker from '../dist/server/index.js';

const api = 'https://songbridge.example/api/playlist';
const invalid = await worker.fetch(new Request(api, {method:'POST', body:'{}'}));
assert.equal(invalid.status, 400);
assert.ok((await invalid.json()).error);
assert.equal((await worker.fetch(new Request(api))).status, 405);

for (const site of ['https://example.workers.dev', 'https://music.example']) {
  const download = await worker.fetch(new Request(site+'/downloads/songbridge-helper.zip'));
  const files = unzipSync(new Uint8Array(await download.arrayBuffer()));
  assert.equal(strFromU8(files['origins.mjs']), 'export const siteOrigins = '+JSON.stringify([site])+';\n');
  assert.ok(files['start.command'].length);
}

console.log('PASS: Worker playlist API and site-specific helper downloads');
