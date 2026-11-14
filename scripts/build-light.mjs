import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
const client=await build({entryPoints:['client.tsx'],bundle:true,write:false,format:'iife',platform:'browser',target:['es2020'],jsx:'automatic',minify:true,define:{'process.env.NODE_ENV':'"production"'}});
const css=await readFile('app/globals.css','utf8');
const helper=(await readFile('public/songbridge-helper.zip')).toString('base64');
const icon=await readFile('public/favicon.svg','utf8');
const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SongBridge · 跨平台歌单迁移</title><meta name="description" content="读取歌单，核对歌曲版本，再导入目标音乐平台"><link rel="icon" href="./favicon.svg"><style>'+css+'</style></head><body><div id="root"></div><noscript>请启用 JavaScript 使用歌单迁移工具。</noscript><script src="./assets/app.js" defer></script></body></html>';
await mkdir('dist/server',{recursive:true});
const source=`
import {POST} from './app/api/playlist/route.ts';
import {helperDownload} from './worker/helper-download.ts';
const helper=${JSON.stringify(helper)};
const html=${JSON.stringify(html)},js=${JSON.stringify(client.outputFiles[0].text)},icon=${JSON.stringify(icon)};
export default {async fetch(request){const p=new URL(request.url).pathname;const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};if(/^\\/dictionary\\/[a-z_]+\\.dat\\.gz$/.test(p))return Response.redirect('https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/'+p.split('/').pop(),302);if(['/downloads/songbridge-helper.zip','/downloads/songbridge-helper-mac.zip'].includes(p)&&request.method==='GET')return new Response(helperDownload(helper,new URL(request.url),${Boolean(process.env.SONGBRIDGE_SITE_ORIGIN?.trim())}),{headers:{...headers,'Content-Type':'application/zip','Content-Disposition':'attachment; filename='+p.split('/').pop(),'Cache-Control':'no-cache'}});if(p==='/api/playlist')return request.method==='POST'?POST(request):new Response('Method not allowed',{status:405,headers:{Allow:'POST'}});if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});const content=p==='/'?[html,'text/html; charset=utf-8']:p==='/assets/app.js'?[js,'text/javascript; charset=utf-8']:p==='/favicon.svg'?[icon,'image/svg+xml']:null;if(!content)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:content[0],{headers:{...headers,'Content-Type':content[1],'Cache-Control':'no-cache'}})}};`;
await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'server-entry.ts',loader:'ts'},bundle:true,platform:'neutral',format:'esm',target:'es2022',outfile:'dist/server/index.js',minify:true});
console.log('Built self-contained Worker and React client.');
