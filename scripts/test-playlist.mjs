import assert from 'node:assert/strict';
import {POST} from '../app/api/playlist/route.ts';
const realFetch=globalThis.fetch;
let calls=0;
globalThis.fetch=async url=>{calls++;assert.match(String(url),/^https:\/\/music\.163\.com\/api\/playlist\/detail\?id=123$/);return Response.json({code:200,result:{name:'测试歌单',trackCount:3,tracks:[{id:9,name:'晴天',artists:[{name:'周杰伦'}],album:{name:'叶惠美'},duration:269000}]}})};
async function read(link){return POST(new Request('https://local/api/playlist',{method:'POST',body:JSON.stringify({link})}))}
for(const link of ['123','https://music.163.com/#/playlist?id=123','https://music.163.com/playlist?id=123','https://music.163.com/playlist/123']){const r=await read(link);assert.equal(r.status,200);const d=await r.json();assert.equal(d.tracks[0].artist,'周杰伦');assert.match(d.warning,/3 首.*1 首/)}
for(const link of ['https://evil.test/playlist?id=123','https://music.163.com/song?id=123','abc','https://music.163.com/playlist?id=123evil'])assert.equal((await read(link)).status,400);
assert.equal(calls,4);
globalThis.fetch=async()=>Response.json({code:403});assert.equal((await read('123')).status,400);
globalThis.fetch=async()=>Response.json({code:200,result:{tracks:[]}});assert.equal((await read('123')).status,400);
let batchCalls=0;
globalThis.fetch=async url=>{
 const u=new URL(url);
 if(u.pathname==='/api/playlist/detail')return Response.json({code:20001});
 if(u.pathname==='/api/v6/playlist/detail')return Response.json({code:200,playlist:{name:'喜欢',trackCount:205,trackIds:Array.from({length:205},(_,i)=>({id:i+1})),tracks:[{id:205,name:'最后一首',ar:[{name:'歌手'}],al:{name:'专辑'}}]}});
 assert.equal(u.pathname,'/api/song/detail');batchCalls++;
 const ids=JSON.parse(u.searchParams.get('ids'));assert.ok(ids.length<=100);
 return Response.json({code:200,songs:ids.reverse().map(id=>({id,name:String(id),artists:[{name:'歌手'}]}))});
};
const complete=await (await read('123')).json();assert.equal(complete.tracks.length,205);assert.equal(complete.tracks[0].id,'1');assert.equal(complete.tracks[204].name,'最后一首');assert.equal(batchCalls,3);assert.deepEqual(complete.missingIds,[]);
globalThis.fetch=realFetch;
console.log('PASS: playlist URLs, invalid input, fixed upstream, normalized metadata, partial results, private and empty playlists');
