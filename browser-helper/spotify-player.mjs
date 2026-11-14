// Runs in the player DOM for both playlist and search rows.
export function spotifyRows(elements){
 return elements.map(row=>{
  const link=row.querySelector('a[href*="/track/"]');
  const cell=row.querySelector('[role="gridcell"][aria-colindex="2"]');
  const album=row.querySelector('a[href*="/album/"]')?.textContent.trim()||'';
  const people=[...row.querySelectorAll('a[href*="/artist/"]')].map(a=>a.textContent.trim()).filter(Boolean);
  const lines=(cell?.innerText||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const named=row.querySelector('[data-testid="internal-track-link"] [dir="auto"],[data-testid="track-name"]');
  const title=(named||link)?.cloneNode(true);
  title?.querySelectorAll('a[href*="/artist/"],a[href*="/album/"],[data-testid="track-artists"],[data-testid="track-album"]').forEach(el=>el.remove());
  const name=named?.innerText?.trim()||((link?.innerText||'').includes('\n')?link.innerText.trim().split('\n')[0]:title?.textContent.trim())||lines[0]||'';
  const artists=[...new Set(people.length?people:lines.slice(1).filter(s=>s!==album&&s!==name))];
  return {index:Number(row.getAttribute('aria-rowindex'))-1,id:link?.pathname.match(/\/track\/([a-zA-Z0-9]{22})/)?.[1]||'',name,artist:artists.join(' / '),artists,album,url:link?.href,episode:!!row.querySelector('a[href*="/episode/"]')};
 });
}
export async function readPlayer(page,id,progress=()=>{}){
 if(!/^[A-Za-z0-9]{22}$/.test(id))throw Error('Spotify 歌单 ID 无效');
 const url='https://open.spotify.com/playlist/'+id;
 try{await page.goto(url,{waitUntil:'commit',timeout:45000})}
 catch{await page.goto(url,{waitUntil:'commit',timeout:60000})}
 const grid=page.locator('[data-testid="playlist-tracklist"][role="grid"]').first();
 await grid.waitFor({state:'attached',timeout:60000}).catch(()=>{throw Error('播放器未显示歌曲列表，请确认歌单可以访问。')});
 const rows=grid.locator('[role="row"][aria-rowindex]:not([aria-rowindex="1"])');
 const declared=Number(await grid.getAttribute('aria-rowcount'));
 if(!Number.isInteger(declared)||declared<1)throw Error('播放器未提供歌单总数，无法核实完整性');
 const total=declared-1,found=new Map();
 let gap=1,attempts=0;
 while(gap<=total&&attempts<14){
  const batch=await rows.evaluateAll(spotifyRows);
  for(const t of batch)if(t.index>=1&&t.index<=total&&(t.episode||t.name&&t.artists.length))found.set(t.index,t);
  const before=gap;
  while(found.has(gap))gap++;
  progress(found.size,total);
  if(gap>total)break;
  attempts=gap===before?attempts+1:0;
  if(attempts>=4&&found.size&&Math.max(...found.keys())>gap){
   // Some regional catalogs omit individual rows. Continue reading later positions.
   gap++;attempts=0;continue;
  }
  await grid.evaluate((g,index)=>{
   const row=g.querySelector('[role="row"][aria-rowindex]:not([aria-rowindex="1"])');
   if(!row)return;
   let owner=g.parentElement;
   while(owner&&!(owner.scrollHeight>owner.clientHeight+8&&/(auto|scroll|overlay)/.test(getComputedStyle(owner).overflowY)))owner=owner.parentElement;
   owner=owner||document.scrollingElement;
   const rect=row.getBoundingClientRect(),first=Number(row.getAttribute('aria-rowindex'))-1;
   owner.scrollTop+=rect.top-owner.getBoundingClientRect().top+(index-first)*rect.height-owner.clientHeight*.28;
  },gap);
  await page.waitForTimeout(attempts?850:170);
 }
 const name=(await page.title()).split(' - playlist by ')[0].replace(/\s*\| Spotify$/,'').trim()||'Spotify 歌单';
 const tracks=[...found.values()].sort((a,b)=>a.index-b.index).filter(t=>!t.episode).map(t=>({entryId:String(t.index),id:t.id,name:t.name,artists:t.artists,artist:t.artists.join(' / '),album:t.album}));
 if(total&&!tracks.length)throw Error('播放器未加载可识别的曲目，请稍后再次读取');
 return {schemaVersion:1,name,source:{platform:'spotify',url},tracks,warning:'播放器已核对 '+found.size+' / '+total+' 项，可迁移 '+tracks.length+' 首。'+(found.size<total?'清单不完整，尚有 '+(total-found.size)+' 项未读取。':'')};
}
