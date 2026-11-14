import {readQQPlaylist} from './qq.ts';
async function netease(path:string):Promise<any>{
 const r=await fetch('https://music.163.com'+path,{headers:{Referer:'https://music.163.com/','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('网易云暂时无法访问，请稍后重试');
 return r.json();
}
export async function POST(request:Request){try{
 const text=await request.text();if(text.length>4000)throw Error('链接过长');
 const {link,platform}=JSON.parse(text);if(typeof link!=='string')throw Error('请输入歌单链接或 ID');
 if(platform==='qq')return await readQQPlaylist(link);
 let id=link.trim();
 if(!/^\d{1,20}$/.test(id)){
  const m=id.match(/https?:\/\/(?:y\.)?music\.163\.com\/[^\s]*/);if(!m)throw Error('请提供 music.163.com 完整歌单链接或数字 ID');
  const u=new URL(m[0]);id=u.searchParams.get('id')||u.hash.match(/[?&]id=(\d+)/)?.[1]||u.pathname.match(/\/playlist\/(\d+)/)?.[1]||'';
  if(!/playlist/.test(u.pathname+u.hash)||!/^\d{1,20}$/.test(id))throw Error('未找到歌单 ID，短分享链接请先在浏览器打开后复制完整地址');
 }
 let d=await netease(`/api/playlist/detail?id=${id}`);let p=d.result||d.playlist;
 if(d.code!==200||!p||!Array.isArray(p.tracks)){
  d=await netease(`/api/v6/playlist/detail?id=${id}&n=1000&s=0`);p=d.playlist;
 }
 if(d.code!==200||!p||!Array.isArray(p.tracks))throw Error('无法读取歌单，请确认歌单公开；接口也可能限制请求，可手动导入');
 const byId=new Map<string,any>(p.tracks.map((t:any)=>[String(t.id),t]));
 const ids:string[]=Array.isArray(p.trackIds)&&p.trackIds.length?p.trackIds.map((t:any)=>String(t.id)):p.tracks.map((t:any)=>String(t.id));
 const wanted=ids.slice(0,5000);const missing=[...new Set(wanted.filter(x=>!byId.has(x)&&/^\d+$/.test(x)))];
 let batchFailed=false;
 for(let i=0;i<missing.length;i+=100){
  try{const batch=await netease('/api/song/detail?ids='+encodeURIComponent(JSON.stringify(missing.slice(i,i+100))));if(batch.code!==200||!Array.isArray(batch.songs))throw Error('歌曲详情读取失败');for(const t of batch.songs)byId.set(String(t.id),t)}catch{batchFailed=true;break}
 }
 const tracks=wanted.map(x=>byId.get(x)).filter(Boolean).map((t:any)=>({id:String(t.id),name:t.name,artist:(t.artists||t.ar||[]).map((a:any)=>a.name).join(' / '),album:(t.album||t.al)?.name||'',duration:t.duration||t.dt}));
 if(!tracks.length)throw Error('未读取到歌曲，歌单可能为空或受限');
 const total=Number(p.trackCount)||ids.length;const missingIds=wanted.filter(x=>!byId.has(x));
 const warning=tracks.length<total?`歌单标记有 ${total} 首，已读取 ${tracks.length} 首。清单不完整，请补充缺失歌曲。${batchFailed?'部分歌曲详情请求失败，可重试。':''}${ids.length>5000?'单次最多读取 5000 首。':''}`:`已读取 ${tracks.length} / ${total} 首歌曲，歌曲顺序与原歌单一致。`;
 return Response.json({name:p.name,source:{platform:"netease",url:"https://music.163.com/playlist?id="+id},tracks,total,missingIds,warning},{headers:{'Cache-Control':'no-store'}});
 }catch(e:any){return Response.json({error:e.name==='TimeoutError'?'歌单请求超时，请稍后重试或手动导入':e.message||'读取失败'},{status:400})}}
