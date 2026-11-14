import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {browserOptions} from '../browser-helper/platform.mjs';
import {macProxy} from '../browser-helper/proxy.mjs';
async function moduleFor(file){
 const r=await build({entryPoints:[file],bundle:true,write:false,platform:'node',format:'esm'});
 return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
}
const {fromText,toText,readFileContent,normalizePlaylist}=await moduleFor('app/playlist.ts');
if(process.argv[2]&&process.argv[3]){
 const [old]=readFileContent('歌曲.json',await readFile(process.argv[2],'utf8'));
 assert.equal(old.tracks.length,442);assert.deepEqual(fromText(toText(old),'歌单').tracks,fromText(await readFile(process.argv[3],'utf8'),'歌单').tracks);
}
const item={track:{trackName:'風 (Live)',artistName:'A & B',albumName:'夏',trackUri:'spotify:track:123'}};
const data={playlists:[{name:'原歌单',items:[item,item,{episode:{episodeName:'讲话'}},{localTrack:{trackName:'本地',artistName:'A'}},null]},{name:'空单',items:[]}]};
const lists=readFileContent('Playlist1.json',JSON.stringify(data));assert.equal(lists.length,2);
assert.deepEqual(lists[0].tracks.map(t=>[t.entryId,t.id]),[['1','123'],['2','123'],['4','']]);
assert.match(lists[0].warning,/播客 1 条、信息缺失 1 条/);
assert.deepEqual(normalizePlaylist(JSON.parse(JSON.stringify(lists[0]))).tracks,lists[0].tracks);
assert.equal(fromText('歌\t人\t碟\r下一首\t人\t碟','TXT').tracks.length,2);
const sp=await moduleFor('app/spotify.ts'),id='a'.repeat(22);
assert.equal(sp.playlistId('spotify:playlist:'+id),id);assert.equal(sp.playlistId('https://open.spotify.com/playlist/'+id+'?si=x'),id);
assert.equal(browserOptions('win32').channel,'msedge');assert.match(browserOptions('darwin',p=>p.includes('Edge')).executablePath,/Microsoft Edge$/);
assert.equal(browserOptions('linux',p=>p==='/usr/bin/chromium').executablePath,'/usr/bin/chromium');
assert.equal(macProxy('  HTTPSEnable : 1\n  HTTPSProxy : 127.0.0.1\n  HTTPSPort : 8888').url,'http://127.0.0.1:8888');
console.log('PASS: legacy 442 JSON/TXT, Spotify exports, duplicate rows, local and missing items, mac browser and proxy selection');

