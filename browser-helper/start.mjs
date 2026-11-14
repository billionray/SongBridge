import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {detectProxy} from './proxy.mjs';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
if(Number(process.versions.node.split('.')[0])<22){console.error('Please install Node.js 22 or newer: https://nodejs.org/');process.exit(1)}
const proxy=detectProxy();
if(proxy.url){process.env.HTTPS_PROXY=proxy.url;process.env.HTTP_PROXY=proxy.url;process.env.npm_config_https_proxy=proxy.url;process.env.npm_config_proxy=proxy.url;const u=new URL(proxy.url);console.log(`Proxy detected (${proxy.source}): ${u.protocol}//${u.hostname}:${u.port||'default'}`)}
else console.log(`Network: ${proxy.source}. No proxy port is hard-coded.`);
process.env.NO_PROXY=[process.env.NO_PROXY,'127.0.0.1','localhost','::1'].filter(Boolean).join(',');
if(['playwright-core','kuromoji','wanakana','opencc-js'].some(pkg=>!existsSync('node_modules/'+pkg+'/package.json'))){
 console.log('Installing helper dependencies...');
 const npmArgs=['ci','--no-audit','--no-fund'];
 const result=process.platform==='win32'?spawnSync(process.execPath,[path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js'),...npmArgs],{stdio:'inherit',env:process.env}):spawnSync('npm',npmArgs,{stdio:'inherit',env:process.env});
 if(result.error||result.status!==0){console.error('Dependency installation failed. Check Node.js/npm and your proxy connection, then retry.');process.exit(1)}
}
await import('./server.mjs');
