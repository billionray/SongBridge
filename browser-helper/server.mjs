import {siteOrigins} from './origins.mjs';
import {platformAction} from './platform-player.mjs';
import {importBatch,recoverUnsubmitted,resetDestination} from './batch.mjs';
import {readPlayer} from './spotify-player.mjs';
import http from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,open,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {browserOptions,playerSession} from './platform.mjs';
import {chromium} from 'playwright-core';
import {detectProxy,browserProxy} from './proxy.mjs';
import {matchTrack,prepare,rank} from './matching.mjs';
import {reading} from './reading.mjs';
import {validateJob,needsContinuedMatch} from './policy.mjs';
import {findTarget,readMembers,confirmMember} from './membership.mjs';
import {search,retryRead,japaneseCatalog,locateSelected,openSongMenu,openPlaylistMenu,resolveTargetButton,playlistId,createFromSong,waitForAddFeedback} from './web.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),dir=path.join(root,'.state');
await mkdir(dir,{recursive:true});
const lockPath=path.join(dir,'helper.lock');
async function acquireLock(){
 try{return await open(lockPath,'wx')}catch(e){
  if(e.code!=='EEXIST')throw e;
  const pid=Number(await readFile(lockPath,'utf8'));let alive=true;
  if(Number.isInteger(pid)&&pid>0){try{process.kill(pid,0)}catch(err){if(err.code==='ESRCH')alive=false}}
  if(alive)throw Error('助手已运行。若上次异常退出且锁文件无效，请确认没有助手运行后删除 .state/helper.lock。');
  await unlink(lockPath);return open(lockPath,'wx');
 }
}
const lock=await acquireLock();await lock.writeFile(String(process.pid));
const code=randomBytes(18).toString('base64url'),port=17321;
const origins=new Set([...siteOrigins,'http://127.0.0.1:5173','http://localhost:5173']);
let running=false,stopping=false,job=null,message='助手已启动，请在网页输入连接码。';
try{job=JSON.parse(await readFile(path.join(dir,'job.json'),'utf8'));if(job){job.phase='paused';message='已恢复本地进度。已尝试导入的任务不会自动重复写入。'}}catch(e){if(e.code!=='ENOENT')throw e}
let saving=Promise.resolve();
function save(){
 const snapshot=JSON.stringify(job);
 const write=saving.then(async()=>{
  await writeFile(path.join(dir,'job.tmp'),snapshot);
  await rename(path.join(dir,'job.tmp'),path.join(dir,'job.json'));
 });
 saving=write.catch(()=>{});
 return write;
}
if(job){
 let restored=0;
 for(const [index,e] of Object.entries(job.entries)){
  if(recoverUnsubmitted(e))restored++;
  const track=job.playlist.tracks[index];
  if(track?.artist?.trim()==='亜咲花'&&e.candidate?.artist?.trim().toLowerCase()==='asaka'&&e.reading?.artist?.trim().toLowerCase()==='a sakihana'){
   const readingOverride={...e.reading,artist:'Asaka'};
   const p=await prepare(track,'romaji',reading,readingOverride);
   const result=await rank(track,[e.candidate],'romaji',p,reading);
   e.reading=readingOverride;e.reason=result.reason;e.risk=result.risk;
   const saved=e.candidates?.find(c=>c.id===e.candidate.id);
   if(saved)saved.matchReason=result.ordered[0]?.matchReason||result.reason;
   restored++;
  }
  if(e.status==="matched"&&!e.userReviewed&&!e.risk&&e.reason?.includes("演唱者不同或署名未确认")){
   const track=job.playlist.tracks[index];const mode=e.mode||"romaji";
   const decision=await rank(track,[e.candidate],mode,await prepare(track,mode,reading,e.reading),reading);
   e.risk=decision.risk;e.reason=decision.reason;if(!decision.candidate){e.status="review";delete e.candidate}restored++;
  }
  if(['added','existing'].includes(e.status)&&e.candidate&&(!job.target?.url||e.verifiedTarget!==job.target.url||e.verifiedId!==e.candidate.id)){
   e.status='matched';restored++;
  }
 }
 if(restored){message='已恢复 '+restored+' 首旧版记录，可重新核对并导入。';await save()}
}
const session=playerSession(()=>chromium.launchPersistentContext(path.join(dir,'profile'),{
 ...browserOptions(),headless:false,chromiumSandbox:true,viewport:null,proxy:browserProxy(detectProxy().url)
}));
const {getPage}=session;
const run=fn=>{if(running)throw Error('正在执行，请先暂停当前操作');running=true;stopping=false;Promise.resolve().then(fn).catch(e=>{message=e.message;if(job)job.phase='error'}).finally(async()=>{await save().catch(e=>{message='保存进度失败：'+e.message});running=false})};
let matching=false;
function status(){return {protocol:11,running,matching,message,job}}
async function recheck(){
 const p=await getPage();
 let target=job.target;
 if(!target){
  await p.goto('https://music.apple.com/cn/new',{waitUntil:'domcontentloaded'});
  target=await findTarget(p,job.playlist.name);
 }
 if(!target){message='未找到同名歌单，可以继续导入。';return}
 job.target=target;
 let count=0;
 for(const delay of [0,3500]){
  if(stopping)break;
  if(delay)await p.waitForTimeout(delay);
  await p.goto(target.url,{waitUntil:'domcontentloaded',timeout:20000});
  const members=await readMembers(p,target,n=>{message='正在核对目标歌单，已读取 '+n+' 首'},()=>stopping);
  count=members.length;
  const ids=new Set(members.map(s=>s.id));
  for(const e of Object.values(job.entries)){
   if(['matched','pending','shelved','added','existing'].includes(e.status))confirmMember(e,ids,target);
  }
  await save();
  if(!Object.values(job.entries).some(e=>['pending','shelved'].includes(e.status)))break;
 }
 message='已核对本次读取到的 '+count+' 首歌曲，可以继续导入剩余项。';
}
async function scan(...args){
 matching=true;
 try{await scanTracks(...args)}finally{matching=false}
}
async function scanTracks(mode,index,override,resume=false){
 job.phase='scanning';let errors=0,auto=0,review=0,missing=0,failed=0;
 const indices=job.playlist.tracks.map((_,i)=>i).filter(i=>{
  const e=job.entries[i];if(resume)return needsContinuedMatch(e);
  if(['added','existing','pending','shelved'].includes(e?.status))return false;
  if(e?.userReviewed)return false;
  return index!=null?i===index:!e?.candidate;
 });
 if(!indices.length){job.phase='review';message='没有待匹配歌曲';return}
 for(const [position,i] of indices.entries()){
  if(stopping)break;
  if(job.entries[i]?.userReviewed)continue;
  message='正在匹配 '+(position+1)+' / '+indices.length;
  try{
   const track=job.playlist.tracks[i];
   async function* pages(term){
    for(const expanded of [false,true]){if(stopping)return;yield await session.read(p=>search(p,term,expanded,()=>stopping),()=>stopping)}
   }
   const decision=await matchTrack(track,mode,reading,pages,override,()=>stopping,ids=>session.read(p=>japaneseCatalog(p,ids),()=>stopping));
   if(stopping)break;
   if(job.entries[i]?.userReviewed)continue;
   const {ordered,...match}=decision;job.entries[i]={...match,reading:override,mode,status:decision.candidate?'matched':ordered.length?'review':'unmatched',candidates:ordered};if(match.candidate)auto++;else if(ordered.length)review++;else missing++;errors=0;
  }
  catch(e){if(job.entries[i]?.userReviewed)continue;failed++;if(job.entries[i]?.candidate)job.entries[i].error=e.message;else job.entries[i]={status:'search_error',error:e.message};if(++errors>=3){await save();throw Error('连续三次搜索失败，已暂停。请检查 Apple Music 网页后继续匹配。')}}
  await save();
 }
 job.lastScan={mode,auto,review,missing,failed};
 job.phase='review';message=stopping?'已暂停匹配，可继续。':'本轮自动选中 '+auto+' 首，需手选 '+review+' 首，未找到 '+missing+' 首'+(failed?'，搜索失败 '+failed+' 首':'')+'。';
}
async function apply(indices){
 if(!job||!Array.isArray(indices)||!indices.length)throw Error('请先选择歌曲');
 const chosen=[...new Set(indices)];if(chosen.some(i=>!Number.isInteger(i)||!job.entries[i]?.candidate||!['matched','pending'].includes(job.entries[i].status)))throw Error('选择包含未匹配歌曲，请重新核对');
 for(const [key,e] of Object.entries(job.entries)){if(e.status==='pending'&&!chosen.includes(Number(key)))e.status='shelved'}
 await save();
 const p=await getPage();await p.goto('https://music.apple.com/cn/new',{waitUntil:'domcontentloaded'});
 await p.getByRole('button',{name:'我的账户',exact:true}).waitFor({state:'visible',timeout:45000});
 job.phase='checking';message='正在读取同名歌单及已有歌曲…';let target=job.target?.name===job.playlist.name?job.target:null;
 if(!target){try{target=await findTarget(p,job.playlist.name)}catch{message='将通过歌曲菜单查找目标歌单。'}}
 let members=[];
 if(target){try{members=await readMembers(p,target,(count,total)=>{message='正在核对目标歌单，已读取 '+count+(total?' / '+total:'')+' 首'},()=>stopping)}catch(err){message='未能读取目标歌单，继续处理已选歌曲：'+err.message}}
 let memberIds=new Set(members.map(s=>s.id));
 job.target=target;await save();
 let uniqueUrl;
 async function uniqueInLibrary(){
  if(uniqueUrl&&uniqueUrl===target?.url)return true;
  const tab=await p.context().newPage();
  try{
   const found=await findTarget(tab,job.playlist.name);
   if(!found||target&&playlistId(found.url)!==playlistId(target.url))return false;
   target=found;job.target=found;
   uniqueUrl=target.url;return true;
  }finally{await tab.close()}
 }
 let processed=0;
 const submitted=new Set();
 async function confirmPending(){
  if(!target)return;
  await p.goto(target.url,{waitUntil:'domcontentloaded',timeout:20000});
  const read=await readMembers(p,target,count=>{message='正在核对目标歌单，已读取 '+count+' 首'},()=>stopping);
  memberIds=new Set(read.map(s=>s.id));
  for(const e of Object.values(job.entries))if(['pending','shelved'].includes(e.status))confirmMember(e,memberIds,target);
  await save();
 }
 await importBatch({indices:chosen,entries:job.entries,save,stopped:()=>stopping,processTrack:async(i,e)=>{
   if(processed&&processed%25===0&&submitted.size&&target){
    try{await confirmPending()}catch(err){message='阶段核对未完成：'+err.message}
    if(stopping)return;
   }
   message='正在处理 '+(++processed)+' / '+chosen.length+'：'+job.playlist.tracks[i].name;
   if(confirmMember(e,memberIds,target))return;
   if(submitted.has(e.candidate.id)){e.status='pending';return}
   const button=await retryRead(async()=>{
    const c=await locateSelected(p,job.playlist.tracks[i],e);
    await p.getByRole('button',{name:'我的账户',exact:true}).waitFor({timeout:16000});
    await openSongMenu(p,c);await openPlaylistMenu(p);
    await p.getByRole('button',{name:'新歌单',exact:true}).waitFor({timeout:8000});
    if(target)await p.getByRole('menu').last().getByRole('button',{name:job.playlist.name,exact:true}).first().waitFor({timeout:5000});
    return resolveTargetButton(p,job.playlist.name,target,uniqueInLibrary);
   },ms=>p.waitForTimeout(ms),()=>stopping);
   if(stopping)return;
   const beforeSubmit=async()=>{e.status='pending';delete e.notSubmitted;delete e.error;await save()};
   if(button){await beforeSubmit();await button.click()}
   else if(!target&&!job.creationAttempted)await createFromSong(p,job.playlist.name,async()=>{job.creationAttempted=true;await beforeSubmit()});
   else if(!target){await uniqueInLibrary();throw Error('已提交创建，菜单尚未显示目标歌单，可重试本曲')}
   else throw Error('歌单菜单未加载目标');
   submitted.add(e.candidate.id);
   if(button)await waitForAddFeedback(p);
   else{
     await p.getByRole('main').getByRole('heading',{name:job.playlist.name,exact:true}).waitFor({timeout:10000});
     if(/^https:\/\/music\.apple\.com\/(?:cn\/)?library\/playlist\//.test(p.url())){target={name:job.playlist.name,url:p.url()};job.target=target}
   }
 }});
 if(!stopping&&chosen.some(i=>job.entries[i].status==='pending')){
   try{
     target=target||await findTarget(p,job.playlist.name);
     if(target){
       job.target=target;
       for(const delay of [1800,5000]){
        if(stopping||!chosen.some(i=>job.entries[i].status==='pending'))break;
        await p.waitForTimeout(delay);await confirmPending();
       }
     }
   }catch(err){for(const i of chosen){const e=job.entries[i];if(e.status==='pending'&&!e.error)e.error=err.message}}
 }
 const pendingCount=chosen.filter(i=>job.entries[i].status==='pending').length;
 job.phase=stopping?'paused':'complete';message=stopping?'已暂停，可继续导入。':'本批处理完成，待核对 '+pendingCount+' 首，未提交 '+chosen.filter(i=>job.entries[i].notSubmitted).length+' 首。';
}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;const allowed=origins.has(origin);
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(allowed){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin';headers['Access-Control-Allow-Headers']='Content-Type, X-SongBridge-Code';headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Private-Network']='true'}
 const reply=(status,data)=>{res.writeHead(status,headers);res.end(JSON.stringify(data))};
 if(req.headers.host!==`127.0.0.1:${port}`||!allowed)return reply(403,{error:'不允许的来源'});
 if(req.method==='OPTIONS')return reply(204,{});
 if(req.headers['x-songbridge-code']!==code)return reply(401,{error:'连接码不正确，请使用助手窗口里的本次连接码'});
 try{
  if(req.method==='GET'&&req.url==='/status')return reply(200,status());
  if(req.method==='GET'&&req.url==='/spotify-progress')return reply(200,{message});
  if(req.method!=='POST')return reply(404,{error:'Not found'});
  let body='';for await(const c of req){body+=c;if(Buffer.byteLength(body)>5e6)throw Error('请求超过 5 MB')};const d=JSON.parse(body||'{}');
  if(req.url==='/stop'){stopping=true;message='正在结束当前步骤…';return reply(200,status())}
  if(running&&!(matching&&req.url==='/select'))throw Error('正在执行，请先暂停当前操作');
  if(['/player-login','/player-read','/player-match','/player-search','/player-write'].includes(req.url)){
   running=true;
   try{
    const act=p=>platformAction(p,req.url,d,(n,total)=>{message='已确认添加 '+n+' / '+total+' 首'});
    return reply(200,req.url==='/player-write'?await act(await getPage()):await session.read(act));
   }
   finally{running=false}
  }
  if(req.url==='/spotify-player'){
   if(typeof d.id!=='string'||!/^[A-Za-z0-9]{22}$/.test(d.id))throw Error('Spotify 歌单 ID 无效');
   running=true;stopping=false;
   try{
    message='正在打开 Spotify 播放器…';
    const result=await session.read(tab=>readPlayer(tab,d.id,(n,total)=>{if(stopping)throw Error('已停止读取');message='Spotify 已读取 '+n+' / '+total+' 项'}),()=>stopping);
    message=result.warning;return reply(200,result);
   }catch(err){message=err.message;throw err}finally{running=false}
  }
  if(req.url==='/login'){run(async()=>{const p=await getPage();await p.goto('https://music.apple.com/cn/new',{waitUntil:'domcontentloaded'});message='请在独立浏览器窗口登录 Apple Music，完成后返回网页匹配。'})}
  else if(req.url==='/continue'){
   if(!job||d.hash!==job.hash)throw Error('任务已改变');
   run(()=>scan('auto',undefined,undefined,true));
  }else if(req.url==='/check'){
   if(!job||d.hash!==job.hash||typeof d.checked!=='boolean')throw Error('任务已改变');
   const e=job.entries[d.index];
   if(!['matched','pending','shelved'].includes(e?.status))throw Error('歌曲状态已改变');
   e.checked=d.checked;if(e.status!=='matched')e.status=d.checked?'pending':'shelved';
   await save();
  }else if(req.url==='/shelve'){
   if(d.hash!==job?.hash)throw Error('任务已改变');
   const e=job.entries[d.index];if(!['pending','shelved'].includes(e?.status))throw Error('歌曲状态已改变');
   e.status=d.shelved?'shelved':'pending';await save();
  }else if(req.url==='/target'){
   if(d.hash!==job?.hash)throw Error('任务已改变');
   if(d.url){const u=new URL(d.url);if(u.origin!=='https://music.apple.com'||!/^\/(?:cn\/)?library\/playlist\/p\.[\w.-]+\/?$/.test(u.pathname))throw Error('请输入 Apple Music 资料库歌单地址');
   const p=await getPage();await p.goto(u.href);await p.getByRole('main').getByRole('heading',{name:job.playlist.name,exact:true}).waitFor({timeout:15000});job.target={name:job.playlist.name,url:u.href}}
   else {resetDestination(job);message='将重新查找目标歌单，已选版本可重新导入。'}
   await save();
  }else if(req.url==='/recheck'){if(!job||d.hash!==job.hash)throw Error('任务已改变');run(recheck)
  }else if(req.url==='/scan'){
   const playlist=validateJob(d.playlist);const hash=createHash('sha256').update(JSON.stringify(playlist)).digest('hex');
   if(job&&(job.playlist.source?.platform??'netease')===playlist.source.platform&&(!job.playlist.source?.url||!playlist.source.url||job.playlist.source.url===playlist.source.url)&&job.playlist.name===playlist.name&&JSON.stringify(job.playlist.tracks.map(({id,name,artist,album})=>[id,name,artist,album]))===JSON.stringify(playlist.tracks.map(({id,name,artist,album})=>[id,name,artist,album]))){job.hash=hash;job.playlist=playlist}
   if(job?.hash!==hash){if(job)await writeFile(path.join(dir,'previous-job.json'),JSON.stringify(job));job={hash,playlist,entries:{},creationAttempted:false,phase:'ready'}}
   await save();run(()=>scan(['auto','smart','romaji'].includes(d.mode)?d.mode:'exact',d.index,d.reading));
  }else if(req.url==='/select'){
   if(d.hash!==job?.hash)throw Error('任务已改变，请刷新进度后重试');
   const e=job.entries[d.index];if(e&&['pending','added','existing'].includes(e.status))throw Error('这首歌曲已处理或待核对，不能更换候选');const c=e?.candidates?.find(c=>c.id===d.id);if(!c)throw Error('候选不存在');e.candidate=c;e.status='matched';e.checked=true;e.userReviewed=true;e.reason="已手动选择";e.risk="none";await save();
  }else if(req.url==='/import'){if(d.hash!==job?.hash)throw Error('任务已改变，请刷新进度后重试');run(()=>apply(d.indices))}
  else return reply(404,{error:'Not found'});
  reply(200,status());
 }catch(e){reply(400,{error:e.message})}
});
server.listen(port,'127.0.0.1',()=>console.log(`SongBridge 浏览器助手\n连接码：${code}\n保持此窗口打开，在 SongBridge 的“浏览器导入”中输入连接码。\n关闭窗口即可停止助手。`));
server.on('error',async e=>{console.error(e.message);await lock.close();await unlink(path.join(dir,'helper.lock'));process.exit(1)});
async function close(){stopping=true;await session.close()?.catch(()=>{});await lock.close();await unlink(path.join(dir,'helper.lock')).catch(()=>{});server.close();process.exit()}
process.on('SIGINT',close);process.on('SIGTERM',close);
