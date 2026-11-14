import test from 'node:test';
import assert from 'node:assert/strict';
import {prepare,rank,originalQuery,matchTrack} from './matching.mjs';
import {reading} from './reading.mjs';

const song=(name,artist,extra={})=>({id:'good',name,artist,...extra});
async function match(t,list,mode='smart',override){
 const source=await prepare(t,mode,reading,override);
 return rank(t,list,mode,source,reading);
}
async function both(a,b,bad,mode){
 for(const [t,good] of [[a,b],[b,a]]){
  const result=await match(t,[{...bad,id:'bad'},good],mode);
  assert.equal(result.candidate?.id,'good',JSON.stringify([t.name,t.artist,result.reason]));
  assert.equal(result.ordered[0].id,'good');
 }
}
test('现场、伴奏、TV Size 和加速版只列为手选',async()=>{
 for(const mark of ['(Live)','- Off Vocal','- TVSize','- Sped Up Ver.','- Remix','- cover','- バンドVer.']){
  const a=song('Konobasyode '+mark,'A'),b=song('Konobasyode','A');
  for(const [source,c] of [[a,b],[b,a]]){
   const m=await match(source,[c]);assert.equal(m.candidate,undefined);assert.match(m.reason,/版本不同/);
  }
 }
});
test('日文歌名、艺人、混合文字可分别双向匹配；英文保留',async()=>{
 const a=song('RenAi Phakchi - Off Vocal','キミのね');
 const b=song(a.name,'Kimi no ne');
 await both(a,b,song('RenAi Phakchi','Kimi no ne'),'romaji');
 await both(song('夜に駆ける','YOASOBI'),song('Yoru ni Kakeru','YOASOBI'),song('Yoru ni Kakeru','Else'),'romaji');
 const localized=song('恋愛パクチー (Off Vocal)','キミのね');
 const fallback=await matchTrack(a,'auto',reading,async function*(){yield [localized]});
 assert.equal(fallback.candidate,undefined);assert.equal(fallback.ordered.length,1);
 assert.equal(originalQuery(b),b.name+' '+b.artist);
});
test('角色和声优跨字段对应，不混淆角色版',async()=>{
 const t=song('ハレ晴レユカイ～Ver.長門有希～','長門有希 (CV.茅原実里)');
 const c=song('ハレ晴レユカイ','長門有希');
 const wrong=song('ハレ晴レユカイ～Ver.キョン～','キョン (CV.杉田智和)');
 await both(t,c,wrong,'smart');
 await both(song('ハレ晴レユカイ (長門有希 (CV.茅原実里))','長門有希'),c,wrong,'smart');
 const actor=song(c.name,'茅原実里');
 assert.equal((await match(t,[actor])).candidate,undefined);
 await both({...t,album:'OST'},{...actor,album:'OST'},wrong,'smart');
 assert.equal((await match(t,[{...wrong,artist:'キョン (CV.茅原実里)'}])).candidate,undefined);
});
test('多角色配对、普通括号及 feat 跨字段',async()=>{
 const a=song('ここから、ここから','A（ＣＶ：甲） / B (声優:乙)',{artists:['A（ＣＶ：甲）','B (声優:乙)']});
 const b=song(a.name,'B、A');
 const swapped=song(a.name,'A (CV.乙) / B (CV.甲)',{id:'bad'});
 assert.equal((await match(a,[swapped,b])).candidate?.id,'good');
 assert.equal((await match(b,[swapped,a])).kind,'preselected');
 await both(a,b,song(a.name,'C'),'smart');
 await both(song('Song (feat. B)','A'),song('Song','B / A'),song('Song','C'),'smart');
 const group='屋内活動サークル(立山秋航、佐々木恵梨、亜咲花)';
 const p=await prepare(song('Konobasyode - TVSize',group),'smart',reading);
 assert.deepEqual(p.credits,[{person:group,actor:''}]);
});
test('ISRC、版本并列、长音、修正读音和候选理由',async()=>{
 const a=song('歌','歌手',{isrc:'JP123',album:'A'});
 const other=song('歌','歌手',{id:'bad',isrc:'JP222',album:'A'});
 assert.equal((await match(a,[other])).candidate,undefined);
 await both(a,song('Song','Singer',{isrc:'JP123'}),other,'smart');
 const tied=await match(a,[song('歌','歌手'),song('歌','歌手',{id:'dup'})]);assert.equal(tied.candidate.id,'good');assert.equal(tied.kind,'preselected');
 const t=song('夜に駆ける','YOASOBI');
 assert.equal((await match(t,[song('Yoru ni Kaker','YOASOBI')],'romaji')).candidate?.id,'good');
 const p=song('難読','歌手'),c=song('Tōkyō','Singer');
 assert.equal((await match(p,[c],'romaji',{name:'Toukyou',artist:'Singer'})).candidate?.id,'good');
 assert.equal((await match(song('歌（动漫片尾曲）','甲'),[song('歌','甲')])).candidate?.id,'good');
});


