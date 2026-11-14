import {originalQuery} from './matching.mjs';
import {songId} from './core.mjs';

export const songRows=page=>page.locator('[data-testid="section-container"][aria-label="歌曲"], [data-testid="section-container"][aria-label="Songs"]').locator('[data-testid="track-lockup"]');
export async function retryRead(operation,wait,stopped=()=>false){
 try{return await operation()}catch(error){
  if(stopped()||!/Timeout|超时|尚未加载|导航|net::ERR_|暂未找到|目标歌单未加载|未找到唯一的“添加/i.test(error.message))throw error;
  await wait(1200);if(stopped())throw error;
  return operation();
 }
}
export function search(page,query,expanded=false,stopped){
 return retryRead(()=>searchOnce(page,query,expanded),ms=>page.waitForTimeout(ms),stopped);
}
async function searchOnce(page,query,expanded){
 await page.goto('https://music.apple.com/cn/search?term='+encodeURIComponent(query),{waitUntil:'commit',timeout:18000});
 await page.waitForURL(u=>u.pathname==='/cn/search'&&u.searchParams.get('term')===query,{waitUntil:'commit',timeout:9000});
 if(!new URL(page.url()).pathname.startsWith('/cn/'))throw Error('网页跳转到了非中国大陆区，请先检查账户地区');
 const rows=songRows(page);
 try{await rows.first().waitFor({state:'attached',timeout:20000})}catch{
  const text=await page.locator('body').innerText();
  if(await page.getByRole('heading',{name:'最佳结果',exact:true}).count())return [];
  if(/没有结果|无结果|未找到|No Results|No results found/.test(text))return [];
  throw Error('搜索结果尚未加载，或 Apple 网页结构已改变；未将它当作无匹配');
 }
 if(expanded){
  const heading=page.getByRole('heading',{name:/^(歌曲|Songs)$/}).getByRole('link');
  if(await heading.count()){
   await heading.click();const grid=page.locator('[data-testid="track-list-item"]');
   await grid.first().waitFor({timeout:5000}).catch(()=>{});
   if(await grid.count())return (await grid.evaluateAll(ns=>ns.map((el,rowIndex)=>({rowIndex,name:el.querySelector('[data-testid="track-title"]')?.textContent?.trim(),artist:el.querySelector('[data-testid="track-column-secondary"]')?.textContent?.trim(),artists:[...el.querySelectorAll('[data-testid="track-column-secondary"] a[href*="/artist/"]')].map(a=>a.textContent.trim()),album:el.querySelector('[data-testid="track-column-tertiary"]')?.textContent?.trim(),durationText:el.querySelector('[data-testid="track-duration"]')?.textContent?.trim(),url:el.querySelector('a[href*="/song/"],a[href*="?i="]')?.href})))).map(c=>({...c,id:songId(c.url),duration:/^\d+:\d{2}$/.test(c.durationText||'')?c.durationText.split(':').reduce((n,s)=>n*60+Number(s),0)*1000:undefined,query,expanded:true})).filter(c=>c.id&&c.name&&c.artist)
  }
 }
 return (await rows.evaluateAll(elements=>elements.map((row,index)=>{
  const title=row.querySelector('[data-testid="track-lockup-title"]');
  const artists=[...row.querySelectorAll('[data-testid="track-lockup-subtitle"] a[href*="/artist/"]')].map(a=>a.textContent.trim());
  return {rowIndex:index,artists,name:title?.textContent?.trim()||'',artist:artists.join(' / ')||row.querySelector('[data-testid="track-lockup-subtitle"]')?.textContent?.trim()||'',url:title?.querySelector('a')?.href||''};
 }))).map(c=>({...c,id:songId(c.url),query})).filter(c=>c.id);
}
export async function locateSelected(page,track,entry,lookup=search){
 const {candidate}=entry;
 const stored=[candidate,...(entry.candidates||[])]
  .find(c=>c.id===candidate.id&&typeof c.query==='string'&&c.query.trim());
 const query=stored?.query??originalQuery(track);
 const firstView=!!(stored?.expanded??candidate.expanded);
 for(const expanded of [firstView,!firstView]){
  const list=await lookup(page,query,expanded);
  const found=list.find(c=>c.id===candidate.id);
  if(found)return found;
 }
 throw Error('该版本暂未找到，可单独重试');
}
export async function openSongMenu(page,candidate){
 const row=(candidate.expanded?page.locator('[data-testid="track-list-item"]'):songRows(page)).nth(candidate.rowIndex);
 const href=await row.locator(candidate.expanded?'a[href*="/song/"],a[href*="?i="]':'[data-testid="track-lockup-title"] a').first().getAttribute('href');
 if(!href||songId(new URL(href,page.url()).href)!==candidate.id)throw Error('搜索结果发生变化，已停止，未点击添加');
 // The icon can render before Apple hydrates its menu button. Clicking the
 // surrounding link-like row opens the album instead of the actions menu.
 const trigger=row.getByRole('button',{name:/更多|more/i}).or(row.locator('button').filter({has:page.locator('[data-testid="more-button"]')})).first();
 await trigger.press('Enter',{timeout:8000});
 await page.getByRole('menu').waitFor({state:'visible',timeout:8000});
}
export async function openPlaylistMenu(page){
 const menu=page.getByRole('menu');
 const add=menu.getByRole('button',{name:/^(添加到歌单|添加到播放列表|添加至播放列表|加入播放列表|Add to Playlist)(…|\.\.\.)?$/i});
 await add.first().waitFor({state:'visible',timeout:5000});
 if(await add.count()!==1)throw Error('未找到唯一的“添加到播放列表”按钮。请确认已登录、订阅有效及同步资料库已开启');
 await add.click();
}
export function playlistId(value){
 const id=String(value||'').match(/^(?:https:\/\/music\.apple\.com)?\/(?:[a-z]{2}\/)?library\/playlist\/(p\.[\w-]+)\/?(?:[?#].*)?$/i);
 return id?.[1]||(/^p\.[\w-]+$/.test(value)?value:null);
}
export async function resolveTargetButton(page,name,target,uniqueInLibrary){
 const buttons=page.getByRole('menu').last().getByRole('button',{name,exact:true});
 const visible=[];
 for(const item of await buttons.all()){
  if(!await item.isVisible())continue;
  const values=await item.evaluate(el=>[el,el.closest('a[href]'),...el.querySelectorAll('a[href]')].filter(Boolean).flatMap(n=>
   ['href','data-playlist-id','data-id'].map(attr=>n.getAttribute(attr)).filter(Boolean)));
  visible.push({item,id:values.map(playlistId).find(Boolean)});
 }
 if(!visible.length)return null;
 const wanted=playlistId(target?.url);
 if(wanted){
  const exact=visible.find(v=>v.id===wanted);
  if(exact)return exact.item;
  if(visible.some(v=>v.id))throw Error('菜单中的歌单 ID 与已保存的目标不符');
 }
 if(visible.length===1||visible[0].id&&visible.every(v=>v.id===visible[0].id))return visible[0].item;
 if(visible.every(v=>!v.id)&&await uniqueInLibrary())return visible[0].item;
 throw Error('无法区分多个同名目标，请在资料库核对歌单名称');
}
export async function waitForAddFeedback(page){
 // Give Apple time to finish the write before navigating away.
 const success=page.getByText(/已添加到歌单|已添加到播放列表|已添加至播放列表|Added to Playlist|Added to playlist/);
 await success.first().waitFor({state:'visible',timeout:3500}).catch(()=>{});
}
export async function createFromSong(page,name,beforeSubmit){
 await page.getByRole('button',{name:'新歌单',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor({state:'visible'});
 await dialog.getByRole('textbox',{name:'歌单标题',exact:true}).fill(name);
 const share=dialog.getByRole('checkbox',{name:'在“我的个人资料”和“搜索”中显示',exact:true});
 if(await share.count())await share.uncheck();
 await beforeSubmit();
 await dialog.getByRole('button',{name:'创建',exact:true}).click();
}

export async function japaneseCatalog(page,ids){
 const response=await page.request.get('https://itunes.apple.com/lookup',{params:{id:ids.join(','),country:'JP',lang:'ja_jp'},timeout:9000});
 try{
  if(!response.ok())return [];
  const data=await response.json();
  return (data.results||[]).filter(c=>c.kind==='song').map(c=>({id:String(c.trackId),name:c.trackName,artist:c.artistName}));
 }finally{await response.dispose()}
}
