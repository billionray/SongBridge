export type Platform='netease'|'spotify'|'apple'|'qq'|'ytmusic'|'text';
export type Source={platform:Platform;url?:string};
export type Song={entryId:string;id:string;name:string;artist:string;album:string;duration?:number;isrc?:string;artists?:string[]};
export type Playlist={schemaVersion:1;source:Source;name:string;tracks:Song[];warning?:string};
const platforms=['netease','spotify','apple','qq','ytmusic','text'];
export function normalizePlaylist(data:any, fallback:Source={platform:'netease'}):Playlist{
 if(data.schemaVersion!==undefined&&data.schemaVersion!==1)throw Error('不支持这个清单版本');
 const source=data.source??fallback;
 if(!platforms.includes(source.platform)||!Array.isArray(data.tracks))throw Error('无法识别歌单格式');
 const entries=new Set<string>();
 const tracks=data.tracks.map((t:any,i:number)=>{
  if(!t||typeof t.name!=='string'||!t.name.trim()||typeof t.artist!=='string')throw Error('第 '+(i+1)+' 行缺少歌名或艺人字段');
  const entryId=String(t.entryId??(i+1));
  if(entries.has(entryId))throw Error('歌单条目标识重复');
  entries.add(entryId);
  return {entryId,id:String(t.id??''),name:t.name,artist:t.artist,album:String(t.album??''),
   ...(Number.isFinite(t.duration)?{duration:t.duration}:{}),...(typeof t.isrc==='string'?{isrc:t.isrc}:{}),
   ...(Array.isArray(t.artists)&&t.artists.every((v:any)=>typeof v==='string')?{artists:[...t.artists]}:{})};
 });
 return {schemaVersion:1,name:String(data.name||'我的歌单'),source:{platform:source.platform,...(typeof source.url==='string'?{url:source.url}:{})},tracks};
}
export function fromText(text:string,name:string){
 const rows=text.replace(/^\uFEFF/,'').split(/\r\n|\r|\n/).filter(row=>row.trim());
 if(!rows.length)throw Error('清单为空');
 return normalizePlaylist({name,tracks:rows.map(row=>{const [name,artist='',album='']=row.split('\t');return {name:name.trim(),artist:artist.trim(),album:album.trim()}})},{platform:'text'});
}
export function toText(p:Playlist){return p.tracks.map(t=>[t.name,t.artist,t.album].map(s=>s.replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n')}
export function spotifyItems(name:string,rows:any[],url?:string):Playlist{
 let local=0,episodes=0,missing=0;
 const tracks:Song[]=[];
 rows.forEach((row,i)=>{
  const item=row?.item??row?.track??row?.localTrack;
  if(row?.episode||item?.type==='episode'){episodes++;return}
  const isLocal=!!(row?.localTrack||row?.is_local||item?.is_local);
  if(isLocal)local++;
  const title=item?.trackName??item?.name;
  const artists=item?.artists?.map((a:any)=>a?.name).filter(Boolean)??(item?.artistName?[item.artistName]:[]);
  if(!title||(isLocal&&!artists.length)){missing++;return}
  const uri=item.trackUri??item.uri??'';
  tracks.push({entryId:String(i+1),id:item.id??(uri.startsWith('spotify:track:')?uri.slice(14):''),name:title,artists,artist:artists.join(' / '),album:item.album?.name??item.albumName??'',duration:item.duration_ms,isrc:item.external_ids?.isrc});
 });
 const p=normalizePlaylist({name,source:{platform:'spotify',url},tracks});
 p.warning='可迁移 '+tracks.length+' 首；本地曲目 '+local+' 条，跳过播客 '+episodes+' 条、信息缺失 '+missing+' 条。';
 return p;
}
export function readFileContent(filename:string,text:string):Playlist[]{
 const name=filename.replace(/\.[^.]+$/,'');
 if(/\.txt$/i.test(filename))return [fromText(text,name)];
 const data=JSON.parse(text.replace(/^\uFEFF/,''));
 const lists=Array.isArray(data)?data:data.playlists??(Array.isArray(data.items)?[data]:null);
 if(lists){return lists.map((p:any)=>{if(!Array.isArray(p?.items))throw Error('无法识别 Spotify 歌单条目');return spotifyItems(p.name||name,p.items)})}
 return [normalizePlaylist({...data,name:data.name||name})];
}

