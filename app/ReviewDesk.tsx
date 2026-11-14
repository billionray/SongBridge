import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {Song} from './playlist';

export type DeskRow={checked:boolean;risk?:string;reason?:string;status:string;toggle?:()=>void;checkLabel?:string;disabled?:boolean};
type Recording={name:string;artist:string;album?:string;duration?:number;url?:string};
function RecordingInfo({label,song}:{label:string;song:Recording}){
 return <div><small>{label}</small><strong>{song.name}</strong><p>{song.artist}</p><p>{song.album||"—"} {song.duration?Math.floor(song.duration/60000)+":"+String(Math.floor(song.duration/1000)%60).padStart(2,"0"):""}</p>{song.url&&<a href={song.url} target="_blank" rel="noreferrer">查看歌曲 ↗</a>}</div>
}
type Props={recordingLabel?:string;recording?:(index:number)=>Recording|undefined;tracks:Song[];rows:DeskRow[];detail:(index:number)=>ReactNode;review:boolean;name:string};
function needsAttention(row:DeskRow){
 return ['spelling','credits','conflict'].includes(row.risk??'')||['需手选','搜索失败','待核对','未提交'].includes(row.status);
}
type View='all'|'unchecked'|'review';
export default function ReviewDesk({tracks,rows,detail,review,name,recording,recordingLabel="Apple Music"}:Props){
 const [view,setView]=useState<View>('all'),[focus,setFocus]=useState(0),[opened,setOpened]=useState(false);
 const list=useRef<HTMLDivElement>(null);
 const currentView=review?view:'all';
 const visible=rows.flatMap((r,i)=>currentView==='all'||(currentView==='unchecked'?!r.checked:needsAttention(r))?[i]:[]);
 const active=visible.includes(focus)?focus:visible.find(i=>i>focus)??visible.at(-1);
 const destination=active!=null?recording?.(active):undefined;
 const pos=visible.indexOf(active??-1);
 const source=active==null?null:tracks[active];
 useEffect(()=>{if(active!=null&&active!==focus)setFocus(active)},[active,focus]);
 function navigate(i:number){setFocus(i);setOpened(true);list.current?.querySelector('[data-index="'+i+'"]')?.scrollIntoView({block:'nearest'})}
 const unchecked=rows.filter(r=>!r.checked).length,needsReview=rows.filter(r=>needsAttention(r)).length;
 return <section className={'desk'+(opened&&source?' detail-open':'')} aria-label={name+' 歌曲核对'}>
  <div className="desk-list"><div className="desk-heading"><strong>歌曲清单</strong>{review&&<label><select aria-label="核对视图" value={view} onChange={e=>setView(e.target.value as View)}>
   <option value="all">全部 · {rows.length}</option><option value="unchecked">只看未选择 · {unchecked}</option><option value="review">只看需要核对的 · {needsReview}</option>
  </select></label>}</div>
  <div className="song-scroll" ref={list}><table><thead><tr><th>源序号</th>{review&&<th>选择</th>}<th>来源歌曲</th>{review&&<th>状态</th>}</tr></thead><tbody>{visible.map(i=>{
   const r=rows[i],t=tracks[i];
   const target=review&&r.status==='需核对'?recording?.(i):undefined;
   return <tr key={i} data-index={i} aria-current={active===i} onClick={()=>{setFocus(i);setOpened(true)}}>
    <td>{i+1}</td>{review&&<td onClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={r.checkLabel||'选择 '+t.name} checked={r.checked} disabled={!r.toggle||r.disabled} onChange={r.toggle}/></td>}
    <td><button className="track-link" onClick={()=>{setFocus(i);setOpened(true)}}>{t.name}</button><small>{t.artist}</small></td>{review&&<td><span className={'row-risk '+(r.status==='需手选'?'risk-manual':r.risk||'none')}>{r.status}</span>{target&&<><small>{target.name} · {target.artist}</small><small>{r.reason}</small></>}</td>}</tr>
  })}</tbody></table>{!visible.length&&<p className="desk-empty">{view==='review'?'没有需要核对的歌曲':'没有未选择的歌曲'}</p>}</div></div>
  <aside className="song-detail">{source&&active!=null?<><div className="detail-nav"><button className="back-list" onClick={()=>setOpened(false)}>返回清单</button><span>源序号 {active+1}</span><div><button aria-label="上一首" disabled={pos<=0} onClick={()=>navigate(visible[pos-1])}>←</button> <button aria-label="下一首" disabled={pos===visible.length-1} onClick={()=>navigate(visible[pos+1])}>→</button></div></div>
  <div className="detail-body" key={active}>{review&&<label className="detail-check"><input aria-label={"将第 "+(active+1)+" 首纳入导入"} type="checkbox" checked={rows[active].checked} disabled={!rows[active].toggle||rows[active].disabled} onChange={rows[active].toggle}/> 纳入导入</label>}<div className="recordings"><RecordingInfo label="来源歌曲" song={source}/>{destination&&<RecordingInfo label={recordingLabel} song={destination}/>}</div>{detail(active)}</div></>:<p>当前视图没有待查看的歌曲</p>}</aside></section>;
}
