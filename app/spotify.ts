export function playlistId(value:string){
 const id=value.trim().match(/^spotify:playlist:([A-Za-z0-9]{22})$/)?.[1];
 if(id)return id;
 try{const u=new URL(value);if(u.origin==='https://open.spotify.com'){const m=u.pathname.match(/^\/(?:intl-[\w-]+\/)?playlist\/([A-Za-z0-9]{22})\/?$/);if(m)return m[1]}}catch{}
 throw Error('请输入 Spotify 歌单链接或 spotify:playlist:…');
}