test('不同艺人不能仅由歌名的高相似度转写选中，优先同艺人，保留录音冲突',async()=>{
 const t=song('Hoshizora No Monogatari','Artist A');
 const close=song('Hoshizora No Monogatar','Artist B',{id:'tentative'});
 const best=await match(t,[close],'romaji');
 assert.equal(best.candidate,undefined);
 assert.equal((await match(t,[close,song(t.name,t.artist)],'romaji')).candidate?.id,'good');
 assert.equal((await match(t,[{...close,name:'Hoshizora Concert'}],'romaji')).candidate,undefined);
 assert.equal((await match(t,[{...close,name:t.name+' (Live)'}],'romaji')).candidate,undefined);
 assert.equal((await match(song('Ai','A'),[song('Ai','B')],'romaji')).candidate,undefined);
});

test('原始完整署名优先，Hello 不因同名或时长相近错选王杰',async()=>{
 const t=song('Hello','Furui Riho / knoak',{album:'Hello',duration:200000});
 const wrong=song('Hello','王杰',{id:'wrong',album:'Hello',duration:200100}),right=song('Hello','Furui Riho',{id:'1820346750'});
 const terms=[];
 const d=await matchTrack(t,'auto',reading,async function*(q){terms.push(q);yield [wrong,right]});
 assert.deepEqual(terms,['Hello Furui Riho / knoak']);assert.equal(d.candidate.id,right.id);assert.equal(d.risk,'credits');
 const fallbackTerms=[];
 const fallback=await matchTrack(t,'auto',reading,async function*(term){
  fallbackTerms.push(term);yield term==='Hello Furui Riho'?[right]:[wrong];
 });
 assert.deepEqual(fallbackTerms,['Hello Furui Riho / knoak','Hello Furui Riho']);
 assert.equal(fallback.candidate.id,right.id);assert.equal(fallback.risk,'credits');
 const onlyWrong=await matchTrack(t,'auto',reading,async function*(){yield [wrong]});
 assert.equal(onlyWrong.candidate,undefined);assert.equal(onlyWrong.ordered[0].id,wrong.id);
});
test('独立英文译名保留原始查询候选供手选',async()=>{
 const t=song('夜に駆ける','YOASOBI'),c=song('Into the Night','YOASOBI');
 const d=await matchTrack(t,'auto',reading,async function*(q){yield q==='夜に駆ける YOASOBI'?[c]:[]});
 assert.equal(d.candidate,undefined);assert.equal(d.ordered[0].id,c.id);assert.match(d.reason,/核对搜索结果/);
});

test('歌名与主艺人分别近似，短字段和双近似需要独立佐证',async()=>{
 const source=song('Aozoramonogatari','Sakurayamada',{duration:190000});
 for(const values of [
  ['Aozoramonogatali','Sakurayamada',undefined,true],
  ['Aozoramonogatari','Sakulayamada',undefined,true],
  ['Aozoramonogatali','Sakulayamada',undefined,false],
  ['Aozoramonogatali','Sakulayamada',194000,true],
  ['Aozoramonogatali','Sakulayamada',194001,false],
  ['Aozoramonogatari','Someone Else',190000,false]
 ]){
  const [name,artist,duration,selected]=values;
  for(const [a,b] of [[source,song(name,artist,{duration})],[song(name,artist,{duration}),source]]){
   const result=await match(a,[b],'romaji');assert.equal(!!result.candidate,selected);
   if(selected)assert.equal(result.risk,'spelling');
  }
 }
 for(const duration of [undefined,190000]){
  const result=await match({...source,name:'Hikari'},[song('Hikaru',source.artist,{duration})],'romaji');
  assert.equal(!!result.candidate,!!duration);
 }
});
test('原文与仅歌名查询翻页，修正读音只参与比对，手选保持原顺序',async()=>{
 const source=song('難読 (Live)','歌手 / 別名'),terms=[];
 for(const mode of ['exact','smart','romaji','auto']){
  const result=await matchTrack(source,mode,reading,async function*(term){
   terms.push(term);yield [song('Independent title','Another',{id:'first'})];
   yield [song('Unrelated','Nobody',{id:'second'})];
  },{name:'Yomikata',artist:'Singer'});
  assert.equal(result.candidate,undefined);assert.deepEqual(result.ordered.map(c=>c.id),['first','second']);
 }
 assert.deepEqual(terms,Array.from({length:4},()=>['難読 (Live) 歌手 / 別名','難読 (Live) 歌手','難読 (Live)','难読 (Live) 歌手 / 别名','难読 (Live) 歌手','难読 (Live)']).flat());assert.equal(originalQuery(song('Hello','')),'Hello');
});
test('同一录音按专辑、时长距离和原始顺序选择发行版',async()=>{
 const t=song('Hello','Furui Riho',{album:'A',duration:100000});
 const list=[['other','B',100000],['far','A',102300],['near','A',101000],['tie','A',99000]].map(([id,album,duration])=>({...t,id,album,duration}));
 const result=await match(t,list,'smart');assert.equal(result.candidate.id,'near');assert.equal(result.risk,'spelling');
});

