import {useRef,useState} from 'react';
import ReviewDesk from './ReviewDesk';
import Modal from './Modal';
import {playerRequest,type Candidate,type Target} from './playerHelper';
import type {Song} from './playlist';
type Row={options:Candidate[];id:string;checked:boolean;searched?:boolean;manual?:boolean;risk?:string;reason?:string};
const empty=():Row=>({options:[],id:'',checked:false});
export default function PlatformImport({active,target,name,tracks,activity,code,setCode}:{code:string;setCode:(v:string)=>void;active:boolean;target:Target;name:string;tracks:Song[];activity:(v:boolean)=>void}){
 const label=target==='spotify'?'Spotify':'YouTube Music';
 const [link,setLink]=useState(''),[rows,setRows]=useState<Row[]>(()=>tracks.map(empty)),[message,say]=useState(''),[operation,working]=useState<'matching'|'other'|null>(null),[confirm,ask]=useState(false);
 const busy=operation!==null;
 const selected=rows.filter(r=>r.checked&&r.id);
 function change(i:number,patch:Partial<Row>){setRows(prev=>prev.map((r,j)=>j===i?{...r,...patch}:r))}
 async function run(fn:()=>Promise<void>,kind:'matching'|'other'='other'){
  working(kind);activity(true);say('');
  try{await fn()}catch(e:any){say(e.message)}finally{working(null);activity(false)}
 }
 const stop=useRef(false),manual=useRef(new Set<number>());
 const [started,setStarted]=useState(false);
 async function match(resume=false,index?:number,mode='auto'){
  let reading;
  if(mode==='romaji'&&index!==undefined){
   const name=window.prompt('可修正歌名罗马音，留空使用词典','');if(name===null)return;
   const artist=window.prompt('可修正艺人罗马音，留空使用词典','');if(artist===null)return;
   reading={name,artist};
  }
  stop.current=false;setStarted(true);
  const indices=tracks.map((_,i)=>i).filter(i=>index!==undefined?i===index:!manual.current.has(i)&&(!rows[i].id||resume&&!rows[i].checked));
  for(const [pos,i] of indices.entries()){
   if(stop.current)break;
   if(manual.current.has(i))continue;
   say('正在匹配 '+(pos+1)+' / '+indices.length);
   const result=await playerRequest<{options:Candidate[];id:string;risk:string;reason:string}>(code,'/player-match',{platform:target,track:tracks[i],mode,reading});
   if(!manual.current.has(i))change(i,{...result,checked:!!result.id,searched:true});
  }
  say(stop.current?'已暂停匹配，可继续。':'匹配完成，请核对候选版本。');
 }
 if(!active)return null;
 return <section className="browser-panel" aria-label={label+' 导入'}>
  <div className="input-row"><input aria-label={label+' 助手连接码'} type="password" placeholder="桌面助手连接码" disabled={busy} value={code} onChange={e=>setCode(e.target.value)}/><button disabled={busy||!code.trim()} onClick={()=>run(async()=>{await playerRequest(code,'/player-login',{platform:target});say('请在助手浏览器登录 '+label+'，完成后返回匹配歌曲')})}>连接 {label}</button>
  <button disabled={!code.trim()||busy} onClick={()=>run(()=>match(),'matching')}>开始匹配</button>{started&&<button disabled={busy||!code.trim()} onClick={()=>run(()=>match(true),'matching')}>继续匹配</button>}{operation==='matching'&&<button onClick={()=>{stop.current=true;say('正在结束当前歌曲的匹配…')}}>暂停</button>}</div>
  <div className="input-row"><input aria-label={label+' 目标歌单链接'} placeholder="粘贴可编辑的目标歌单链接" value={link} disabled={busy} onChange={e=>setLink(e.target.value)}/></div>
  {message&&<p role="status" className="notice">{message}</p>}
  <ReviewDesk name={name} tracks={tracks} review recordingLabel={label} recording={i=>rows[i].options.find(c=>c.id===rows[i].id)} rows={rows.map((r,i)=>({checked:r.checked,risk:r.risk,reason:r.reason,disabled:busy||!r.id,toggle:()=>change(i,{checked:!r.checked}),status:r.id?(r.risk==='credits'||r.risk==='spelling'?'需核对':'已匹配'):r.options.length?'需手选':r.searched?'未找到':'待匹配'}))}
   detail={i=><><label>{label} 版本<select disabled={operation==='other'||!rows[i].options.length} value={rows[i].id} onChange={e=>{const id=e.target.value;if(id)manual.current.add(i);else manual.current.delete(i);change(i,{id,manual:!!id,checked:!!id,risk:'none',reason:id?'已手动选择':''})}}><option value="">请选择版本</option>{rows[i].options.map(c=><option key={c.id} value={c.id}>{c.name} · {c.artist} {c.album}</option>)}</select></label>{rows[i].id&&<a href={rows[i].options.find(c=>c.id===rows[i].id)?.url} target="_blank" rel="noreferrer">在 {label} 查看</a>}{rows[i].reason&&<small className={!rows[i].id&&rows[i].options.length?'risk-manual':undefined}>{rows[i].reason}</small>}{rows[i].searched&&!rows[i].manual&&<details><summary>单曲重搜</summary>{[['exact','精确'],['smart','智能'],['romaji','罗马音 / 修正读音']].map(([mode,text])=><button key={mode} disabled={busy} onClick={()=>run(()=>match(false,i,mode),'matching')}>{text}</button>)}</details>}</>}/>
  <button className="primary" disabled={busy||!selected.length||!link.trim()||!code.trim()} onClick={()=>ask(true)}>导入已选的 {selected.length} 首</button>
  {confirm&&<Modal label="确认导入" onDismiss={()=>ask(false)}><h2>导入到 {label}</h2><p>将 {selected.length} 首加入目标歌单 {link}。已有曲目会跳过。</p><div className="actions"><button onClick={()=>ask(false)}>返回核对</button><button onClick={()=>{ask(false);run(async()=>{const r=await playerRequest<{added:number;skipped:number}>(code,'/player-write',{platform:target,link,ids:selected.map(r=>r.id)});say('导入完成，新增 '+r.added+' 首，跳过 '+r.skipped+' 首')})}}>确认导入</button></div></Modal>}
 </section>
}
