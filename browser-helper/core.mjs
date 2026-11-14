import {createHash} from 'node:crypto';
export const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}\uFE0E\uFE0F\u200D]/gu,'');
export function artists(s){return String(s??'').split(/\s*\/\s*|、|，|,|\s+&\s+/).map(normalize).filter(Boolean).sort();}
export function exactMatch(source,candidate){
 const a=artists(source.artist),b=artists(candidate.artist);
 return !!normalize(source.name)&&normalize(source.name)===normalize(candidate.name)&&a.length>0&&JSON.stringify(a)===JSON.stringify(b);
}
export function chooseCandidate(source,candidates){
 const unique=[...new Map(candidates.filter(x=>x.id).map(x=>[x.id,x])).values()];
 const matches=unique.filter(c=>exactMatch(source,c));
 return matches.length===1?matches[0]:null;
}
export function fingerprint(playlist){return createHash('sha256').update(JSON.stringify(playlist.tracks.map(t=>[String(t.id),t.name,t.artist,t.album]))).digest('hex');}
export function validatePlaylist(data){
 if(!data||!Array.isArray(data.tracks)||!data.tracks.length||data.tracks.some(t=>!t||typeof t.name!=='string'||!t.name.trim()||typeof t.artist!=='string'))throw Error('playlist.json 格式不正确');
 return data;
}
export function songId(href){try{const u=new URL(href);if(u.protocol!=='https:'||u.hostname!=='music.apple.com')return null;return u.searchParams.get('i')||u.pathname.match(/\/song\/(?:[^/]+\/)?(\d+)$/)?.[1]||null}catch{return null}}
