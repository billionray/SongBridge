import {execFileSync} from 'node:child_process';
export function proxyURL(value){
 if(!value)return '';
 try{const u=new URL(/^[a-z]+:\/\//i.test(value)?value:'http://'+value);return ['http:','https:'].includes(u.protocol)&&u.hostname?u.href.replace(/\/$/,''):''}catch{return ''}
}
export function selectProxy(env,windows={}){
 for(const key of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy','ALL_PROXY','all_proxy']){const url=proxyURL(env[key]);if(url)return {url,source:'environment'}}
 if(windows.ProxyEnable&&windows.ProxyServer){
  const raw=windows.ProxyServer;
  const parts=Object.fromEntries(raw.split(';').filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i).trim().toLowerCase(),s.slice(i+1).trim()]}));
  const url=proxyURL(raw.includes('=')?(parts.https||parts.http):raw);if(url)return {url,source:'Windows system proxy'};
 }
 return {url:'',source:windows.AutoConfigURL?'Windows PAC (Edge system settings)':'system/default'};
}
export function macProxy(raw){
 const values=Object.fromEntries([...raw.matchAll(/^\s*(\w+)\s*:\s*(.*?)\s*$/gm)].map(m=>[m[1],m[2]]));
 for(const key of ['HTTPS','HTTP'])if(values[key+'Enable']==='1'&&values[key+'Proxy']){const url=proxyURL(values[key+'Proxy']+':'+(values[key+'Port']||80));if(url)return {url,source:'macOS system proxy'}}
 return {url:'',source:'macOS system/default'};
}
export function detectProxy(env=process.env){
 const explicit=selectProxy(env);if(explicit.url)return explicit;
 if(process.platform==='darwin'){try{return macProxy(execFileSync('/usr/sbin/scutil',['--proxy'],{encoding:'utf8',timeout:5000}))}catch{return explicit}}
 if(process.platform==='linux'){
  try{
   const get=(schema,key)=>execFileSync('gsettings',['get',schema,key],{encoding:'utf8',timeout:2000,stdio:['ignore','pipe','ignore']}).trim().replace(/^'|'$/g,'');
   if(get('org.gnome.system.proxy','mode')==='manual'){
    for(const type of ['https','http']){
     const schema='org.gnome.system.proxy.'+type,host=get(schema,'host'),port=get(schema,'port');
     if(host&&port)return {url:proxyURL(host+':'+port),source:'GNOME system proxy'};
    }
   }
  }catch{}
  return explicit;
 }
 if(process.platform!=='win32')return explicit;
 try{const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' | Select-Object ProxyEnable,ProxyServer,AutoConfigURL | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true,timeout:5000});return selectProxy(env,JSON.parse(raw.replace(/^\uFEFF/,'')))}catch{return explicit}
}
export function browserProxy(url){if(!url)return undefined;const u=new URL(url);return {server:u.origin,...(u.username?{username:decodeURIComponent(u.username),password:decodeURIComponent(u.password)}:{}),bypass:'127.0.0.1,localhost,[::1]'}}