test('艺名、角色及声优分字段换序，CV 近似标橙，完整署名优先',async()=>{
 const artist=song('Track','佐咲紗花'),roman=song('Track','Sayaka Sasaki');
 for(const [a,b] of [[artist,roman],[roman,artist]]){
  const result=await match(a,[b],'romaji');assert.equal(result.candidate?.id,b.id);assert.equal(result.risk,'consistent');
 }
 const jp=song('Koi no Uta','北白川たまこ (CV: 洲崎 綾)');
 const actor=name=>song(jp.name,'Tamako Kitashirakawa (CV: '+name+')',{id:name});
 for(const [name,risk] of [['Aya Suzaki','consistent'],['Aya Suzuki','credits']]){
  const en=actor(name);
  for(const [a,b] of [[jp,en],[en,jp]]){
   const result=await match(a,[b],'romaji');assert.equal(result.candidate?.id,b.id);assert.equal(result.risk,risk);
   if(risk==='credits')assert.match(result.reason,/CV 拼写接近/);
  }
 }
 const actual=song(jp.name,'Kitashirakawa Tamako (CV: Aya Suzuki)');
 assert.equal((await match(actual,[jp],'romaji')).risk,'credits');
 assert.equal((await match(jp,[actor('Aya Suzuki'),actor('Aya Suzaki')],'romaji')).candidate.id,'Aya Suzaki');
 assert.equal((await match(jp,[actor('Other Singer')],'romaji')).candidate,undefined);
 assert.equal((await match(jp,[song(jp.name,'Other Role (CV: Aya Suzaki)')],'romaji')).candidate,undefined);
 assert.equal((await match(song('Kitashirakawa Tamako','Artist'),[song('Tamako Kitashirakawa','Artist')],'romaji')).candidate,undefined);
});

test('So Precious 精确识别亜咲花的艺名，排除同名及 TV、伴奏版',async()=>{
 const t=song('So Precious','亜咲花');
 const full=song(t.name,'Asaka',{id:'1880626445'});
 for(const [source,correct] of [[t,full],[full,t]]){
  const result=await match(source,[song(t.name,'Askling',{id:'other'}),song(t.name+' (TV SIZE)','Asaka',{id:'tv'}),song(t.name+' (Off Vocal)','Asaka',{id:'off'}),correct],'romaji');
  assert.equal(result.candidate?.id,correct.id);assert.equal(result.risk,'consistent');
 }
});

test('仅歌名补搜可选中并按命中词定位，排除同名错误艺人',async()=>{
 const {locateSelected}=await import('./web.mjs');
 const t=song('So Precious','亜咲花');
 const wrong=song(t.name,'Askling',{id:'wrong'});
 const full=song(t.name,'Asaka',{id:'1880626445'});
 const terms=[];
 const result=await matchTrack(t,'auto',reading,async function*(term){
  terms.push(term);yield term===t.name?[wrong,full]:[wrong];
 });
 assert.deepEqual(terms,['So Precious 亜咲花','So Precious']);
 assert.equal(result.candidate.id,full.id);assert.equal(result.candidate.query,'So Precious');
 const found=await locateSelected(null,t,{candidate:result.candidate},async(_,term)=>{assert.equal(term,t.name);return [wrong,full]});
 assert.equal(found.id,full.id);
 const none=[];
 await matchTrack(song('Solo',''),'auto',reading,async function*(term){none.push(term);yield []});
 assert.deepEqual(none,['Solo']);
});

test('星号仅在查询与匹配中移除；简称有唯一全名时才预选',async()=>{
 const t=song('もうそう☆えくすぷれす','Sasaki Sayaka');
 assert.equal(originalQuery(t),'もうそうえくすぷれす Sasaki Sayaka');
 const short=song('もうそうえくすぷれす','Sayaka',{id:'one'});
 for(const [a,b] of [[t,short],[short,t]]){
  const m=await match(a,[b],'romaji');assert.equal(m.candidate?.id,b.id);assert.equal(m.risk,'credits');
 }
 assert.equal((await match(short,[t,{...t,id:'other',artist:'Sayaka Yamada'}],'romaji')).candidate,undefined);
 assert.equal((await match(t,[{...short,name:short.name+' (Live)'}],'romaji')).candidate,undefined);
});
test('独立英文标题由同一目录 ID 的日区元数据确认，保留国区候选与查询',async()=>{
 const t=song('衛星','kakizaki yuta'),cn=song('Satellite','Kakizaki Yuta',{id:'6786947771'});
 const run=(name,id)=>matchTrack(t,'auto',reading,async function*(){yield [{...cn,name}]},undefined,undefined,async()=>[{id,name:'衛星',artist:'柿崎ユウタ'}]);
 const m=await run('Satellite',cn.id);assert.equal(m.candidate.name,'Satellite');assert.equal(m.candidate.id,cn.id);assert.match(m.reason,/日区/);
 assert.equal((await run('Satellite','12345')).candidate,undefined);
 assert.equal((await run('Satellite (Live)',cn.id)).candidate,undefined);
});

