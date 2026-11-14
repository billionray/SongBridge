import {useEffect,useRef,useState} from 'react';
import Modal from './Modal';
import ReviewDesk from './ReviewDesk';
import type {Source} from './playlist';
type Props={target:"apple"|"spotify"|"ytmusic";activity:(busy:boolean)=>void;ready:(value:boolean)=>void;restore:(playlist:any)=>void;code:string;setCode:(v:string)=>void;source:Source;name:string;tracks:any[]};
export default function BrowserImport({target,name:loadedName,tracks:loadedTracks,source:loadedSource,code,setCode,restore,activity,ready}:Props){
 const [connected,setConnected]=useState(false),[state,setState]=useState<any>(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[confirm,setConfirm]=useState(false);

 const label={apple:'Apple Music',spotify:'Spotify',ytmusic:'YouTube Music'}[target];
 const endpoint=(route:string)=>route+'?platform='+target;
 const sequence=useRef(0),applied=useRef(0);
 async function request(route:string,data?:any){const seq=++sequence.current;const r=await fetch('http://127.0.0.1:17321'+endpoint(route),{method:data===undefined?'GET':'POST',headers:{'X-SongBridge-Code':code.trim(),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(8000)});const d=await r.json();if(!r.ok)throw Error(d.error||'助手请求失败');if(seq>applied.current){applied.current=seq;setState({...d,platform:target})}return d}
 async function action(route:string,data?:any){setPending(true);setError('');try{const d=await request(route,data);if(route==='/status'){if(d.protocol!==12)throw Error('请下载新版助手并覆盖原目录，保留 .state 后重新启动');if(!loadedTracks.length&&d.job?.playlist)restore(d.job.playlist);setConnected(true)};return d}catch(e:any){setError(e.name==='TypeError'||e.name==='TimeoutError'?'无法连接本地助手。请先解压并启动助手；如果浏览器询问本地网络访问权限，请允许。':e.message)}finally{setPending(false)}}
 useEffect(()=>{
  if(!connected)return;
  let alive=true;
  const poll=()=>request('/status').catch(()=>{if(alive){setConnected(false);setError('助手连接已断开，请重新连接查看保存的进度。')}});
  void poll();
  const timer=setInterval(poll,1800);
  return()=>{alive=false;applied.current=++sequence.current;clearInterval(timer)};
 },[connected,code,target]);
 const current=state?.platform===target?state:null;
 const job=current?.job,busy=pending||current?.running,entries=job?.entries||{};
 const saved=job?.playlist;
 const same=!!saved&&(saved.source?.platform??'netease')===loadedSource.platform&&
  (!saved.source?.url||!loadedSource.url||saved.source.url===loadedSource.url)&&saved.name===loadedName&&
  saved.tracks.length===loadedTracks.length&&loadedTracks.every((t,i)=>{
   const other=saved.tracks[i];
   return String(t.id??i)===String(other.id??i)&&t.name===other.name&&t.artist===other.artist&&
    String(t.album??'')===String(other.album??'');
  });
 // Index-based review actions must always use the playlist that owns the helper entries.
 const [followed,setFollowed]=useState<{hash:string;sourceTracks:any[]}|null>(null);
 const live=!!(connected&&job&&current.matching);
 useEffect(()=>{
  if(live)setFollowed({hash:job.hash,sourceTracks:loadedTracks});
 },[live,job?.hash,loadedTracks]);
 const following=!!(job&&!same&&(live||followed?.hash===job.hash&&followed?.sourceTracks===loadedTracks));
 const showing=same||following;
 const tracks:any[]=following?saved.tracks:loadedTracks;
 const name=following?saved.name:loadedName,source=following?saved.source:loadedSource;
 useEffect(()=>{setConfirm(false)},[job?.hash]);
 useEffect(()=>{activity(!!busy);return ()=>activity(false)},[busy,activity]);
 useEffect(()=>{ready(!!(connected&&showing));return ()=>ready(false)},[connected,showing,ready]);
 const indices=showing?Object.keys(entries).map(Number).filter(i=>['matched','pending'].includes(entries[i].status)&&(entries[i].checked??entries[i].status==='matched')):[];
 const selectedIndices=new Set(indices);
 function scan(mode:string,index?:number){let reading;if(mode==='romaji'&&index!=null){const current=entries[index]?.reading;const title=window.prompt('可修正歌名罗马音，留空使用词典',current?.name||'');if(title===null)return;const artist=window.prompt('可修正艺人罗马音，留空使用词典',current?.artist||'');if(artist===null)return;reading={name:title,artist}}return action('/scan',{playlist:{name,source,tracks:tracks.map(({id,name,artist,album,duration,artists,isrc})=>({id,name,artist,album,duration,artists,isrc}))},mode,index,reading})}
 function report(){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(job,null,2)],{type:'application/json'}));a.href=url;a.download='SongBridge-浏览器导入报告.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className='browser-panel' aria-label={label+' 导入'}><section className="setup"><div className="helper-heading"><strong>{connected?'桌面助手已连接':'连接桌面助手'}</strong><a href="./downloads/songbridge-helper.zip" download>下载助手</a></div><div className='input-row'><input aria-label='助手连接码' type='password' placeholder='粘贴助手显示的连接码' autoComplete='off' value={code} disabled={connected} onChange={e=>setCode(e.target.value)}/><button disabled={pending||busy||!code.trim()} onClick={()=>connected?setConnected(false):action('/status')}>{connected?'断开网页连接':'连接助手'}</button></div></section>{error&&<p role='alert' className='notice'>{error}</p>}{connected&&<>{current?.message&&<div role='status' className='notice'>{current.message}</div>}<div className='actions'><button disabled={busy||!current} onClick={()=>action('/login',{})}>打开 {label} 登录</button><button disabled={busy||!current||!tracks.length} onClick={()=>scan('auto')}>开始匹配</button>{showing&&<button disabled={busy} onClick={()=>action("/continue",{hash:job.hash})}>继续匹配</button>}{current?.running&&<button onClick={()=>action('/stop',{})}>暂停</button>}{job&&<><button disabled={busy||!showing} onClick={()=>action('/recheck',{hash:job.hash})}>仅核对目标歌单</button><button onClick={report}>下载报告</button></>}</div>{job&&!same&&<p>{following?'正在显示助手任务':'助手当前任务为'}「{saved.name}」。
 {following&&!busy?<button onClick={()=>setFollowed(null)}>返回当前来源清单</button>:
 !following&&<button onClick={()=>restore(saved)}>加载助手任务清单</button>}</p>}{showing&&<><p>已匹配 {Object.values(entries).filter((e:any)=>e.status==='matched').length} 首 · 已确认添加 {Object.values(entries).filter((e:any)=>e.status==='added').length} 首 · 已跳过 {Object.values(entries).filter((e:any)=>e.status==='existing').length} 首 · 未提交 {Object.values(entries).filter((e:any)=>e.notSubmitted).length} 首 · 结果待核对 {Object.values(entries).filter((e:any)=>e.status==='pending').length} 首</p><ReviewDesk key={job.hash} tracks={tracks} name={name} review recordingLabel={label} recording={i=>entries[i]?.candidate} rows={tracks.map((t,i)=>{const e=entries[i];return {checked:selectedIndices.has(i),risk:e?.risk,reason:e?.reason,checkLabel:'浏览器选择 '+t.name,disabled:busy||!['matched','pending','shelved'].includes(e?.status),toggle:()=>action('/check',{hash:job.hash,index:i,checked:!selectedIndices.has(i)}),status:e?.notSubmitted?'未提交':({pending:'待核对',shelved:'已搁置',added:'已添加',existing:'已存在',matched:e?.risk==='credits'||e?.risk==='spelling'?'需核对':'已匹配',review:'需手选',search_error:'搜索失败',unmatched:'未找到'} as any)[e?.status]||'等待匹配'}})} detail={i=>{const e=entries[i];return <><h4>{label} 版本</h4>{e?.candidates?.length?<><select aria-label={`浏览器版本 ${i+1}`} disabled={pending||(current.running&&!current.matching)||['pending','added','existing'].includes(e.status)} value={e.candidate?.id||''} onChange={ev=>action('/select',{index:i,id:ev.target.value,hash:job.hash})}><option value='' disabled>选择正确版本</option>{e.candidates.map((c:any)=><option value={c.id} key={c.id}>{c.name} · {c.artist}{c.matchReason?' · '+c.matchReason:''}</option>)}</select></>:null}{e?.notSubmitted&&<strong>未提交，可重试</strong>}{e?.error&&<small>{e.error}</small>}{e?.reason&&<small className={'risk-'+(e.status==='review'?'manual':e.risk||'none')}>{e.reason}</small>}{e?.reading&&<small>罗马音 {e.reading.name} · {e.reading.artist}</small>}{e&&!e.userReviewed&&['matched','review','unmatched','search_error'].includes(e.status)&&<details><summary>单曲重搜</summary>{[['exact','精确'],['smart','智能'],['romaji','罗马音 / 修正读音']].map(([mode,label])=><button key={mode} disabled={busy} onClick={()=>scan(mode,i)}>{label}</button>)}</details>}<small>{({shelved:'已搁置，可勾选重试',matched:'已匹配',review:'需要手动确认',unmatched:'未找到歌曲',search_error:'搜索失败，可继续匹配',pending:'待核对 · 可勾选重试',added:'已确认添加',existing:'已存在 · 已跳过'} as any)[e?.status]||'等待匹配'}</small></>}}/><button className='primary' disabled={busy||!indices.length} onClick={()=>setConfirm(true)}>{job?.phase==='error'?'继续读取并导入':'确认并导入'} {indices.length} 首</button></> }</>}{confirm&&<Modal label='确认浏览器导入' onDismiss={()=>setConfirm(false)}><h2>导入「{name}」</h2><p>通过浏览器导入已选的 {indices.length} 首歌曲。同名歌单存在则继续添加，否则新建。已有歌曲和本次重复项自动跳过；单首结果待核对时继续处理其余歌曲。</p><div className='actions'><button onClick={()=>setConfirm(false)}>返回核对</button><button className='primary' onClick={()=>{setConfirm(false);action('/import',{indices,hash:job.hash})}}>确认导入</button></div></Modal>}</section>
}
