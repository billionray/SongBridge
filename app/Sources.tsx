import {useEffect,useState,type ReactNode} from 'react';
import {fromText,readFileContent,type Playlist} from './playlist';
import {playlistId} from './spotify';
import {playerRequest} from './playerHelper';
import {readers} from './sourceReaders';
type Props={destination:ReactNode;code:string;setCode:(v:string)=>void;locked:boolean;load:(p:Playlist)=>void;busy:(s:string)=>void;notice:(s:string)=>void};
export default function Sources({destination,locked,load,busy,notice,code,setCode}:Props){
 const [source,setSource]=useState<keyof typeof readers>('netease'),[link,setLink]=useState(''),[lists,setLists]=useState<Playlist[]>([]),[manual,setManual]=useState(false),[raw,setRaw]=useState('');
 async function run(fn:()=>Promise<Playlist|void>){
  busy('正在读取歌单…');try{const p=await fn();if(p)load(p)}catch(e:any){notice(e.message)}finally{busy('')}
 }
 useEffect(()=>{
  const sample=new URLSearchParams(location.search).get('spotify');if(sample&&/^[A-Za-z0-9]{22}$/.test(sample)){setSource('spotify');setLink('https://open.spotify.com/playlist/'+sample);return}
 },[]);
 const [fieldError,setFieldError]=useState('');
 function startPlayer(){
  let msg='',field='source-link';
  if(source!=='spotify'&&!link.trim())msg='请粘贴歌单分享链接';
  if(source==='spotify')try{playlistId(link)}catch{msg='请在歌单链接框粘贴 Spotify 歌单链接。'}
  if(!msg&&!code.trim()){msg='请输入本地助手窗口显示的连接码。';field='player-code'}
  setFieldError(msg);if(msg){document.getElementById(field)?.focus();return}void run(()=>source==='spotify'?player():playerRequest<Playlist>(code,'/player-read',{platform:source,link}));
 }
 async function player(){
  const id=playlistId(link);
  busy('正在通过本地助手读取 Spotify 播放器…');
  let active=true;
  const timer=setInterval(async()=>{
   try{const r=await fetch('http://127.0.0.1:17321/spotify-progress',{headers:{'X-SongBridge-Code':code.trim()},signal:AbortSignal.timeout(2000)});
    if(r.ok){const d=await r.json();if(active&&d.message?.includes('Spotify'))busy(d.message)}
   }catch{}
  },1800);
  let response;
  try{response=await fetch('http://127.0.0.1:17321/spotify-player',{method:'POST',headers:{'Content-Type':'application/json','X-SongBridge-Code':code.trim()},body:JSON.stringify({id})})}catch{throw Error('无法连接本地助手，请启动助手并允许本地网络访问')}finally{active=false;clearInterval(timer)}
  if(response.status===404)throw Error('请下载新版助手，覆盖原目录后重新启动');
  const d=await response.json();if(!response.ok)throw Error(d.error||'读取失败');return d as Playlist;
 }
 async function files(input:HTMLInputElement){
  const selected=Array.from(input.files??[]);input.value='';if(!selected.length)return;
  busy('正在读取文件…');try{
   const choices=(await Promise.all(selected.map(async f=>readFileContent(f.name,await f.text())))).flat();
   setLists(choices);if(choices.length===1)load(choices[0]);else notice('请选择要迁移的歌单');
  }catch(e:any){notice('文件读取失败：'+e.message)}finally{busy('')}
 }
 const reader=readers[source];
 const helperOnly=!('read' in reader);
 const helperControls=<div className="input-row"><input id="player-code" type="password" aria-label={readers[source].label+' 本地助手连接码'} autoComplete="off" placeholder="本地助手连接码" disabled={locked} value={code} onChange={e=>{setCode(e.target.value);setFieldError('')}}/><button type="button" disabled={locked||!code.trim()} onClick={()=>run(async()=>{await playerRequest(code,'/player-login',{platform:source});notice('请在助手打开的浏览器中登录，然后返回读取歌单')})}>打开网页登录</button><button type="submit" className="primary" disabled={locked}>读取歌单</button></div>;
 return <div className="source">
 <h2>读取歌单</h2><div className="source-route"><div className="route-field"><div className="actions" role="group" aria-label="来源平台">{(Object.keys(readers) as (keyof typeof readers)[]).map(s=><button aria-pressed={source===s} key={s} disabled={locked} onClick={()=>{if(s!==source){setSource(s);setLink('');setFieldError('')}}}>{readers[s].label}</button>)}</div></div>{destination}</div>
 <form onSubmit={e=>{e.preventDefault();if(locked)return;if(helperOnly){startPlayer();return}if(!link.trim())return;void run(()=>reader.read(link))}}>
 <div className="input-row"><input id="source-link" aria-label={readers[source].label+' 歌单链接'} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={readers[source].placeholder} value={link} disabled={locked} onChange={e=>{setLink(e.target.value);setFieldError('')}}/>{!helperOnly&&<button className="primary" disabled={locked||!link.trim()}>读取歌单</button>}</div>
 {helperOnly&&helperControls}
 {fieldError&&<p role="alert">{fieldError}</p>}</form>
 {lists.length>1&&<label>选择歌单 <select key={lists.map(p=>p.name).join('|')} defaultValue="" disabled={locked} onChange={e=>load(lists[Number(e.target.value)])}><option value="" disabled>选择要载入的歌单</option>{lists.map((p,i)=><option key={i} value={i}>{p.name} · {p.tracks.length} 首</option>)}</select></label>}
 <div className="alternate"><label className="file">导入备份文件<input type="file" multiple accept=".json,.txt" disabled={locked} onChange={e=>void files(e.currentTarget)}/></label><button className="text-button" disabled={locked} aria-expanded={manual} onClick={()=>setManual(!manual)}>手动粘贴清单</button>{helperOnly&&<a className="text-button" href="./downloads/songbridge-helper.zip" download>下载助手</a>}</div>{manual&&<div className="manual"><label>每行一首，歌名、艺人、专辑用 Tab 分隔<textarea value={raw} onChange={e=>setRaw(e.target.value)}/></label><button disabled={locked} onClick={()=>{try{load(fromText(raw,'手动导入的歌单'));setManual(false)}catch(e:any){notice(e.message)}}}>载入清单</button></div>}</div>
}