test('原版优先，缺原版可选母带、TV Size，伴奏不替代',async()=>{
 const t=song('Song','Singer'),tv=song('Song (TV Size)','Singer',{id:'tv'}),rem=song('Song - 2024 Remastered','Singer',{id:'rem'}),off=song('Song (Off Vocal)','Singer',{id:'off'});
 const run=(first,next=first)=>matchTrack(t,'auto',reading,async function*(term){yield term===t.name?next:first});
 assert.equal((await run([tv],[t])).candidate.id,t.id);
 assert.equal((await run([off,tv,rem])).candidate.id,'rem');
 assert.equal((await run([off,tv])).candidate.id,'tv');
 assert.equal((await run([off])).candidate,undefined);
 assert.equal((await run([{...tv,artist:'Other'}])).candidate,undefined);
});

test('中文简繁双向搜索，按原始曲名及艺人确认唯一版本',async()=>{
 const simplified=song('听海','张惠妹'),traditional=song('聽海','張惠妹');
 for(const [source,target] of [[simplified,traditional],[traditional,simplified]]){
  const search=async q=>q===originalQuery(target)?[target]:[];
  const apple=await matchTrack(source,'exact',reading,async function*(q){yield await search(q)});
  assert.equal(apple.kind,'exact');

 }
});

test('艺人别名可由同名歌曲和高相似专辑预选，保留精确模式与版本核对',async()=>{
 const t=song('三年二班','周杰伦',{album:'葉惠美',duration:240000});
 const c=song('三年二班','Jay Chou',{album:'叶惠美',duration:241000});
 const picked=await match(t,[c]);
 assert.equal(picked.candidate?.id,c.id);assert.equal(picked.kind,'preselected');assert.match(picked.reason,/100%/);
 assert.equal((await match(t,[c],'exact')).candidate,undefined);
 for(const patch of [{name:'三年二班 (Live)'},{album:'其他专辑'},{duration:300000},{name:'另一首'}]){
  assert.equal((await match(t,[{...c,...patch}])).candidate,undefined);
 }
 for(const album of ['Greatest Hits','三年二班','']){
  assert.equal((await match({...t,album},[{...c,album}])).candidate,undefined);
 }
 assert.equal((await match(t,[c,{...c,id:'cover',artist:'Another singer'}])).candidate,undefined);
 const jp=song('光','宇多田ヒカル',{album:'Deep River Tracks'});
 assert.ok((await match(jp,[song('光','Hikaru Utada',{album:'Deep River Track'})])).candidate);
 const stronger={...t,id:'original'};
 const result=await matchTrack(t,'auto',reading,async function*(q){yield q===t.name?[stronger]:[c]});
 assert.equal(result.candidate.id,'original');
});

test('专辑相似度达到 60% 时预选，低于阈值时保留手选',async()=>{
 const source=song('光','甲',{album:'春夏秋冬夜'});
 const candidate=album=>song('光','Artist B',{album});
 const edge=await match(source,[candidate('春夏秋晨曦')]);
 assert.equal(edge.kind,'preselected');
 assert.match(edge.reason,/60%/);
 const below=await match(source,[candidate('春夏秋晨曦曲')]);
 assert.equal(below.candidate,undefined);
});

test('自动匹配双向核对简繁专辑名与日语罗马音专辑名',async()=>{
 for(const [a,b] of [['葉惠美','叶惠美'],['東京の空','Tōkyō no Sora'],['東京の空','Tokyo no Soraa']]){
  for(const [left,right] of [[a,b],[b,a]]){
   const source=song('Signal','甲',{album:left}),candidate=song('Signal','Alias',{album:right});
   const result=await matchTrack(source,'auto',reading,async function*(){yield [candidate]});
   assert.equal(result.candidate?.id,'good',left+' → '+right);
   assert.equal(result.risk,'credits');
  }
 }
 const a=song('Signal','甲',{album:'東京の空 2'});
 assert.equal((await match(a,[song('Signal','Alias',{album:'Tokyo no Sora 3'})],'romaji')).candidate,undefined);
});
