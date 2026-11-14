import assert from 'node:assert/strict';
import {chromium} from '../browser-helper/node_modules/playwright-core/index.mjs';
import {browserOptions,playerSession} from '../browser-helper/platform.mjs';
import {platformAction} from '../browser-helper/platform-player.mjs';
const browser=await chromium.launch({...browserOptions(),headless:true});
try{
 for(const platform of ['spotify','ytmusic']){
  const sp=platform==='spotify',host=sp?'https://open.spotify.com':'https://music.youtube.com';
  const link=host+(sp?'/playlist/'+ 'P'.repeat(22):'/playlist?list=PL123');
  const ids=['A','B'].map(c=>c.repeat(sp?22:11)),saved=[ids[0]];
  const page=await browser.newPage();
  await page.route(host+'/**',async route=>{
   const u=new URL(route.request().url());let html='';
   if(u.href===link){
    const rows=saved.map((id,i)=>sp?
     '<div role="row" aria-rowindex="'+(i+2)+'"><a href="/track/'+id+'" data-testid="internal-track-link"><span dir="auto">Song</span><span data-testid="track-artists">Artist</span><span data-testid="track-album">Album</span></a><a href="/artist/a">Artist</a><a href="/album/a">Album</a></div>':
     '<ytmusic-responsive-list-item-renderer><a href="/watch?v='+id+'">Song</a><a href="/channel/a">Artist</a></ytmusic-responsive-list-item-renderer>').join('');
    html=sp?'<title>Test | Spotify</title><div role="grid" data-testid="playlist-tracklist" aria-rowcount="'+(saved.length+1)+'">'+rows+'</div>':
     '<ytmusic-responsive-header-renderer><h1>Test</h1><span>99 tracks</span></ytmusic-responsive-header-renderer><ytmusic-playlist-shelf-renderer><ytmusic-responsive-list-item-renderer unplayable><a href="/watch?v=CCCCCCCCCCC">Grey item</a></ytmusic-responsive-list-item-renderer>'+rows+'</ytmusic-playlist-shelf-renderer>';
   }else if(u.pathname==='/save'){saved.push(ids[1]);return route.fulfill({body:'ok'})}
   else html=sp?'<main><button data-testid="more-button">More</button><button role="menuitem">Add to playlist</button><button role="menuitem" onclick="fetch(\'/save\')">Test</button></main>':
    '<ytmusic-player-bar><ytmusic-menu-renderer><button>Menu</button></ytmusic-menu-renderer></ytmusic-player-bar><ytmusic-menu-service-item-renderer>Save to playlist</ytmusic-menu-service-item-renderer><ytmusic-playlist-add-to-option-renderer onclick="fetch(\'/save\')"><span>Test</span></ytmusic-playlist-add-to-option-renderer>';
   await route.fulfill({contentType:'text/html',body:html});
  });
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
  const write=()=>platformAction(page,'/player-write',{platform,link,ids:[...ids,ids[1]]},()=>{});
  assert.deepEqual(await write(),{added:1,skipped:2});
  assert.deepEqual(await write(),{added:0,skipped:3});
  assert.deepEqual(saved,ids);await page.close();
 }
 console.log('PASS: browser writes, verified membership, duplicates and retry (simulated players)');
}finally{await browser.close()}
