import test from 'node:test';
import assert from 'node:assert/strict';
import {importBatch,recoverUnsubmitted,resetDestination} from './batch.mjs';
test('442 首任务中途出现未确认写入：继续到最后，重启后只重试选中的行',async()=>{
 const entries=Array.from({length:442},()=>({status:'matched'}));
 const attempted=[];let saves=0;
 const options={entries,save:async()=>{saves++},stopped:()=>false};
 await importBatch({...options,indices:entries.map((_,i)=>i),processTrack:async(i,e)=>{
   attempted.push(i);if(i===199||i===399){e.status='pending';throw Error('网页无回执')}
   e.status='added';
 }});
 assert.equal(attempted.at(-1),441);assert.equal(saves,442);
 assert.equal(entries.filter(e=>e.status==='pending').length,2);
 const restored=JSON.parse(JSON.stringify(entries));
 await importBatch({...options,entries:restored,indices:[399],processTrack:async(i,e)=>{assert.equal(i,399);e.status='added'}});
 assert.equal(restored[199].status,'pending');assert.equal(restored[399].status,'added');
});

test('迁移确定未提交的旧记录，重选目标后保留版本和主动取消的勾选',async()=>{
 const e={status:'pending',candidate:{id:'one'},error:'有多个同名目标'};
 assert.ok(recoverUnsubmitted(e));assert.equal(e.status,'matched');
 const pending={status:'pending',candidate:{id:'two'}};
 assert.equal(recoverUnsubmitted(pending),false);
 const job={target:{url:'old'},entries:[e,pending,{status:'shelved',candidate:{id:'three'}},{status:'added',candidate:{id:'four'},verifiedTarget:'old',verifiedId:'four'}]};
 resetDestination(job);assert.equal(job.target,null);assert.deepEqual(job.entries.map(e=>e.status),Array(4).fill('matched'));
 assert.equal(job.entries[2].checked,false);assert.equal(job.entries[3].verifiedTarget,undefined);
 await importBatch({indices:[0],entries:job.entries,save:async()=>{},stopped:()=>false,processTrack:async()=>{throw Error('before click')}});
 assert.equal(e.status,'matched');assert.equal(e.notSubmitted,true);
});
test('同名菜单优先目标 ID；缺少 ID 时仅在资料库核实唯一后选取',async()=>{
 const {resolveTargetButton}=await import('./web.mjs');
 const button=(id,visible=true)=>({isVisible:async()=>visible,evaluate:async()=>id?[id]:[]});
 const first=button('p.other'),right=button('p.target'),unknown=button(),hidden=button(null,false);
 const page=items=>({getByRole:()=>({last:()=>({getByRole:()=>({all:async()=>items})})})});
 const saved={url:'https://music.apple.com/library/playlist/p.target'};
 const resolve=(items,unique)=>resolveTargetButton(page(items),'j-pop',saved,async()=>unique);
 assert.equal(await resolve([first,right],false),right);assert.equal(await resolve([hidden,unknown],false),unknown);
 assert.equal(await resolve([unknown,button()],true),unknown);await assert.rejects(resolve([unknown,button()],false));
 assert.equal(await resolveTargetButton(page([right,right]),'j-pop',null,async()=>false),right);
 await assert.rejects(resolve([first],true));assert.equal(await resolve([],true),null);
});
