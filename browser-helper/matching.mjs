import {toHiragana, toKatakana, toRomaji} from 'wanakana';
import {Converter} from 'opencc-js/t2cn';
import {Converter as TraditionalConverter} from 'opencc-js/cn2t';

const simplify=Converter({from:'tw',to:'cn'});
const traditional=TraditionalConverter({from:'cn',to:'tw'});
const clean=s=>String(s??'').normalize('NFKC').trim();
export const searchText=s=>clean(s).replace(/[\p{P}\p{S}\uFE0E\uFE0F\u200D]/gu,'').replace(/\s+/gu,' ').trim();
const norm=s=>simplify(searchText(s)).toLowerCase().replaceAll(' ','');
function queryForms(query){
 if(!/\p{Script=Han}/u.test(query)||/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(query))return [query];
 return [...new Set([query,simplify(query),traditional(query)])];
}

const japanese=/[\u3040-\u30ff\u3400-\u9fff]/u;
const cv=/^(?:cv|声優|声优)\s*[.:・]?\s*(.+)$/i;
const versions=[
 ['伴奏',/\b(?:off[\s-]*vocal|instrumental|karaoke)\b|伴奏|カラオケ/i],
 ['TV Size',/\btv[\s-]*(?:size|edit|version|ver\.?)\b/i],
 ['加速版',/\bsped[\s-]*up\b/i],['变速版',/\bslowed\b/i],
 ['Remix',/\bremix\b/i],['Live',/\blive\b|现场|現場|ライブ/i],
 ['Cover',/\bcover\b|翻唱|翻自|カバー/i],['乐队版',/バンド\s*ver|band\s*ver/i],
 ['独唱版',/\bsolo\b|ソロ/i],['原声版',/\bacoustic\b/i],
 ['重新母带',/\bremaster(?:ed)?\b/i]
];

