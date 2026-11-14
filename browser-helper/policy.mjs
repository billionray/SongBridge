export function validateJob(d){
 if(!d||typeof d.name!=='string'||!d.name.trim()||d.name.length>200||!Array.isArray(d.tracks)||!d.tracks.length||d.tracks.length>10000||d.tracks.some(t=>!t||typeof t.name!=='string'||!t.name.trim()||typeof t.artist!=='string'))throw Error('歌单格式不正确，需要名称及 1–10000 首歌曲');
 return {name:d.name,source:{platform:d.source?.platform??'netease',...(d.source?.url?{url:d.source.url}:{})},tracks:d.tracks.map((t,i)=>({id:String(t.id??i),name:t.name,artist:t.artist,album:String(t.album||''),...(Array.isArray(t.artists)&&t.artists.every(a=>typeof a==='string')?{artists:t.artists}:{}),...(typeof t.isrc==='string'?{isrc:t.isrc}:{}),...(Number.isFinite(t.duration)?{duration:t.duration}:{})}))};
}
export function uniqueTarget(matches){if(matches.length>1)throw Error('存在多个同名歌单，请先在 Apple Music 区分名称');return matches[0]||null}

export function needsContinuedMatch(entry){
 if(['added','existing','pending','shelved'].includes(entry?.status))return false;
 return entry?.status!=='matched'||entry.checked===false;
}
