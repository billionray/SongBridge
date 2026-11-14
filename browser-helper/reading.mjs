import kuromoji from 'kuromoji';
import {toRomaji} from 'wanakana';
import {createRequire} from 'node:module';
import path from 'node:path';
let dictionary;
export async function reading(text){
 if(!/[\u3040-\u30ff\u3400-\u9fff]/u.test(text))return text;
 const dir=path.join(path.dirname(createRequire(import.meta.url).resolve('kuromoji/package.json')),'dict');
 dictionary??=new Promise((resolve,reject)=>kuromoji.builder({dicPath:dir}).build((e,t)=>e?reject(e):resolve(t)));
 return (await dictionary).tokenize(text).map(t=>/^[\p{P}\p{S}]+$/u.test(t.surface_form)?t.surface_form:toRomaji(t.reading||t.surface_form)).join(' ').trim();
}
