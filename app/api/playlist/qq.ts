export async function readQQPlaylist(link:string){
 let id=link.trim();
 if(!/^\d{1,20}$/.test(id)){
  const raw=id.match(/https?:\/\/[^\s]+/)?.[0];
  if(!raw)throw Error('请输入 QQ 音乐歌单链接或数字 ID');
  const url=new URL(raw);
  if(!['y.qq.com','i.y.qq.com'].includes(url.hostname))throw Error('请在浏览器打开分享链接，再复制 QQ 音乐歌单完整地址');
  id=url.pathname.match(/\/playlist\/(\d+)(?:\.html)?\/?$/)?.[1]||
   (/\/(?:taoge|playsquare)\.html$/.test(url.pathname)?url.searchParams.get('id')||'':'');
  if(!/^\d{1,20}$/.test(id))throw Error('未找到 QQ 音乐歌单 ID，请复制完整歌单地址');
 }
 const endpoint='https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&format=json&disstid='+id;
 const response=await fetch(endpoint,{headers:{Referer:'https://y.qq.com/'},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('QQ 音乐暂时无法访问，请稍后重试');
 const data=await response.json();
 const playlist=data.cdlist?.[0];
 if(data.code!==0||!playlist||!Array.isArray(playlist.songlist))throw Error('无法读取 QQ 音乐歌单，请确认链接有效且歌单已公开');
 const tracks=playlist.songlist.map((song:any)=>({
  id:String(song.songmid||song.songid||''),name:song.songname,
  artist:(song.singer||[]).map((person:any)=>person.name).join(' / '),
  album:song.albumname||'',duration:Number(song.interval)*1000
 }));
 const total=Number(playlist.songnum);
 if(!tracks.length)throw Error('未读取到歌曲，歌单可能为空或受限');
 const warning=tracks.length===total?`已读取 ${total} / ${total} 首歌曲，歌曲顺序与原歌单一致。`:
  `已读取 ${tracks.length} 首，${Number.isInteger(total)?'歌单标注 '+total+' 首。':'平台未提供总数。'}清单完整性未确认。`;
 return Response.json({name:playlist.dissname,source:{platform:'qq',url:'https://y.qq.com/n/ryqq/playlist/'+id},tracks,total,warning},{headers:{'Cache-Control':'no-store'}});
}
