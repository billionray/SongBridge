"use client";
import {useState} from 'react';
import ReviewDesk from './ReviewDesk';

import PlatformImport from './PlatformImport';
import BrowserImport from './BrowserImport';

import {Music2,ArrowRight} from 'lucide-react';
import Sources from './Sources';
import {normalizePlaylist,toText,type Song,type Source,type Playlist} from './playlist';
export default function Home(){
 const [tracks,T]=useState<Song[]>([]),[name,N]=useState('我的歌单'),[notice,M]=useState(''),[busy,B]=useState('');
 const [target,setTarget]=useState<'apple'|'spotify'|'ytmusic'>('apple'),[helperBusy,setHelperBusy]=useState(false),[helperReady,setHelperReady]=useState(false),[sourceOpen,setSourceOpen]=useState(true);
 const [listVersion,setListVersion]=useState(0);
 const [code,setCode]=useState('');
 const [source,setSource]=useState<Source>({platform:'netease'});
 const locked=!!busy;
 function load(d:Playlist){setListVersion(v=>v+1);setSourceOpen(false);setSource(d.source);T(d.tracks);N(d.name||'我的歌单');M(d.warning||'')}
 function download(kind:'json'|'txt'){const p=normalizePlaylist({name,source,tracks});const d=kind==='json'?JSON.stringify(p,null,2):toText(p);const url=URL.createObjectURL(new Blob([d],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${name.replace(/[\\/:*?"<>|]/g,'_')}.${kind}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 const destination=<div className="destination">{!tracks.length&&<ArrowRight size={18} strokeWidth={1.5} aria-hidden="true"/>}<div className="route-field"><div className="actions" role="group" aria-label="目标平台">{(["apple","spotify","ytmusic"] as const).map(platform=><button key={platform} aria-pressed={target===platform} disabled={helperBusy||locked} onClick={()=>setTarget(platform)}>{platform==="apple"?"Apple Music":platform==="spotify"?"Spotify":"YouTube Music"}</button>)}</div></div></div>;
 return <main data-theme={target} className={tracks.length?'loaded':'landing'}>
 <nav><div className="brand">SongBridge</div></nav>
 {!tracks.length&&<header className="intro"><div><h1>换个平台，<br/><em>喜欢的歌继续听。</em></h1><p>读取歌单，核对歌曲版本，再导入目标音乐平台。</p></div><div className="record-art" aria-hidden="true"><div className="vinyl"/><div className="sleeve"><Music2 size={48} strokeWidth={1.2}/></div></div></header>}
 <section className="workspace"><div hidden={!sourceOpen&&!!tracks.length}><Sources destination={tracks.length?null:destination} code={code} setCode={setCode} locked={helperBusy||locked} load={load} busy={B} notice={M}/></div>
 {tracks.length>0&&<div className="result-toolbar"><div><input className="playlist-name" aria-label="歌单名称" value={name} disabled={locked||helperBusy} onChange={e=>N(e.target.value)}/><small>{tracks.length} 首歌曲</small></div><div className="actions"><button disabled={locked||helperBusy} aria-expanded={sourceOpen} onClick={()=>setSourceOpen(v=>!v)}>{sourceOpen?'收起来源':'更换来源'}</button><button onClick={()=>download('txt')}>导出 TXT</button><button onClick={()=>download('json')}>导出 JSON</button></div></div>}
 {!!tracks.length&&<div className="import-route">{destination}
 </div>}
 <div hidden={!tracks.length||target!=='apple'}><BrowserImport code={code} setCode={setCode} source={source} name={name} tracks={tracks} restore={playlist=>load(normalizePlaylist(playlist))} activity={setHelperBusy} ready={setHelperReady}/></div>
 {(['spotify','ytmusic'] as const).map(platform=>tracks.length>0&&<div key={platform} hidden={target!==platform}><PlatformImport code={code} setCode={setCode} key={listVersion} active={target===platform} target={platform} name={name} tracks={tracks} activity={setHelperBusy}/></div>)}
 {(busy||notice)&&<div role='status' className='notice'>{busy||notice}</div>}
 {!!tracks.length&&target==='apple'&&!helperReady&&<ReviewDesk key={listVersion} name={name} tracks={tracks} review={false}
  rows={tracks.map(()=>({checked:false,status:'来源'}))}
  detail={i=>source.platform==='spotify'&&/^[A-Za-z0-9]{22}$/.test(tracks[i].id)&&<a href={'https://open.spotify.com/track/'+tracks[i].id} target="_blank" rel="noreferrer">查看来源歌曲 ↗</a>}/>}
 </section></main>
}