function splitCredits(value){
 const parts=[];let depth=0,part='';
 for(const c of clean(value).replace(/\s+(?:feat\.?|featuring|&)\s+/gi,' / ')){
  if(c==='(')depth++;
  if(!depth&&'/、,;'.includes(c)){if(part.trim())parts.push(part.trim());part='';continue}
  part+=c;if(c===')')depth=Math.max(0,depth-1);
 }
 if(part.trim())parts.push(part.trim());return parts;
}
function credit(s){
 const m=clean(s).match(/^(.*?)\s*\(([^()]*)\)$/);
 const actor=m&&m[2].match(cv);
 if(actor)return {person:m[1].trim(),actor:actor[1].trim()};
 const inline=clean(s).match(/^(.+?)\s+(?:cv|声優|声优)\s*[.:・]\s*(.+)$/i);
 return inline?{person:inline[1].trim(),actor:inline[2].trim()}:{person:clean(s),actor:''};
}
// Literal catalog spellings confirmed on both releases. Title translations belong to an artist.
const artistSpellings=[
 ['BLEND-A','ブレンド・A'],['Ho - Kago Tea Time','放課後ティータイム'],
 ['Sheena Ringo','椎名林檎'],['ペコリーヌ','Pecorine'],['キャル','Karyl'],
 ['M・A・O','M·A·O'],['白雪 風真','Shirayuki Fuma'],['平沢憂','Hirasawa Ui']
];
function spellings(value){
 const key=norm(value);
 return artistSpellings.find(group=>group.some(name=>norm(name)===key))||[value];
}
// Whole title equivalents only. Keep the normal artist and version checks.
const loanwordTitles=[['ブレンド','Blend'],['プリンセス','Princess'],['ミュージック','Music'],['チョコレート','Chocolate']];
function loanwordTitle(value){
 for(const [kana,english] of loanwordTitles){
  if(norm(value)===norm(kana))return english;
  if(norm(value)===norm(english))return kana;
 }
 return '';
}
const titleSpellings=[
 ['IOSYS','明日なき暴走！クラウンピースを追い詰めろ','Ashita naki Boso! ClownPiece wo Oitsumero'],
 ['Chihiro Nakamura','カサネテク',"Kasaneteku - Japanese Girl's Strategy"],
 ['Sheena Ringo','ギブス','Gips'],
 ['白雪 風真','なでなで','NadeNade'],
 ['平沢憂','ウキウキNew! My Way','Uki Uki New My Way']
];
function unmarkedPair(s){
 return clean(s).match(/^([^()]+?)\s*\(([^()]+)\)$/);
}
function parseCredits(track){
 const fields=track.artists?.length?track.artists:[track.artist];
 const parts=fields.flatMap(splitCredits);
 const pairs=parts.map(unmarkedPair);
 // Some catalogs place all roles before one parenthesized, ordered list of actors.
 if(parts.length===1&&pairs[0]){
  const people=pairs[0][1].split('・'),actors=splitCredits(pairs[0][2]);
  if(actors.length>1&&people.length===actors.length)return people.map((person,i)=>({person:person.trim(),actor:actors[i]}));
 }
 // Also recognize a list of individually paired credits without the literal "CV".
 if(parts.length>1&&pairs.every(Boolean)&&pairs.every(m=>!cv.test(m[2])&&splitCredits(m[2]).length===1&&japanese.test(m[1])&&japanese.test(m[2]))){
  return pairs.map(m=>({person:m[1].trim(),actor:m[2].trim()}));
 }
 return parts.map(credit);
}
function alternateTitle(title,credits){
 for(const [owner,a,b] of titleSpellings){
  const other=norm(title)===norm(a)?b:norm(title)===norm(b)?a:'';
  if(!other)continue;
  const known=credits.some(c=>spellings(c.person).some(s=>norm(s)===norm(owner)));
  // This source misspells Hirasawa. Require the credited actor as independent evidence.
  if(known||owner==='平沢憂'&&credits.some(c=>norm(c.person)==='hirasaraui'&&norm(c.actor)==='madokayonezawa'))return other;
 }
 return '';
}
function profile(t){
 let base=clean(t.name);
 const credits=parseCredits(t);
 const marks=[],roles=[];
 function note(s){
  s=s.trim();
  const featured=s.match(/^(?:feat\.?|featuring)\s+(.+)$/i);
  if(featured){credits.push(...splitCredits(featured[1]).map(credit));return true}
  const embedded=credit(s),actor=s.match(cv);
  if(embedded.actor){credits.push(embedded);roles.push(embedded.person);return true}
  if(actor){credits.push({person:'',actor:actor[1]});return true}
  if(/主题曲|主题歌|主題曲|主題歌|片[头頭尾]曲|插曲/i.test(s))return true;
  const role=s.match(/^ver[.: ]+\s*(.+)$/i);
  if(role){roles.push(role[1].trim());return true}
  const version=versions.find(([,re])=>re.test(s));
  if(version){
   const detail=norm(s.replace(version[1],'').replace(/\b(?:version|ver)\b\.?/gi,''));
   marks.push(version[0]+(detail?' '+detail:''));return true;
  }
  return false;
 }
 base=base.replace(/\(([^()]*(?:\([^()]*\)[^()]*)?)\)|【([^】]*)】|\[([^\]]*)\]|[~〜]([^~〜]+)[~〜]/g,(all,...p)=>{
  const s=p.slice(0,4).find(v=>v!==undefined);return note(s)?' ':all;
 });
 // A final actor credit may follow an unparenthesized character after a dash.
 const tail=base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
 if(tail&&note(tail[2]))base=tail[1];
 else if(tail&&credits.some(c=>!c.person&&c.actor)){
  const actor=credits.find(c=>!c.person&&c.actor);actor.person=tail[2].trim();roles.push(actor.person);base=tail[1];
 }
 base=base.replace(/\s+((?:feat\.?|featuring)\s+.+)$/i,(_,s)=>{note(s);return ''});
 const named=credits.filter(c=>c.person);
 for(const c of credits)if(!c.person&&c.actor&&named.length===1)c.person=named[0].person;
 const unique=new Map(credits.map(c=>[norm(c.person)+'|'+norm(c.actor),c]));
 return {base:base.trim(),credits:[...unique.values()],roles,version:marks.sort().join(' / ')};
}

