import test from 'node:test';
import assert from 'node:assert/strict';
import {uniqueTarget,validateJob} from './policy.mjs';
import {containsSong} from './membership.mjs';
import {chooseCandidate} from './core.mjs';
test('单个同名目标继续使用，多个同名目标停止',()=>{
 assert.equal(uniqueTarget([{id:'a'}]).id,'a');assert.equal(uniqueTarget([]),null);
 assert.throws(()=>uniqueTarget([{id:'a'},{id:'b'}]),/多个同名/);
});
test('保持导出名称，拒绝空名称和错误歌曲格式',()=>{
 assert.equal(validateJob({name:'我喜欢的音乐',tracks:[{name:'晴天',artist:'周杰伦'}]}).name,'我喜欢的音乐');
 assert.throws(()=>validateJob({name:' ',tracks:[{name:'a',artist:'b'}]}));
 assert.throws(()=>validateJob({name:'a',tracks:[{name:'a'}]}));
});
test('已存在歌曲按目录 ID 确认，现场版不与原版混淆',()=>{
 const songs=[{id:'1',name:'晴天',artist:'周杰伦'}];
 assert.ok(containsSong(songs,{id:'1',name:'晴天',artist:'周杰伦'}));
 assert.equal(containsSong(songs,{id:'2',name:'晴天',artist:'周杰伦'}),false);
 assert.equal(containsSong(songs,{id:'3',name:'晴天 (Live)',artist:'周杰伦'}),false);
 assert.equal(containsSong(songs,{id:'4',name:'晴天',artist:'其他人'}),false);
});
test('翻唱与现场版本不自动替代原曲，多个版本需确认',()=>{
 const track={name:'晴天',artist:'周杰伦'};
 assert.equal(chooseCandidate(track,[{id:'1',name:'晴天 (Live)',artist:'周杰伦'}]),null);
 assert.equal(chooseCandidate(track,[{id:'1',name:'晴天',artist:'其他人'}]),null);
 assert.equal(chooseCandidate(track,[{id:'1',...track},{id:'2',...track}]),null);
});

test('继续匹配按勾选状态跳过已选和已写入的记录',async()=>{
 const {needsContinuedMatch}=await import('./policy.mjs');
 for(const e of [undefined,{status:'review'},{status:'matched',checked:false,userReviewed:true}])assert.ok(needsContinuedMatch(e));
 for(const e of [{status:'matched'},{status:'matched',checked:true},...['pending','shelved','added','existing'].map(status=>({status,checked:false}))])assert.equal(needsContinuedMatch(e),false);
});

test('从歌单详情或无侧栏页面查找目标，直接打开国区资料库',async()=>{
 const {findTarget}=await import('./membership.mjs');
 const calls=[];
 const page={goto:async url=>{calls.push(url);throw Error('已记录导航')}};
 await assert.rejects(findTarget(page,'j-pop'),/已记录导航/);
 assert.deepEqual(calls,['https://music.apple.com/cn/library/all-playlists']);
});

test('用所选版本实际命中的搜索词在两个视图重定位，仅接受原 ID',async()=>{
 const {locateSelected}=await import('./web.mjs');
 const track={name:'So Precious',artist:'亜咲花'},hit={id:'1880626445',query:'So Precious Asaka',expanded:true};
 for(const candidate of [hit,{id:hit.id}]){
  const requests=[];
  const found=await locateSelected(null,track,{candidate,candidates:[hit]},async(_,q,expanded)=>{
   requests.push([q,expanded]);return expanded?[{id:'TV Size'}]:[hit];
  });
  assert.equal(found.id,hit.id);assert.deepEqual(requests,[[hit.query,true],[hit.query,false]]);
 }
 await assert.rejects(locateSelected(null,track,{candidate:{id:hit.id}},async(_,q)=>{
  assert.equal(q,'So Precious 亜咲花');return [{id:'other'}];
 }),/暂未找到/);
});

test('只读步骤超时后最多重试一次，暂停时不再重试',async()=>{
 const {retryRead}=await import('./web.mjs');let calls=0;
 const result=await retryRead(async()=>{if(!calls++)throw Error('Timeout');return 'ok'},async()=>{});
 assert.equal(result,'ok');assert.equal(calls,2);
 await assert.rejects(retryRead(async()=>{throw Error('Timeout')},async()=>{},()=>true),/Timeout/);
});

test('目标 ID 确认已提交和搁置项；部分读取不撤销既有确认',async()=>{
 const {confirmMember}=await import('./membership.mjs');
 const target={url:'https://music.apple.com/library/playlist/p.one'};
 for(const status of ['pending','shelved','added']){
  const e={status,candidate:{id:'42'},error:'old'};assert.ok(confirmMember(e,new Set(['42']),target));
  assert.equal(e.status,'added');assert.equal(e.error,undefined);assert.equal(e.verifiedTarget,target.url);
  assert.equal(confirmMember(e,new Set(),target),false);assert.equal(e.status,'added');
 }
});
