import http from 'node:http';
import worker from '../dist/server/index.js';
// On supported Node versions, honor the same proxy and CA settings as the OS.
const flags=['--use-env-proxy','--use-system-ca'].filter(flag=>process.allowedNodeEnvironmentFlags.has(flag)&&!process.execArgv.includes(flag));
if(flags.length){
 const {spawnSync}=await import('node:child_process');
 const child=spawnSync(process.execPath,[...process.execArgv,...flags,...process.argv.slice(1)],{stdio:'inherit'});
 process.exit(child.status??1);
}
const server=http.createServer(async(req,res)=>{try{const parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts);const request=new Request('http://127.0.0.1:5173'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}: {})});const response=await worker.fetch(request,process.env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('Preview error')}});
server.listen(5173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:5173'));
