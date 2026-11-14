import {existsSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export function browserOptions(platform=process.platform,exists=existsSync,home=os.homedir()){
 if(platform==='linux'){
  const override=process.env.SONGBRIDGE_BROWSER;
  if(override){if(path.posix.isAbsolute(override)&&exists(override))return {executablePath:override};throw Error('SONGBRIDGE_BROWSER 需要指向已安装浏览器的绝对路径')}
  for(const binary of ['google-chrome','google-chrome-stable','chromium','chromium-browser','microsoft-edge','microsoft-edge-stable']){
   for(const folder of [...(process.env.PATH||'').split(':'),'/usr/bin','/snap/bin'].filter(path.posix.isAbsolute)){
    const executablePath=path.posix.join(folder,binary);if(exists(executablePath))return {executablePath};
   }
  }
  throw Error('Linux 图形桌面需要 Chrome、Chromium 或 Edge。可设置 SONGBRIDGE_BROWSER 指定浏览器路径。');
 }
 if(platform!=='darwin')return {channel:'msedge'};
 for(const app of ['Google Chrome','Microsoft Edge']){
  for(const base of ['/Applications',path.join(home,'Applications')]){
   const executablePath=path.join(base,app+'.app','Contents','MacOS',app);
   if(exists(executablePath))return {executablePath};
  }
 }
 throw Error('请先安装 Google Chrome 或 Microsoft Edge，再启动浏览器导入。');
}


export function playerSession(launch){
 let context,page;
 async function getPage(){
  if(!context||context.browser()?.isConnected()===false){
   const opened=await launch();
   context=opened;page=null;
   opened.once('close',()=>{if(context===opened){context=null;page=null}});
  }
  if(!page||page.isClosed()){
   page=context.pages().find(p=>!p.isClosed())||await context.newPage();
   const current=page;
   current.once('crash',()=>{if(page===current)page=null;current.close().catch(()=>{})});
   current.setDefaultTimeout(15000);
  }
  return page;
 }
 async function read(operation,stopped=()=>false){
  try{return await operation(await getPage())}catch(error){
   if(stopped()||!(page?.isClosed()||!context||/Target page, context or browser has been closed|page crashed/i.test(error.message)))throw error;
   return operation(await getPage());
  }
 }
 return {getPage,read,close:()=>context?.close()};
}
