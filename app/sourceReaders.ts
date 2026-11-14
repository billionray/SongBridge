import {normalizePlaylist} from './playlist';
async function readPublic(link:string,platform:string){
  const r=await fetch('/api/playlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({link,platform})});
  const d=await r.json();if(!r.ok)throw Error(d.error);return {...normalizePlaylist(d),warning:d.warning};
}
export const readers={
 netease:{label:'NetEase',placeholder:'NetEase 歌单链接或 ID',read:(link:string)=>readPublic(link,'netease')},
 qq:{label:'QQ',placeholder:'QQ音乐歌单链接或 ID',read:(link:string)=>readPublic(link,'qq')},
 spotify:{label:'Spotify',placeholder:'Spotify 歌单链接或 spotify:playlist:…'},
 apple:{label:'Apple Music',placeholder:'Apple Music 歌单分享链接'},
 ytmusic:{label:'YouTube Music',placeholder:'YouTube Music 歌单分享链接'}
};
