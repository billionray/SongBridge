import {browserOptions} from '../browser-helper/platform.mjs';
import {chromium} from '../browser-helper/node_modules/playwright-core/index.mjs';
import {readMembers} from '../browser-helper/membership.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({...browserOptions(),headless:true,chromiumSandbox:true});
try{
 const page=await browser.newPage();
 await page.setContent('<main><h1>测试</h1><div role="grid" id="view" style="height:350px;overflow:auto"><div id="spacer" style="position:relative"></div></div></main>');
 await page.evaluate(()=>{
  let size=200,loading=false;
  const view=document.querySelector('#view'),spacer=document.querySelector('#spacer');
  function render(){
   spacer.style.height=size*20+'px';
   const first=Math.floor(view.scrollTop/20);
   spacer.replaceChildren();
   for(let i=first;i<Math.min(size,first+20);i++){const el=document.createElement('div');el.dataset.testid='track-list-item';el.dataset.row=i;el.style='position:absolute;height:20px;top:'+i*20+'px';el.innerHTML='<a href="https://music.apple.com/cn/song/'+(10000+i)+'"><span data-testid="track-title">歌'+i+'</span></a><span data-testid="track-column-secondary">歌手</span>';spacer.append(el)}
   if(view.scrollTop+view.clientHeight>=size*20-3&&size<442&&!loading){loading=true;setTimeout(()=>{size=Math.min(442,size+200);loading=false;render()},3200)}
  }
  // A cold virtual list can keep its first window mounted after scrolling.
  let ready=false,scheduled=false;
  view.addEventListener('scroll',()=>{
   if(ready)return render();
   if(!scheduled){scheduled=true;setTimeout(()=>{ready=true;render()},1400)}
  });
  render();
 });
 const members=await readMembers(page,{name:'测试',url:page.url()});
 assert.deepEqual(members.map(s=>s.id),Array.from({length:442},(_,i)=>String(10000+i)));console.log('PASS 200 → 400 → 442 with delayed loads, recycled rows, track 401 present');
}finally{await browser.close()}