// Share successful dictionary lookups across tracks; a failed lookup can be retried.
const dictionaries=new WeakMap();
const artistReadings=new Map([['佐咲紗花','Sasaki Sayaka'],['亜咲花','Asaka']].map(([name,reading])=>[norm(name),reading]));
export async function prepare(t,mode,convert,override={}){
 const p=profile(t),readings=new Map(),personReadings=new Map();
 if(mode==='romaji'){
  let cache=dictionaries.get(convert);if(!cache){cache=new Map();dictionaries.set(convert,cache)}
  const words=[p.base,t.album,...p.roles,...p.credits.flatMap(c=>[c.person,c.actor])];
  for(const word of new Set(words.filter(Boolean))){
   if(!japanese.test(word))continue;
   if(!cache.has(word)){if(cache.size>=12000)cache.clear();cache.set(word,Promise.resolve().then(()=>convert(word)))}
   try{readings.set(word,await cache.get(word))}catch(e){cache.delete(word);throw e}
  }
  for(const person of [...p.roles,...p.credits.flatMap(c=>[c.person,c.actor])]){
   const known=artistReadings.get(norm(person));if(known)personReadings.set(person,known);
  }
  if(override?.name)readings.set(p.base,override.name);
  if(override?.artist){
   const names=splitCredits(override.artist);
   if(names.length===p.credits.length)names.forEach((s,i)=>personReadings.set(p.credits[i].person,s));
   else if(p.credits[0])personReadings.set(p.credits[0].person,override.artist);
  }
 }
 return {...p,readings,personReadings};
}
export const originalQuery=t=>searchText([t.name,t.artist||t.artists?.join(' / ')].filter(Boolean).join(' '));
const latin=s=>norm(s.normalize('NFD').replace(/\p{M}/gu,'')).replace(/ou|oo/g,'o').replace(/uu/g,'u').replace(/shi/g,'si').replace(/chi/g,'ti').replace(/tsu/g,'tu').replace(/fu/g,'hu');
// Normalized edit distance lets one misread syllable affect just that field.
function phoneticSimilarity(a,b,left,right){
 const x=latin(left.readings?.get(a)||a||''),y=latin(right.readings?.get(b)||b||'');
 if(!/^[a-z]+$/.test(x)||!/^[a-z]+$/.test(y))return {score:0,length:0};
 return {score:textSimilarity(x,y),length:Math.min(x.length,y.length)};
}
function textSimilarity(x,y){
 if(x===y)return 1;
 const row=Array.from({length:y.length+1},(_,i)=>i);
 for(let i=1;i<=x.length;i++){
  let diagonal=row[0];row[0]=i;
  for(let j=1;j<=y.length;j++){
   const above=row[j];
   row[j]=Math.min(above+1,row[j-1]+1,diagonal+Number(x[i-1]!==y[j-1]));diagonal=above;
  }
 }
 return 1-row[y.length]/Math.max(x.length,y.length);
}
function albumReadingScore(a,b,left,right){
 // Compare across scripts only; two unrelated Han titles can share a Japanese reading.
 if(!a||!b||japanese.test(a)===japanese.test(b))return 0;
 const readingA=left.readings.get(a)||a,readingB=right.readings.get(b)||b;
 const x=latin(readingA),y=latin(readingB);
 if(!/^[a-z0-9]{1,256}$/.test(x)||!/^[a-z0-9]{1,256}$/.test(y))return 0;
 if(x.match(/\d+/g)?.join('/')!==y.match(/\d+/g)?.join('/'))return 0;
 return textSimilarity(x,y);
}
function albumEvidence(a,b,left,right,readingScore){
 const x=norm(a),y=norm(b);
 if(!x||!y||x===norm(left.base)||y===norm(right.base)||albumReadingScore(a,right.base,left,right)===1||albumReadingScore(b,left.base,right,left)===1)return 0;
 const generic=/greatesthits|bestof|compilation|精选|合辑|群星|ベストアルバム|^(single|ep|album|soundtrack|原声带|未命名|unknown)$/;
 if(generic.test(x)||generic.test(y))return 0;
 if(x===y)return 1;
 if(Math.max(x.length,y.length)>256)return 0;
 if(x.match(/\d+/g)?.join('/')!==y.match(/\d+/g)?.join('/'))return 0;
 return Math.max(textSimilarity(x,y),readingScore);
}
function compare(a,b,left,right){
 if(!norm(a)||!norm(b))return 0;if(norm(a)===norm(b))return 3;
 const x=left.readings?.get(a)||a,y=right.readings?.get(b)||b;
 if(japanese.test(x)||japanese.test(y))return 0;
 if(norm(x)===norm(y))return 2;
 return latin(x)===latin(y)?1:0;
}
function oneLetterApart(a,b){
 if(Math.min(a.length,b.length)<4||Math.abs(a.length-b.length)>1)return false;
 let i=0,j=0,diff=0;
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;continue}
  if(++diff>1)return false;
  if(a.length>=b.length)i++;
  if(b.length>=a.length)j++;
 }
 return diff+(a.length-i)+(b.length-j)===1;
}
function personalReading(name,p){
 return p.personReadings?.get(name)||p.readings.get(name)||name||'';
}
// Try one boundary between family and given name, including tokenized compound surnames.
function namePairs(name,p){
 const tokens=personalReading(name,p).trim().split(/[\s・,]+/u).map(latin);
 if(tokens.length<2||tokens.length>6||tokens.some(t=>!/^[a-z]+$/.test(t)))return [];
 return tokens.slice(1).map((_,i)=>[tokens.slice(0,i+1).join(''),tokens.slice(i+1).join('')]);
}
function evaluate(t,c,l,r,mode){
 const eq=(a,b)=>mode==='romaji'?compare(a,b,l,r):Number(!!norm(a)&&norm(a)===norm(b))*3;
 const literalTitle=eq(l.base,r.base);
 const translation=mode==='exact'?'':alternateTitle(l.base,l.credits);
 const confirmedTitle=!!translation&&norm(translation)===norm(r.base)&&norm(alternateTitle(r.base,r.credits))===norm(l.base);
 const loanword=mode==='romaji'&&loanwordTitle(l.base);
 const translatedTitle=confirmedTitle||Boolean(loanword&&norm(loanword)===norm(r.base));
 const title=literalTitle||(translatedTitle?2:0);
 const isrc=!!t.isrc&&!!c.isrc&&norm(t.isrc)===norm(c.isrc);
 const albumReading=mode==='romaji'?albumReadingScore(t.album,c.album,l,r):0;
 const album=!!t.album&&(norm(t.album)===norm(c.album)||albumReading===1);
 const close=t.duration&&c.duration&&Math.abs(t.duration-c.duration)<=4000;
 const corroborated=album||close;
 let conflict='';
 const personEq=(a,b)=>{
  if(!norm(a)||!norm(b))return 0;
  if(mode!=='exact'&&spellings(a).some(s=>norm(s)===norm(b)))return norm(a)===norm(b)?3:2;
  if(mode!=='romaji')return eq(a,b);
  const x=personalReading(a,l),y=personalReading(b,r);
  if(norm(a)===norm(b))return 3;
  if(latin(x)===latin(y))return 2;
  return namePairs(a,l).some(([family,given])=>namePairs(b,r).some(([first,last])=>family===last&&given===first))?2:0;
 };
 const closeCV=(a,b)=>mode==='romaji'&&namePairs(a,l).some(([x,y])=>namePairs(b,r).some(([u,v])=>
  [[u,v],[v,u]].some(([first,last])=>x===first&&oneLetterApart(y,last)||y===last&&oneLetterApart(x,first))));
 const matched=(a,b)=>{
  const identity=personEq(a.person,b.person),voice=personEq(a.actor,b.person)||personEq(a.person,b.actor)||personEq(a.actor,b.actor);
  if(identity&&a.actor&&b.actor&&!personEq(a.actor,b.actor))return closeCV(a.actor,b.actor)?3:0;
  if(identity)return identity===3?6:4;
  if(a.person&&b.person&&a.actor&&b.actor){
   // A one-letter difference in a character's family or given name needs the same actor.
   if(mode==='romaji'&&title&&personEq(a.actor,b.actor)){
    const alternatePairs=(name,p)=>spellings(name).flatMap(s=>namePairs(s,p));
    if(alternatePairs(a.person,l).some(([x,y])=>alternatePairs(b.person,r).some(([u,v])=>
     (x===u&&oneLetterApart(y,v))||(y===v&&oneLetterApart(x,u)))))return 3;
   }
   return 0;
  }
  return voice?1:0;
 };
 // One performer may appear in both the title and artist field. Merge on identity.
 const people=p=>{const result=new Map();for(const c of p.credits){const key=norm(c.person||c.actor);if(key&&(!result.has(key)||c.actor))result.set(key,c)}return [...result.values()]};
 const left=people(l),right=people(r);
 const edges=left.map(x=>right.map(y=>matched(x,y)));
 function pairCredits(minimum){
  if(!left.length||left.length!==right.length)return false;
  const assigned=new Map();
  function assign(i,seen){
   for(let j=0;j<right.length;j++){
    if(seen.has(j)||edges[i][j]<minimum)continue;
    seen.add(j);
    if(!assigned.has(j)||assign(assigned.get(j),seen)){assigned.set(j,i);return true}
   }
   return false;
  }
  return left.every((_,i)=>assign(i,new Set()));
 }
 const strength=[6,4,3,1].find(pairCredits)||0;
 const artists=strength>0,weak=strength===1,cvApprox=strength===3,phonetic=strength===4;
 const primary=left[0],other=right[0];
 const primaryExact=!!primary&&right.some(y=>matched(primary,y)>=4);
 const shortName=(short,full,sp,fp)=>{
  const key=latin(personalReading(short,sp));
  return key.length>=2&&namePairs(full,fp).some(pair=>pair.includes(key));
 };
 const abbreviated=mode==='romaji'&&!!title&&!primaryExact&&primary?.person&&other?.person&&
  (shortName(primary.person,other.person,l,r)||shortName(other.person,primary.person,r,l));
 const titleFit=mode==='romaji'&&!title?phoneticSimilarity(l.base,r.base,l,r):{score:0,length:0};
 const artistFit=mode==='romaji'&&!primaryExact&&primary?.person&&other?.person?
  phoneticSimilarity(primary.person,other.person,l,r):{score:0,length:0};
 const passes=f=>f.score>=0.80&&(f.length>=8||corroborated);

 const fuzzyTitle=!title&&passes(titleFit);
 const fuzzyArtist=!primaryExact&&passes(artistFit);
 const bothFuzzy=fuzzyTitle&&fuzzyArtist&&corroborated&&[titleFit,artistFit].every(f=>f.score>=0.85&&f.length>=8);
 const creditConflict=left.some(x=>right.some(y=>x.actor&&y.actor&&(
  personEq(x.person,y.person)&&!personEq(x.actor,y.actor)||personEq(x.actor,y.actor)&&x.person&&y.person&&!personEq(x.person,y.person)
 )))&&!artists;
 const roleFits=(p,q,reverse=false)=>p.roles.every(a=>(q.roles.length?q.roles:q.credits.map(c=>c.person)).some(b=>reverse?personEq(b,a):personEq(a,b))||(!q.roles.length&&weak&&artists&&corroborated));
 if(l.version!==r.version)conflict='录音版本不同：'+(l.version||'未标注')+' → '+(r.version||'未标注');
 else if(creditConflict||abbreviated&&primary.actor&&other.actor&&!personEq(primary.actor,other.actor)||!roleFits(l,r)||!roleFits(r,l,true))conflict='角色或声优不同，或角色版本未确认';
 else if(t.isrc&&c.isrc&&!isrc)conflict='录音 ISRC 不同';
 const exact=norm(t.name)===norm(c.name)&&strength===6;
 const partial=primaryExact&&!artists;
 const fuzzy=!!(title&&fuzzyArtist||fuzzyTitle&&primaryExact||bothFuzzy);
 const albumScore=mode!=='exact'&&!isrc&&!conflict&&!primaryExact&&!artists&&title===3&&left.length&&right.length&&
  (!t.duration||!c.duration||close)?albumEvidence(t.album,c.album,l,r,albumReading):0;
 const albumAlias=albumScore>=0.60;
 const supported=!!(albumAlias||isrc||title&&(artists&&(!weak||corroborated)||partial||abbreviated)||fuzzy);
 const selectable=!conflict&&supported&&(mode!=='exact'||exact||isrc);
 const risk=conflict?'conflict':weak||partial||cvApprox||abbreviated||albumAlias?'credits':fuzzy?'spelling':supported?'consistent':'none';
 const cvPair=cvApprox&&left.flatMap(x=>right.filter(y=>personEq(x.person,y.person)&&closeCV(x.actor,y.actor)&&!personEq(x.actor,y.actor)).map(y=>[x.actor,y.actor]))[0];
 const reason=conflict||(cvApprox&&!cvPair?'声优一致，角色名拼写接近，需核对':null)||(cvPair?'角色一致，CV 拼写接近：'+personalReading(cvPair[0],l)+' / '+personalReading(cvPair[1],r):'')||(isrc?'录音 ISRC 一致':weak?'声优对应，需核对角色或录音':fuzzy?
  (bothFuzzy?'歌名和主艺人读音均接近，专辑或时长一致':fuzzyTitle?'歌名读音接近，主艺人对应':'歌名对应，主艺人读音接近'):
  abbreviated?'艺人仅署姓或名：'+primary.person+' / '+other.person:partial?'主艺人对应，合作署名有差异':albumAlias?'歌名一致，专辑相似度 '+Math.round(albumScore*100)+'%，艺人署名待核对':!title?'歌名未对应':!artists?'演唱者不同或署名未确认':
  (translatedTitle?'歌名为已核对的双语写法':title===3?'歌名一致':'歌名读音一致')+'，'+(phonetic?'艺人读音一致':'艺人对应'));
 const delta=t.duration>0&&c.duration>0?Math.abs(t.duration-c.duration):Infinity;
 return {c,risk,albumAlias,shortIdentity:abbreviated?latin(personalReading(other.person,r)):null,plausible:!!(title||fuzzyTitle||isrc),priority:selectable?(albumAlias?0.5:fuzzy||partial||weak||cvApprox||abbreviated?1:2):0,exact:exact||isrc,reason,
  score:(isrc?1000:0)+(title?30:0)+(artists&&!weak?15:primaryExact?10:0)+titleFit.score+artistFit.score+albumScore,album:!!album,delta};
}
export async function rank(t,candidates,mode,source,convert,localized=new Map()){
 const results=[];
 for(const c of new Map(candidates.map(c=>[c.id,c])).values()){
  let result=evaluate(t,c,source,await prepare(c,mode,convert),mode);
  const jp=localized.get(c.id);
  if(jp&&result.risk!=='conflict'){
   const localTitle={...c,name:jp.name};
   const variants=[localTitle,{...localTitle,artist:jp.artist,artists:undefined}];
   for(const variant of variants){
    const alt=evaluate(t,variant,source,await prepare(variant,mode,convert),mode);
    if(alt.priority>0&&(alt.priority>result.priority||alt.priority===result.priority&&alt.score>result.score)){
     result={...alt,c,reason:'同一歌曲 ID 的日区署名「'+jp.name+' · '+jp.artist+'」；'+alt.reason};
    }
   }
  }
  if(result.plausible)results.push(result);
 }
 results.sort((a,b)=>b.priority-a.priority||b.score-a.score||Number(b.album)-Number(a.album)||a.delta-b.delta);
 const identities=new Set(results.filter(x=>x.shortIdentity&&x.priority).map(x=>x.shortIdentity));
 if(identities.size>1){
  const backed=new Set(results.filter(x=>x.priority&&x.shortIdentity&&(x.album||x.delta<=4000)).map(x=>x.shortIdentity));
  for(const x of results)if(x.shortIdentity&&(backed.size!==1||!backed.has(x.shortIdentity))){
   x.priority=0;x.reason='简称对应多个艺人，请核对完整署名';
  }
  results.sort((a,b)=>b.priority-a.priority||b.score-a.score||Number(b.album)-Number(a.album)||a.delta-b.delta);
 }
 const [first,second]=results;
 const tied=first?.priority>0&&second?.priority===first.priority&&first.score===second.score&&first.album===second.album&&first.delta===second.delta;
 const ambiguousAlbum=first?.albumAlias&&results.some(x=>x!==first&&x.priority&&x.albumAlias&&norm(x.c.artist)!==norm(first.c.artist));
 const best=first?.priority&&!ambiguousAlbum?first:null;
 const check=best&&(best.priority<=1||tied);
 return {candidate:best?.c,albumAlias:!!best?.albumAlias,tied:!!tied,kind:check?'preselected':best?(best.exact?'exact':mode):'review',risk:first?(tied&&first.risk==='consistent'?'spelling':first.risk):'none',
  reason:ambiguousAlbum?'同名歌曲及相近专辑对应多个演唱者，请核对艺人':check?'已预选 · '+(tied?'多个候选证据相当，按搜索顺序选中首个发行版本。':'')+first.reason:first?.reason||'未找到歌曲',
  ordered:results.map(x=>({...x.c,matchReason:x.reason}))};
}

