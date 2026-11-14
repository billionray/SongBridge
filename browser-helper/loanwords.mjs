import {readFileSync} from 'node:fs';

const key=text=>text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
const index=new Map();
function add(from,to){
 const k=key(from);
 if(!index.has(k))index.set(k,[]);
 const list=index.get(k);
 if(!list.includes(to))list.push(to);
}
for(const line of readFileSync(new URL('./loanwords.tsv',import.meta.url),'utf8').trimEnd().split('\n')){
 const [kana,english]=line.split('\t');
 add(kana,english);
 add(english,kana);
}

export function dictionaryForms(text){
 if(!text||text.length>96)return [];
 const whole=index.get(key(text))||[];
 const parts=text.trim().split(/[\s・-]+/u);
 if(parts.length<2||parts.length>5)return whole;
 // Try complete phrases first, then compose their words without guessing unknown ones.
 const words=parts.map(part=>index.get(key(part))?.[0]);
 if(words.some(word=>!word))return whole;
 const phrase=words.join(/[ァ-ヺー]/u.test(text)?' ':'・');
 return [...new Set([...whole,phrase])];
}
export function dictionaryPair(a,b){
 if(!a||!b||/[ァ-ヺー]/u.test(a)===/[ァ-ヺー]/u.test(b))return false;
 return dictionaryForms(a).some(s=>key(s)===key(b))||dictionaryForms(b).some(s=>key(s)===key(a));
}
