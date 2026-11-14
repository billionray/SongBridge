import {browserOptions} from '../browser-helper/platform.mjs';
import assert from 'node:assert/strict';import {chromium} from '../browser-helper/node_modules/playwright-core/index.mjs';
import {detectProxy,browserProxy} from '../browser-helper/proxy.mjs';
import {matchTrack,originalQuery} from '../browser-helper/matching.mjs';
import {reading} from '../browser-helper/reading.mjs';
import worker from '../dist/server/index.js';import {search,locateSelected,openSongMenu} from '../browser-helper/web.mjs';
const browser=await chromium.launch({...browserOptions(),proxy:browserProxy(detectProxy().url),headless:true,chromiumSandbox:true});
try{const p=await browser.newPage();await p.route('http://127.0.0.1:5173/**',async route=>{const response=await worker.fetch(new Request(route.request().url()));await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())})});
await p.goto('http://127.0.0.1:5173');const playlist={schemaVersion:1,name:'测试歌单',source:{platform:'spotify'},tracks:[{entryId:'1',id:'1',name:'Hello',artist:'Furui Riho / knoak'}]};
await p.locator('input[type=file]').setInputFiles({name:'playlist.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(playlist))});
await p.route('http://127.0.0.1:17321/**',r=>r.fulfill({json:{protocol:12,running:false,message:'就绪',job:null}}));await p.getByLabel('助手连接码').fill('demo');await p.getByRole('button',{name:'连接助手',exact:true}).click();
for(const name of ['开始匹配'])assert.ok(await p.getByRole('button',{name,exact:true}).isEnabled());
const hello={name:'Hello',artist:'Furui Riho / knoak'};const terms=[];
const actual=await matchTrack(hello,'auto',reading,async function*(q){terms.push(q);yield await search(p,q);yield await search(p,q,true)});
assert.equal(actual.candidate?.artist,'Furui Riho');assert.equal(terms[0],'Hello Furui Riho / knoak');assert.equal(actual.candidate.name,'Hello');console.log('Live Hello:',actual.candidate.id,actual.reason);
const track={name:'强军战歌',artist:'阎维文'};const list=await search(p,originalQuery(track));const candidate=list.find(c=>c.id==='1656180929');assert.ok(candidate);
const again=await locateSelected(p,track,{candidate});await openSongMenu(p,again);console.log('Live search and saved-query catalog ID relocation passed.');
}finally{await browser.close()}
