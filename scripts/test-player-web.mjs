import assert from 'node:assert/strict';
import {chromium} from '../browser-helper/node_modules/playwright-core/index.mjs';
import {browserOptions,playerSession} from '../browser-helper/platform.mjs';
import {platformAction,writePlayer} from '../browser-helper/platform-player.mjs';
import {resolvePlayerTarget} from '../browser-helper/target-playlist.mjs';
const browser=await chromium.launch({...browserOptions(),headless:true});
try{
 for(const platform of ['spotify','ytmusic']){
  const sp=platform==='spotify',host=sp?'https://open.spotify.com':'https://music.youtube.com';
  const link=host+(sp?'/playlist/'+ 'P'.repeat(22):'/playlist?list=PL123');
  const ids=['A','B'].map(c=>c.repeat(sp?22:11)),saved=[ids[0]];
  const page=await browser.newPage();
  let duplicate=false,created='';
  await page.route(host+'/**',async route=>{
   const u=new URL(route.request().url());let html='';
   if(u.pathname==='/collection/playlists'||u.pathname==='/library/playlists'){
    const tag=sp?'main':'ytmusic-browse-response';
    const other=link.replace(sp?'P'.repeat(22):'PL123',sp?'Q'.repeat(22):'PL456');
    html='<'+tag+'><a href="'+link+'">Test</a>'+(duplicate?'<a href="'+other+'">Test</a>':'')+(created?'<a href="'+link+'">'+created+'</a>':'')+'<button onclick="'+(sp?"location.href='"+link+"'":"document.querySelector('dialog').showModal()")+'">Create playlist</button></'+tag+'>';
   }else if(u.href===link){
    const rows=saved.map((id,i)=>sp?
     '<div role="row" aria-rowindex="'+(i+2)+'"><a href="/track/'+id+'" data-testid="internal-track-link"><span dir="auto">Song</span><span data-testid="track-artists">Artist</span><span data-testid="track-album">Album</span></a><a href="/artist/a">Artist</a><a href="/album/a">Album</a></div>':
     '<ytmusic-responsive-list-item-renderer><a href="/watch?v='+id+'">Song</a><a href="/channel/a">Artist</a></ytmusic-responsive-list-item-renderer>').join('');
    html=sp?'<title>Test | Spotify</title><div role="grid" data-testid="playlist-tracklist" aria-rowcount="'+(saved.length+1)+'">'+rows+'</div>':
     '<ytmusic-responsive-header-renderer><h1>Test</h1><span>99 tracks</span></ytmusic-responsive-header-renderer><ytmusic-playlist-shelf-renderer><ytmusic-responsive-list-item-renderer unplayable><a href="/watch?v=CCCCCCCCCCC">Grey item</a></ytmusic-responsive-list-item-renderer>'+rows+'</ytmusic-playlist-shelf-renderer>';
   }else if(u.pathname==='/save'){saved.push(ids[1]);return route.fulfill({body:'ok'})}
   else html=sp?'<main><button data-testid="more-button">More</button><button role="menuitem">Add to playlist</button><button role="menuitem" onclick="fetch(\'/save\')">Test</button></main>':
    '<ytmusic-player-bar><ytmusic-menu-renderer><button>Menu</button></ytmusic-menu-renderer></ytmusic-player-bar><ytmusic-menu-service-item-renderer>Save to playlist</ytmusic-menu-service-item-renderer><ytmusic-playlist-add-to-option-renderer onclick="fetch(\'/save\')"><span>Test</span></ytmusic-playlist-add-to-option-renderer>';
   if(u.pathname==='/created'){created='New Mix';return route.fulfill({body:'ok'})}
   if(sp&&u.href===link)html+='<main><h1 onclick="document.querySelector(&quot;dialog&quot;).showModal()">Test</h1></main>';
   html+=`<dialog><input><button onclick="fetch('/created').then(()=>{const h=document.querySelector('h1');if(h)h.textContent='New Mix';document.querySelector('dialog').close()})">Save</button></dialog>`;
   await route.fulfill({contentType:'text/html',body:html});
  });
  assert.deepEqual(await resolvePlayerTarget(page,platform,'Test',false),{name:'Test',url:link});
  assert.equal(await resolvePlayerTarget(page,platform,'Absent',false),null);
  let attemptsToCreate=0;
  assert.deepEqual(await resolvePlayerTarget(page,platform,'New Mix',true,()=>{attemptsToCreate++}),{name:'New Mix',url:link});
  assert.equal(attemptsToCreate,1);
  duplicate=true;
  await assert.rejects(resolvePlayerTarget(page,platform,'Test',true),/多个同名/);
  if(sp){
   const read=await platformAction(page,'/player-read',{platform,link});
   assert.deepEqual(read.tracks.map(t=>[t.name,t.artist,t.album]),[['Song','Artist','Album']]);
   const isolated=await browser.newContext();
   const sourcePage=await isolated.newPage();
   await sourcePage.goto('data:text/html,Spotify');
   const session=playerSession(async()=>isolated);
   assert.equal(await session.getPage(),sourcePage);
   const spare=await isolated.newPage();
   let attempts=0;
   await session.read(async current=>{
    if(++attempts===1)await current.close();
    await current.goto('data:text/html,<title>Matching</title>');
    assert.equal(current,spare);
   });
   assert.equal(attempts,2);
   await isolated.close();

  }else{
   const read=await platformAction(page,'/player-read',{platform,link});
   assert.deepEqual(read.tracks.map(t=>t.id),saved);
   assert.match(read.warning,/跳过 1 条灰色条目/);
  }
  const write=()=>writePlayer(page,platform,link,[...ids,ids[1]],()=>{});
  assert.deepEqual(await write(),{added:1,skipped:2});
  assert.deepEqual(await write(),{added:0,skipped:3});
  assert.deepEqual(saved,ids);await page.close();
 }
 console.log('PASS: browser writes, verified membership, duplicates and retry (simulated players)');
}finally{await browser.close()}
