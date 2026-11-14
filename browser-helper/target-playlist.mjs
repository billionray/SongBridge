// Resolve destinations in the signed-in library; public catalog search also includes other people's lists.
import {playlistUrl} from './platform-player.mjs';

export async function resolvePlayerTarget(page,platform,name,create,beforeCreate){
 const spotify=platform==='spotify';
 const library=spotify?'https://open.spotify.com/collection/playlists':'https://music.youtube.com/library/playlists';
 await page.goto(library,{waitUntil:'domcontentloaded'});
 const region=page.locator(spotify?'main':'ytmusic-browse-response').first();
 const links=region.locator(spotify?'a[href*="/playlist/"]':'a[href*="playlist?list="]');
 const createLabel=/create playlist|new playlist|创建播放列表|新建播放列表|创建歌单|新建歌单/i;
 const createButton=page.getByRole('button',{name:createLabel}).or(region.getByText(createLabel,{exact:true})).first();
 const createMenu=page.getByRole('button',{name:/^(?:create|创建|建立)$/i}).first();
 await links.first().or(createButton).or(createMenu).first().waitFor({state:'attached'});
 const hits=new Set();
 // Library grids may load additional results as the user scrolls.
 let previous='',stable=0;
 for(let step=0;step<500;step++){
  const snapshot=await links.evaluateAll(nodes=>nodes.map(a=>({
   href:a.href,names:[a.textContent,a.getAttribute('aria-label'),a.title,a.closest('[data-testid="card-click-handler"]')?.querySelector('[data-encore-id="cardTitle"]')?.textContent]
  })));
  for(const item of snapshot)if(item.names.some(n=>n?.trim()===name))hits.add(playlistUrl(platform,item.href));
  if(hits.size>1)throw Error('资料库有多个同名歌单，请在播放器中区分名称后重试');

  const bottom=await region.evaluate(el=>{
   let area=el.querySelector('[data-overlayscrollbars-viewport]')||el;
   while(area.parentElement&&area.scrollHeight<=area.clientHeight+2)area=area.parentElement;
   if(area.scrollHeight<=area.clientHeight+2)area=document.scrollingElement;
   area.scrollTop+=Math.max(400,area.clientHeight*.8);
   return area.scrollTop+area.clientHeight>=area.scrollHeight-3;
  });
  const signature=snapshot.map(item=>item.href).join('|');
  stable=bottom&&previous===signature?stable+1:0;previous=signature;
  if(stable>=3)break;
  if(step===499)throw Error('资料库尚未完整载入，请重试');
  await page.waitForTimeout(400);
 }
 if(hits.size)return {name,url:[...hits][0]};
 if(!create)return null;
 // Confirm the library's create control before recording an attempted creation.
 let control=createButton;
 if(!await control.isVisible()&&await createMenu.isVisible()){
  await createMenu.click();
  control=page.getByRole('menuitem',{name:/playlist|歌单|播放列表/i}).first();
 }
 await control.waitFor();
 await beforeCreate();
 await control.click();
 if(spotify){
  await page.waitForURL(u=>u.pathname.includes('/playlist/'));
  await page.locator('main h1').click();
 }
 const dialog=page.getByRole('dialog').or(page.locator('ytmusic-playlist-form')).first();
 const title=dialog.locator('input:not([type=hidden])').first();
 await title.fill(name);
 await dialog.getByRole('button',{name:/^(save|create|保存|创建|建立)$/i}).click();
 await dialog.waitFor({state:'hidden'});
 if(spotify){
  await page.getByRole('heading',{name,exact:true}).first().waitFor();
  return {name,url:playlistUrl(platform,page.url())};
 }
 const result=await resolvePlayerTarget(page,platform,name,false);
 if(!result)throw Error('已提交创建，请稍后重试以核对同名歌单');
 return result;
}