// Try the full source credit first. For collaborations, narrow by lead artist before trying the title alone.
export async function matchTrack(track,mode,convert,search,override,stopped=()=>false,lookupJapanese){
 const modes=mode==='auto'?['exact','smart','romaji']:[mode];
 const pool=new Map(),profiles=new Map();
 let decision;
 const full=originalQuery(track);
 const artists=track.artists?.length?track.artists:splitCredits(track.artist);
 const lead=artists.length>1?originalQuery({name:track.name,artist:artists[0]}):'';
 const terms=[full,lead,track.name.trim()].filter(Boolean);
 async function* queries(){
  yield* [...terms,...terms.flatMap(queryForms)];
  if(mode==='exact')return;
  const p=profile(track);
  const other=alternateTitle(track.name,p.credits);
  if(other)yield other;
  const loanword=loanwordTitle(track.name);
  if(loanword&&modes.includes('romaji'))yield loanword;
  for(const person of spellings(p.credits[0]?.person||'')){
   if(person&&person!==p.credits[0]?.person)yield track.name+' '+person;
  }
  if(!modes.includes('romaji')||p.version||stopped())return;
  if(japanese.test(track.name)){
   const roman=await convert(track.name);
   if(roman)yield roman.trim();
  }else if(/^[a-z ]{3,48}$/i.test(searchText(track.name))){
   // Only propose kana when every letter can be read and round-tripped.
   const compact=searchText(track.name).toLowerCase().replaceAll(' ','');
   const kana=toHiragana(compact);
   if(/^[ぁ-ゖー]+$/.test(kana)&&toRomaji(kana)===compact){
    yield kana;
    yield toKatakana(kana);
   }
  }
 }
 const searched=new Set();
 for await(const raw of queries()){
  const term=searchText(raw);
  if(!term||searched.has(term))continue;
  searched.add(term);
  if(stopped()||decision?.candidate&&!decision.albumAlias)break;
  try{
   for await(const page of search(term)){
    if(stopped())break;
    for(const c of page){
     const prior=pool.get(c.id);
     if(!prior||c.album&&!prior.album)pool.set(c.id,{...c,query:term});
    }
    if(!pool.size)continue;
    for(const m of modes){
     if(!profiles.has(m))profiles.set(m,await prepare(track,m,convert,override));
     decision=await rank(track,[...pool.values()],m,profiles.get(m),convert);
     if(decision.candidate&&decision.risk==='consistent')return decision;
    }
   }
  }catch(e){if(!pool.size)throw e;break}
 }
 if(!stopped()&&(!decision?.candidate||decision.albumAlias)&&lookupJapanese&&pool.size){
  const ids=[...pool.keys()].filter(id=>/^\d+$/.test(id)).slice(0,80);
  try{
   const localized=new Map();
   for(let i=0;i<ids.length&&!stopped();i+=40){
    for(const c of await lookupJapanese(ids.slice(i,i+40)))if(pool.has(c.id)&&c.name&&c.artist)localized.set(c.id,c);
   }
   const m=modes[modes.length-1];
   if(localized.size&&!stopped())decision=await rank(track,[...pool.values()],m,profiles.get(m)||await prepare(track,m,convert,override),convert,localized);
  }catch{/* Keep the original search results if localized metadata is unavailable. */}
 }
 if(!decision?.candidate&&!stopped()&&pool.size){
  const m=modes[modes.length-1],source=profiles.get(m);
  const preference=['重新母带','TV Size','Live','原声版','乐队版','Remix','加速版','变速版','独唱版'];
  const alternatives=[];
  if(source&&!source.version){
   for(const c of pool.values()){
    const candidate=await prepare(c,m,convert);
    const version=candidate.version;
    const order=preference.findIndex(v=>version===v||version.startsWith(v+' '));
    if(order<0||version.includes(' / ')||/off[\s-]*vocal|instrumental|karaoke|伴奏|カラオケ|翻唱|\bcover\b/i.test(c.name))continue;
    const test=evaluate({...track,isrc:undefined},{...c,isrc:undefined},source,{...candidate,version:''},m==='exact'?'smart':m);
    if(test.priority>0&&test.risk==='consistent')alternatives.push({c,version,order,score:test.score});
   }
  }
  alternatives.sort((a,b)=>a.order-b.order||b.score-a.score);
  const best=alternatives[0];
  if(best){
   const reason='未找到原版，已预选替代版本：'+best.version;
   decision={candidate:best.c,kind:'preselected',risk:'credits',reason,ordered:[{...best.c,matchReason:reason},...(decision?.ordered||[]).filter(c=>c.id!==best.c.id)]};
  }
 }
 decision??={kind:'review',risk:'none',reason:'未找到歌曲',ordered:[]};
 if(!decision.candidate&&pool.size){
  const ranked=new Map(decision.ordered.map(c=>[c.id,c]));
  decision.ordered=Array.from(pool.values(),c=>ranked.get(c.id)||{...c,matchReason:c.query===full?'原始搜索结果，需手选':'仅歌名搜索结果，需手选'});
  decision.reason='未找到可靠匹配，可手动核对搜索结果。'+(decision.risk==='none'?'':decision.reason);
 }
 return decision;
}
