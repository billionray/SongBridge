import assert from 'node:assert/strict';
for (const [platform, link] of [['netease', '3778678'], ['qq', '3805603854']]) {
  const response = await fetch(new URL('/api/playlist', process.env.SONGBRIDGE_SITE_ORIGIN), {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({platform, link}),
    signal: AbortSignal.timeout(60000)
  });
  const data = await response.json();
  assert.ok(response.ok, data.error);
  assert.equal(data.source.platform, platform);
  assert.ok(data.tracks.length > 0);
  assert.equal(data.tracks.length, data.total);
  console.log(platform, data.tracks.length, '/', data.total);
}
