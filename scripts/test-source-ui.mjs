import {browserOptions} from '../browser-helper/platform.mjs';
import {chromium} from '../browser-helper/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const browser=await chromium.launch({...browserOptions(),headless:true,chromiumSandbox:true});
try{
 const p=await browser.newPage();p.setDefaultTimeout(6000);
 await p.route('http://127.0.0.1:5173/**',async route=>{
  const response=await worker.fetch(new Request(route.request().url()));
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 await p.goto('http://127.0.0.1:5173');
 await p.getByRole('group',{name:'来源平台'}).getByRole('button',{name:'Apple Music',exact:true}).click();
 assert.equal(await p.getByRole('button',{name:'读取歌单',exact:true}).count(),1);
 assert.ok(await p.getByLabel('Apple Music 本地助手连接码').isVisible());
 await p.getByRole('group',{name:'来源平台'}).getByRole('button',{name:'YouTube Music',exact:true}).click();
 assert.equal(await p.getByRole('button',{name:'读取歌单',exact:true}).count(),1);
 assert.ok(await p.getByLabel('YouTube Music 本地助手连接码').isVisible());
 await p.getByRole('group',{name:'来源平台'}).getByRole('button',{name:'Spotify',exact:true}).click();
 assert.equal(await p.getByRole('button',{name:'读取歌单',exact:true}).count(),1);
 assert.ok(await p.getByLabel('Spotify 本地助手连接码').isVisible());
 await p.getByRole('button',{name:'读取歌单'}).click();
 assert.ok(await p.getByRole('alert').isVisible());assert.equal(await p.evaluate(()=>document.activeElement.id),'source-link');
 await p.goto('http://127.0.0.1:5173/?spotify='+'a'.repeat(22));
 assert.equal(await p.getByLabel(/Spotify 歌单链接/).inputValue(),'https://open.spotify.com/playlist/'+'a'.repeat(22));
 await p.getByRole('button',{name:'读取歌单'}).click();assert.equal(await p.evaluate(()=>document.activeElement.id),'player-code');
 await p.getByLabel(/Spotify 歌单链接/).fill('spotify:playlist:'+'a'.repeat(22));
 await p.getByLabel('Spotify 本地助手连接码').fill('demo');
 await p.route('http://127.0.0.1:17321/spotify-player',async r=>{
  assert.equal(r.request().postDataJSON().id,'a'.repeat(22));
  await r.fulfill({json:{schemaVersion:1,name:'播放器样例',source:{platform:'spotify'},tracks:[{entryId:'1',id:'track',name:'Song',artist:'Artist',album:''}],warning:'已核对 1 / 1 项'}});
 });
 await p.getByRole('button',{name:'读取歌单'}).click();await p.getByText('已核对 1 / 1 项').waitFor();
 assert.equal(await p.getByLabel('歌单名称').inputValue(),'播放器样例');
 await p.getByRole('button',{name:'更换来源'}).click();
 const file=(name,items)=>({name:name+'.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({playlists:[{name,items:items.map(trackName=>({track:{trackName,artistName:'Singer'}}))}]}))});
 await p.locator('input[type=file]').setInputFiles([file('First',['Apple','Missing']),file('Second',['Last'])]);
 await p.getByLabel('选择歌单').selectOption('0');assert.equal(await p.getByLabel('歌单名称').inputValue(),'First');
 let helperJob,matching=false;
 await p.route('http://127.0.0.1:17321/**',async route=>{
  if(route.request().url().endsWith('/scan')){
   const {playlist}=route.request().postDataJSON();
   matching=true;
   helperJob={hash:'review-test',playlist,entries:{0:{status:'matched',risk:'consistent',candidates:[{id:'live',name:'Apple (Live)',artist:'Singer'}]},1:{status:'matched',risk:'credits',reason:'唯一候选，完整艺人署名对应',candidate:{id:'unique',name:'Destination',artist:'Singer'}}}};
  }
  if(route.request().url().endsWith('/select')){
   const {index,id}=route.request().postDataJSON();assert.ok(matching);helperJob.entries[index].candidate=helperJob.entries[index].candidates.find(c=>c.id===id);matching=false;
  }
  if(route.request().url().endsWith('/check')){
   const {index,checked}=route.request().postDataJSON();helperJob.entries[index].checked=checked;
  }
  if(route.request().url().endsWith('/continue'))assert.equal(route.request().postDataJSON().hash,helperJob.hash);
  return route.fulfill({json:{protocol:11,job:helperJob,matching,running:matching,message:'就绪'}});
 });
 await p.getByLabel('助手连接码',{exact:true}).fill('demo');
 await p.getByRole('button',{name:'连接助手',exact:true}).click();
 const panel=p.getByRole('region',{name:'浏览器导入'});
 await panel.getByRole('button',{name:'开始匹配'}).click();
 await panel.getByLabel('浏览器版本 1').selectOption('live');
 await panel.getByText('Apple (Live)',{exact:true}).first().waitFor();
 await panel.getByLabel('核对视图').selectOption('review');
 assert.equal(await panel.locator('tbody tr').count(),1);assert.ok(await panel.getByLabel('浏览器选择 Missing').isChecked());
 assert.match(await panel.locator('tbody tr').innerText(),/Destination · Singer/);
 assert.match(await panel.locator('tbody tr').innerText(),/唯一候选，完整艺人署名对应/);
 await panel.getByLabel('浏览器选择 Missing').click();
 await panel.locator('input[aria-label="浏览器选择 Missing"]:not(:checked)').waitFor();
 await panel.getByRole('button',{name:'继续匹配'}).click();
 await panel.getByLabel('核对视图').selectOption('unchecked');
 assert.equal(await panel.locator('tbody tr td').first().innerText(),'2');
 assert.equal(await panel.locator('tbody tr').count(),1);
 await panel.getByLabel('浏览器选择 Missing').click();
 await panel.getByText('没有未选择的歌曲').waitFor();
 assert.ok(await panel.getByRole('button',{name:'确认并导入 2 首'}).isEnabled());
 await panel.getByLabel('核对视图').selectOption('all');
 assert.equal(await panel.locator('tbody tr').count(),2);
 await panel.getByLabel('浏览器选择 Missing').click();
 await panel.locator('input[aria-label="浏览器选择 Missing"]:not(:checked)').waitFor();
 await p.reload();
 assert.equal(await p.getByRole('button',{name:'连接助手',exact:true}).count(),0);
 await p.locator('input[type=file]').setInputFiles(file('First',['Apple','Missing']));
 await p.getByLabel('助手连接码',{exact:true}).fill('demo');
 await p.getByRole('button',{name:'连接助手',exact:true}).click();
 await panel.getByRole('button',{name:'继续匹配'}).waitFor();
 assert.equal(await p.getByLabel('歌单名称').inputValue(),'First');
 assert.equal(await panel.getByLabel('浏览器选择 Missing').isChecked(),false);
 assert.equal(await p.getByRole('button',{name:'API 导入'}).count(),0);
 await p.getByRole('group',{name:'目标平台'}).getByRole('button',{name:'Spotify'}).click();
 for(const target of ['Spotify','YouTube Music']){
  await p.getByRole('group',{name:'目标平台'}).getByRole('button',{name:target,exact:true}).click();
  const pane=p.getByRole('region',{name:target+' 导入'});
  let release;
  const gate=new Promise(resolve=>release=resolve),calls=[];
  await p.route('**/player-match',async route=>{
   const {track,mode}=route.request().postDataJSON();
   calls.push(track.name);assert.equal(mode,'auto');
   if(calls.length===1)await gate;
   await route.fulfill({json:{options:[{id:'a',name:track.name,artist:'Singer'},{id:'b',name:track.name+' (Live)',artist:'Singer'}],id:'a',risk:'credits',reason:'唯一候选，完整艺人署名对应'}});
  });
  await pane.getByRole('button',{name:'开始匹配'}).click();
  await pane.getByRole('button',{name:'暂停'}).click();release();
  await pane.getByText('已暂停匹配，可继续。').waitFor();
  await pane.getByLabel(target+' 版本').selectOption('b');
  await pane.getByRole('button',{name:'继续匹配'}).click();
  await pane.getByText('匹配完成，请核对候选版本。').waitFor();
  assert.deepEqual(calls,['Apple','Missing']);
  const rowText=await pane.locator('tbody tr').last().innerText();
  assert.match(rowText,/Missing · Singer/);assert.match(rowText,/唯一候选，完整艺人署名对应/);
  assert.equal(await pane.getByLabel(target+' 版本').inputValue(),'b');
  await p.unroute('**/player-match');
 }
 await p.getByRole('group',{name:'目标平台'}).getByRole('button',{name:'Apple Music'}).click();
 assert.equal(await panel.getByLabel('浏览器选择 Missing').isChecked(),false);
 await p.setViewportSize({width:390,height:844});
 await panel.getByRole('button',{name:'Missing',exact:true}).click();
 await panel.getByRole('button',{name:'返回清单'}).click();
 assert.ok(await panel.getByLabel('浏览器选择 Missing').isVisible());
 console.log('PASS: source loading, helper review, restore, target switching and mobile navigation');
}finally{await browser.close()}

