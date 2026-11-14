export type Target='spotify'|'ytmusic';
export type Candidate={id:string;name:string;artist:string;album:string;url:string};
export async function playerRequest<T>(code:string,route:string,data:object):Promise<T>{
 if(!code.trim())throw Error('请输入桌面助手连接码');
 let r:Response;
 try{r=await fetch('http://127.0.0.1:17321'+route,{method:'POST',headers:{'Content-Type':'application/json','X-SongBridge-Code':code.trim()},body:JSON.stringify(data)})}
 catch{throw Error('请启动桌面助手并允许本地网络访问')}
 if(r.status===404)throw Error('请下载新版桌面助手，覆盖旧目录并重启');
 const result=await r.json();if(!r.ok)throw Error(result.error||'助手请求失败');return result;
}
