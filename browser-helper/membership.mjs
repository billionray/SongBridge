import {songId} from './core.mjs';
import {uniqueTarget} from './policy.mjs';
export function confirmMember(entry,ids,target){
 if(!target?.url||!entry.candidate||!ids.has(entry.candidate.id))return false;
 entry.verifiedId=entry.candidate.id;entry.verifiedTarget=target.url;
 entry.status=['pending','shelved','added'].includes(entry.status)?'added':'existing';
 delete entry.error;delete entry.notSubmitted;return true;
}
export const containsSong=(songs,candidate)=>!!candidate?.id&&songs.some(s=>s.id===candidate.id);
async function trackScroll(rows,step){
 return rows.first().evaluate((row,step)=>{
  let owner=row.parentElement;
  while(owner&&!(owner.scrollHeight>owner.clientHeight+5&&/(auto|scroll)/.test(getComputedStyle(owner).overflowY)))owner=owner.parentElement;
  owner=owner||document.scrollingElement;
  if(step==='reset')owner.scrollTop=0;
  else owner.scrollTop+=owner.clientHeight*(step==='back'?-.35:.7);
  return owner.scrollTop+owner.clientHeight>=owner.scrollHeight-3;
 },step);
}
async function scroll(page,reset=false){return page.getByRole('main').evaluate((el,reset)=>{
 const nodes=[document.scrollingElement,el,...el.querySelectorAll('*')].filter(n=>n&&n.clientHeight>100&&n.scrollHeight>n.clientHeight+5);
 for(const n of nodes)n.scrollTop=reset?0:Math.min(n.scrollTop+n.clientHeight*.7,n.scrollHeight);
 return nodes.map(n=>[Math.round(n.scrollTop),n.scrollHeight,n.clientHeight]);
},reset)}
const cards=page=>page.locator('[data-testid="lockup-virtual-scrolling-row"] [data-testid="product-lockup"]');
export async function findTarget(page,name){
 await page.goto('https://music.apple.com/cn/library/all-playlists',{waitUntil:'domcontentloaded',timeout:30000});
 const main=page.getByRole('main');
 // The library can briefly display its empty placeholder while loading.
 await Promise.race([cards(page).first().waitFor({state:'visible',timeout:30000}),main.getByRole('heading',{name:'将音乐添加到资料库中',exact:true}).waitFor({timeout:30000})]);
 if(!await cards(page).count()){
  await page.waitForTimeout(5000);
  if(!await cards(page).count()){
   const side=await page.getByRole('navigation').getByRole('list',{name:'播放列表',exact:true}).getByRole('button').count();
   if(side>1)throw Error('歌单列表尚未完成加载，请稍后重试');
   if(await main.getByRole('heading',{name:'将音乐添加到资料库中',exact:true}).isVisible())return null;
   throw Error('无法读取歌单列表，已停止');
  }
 }
 await scroll(page,true);let stable=0,prev='';const found=new Map();
 for(let n=0;n<500;n++){
  const items=await cards(page).evaluateAll(ns=>ns.map((el,i)=>({name:el.querySelector('[data-testid="product-lockup-title"]')?.textContent?.trim(),position:el.closest('[data-testid="lockup-virtual-scrolling-row"]')?.style.top+'|'+[...el.closest('[data-testid="lockup-virtual-scrolling-row"]').querySelectorAll('[data-testid="product-lockup"]')].indexOf(el)})));
  for(const item of items)if(item.name===name.trim())found.set(item.position,item);
  uniqueTarget([...found.values()]);
  const pos=await scroll(page);const sig=JSON.stringify([pos,items]);stable=sig===prev?stable+1:0;prev=sig;
  if(stable===3||stable===4){await page.waitForTimeout(stable===3?5000:10000);continue}if(stable>=5)break;
  if(n===499)throw Error('歌单列表尚未完整读取，已停止');
  await page.waitForTimeout(500);
 }
 if(!found.size)return null;
 await scroll(page,true);
 for(let n=0;n<500;n++){
  const matches=cards(page).filter({has:page.locator('[data-testid="product-lockup-title"]').filter({hasText:new RegExp('^'+name.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})});
  if(await matches.count()===1){await matches.getByRole('link',{name:name.trim(),exact:true}).click();await main.getByRole('heading',{name,exact:true}).waitFor({timeout:30000});const url=page.url();if(!/^https:\/\/music\.apple\.com\/(?:cn\/)?library\/playlist\//.test(url))throw Error('目标不是资料库歌单，已停止');return {url,name}}
  await scroll(page);await page.waitForTimeout(400);
 }
 throw Error('目标歌单位置改变，请重试');
}
export async function readMembers(page,target,progress=()=>{},stopped=()=>false){
 if(page.url()!==target.url)await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:20000});
 const main=page.getByRole('main');
 await main.getByRole('heading',{name:target.name,exact:true}).waitFor({timeout:10000});
 if(new URL(page.url()).pathname.replace(/^\/[a-z]{2}\//,'/')!==new URL(target.url).pathname.replace(/^\/[a-z]{2}\//,'/'))throw Error('目标歌单已改变');
 const count=(await main.innerText()).match(/(?:^|\n)\s*([\d,]+)\s*(?:首歌(?:曲)?|songs?\b)/i);
 const expected=count?Number(count[1].replaceAll(',','')):null;
 const grid=main.getByRole('grid').first();
 const rows=grid.locator('[data-testid="track-list-item"]');
 try{await rows.first().waitFor({state:'attached',timeout:5000})}catch{return []}
 await trackScroll(rows,'reset');
 const collected=new Map();
 let stagnant=0,lastSignature='';
 const deadline=Date.now()+180000;
 while(!stopped()&&Date.now()<deadline){
  const current=await rows.evaluateAll(ns=>ns.map(el=>({
   index:el.getAttribute('data-row'),
   urls:[...el.querySelectorAll('a[href]')].map(a=>a.href)
  })));
  if(!current.length)break;
  for(const row of current){
   const id=row.urls.map(songId).find(Boolean);
   if(id)collected.set(row.index??id,{id});
  }
  progress(collected.size,expected);
  if(expected&&collected.size>=expected)break;
  const bottom=await trackScroll(rows,'forward');
  const signature=JSON.stringify([collected.size,current.at(-1)]);
  stagnant=signature===lastSignature?stagnant+1:0;
  lastSignature=signature;
  if(bottom&&stagnant>=3)break;
  if(bottom){
   await trackScroll(rows,'back');
   await page.waitForTimeout(100);
   await trackScroll(rows,'forward');
  }
  // Wait for the rendered window before taking another step. A static grid
  // can keep the same last row while scrolling, so bound each wait.
  await grid.evaluate((owner,{last,timeout})=>new Promise(resolve=>{
   const changed=()=>{
    const all=owner.querySelectorAll('[data-testid="track-list-item"]');
    const tail=all[all.length-1];
    return tail&&(tail.getAttribute('data-row')!==last.index||
     JSON.stringify([...tail.querySelectorAll('a[href]')].map(a=>a.href))!==JSON.stringify(last.urls));
   };
   if(changed())return resolve();
   const done=()=>{observer.disconnect();clearTimeout(timer);resolve()};
   const observer=new MutationObserver(()=>{if(changed())done()});
   const timer=setTimeout(done,timeout);
   observer.observe(owner,{childList:true,subtree:true,attributes:true});
  }),{last:current.at(-1),timeout:bottom?[4000,5000,8000][stagnant]:2500});
 }
 return [...collected.values()];
}
