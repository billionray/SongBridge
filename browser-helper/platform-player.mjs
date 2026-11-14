import {matchTrack} from './matching.mjs';
import {reading} from './reading.mjs';
import {readPlayer,spotifyRows} from './spotify-player.mjs';

const hosts={apple:'https://music.apple.com',spotify:'https://open.spotify.com',ytmusic:'https://music.youtube.com'};
export function playlistUrl(platform,value){
 const u=new URL(value);
 if(!hosts[platform]||u.username||u.password)throw Error('无效歌单链接');
 if(platform==='ytmusic'&&['https://www.youtube.com',hosts.ytmusic].includes(u.origin)&&['/watch','/playlist'].includes(u.pathname)&&/^[\w-]+$/.test(u.searchParams.get('list')||''))
  return hosts.ytmusic+'/playlist?list='+u.searchParams.get('list');
 if(platform==='apple'&&u.origin===hosts.apple&&/^\/(?:[a-z]{2}\/)?(?:library\/)?playlist\/(?:[^/]+\/)?(?:pl\.|p\.)[\w.-]+\/?$/.test(u.pathname))return u.origin+u.pathname;
 if(platform==='spotify'&&u.origin===hosts.spotify&&/^\/(?:intl-[\w-]+\/)?playlist\/[a-zA-Z0-9]{22}\/?$/.test(u.pathname))return hosts.spotify+'/playlist/'+u.pathname.split('/').filter(Boolean).at(-1);
 throw Error('请输入对应平台的歌单分享链接');
}
const youtubeRows='ytmusic-responsive-list-item-renderer';
const appleRows='[data-testid="track-list-item"],.songs-list-row';
async function snapshot(rows,platform){
 if(platform==='spotify')return rows.evaluateAll(spotifyRows);
 return rows.evaluateAll((elements,platform)=>elements.map((row,i)=>{
  const yt=platform==='ytmusic',sp=platform==='spotify';
  const link=row.querySelector(yt?'a[href*="watch?v="]':sp?'a[href*="/track/"]':'a[href*="/song/"],a[href*="?i="]');
  const title=row.querySelector(yt?'.title-column .title,.title-column a':sp?'a[href*="/track/"]':'[data-testid="track-title"],.songs-list-row__song-name');
  const people=[...row.querySelectorAll(yt?'a[href*="channel/"],a[href*="browse/UC"]':sp?'a[href*="/artist/"]':'a[href*="/artist/"]')].map(a=>a.textContent.trim()).filter(Boolean);
  const url=link&&new URL(link.href);
  const id=url&&(yt?url.searchParams.get('v'):sp?url.pathname.split('/').at(-1):url.searchParams.get('i')||url.pathname.split('/').at(-1));
  const position=row.getAttribute('data-row')??row.getAttribute('aria-rowindex')??row.querySelector('.index-column,.track-number')?.textContent.trim();
  const videoId=yt?(id||row.data?.playlistItemData?.videoId):null;
  return {index:position&&/^\d+$/.test(position)?Number(position):i,id:videoId||id||'',name:(title||link)?.textContent.trim()||'',artist:[...new Set(people)].join(' / ')||row.querySelector(yt?'.secondary-flex-columns .flex-column': '[data-testid="track-column-secondary"],.songs-list-row__by-line')?.textContent.trim()||'',album:row.querySelector(yt?'a[href*="/album/"],a[href*="/browse/MPRE"],a[href*="list=OLAK5uy"]':'a[href*="/album/"]')?.textContent.trim()||'',url:link?.href||(videoId?'https://music.youtube.com/watch?v='+encodeURIComponent(videoId):undefined)};
 }),platform);
}
export async function readList(page,platform,link){
 const url=playlistUrl(platform,link);
 if(platform==='spotify')return readPlayer(page,url.split('/').at(-1));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const heading=page.locator(platform==='apple'?'main h1':'ytmusic-responsive-header-renderer h1,ytmusic-detail-header-renderer .title').first();
 await heading.waitFor();
 const name=(await heading.innerText()).trim(),rows=page.locator(platform==='apple'?appleRows:'ytmusic-playlist-shelf-renderer '+youtubeRows);
 const summary=(await page.locator('body').innerText()).match(/([\d,]+)\s*(?:首歌(?:曲)?|songs?\b|tracks?\b)/i);
 const expected=summary?Number(summary[1].replaceAll(',','')):null;
 if(expected!==0)await rows.first().waitFor({timeout:20000}).catch(()=>{throw Error('网页未显示曲目，请确认歌单可见并在助手浏览器登录')});
 if(platform==='ytmusic'&&expected!==0){
  const shelf=rows.first().locator('xpath=ancestor::ytmusic-playlist-shelf-renderer');
  let previous=0,stable=0,stalled=0;
  for(let round=0;round<1500;round++){
   await rows.last().scrollIntoViewIfNeeded();
   await page.waitForTimeout(1000);
   const count=await rows.count();
   const pending=await shelf.locator('yt-next-continuation:visible,ytmusic-continuation-item-renderer:visible').count();
   const continuation=await shelf.evaluate(el=>!!el.querySelector('#continuations')?.children.length||!!el.querySelector('ytmusic-continuation-item-renderer,ytd-continuation-item-renderer'));
   stable=count===previous&&!pending&&!continuation?stable+1:0;
   stalled=count===previous?stalled+1:0;
   if(stalled>=30)throw Error('歌单分页未响应，请重试');
   previous=count;
   if(stable<5)continue;
   const playable=page.locator('ytmusic-playlist-shelf-renderer '+youtubeRows+':not([unplayable]):not([display-policy*="GREY_OUT" i])');
   const visible=await snapshot(playable,platform);
   if(await rows.count()!==count)continue;
   if(visible.some(t=>!t.name||!t.id))throw Error('部分可见曲目的标题或 ID 未能读取，请重试');
   const tracks=visible.map((t,i)=>({...t,entryId:String(i+1)}));
   return {schemaVersion:1,name,source:{platform,url},tracks,warning:count===tracks.length&&(expected===null||expected===count)?'':'已读取 '+tracks.length+' 条可用曲目，跳过 '+(count-tracks.length)+' 条灰色条目。'+(expected===null?'':'歌单标注 '+expected+' 条。')};
  }
  throw Error('歌单分页尚未完成，请重试');
 }
 const found=new Map();let stable=0;
 for(let n=0;n<1500&&expected!==0;n++){
  const before=found.size;
  for(const t of await snapshot(rows,platform)){
   if(!t.name)continue;
   const prev=found.get(t.index);
   if(prev&&(prev.id!==t.id||prev.name!==t.name))throw Error('歌曲行位置发生变化，无法完整读取');
   found.set(t.index,t);
  }
  if(expected!==null&&found.size===expected)break;
  const bottom=await rows.last().evaluate(row=>{
   let owner=row.parentElement;
   while(owner&&!(owner.scrollHeight>owner.clientHeight+4&&/auto|scroll|overlay/.test(getComputedStyle(owner).overflowY)))owner=owner.parentElement;
   owner=owner||document.scrollingElement;owner.scrollTop+=owner.clientHeight*.65;
   return owner.scrollTop+owner.clientHeight>=owner.scrollHeight-4;
  });
  stable=bottom&&found.size===before?stable+1:0;
  if(stable>=5)break;
  if(n===1499)throw Error('歌单尚未完整读取');
  await page.waitForTimeout(bottom?1000:250);
 }
 if(expected!==null&&found.size!==expected)throw Error('网页只读取到 '+found.size+' / '+expected+' 首，请重试');
 const tracks=[...found].sort(([a],[b])=>a-b).map(([,t],i)=>({...t,entryId:String(i+1)}));
 return {schemaVersion:1,name,source:{platform,url},tracks,warning:expected===null?'已读取 '+tracks.length+' 首；网页未显示总数。':''};
}
export async function searchPlayer(page,platform,query){
 const sp=platform==='spotify';
 await page.goto(sp?hosts.spotify+'/search/'+encodeURIComponent(query)+'/tracks':hosts.ytmusic+'/search?q='+encodeURIComponent(query)+'&sp=EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D',{waitUntil:'domcontentloaded'});
 const rows=page.locator(sp?'[data-testid="tracklist-row"]':'ytmusic-search-page '+youtubeRows);
 await rows.first().waitFor({timeout:15000}).catch(async e=>{
  if(page.url().includes('unsupported')||await page.getByText(/not optimized for your browser|当前浏览器不受支持/i).count())throw Error('YouTube Music 不支持当前浏览器或所在地区，请更新桌面 Chrome 并在助手浏览器确认播放器可用');
  if(!await page.getByText(/No results|没有结果|未找到结果/i).count())throw e;
 });
 return (await snapshot(rows,platform)).filter(t=>t.id&&t.name).slice(0,12);
}
export async function writePlayer(page,platform,link,ids,progress){
 let target;
 try{target=await readList(page,platform,link)}
 catch(error){
  const canonical=playlistUrl(platform,link);
  if(playlistUrl(platform,page.url())!==canonical)throw error;
  const empty=page.getByText(/^(?:this playlist is empty|no songs in this playlist|let.s find something for your playlist|此播放列表为空|此歌单为空|此播放列表中没有歌曲|来为你的歌单找点内容吧)[.!。！]?$/i);
  if(!await empty.first().isVisible())throw error;
  const heading=page.locator(platform==='spotify'?'main h1':'ytmusic-responsive-header-renderer h1,ytmusic-detail-header-renderer .title').first();
  target={name:(await heading.innerText()).trim(),tracks:[]};
 }
 if(target.warning?.includes('不完整'))throw Error('目标歌单读取不完整，请重试');
 const pending=[...new Set(ids)].filter(id=>!target.tracks.some(t=>t.id===id));
 const sp=platform==='spotify';
 for(const [i,id] of pending.entries()){
  if(sp){
   await page.goto(hosts.spotify+'/track/'+id,{waitUntil:'domcontentloaded'});
   await page.locator('main [data-testid="more-button"],main button[aria-haspopup="menu"]').first().click();
   const menu=page.getByRole('menuitem',{name:/Add to playlist|添加到播放列表|添加到歌单/i});
   await menu.hover();
   const item=page.getByRole('menuitem',{name:target.name,exact:true});
   if(!await item.count()){await menu.click();await item.waitFor()}
   await item.click();
  }else{
   await page.goto(hosts.ytmusic+'/watch?v='+id,{waitUntil:'domcontentloaded'});
   await page.locator('ytmusic-player-bar ytmusic-menu-renderer button').last().click();
   await page.locator('ytmusic-menu-service-item-renderer,ytmusic-menu-navigation-item-renderer').filter({hasText:/Save to playlist|Add to playlist|保存到播放列表|添加到播放列表/i}).click();
   const item=page.locator('ytmusic-playlist-add-to-option-renderer,ytd-playlist-add-to-option-renderer').filter({has:page.getByText(target.name,{exact:true})});
   await item.click();
  }
  // Confirm membership before attempting the next write. A retry rereads the target.
  const verified=await readList(page,platform,link);
  if(!verified.tracks.some(t=>t.id===id))throw Error('未能确认本次写入，请核对目标歌单后重试');
  progress(i+1,pending.length);
 }
 return {added:pending.length,skipped:ids.length-pending.length};
}
export async function platformAction(page,route,d,progress){
 if(!Object.hasOwn(hosts,d.platform))throw Error('不支持的平台');
 if(route==='/player-login'){await page.goto(hosts[d.platform],{waitUntil:'domcontentloaded'});await page.bringToFront();return {ok:true}}
 if(route==='/player-read')return readList(page,d.platform,d.link);
 if(d.platform==='apple')throw Error('请使用 Apple Music 浏览器导入');
 if(route==='/player-match'&&typeof d.track?.name==='string'&&typeof d.track.artist==='string'){
  const mode=['exact','smart','romaji'].includes(d.mode)?d.mode:'auto';
  const decision=await matchTrack(d.track,mode,reading,async function*(query){yield await searchPlayer(page,d.platform,query)},d.reading);
  return {options:decision.ordered,id:decision.candidate?.id||'',risk:decision.risk,reason:decision.reason};
 }
 if(route==='/player-search'&&typeof d.query==='string')return searchPlayer(page,d.platform,d.query);
 if(route==='/player-write'&&Array.isArray(d.ids)&&d.ids.length&&d.ids.every(id=>typeof id==='string'&&(d.platform==='spotify'?/^[a-zA-Z0-9]{22}$/:/^[\w-]{11}$/).test(id)))return writePlayer(page,d.platform,d.link,d.ids,progress);
 throw Error('无效播放器请求');
}
