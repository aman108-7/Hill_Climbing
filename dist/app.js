import { HillSearch, queenNeighbors, attacks, landscapes } from './engine.js';
import { LandscapeView } from './landscape.js';

const $ = id => document.getElementById(id);
const presetBoards={plateau:[5,2,4,7,0,4,6,1],local:[1,6,0,3,7,4,2,5],near:[1,4,7,5,2,6,1,3]};
const queenSVG='<svg viewBox="0 0 64 64" fill="none"><path d="m14 19 5 23h26l5-23-12 9-6-15-6 15-12-9Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="16" r="4" fill="currentColor"/><circle cx="32" cy="10" r="4" fill="currentColor"/><circle cx="52" cy="16" r="4" fill="currentColor"/><path d="M18 47h28M16 53h32" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M25 38h14" stroke="#ffffff70" stroke-width="2" stroke-linecap="round"/></svg>';
let mode='queens', engine, running=false, timer=null, reviewIndex=null, boardN=0, customBoard=null;
const number=(v,lo,hi,fallback)=>Number.isFinite(+v)?Math.max(lo,Math.min(hi,Math.round(+v))):fallback;
const fmt=(n,exact=false)=>mode==='queens'?String(n):n.toFixed(exact?4:2);
const letter=c=>String.fromCharCode(65+c);
const landscape=new LandscapeView($('landscape'),state=>resetSearch(state));
landscape.onRotate=yaw=>{$('rotation').value=String(((yaw*180/Math.PI+180)%360+360)%360-180);};

function config(){
  return {mode,n:number($('board-size').value,4,16,8),seed:$('seed').value||'31415',
    sideways:$('sideways').checked,sidewaysLimit:number($('sideways-limit').value,1,100,8),
    autoRestart:$('auto-restart').checked,maxRestarts:number($('restart-limit').value,0,100,20),
    function:$('function-select').value,stepSize:+$('step-size').value};
}
function pause(){running=false;clearTimeout(timer);timer=null;syncPlayback();}
function resetSearch(initial){
  pause();reviewIndex=null;
  const c=config();
  if(!initial&&mode==='queens')initial=$('preset').value==='custom'?customBoard:presetBoards[$('preset').value];
  if(!initial&&mode==='landscape')initial=landscapes[c.function].start;
  engine=new HillSearch(c,initial);
  $('sideways-limit').value=c.sidewaysLimit;$('restart-limit').value=c.maxRestarts;
  $('size-output').textContent=`${c.n} × ${c.n}`;
  $('sideways-limit').disabled=!c.sideways;$('restart-limit').disabled=!c.autoRestart;
  render();
}
function syncPlayback(){
  if(!engine)return;
  $('run-icon').textContent=running?'Ⅱ':'▶';
  const label=running?'Pause':engine.done?'New search':engine.iteration>0?'Resume':'Run search';
  $('run-label').textContent=label;
  $('step').disabled=engine.done&&reviewIndex===null;
  $('manual-restart').disabled=engine.restarts>=engine.config.maxRestarts;
  $('mobile-run').textContent=running?'Ⅱ Pause':engine.done?'↻ New search':'▶ Run search';
  $('mobile-step').disabled=$('step').disabled;
}
function play(){
  if(running){pause();render();return;}
  if(engine.done)resetSearch();
  reviewIndex=null;running=true;syncPlayback();render();
  timer=setTimeout(tick,250);
}
function tick(){
  if(!running)return;
  engine.step();render();
  if(engine.done){pause();render();return;}
  timer=setTimeout(tick,1000/+$('speed').value);
}
function oneStep(){
  pause();
  if(reviewIndex!==null&&reviewIndex<engine.history.length-1){
    reviewIndex++;if(reviewIndex===engine.history.length-1)reviewIndex=null;
  }else{reviewIndex=null;engine.step();}
  render();
}
function setMode(next){
  mode=next;pause();
  for(const m of ['queens','landscape'])$('tab-'+m).setAttribute('aria-selected',String(m===mode));
  $('workspace').setAttribute('aria-labelledby','tab-'+mode);
  $('queens-controls').hidden=mode!=='queens';$('landscape-controls').hidden=mode!=='landscape';
  $('board-wrap').hidden=mode!=='queens';$('board-toolbar').hidden=mode!=='queens';
  $('landscape-wrap').hidden=mode!=='landscape';$('workspace').classList.toggle('landscape-mode',mode==='landscape');
  $('cost-label').textContent=mode==='queens'?'ATTACKING PAIRS':'FUNCTION COST · f(x, y)';
  $('cost-hint').textContent=mode==='queens'?'The goal is zero.':'Lower is better.';
  $('chart-label').textContent=mode==='queens'?'Attacking pairs':'Function cost';
  resetSearch();
}
function render(){
  const index=reviewIndex??engine.history.length-1;
  const s=engine.history[index];
  $('visual-title').textContent=mode==='queens'?'The chessboard':landscapes[engine.config.function].name;
  $('board-pill').textContent=mode==='queens'?`${engine.config.n} QUEENS`:'2 VARIABLES';
  $('visual-subtitle').textContent=mode==='queens'?'One queen per column. No two queens should attack.':'Follow a greedy search through the same function in 2D and 3D.';
  $('edit-hint').innerHTML=mode==='queens'?'<span>↳</span> Click any square to try your own starting board.':landscapes[engine.config.function].hint;
  if(mode==='queens')renderBoard(s);else{
    $('formula').textContent=landscapes[engine.config.function].formula;
    landscape.update({function:engine.config.function,state:s.state,history:engine.history,index,step:engine.config.stepSize});
  }
  $('cost').textContent=fmt(s.score);$('iteration').textContent=s.iteration.toLocaleString();
  $('restarts').innerHTML=`${s.restarts}<span> / ${engine.config.maxRestarts}</span>`;
  $('sideways-count').innerHTML=`${s.sidewaysCount}<span> / ${engine.config.sideways?engine.config.sidewaysLimit:'off'}</span>`;
  $('evaluations').textContent=s.evaluations.toLocaleString();
  $('best-label').textContent=`Best so far: ${fmt(s.bestScore)}`;
  const known=mode==='queens'||landscapes[engine.config.function].optimum!==null;
  $('goal-label').textContent=known?'goal: 0':'minimize';
  const initial=Math.abs(engine.history[0].score),progress=known?Math.max(0,Math.min(1,1-s.bestScore/(initial||1))):Math.max(.08,Math.min(1,.3+(engine.history[0].score-s.bestScore)/(Math.abs(engine.history[0].score)+5)));
  $('goal-progress').style.width=`${progress*100}%`;
  const difference=s.previous===undefined?null:s.score-s.previous;
  $('delta').textContent=s.kind==='restart'?'RESTART':difference===null?(s.kind==='solved'?'SOLVED':'INITIAL'):Math.abs(difference)<1e-8?'NO CHANGE':`${difference>0?'+':''}${fmt(difference)}`;
  $('delta').className='delta '+s.kind;
  let status=reviewIndex!==null?'Reviewing':running?'Running':s.kind==='solved'?'Solved':s.kind==='stuck'?'Stuck':s.kind==='limit'?'Limit reached':engine.iteration>0||engine.restarts>0?'Paused':'Ready';
  $('status-pill').className='status-pill '+(reviewIndex!==null?'':s.kind==='stuck'?'stuck':s.kind==='solved'?'solved':running?'running':'');
  $('status-pill').innerHTML=`<span></span>${status}`;
  $('decision-card').className='decision-card '+s.kind;
  $('decision-type').textContent=s.kind==='start'?'YOUR NEXT MOVE':s.kind==='solved'?'OBJECTIVE COMPLETE':s.kind==='stuck'?'WHY WE STOPPED':s.kind==='restart'?'A FRESH START':s.kind==='limit'?'SEARCH BUDGET':'THE LAST DECISION';
  $('decision-title').textContent=s.kind==='start'?'Ready to explore':s.title;
  $('decision-detail').textContent=s.kind==='start'?'Start the search or take it one step at a time. All neighbors are scored before each move.':s.detail;
  $('history').max=engine.history.length-1;$('history').value=index;
  $('history').disabled=engine.history.length<=1;
  $('replay-label').textContent=reviewIndex===null?'LIVE':'REVIEW';
  $('history-count').textContent=`State ${index+1} of ${engine.history.length}`;
  $('return-live').hidden=reviewIndex===null;
  renderChart(index);renderTrace(index);syncPlayback();
}
function renderBoard(s){
  const n=s.state.length;
  if(n!==boardN){
    boardN=n;$('board').style.setProperty('--n',n);$('board').setAttribute('role','group');
    $('board').setAttribute('aria-label',`${n} by ${n} chessboard. Click a square to move its column's queen.`);
    $('cells').replaceChildren();$('pieces').replaceChildren();
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){
      const btn=document.createElement('button');btn.type='button';btn.className='cell '+((r+c)%2?'dark':'');
      btn.dataset.row=r;btn.dataset.col=c;
      btn.addEventListener('click',()=>{
        const current=engine.history[reviewIndex??engine.history.length-1].state.slice();
        if(current[c]===r)return;
        current[c]=r;customBoard=current;
        if(!$('preset').querySelector('[value=custom]')){const o=document.createElement('option');o.value='custom';o.textContent='Your custom board';$('preset').append(o);}
        $('preset').value='custom';resetSearch(current);
      });
      $('cells').append(btn);
    }
    for(let c=0;c<n;c++){const p=document.createElement('div');p.className='queen';p.style.width=`${100/n}%`;p.style.height=`${100/n}%`;p.style.left=`${c*100/n}%`;p.innerHTML=queenSVG;$('pieces').append(p);}
    $('rank-labels').innerHTML=Array.from({length:n},(_,i)=>`<span>${n-i}</span>`).join('');
    $('file-labels').innerHTML=Array.from({length:n},(_,i)=>`<span>${letter(i)}</span>`).join('');
  }
  const pairs=attacks(s.state),conflicted=new Set(pairs.flat());
  const moved=s.move?.column;
  const costs=$('show-costs').checked?queenNeighbors(s.state):[];
  const costMap=new Map(costs.map(x=>[`${x.move.to},${x.move.column}`,x.score]));
  const best=Math.min(...costs.map(x=>x.score));
  for(const cell of $('cells').children){
    const r=+cell.dataset.row,c=+cell.dataset.col,cost=costMap.get(`${r},${c}`),occupied=s.state[c]===r;
    cell.classList.toggle('last',moved===c&&occupied);cell.classList.toggle('best-cost',cost===best&&cost!==undefined);
    cell.innerHTML=$('show-costs').checked&&!occupied?`<span>${cost}</span>`:'';
    cell.setAttribute('aria-label',`${letter(c)}${n-r}: ${occupied?'queen, '+(conflicted.has(c)?'in conflict':'safe'):'move queen here'}${cost===undefined?'':`, resulting cost ${cost}`}`);
  }
  for(let c=0;c<n;c++){
    const p=$('pieces').children[c];p.style.top=`${s.state[c]*100/n}%`;
    p.className='queen '+(conflicted.has(c)?'conflict':'safe')+(moved===c?' last':'');
    p.style.background='transparent';
  }
  const svg=$('attack-lines');svg.setAttribute('viewBox',`0 0 ${n} ${n}`);
  svg.innerHTML=$('show-attacks').checked?pairs.map(([a,b])=>`<line x1="${a+.5}" y1="${s.state[a]+.5}" x2="${b+.5}" y2="${s.state[b]+.5}" stroke="#af6750" stroke-width=".035" stroke-dasharray=".09 .07" opacity=".43"/>`).join(''):'';
}
function moveText(s){
  if(!s.move)return s.kind==='start'?'Starting position':s.kind==='stuck'?(s.pendingRestart?'Restart on next step':'Search stopped'):s.kind==='restart'?`Attempt ${s.restarts+1}`:s.kind==='limit'?'Try a new search':'';
  if(mode==='queens')return `Column ${letter(s.move.column)} · row ${engine.config.n-s.move.from} → ${engine.config.n-s.move.to}`;
  return `x = ${s.state[0].toFixed(2)}, y = ${s.state[1].toFixed(2)}`;
}
function renderTrace(index){
  const visible=engine.history.slice(0,index+1).map((s,i)=>({...s,index:i})).slice(-60).reverse();
  $('event-count').textContent=index+1;$('trace-list').replaceChildren();
  for(const s of visible){
    const li=document.createElement('li');li.className=s.kind;
    const st=document.createElement('span');st.className='event-step';st.textContent=String(s.index).padStart(2,'0');
    const copy=document.createElement('div'),title=document.createElement('span'),detail=document.createElement('span');
    title.className='event-title';title.textContent=s.title;detail.className='event-detail';detail.textContent=moveText(s);
    copy.append(title,detail);const score=document.createElement('span');score.className='event-score';score.textContent=fmt(s.score);
    li.append(st,copy,score);$('trace-list').append(li);
  }
}
function renderChart(selected){
  const h=engine.history,svg=$('progress-chart'),w=720,hh=142,p={l:28,r:9,t:10,b:23};
  const ys=h.map(s=>s.score);let lo=Math.min(0,...ys),hi=Math.max(1,...ys);
  const padding=(hi-lo)*.08;hi+=padding;if(lo<0)lo-=padding;
  const x=i=>p.l+(w-p.l-p.r)*(h.length<2?0:i/(h.length-1));
  const y=v=>p.t+(hh-p.t-p.b)*(1-(v-lo)/(hi-lo));
  let markup='';
  for(let i=0;i<=3;i++){
    const v=lo+(hi-lo)*i/3,yy=y(v);markup+=`<line x1="${p.l}" x2="${w-p.r}" y1="${yy}" y2="${yy}" stroke="#edf1e7" stroke-dasharray="3 5"/><text x="${p.l-9}" y="${yy+3}" text-anchor="end" fill="#a3b296" font-size="8" font-family="system-ui">${mode==='queens'?Math.round(v):v.toFixed(1)}</text>`;
  }
  const line=h.map((s,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(s.score).toFixed(2)}`).join(' ');
  if(h.length>1){const area=`${line} L${x(h.length-1)},${y(lo)} L${x(0)},${y(lo)} Z`;markup+=`<defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#86a67b" stop-opacity=".14"/><stop offset="1" stop-color="#86a67b" stop-opacity=".01"/></linearGradient></defs><path d="${area}" fill="url(#chart-fill)"/>`;}
  markup+=`<path d="${line}" fill="none" stroke="#7a9a6f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  for(let i=0;i<h.length;i++){
    const s=h[i];if(s.kind==='restart')markup+=`<line x1="${x(i)}" x2="${x(i)}" y1="${p.t}" y2="${hh-p.b}" stroke="#d5b76b" stroke-dasharray="3 3" stroke-width=".8"/>`;
    if(s.kind==='sideways'||s.kind==='stuck'||s.kind==='restart')markup+=`<circle cx="${x(i)}" cy="${y(s.score)}" r="2.6" fill="${s.kind==='restart'?'#8a9bb7':'#ceb166'}" stroke="#fff" stroke-width="1"/>`;
  }
  const cx=x(selected),cy=y(h[selected].score);
  markup+=`<circle cx="${cx}" cy="${cy}" r="5" fill="#eef5e9" stroke="#568746" stroke-width="1.8"/><text x="${p.l}" y="${hh-5}" fill="#a3b296" font-size="8" font-family="system-ui">START</text><text x="${w-p.r}" y="${hh-5}" text-anchor="end" fill="#a3b296" font-size="8" font-family="system-ui">${h.length>1?'STATE '+(h.length-1):'YOUR SEARCH BEGINS HERE'}</text>`;
  svg.innerHTML=markup;svg.setAttribute('aria-label',`Objective cost over ${h.length} recorded states. Current cost ${fmt(h[selected].score)}, best ${fmt(h[selected].bestScore)}.`);
}

// Compact playback stays in reach on a phone while the board is on screen.
const mobile=document.createElement('nav');mobile.className='mobile-playback';mobile.setAttribute('aria-label','Quick search controls');
mobile.innerHTML='<button id="mobile-run">▶ Run search</button><button id="mobile-step">Step →</button><button id="mobile-settings">Settings ⚙</button>';
document.body.append(mobile);
$('mobile-run').addEventListener('click',play);$('mobile-step').addEventListener('click',oneStep);
$('mobile-settings').addEventListener('click',()=>document.querySelector('.control-panel').scrollIntoView({behavior:'smooth',block:'start'}));
$('run').addEventListener('click',play);$('step').addEventListener('click',oneStep);$('new-run').addEventListener('click',()=>resetSearch());
$('manual-restart').addEventListener('click',()=>{pause();reviewIndex=null;engine.restart(true);render();});
for(const m of ['queens','landscape'])$('tab-'+m).addEventListener('click',()=>setMode(m));
// Tabs also support the standard left/right keyboard navigation.
for(const m of ['queens','landscape'])$('tab-'+m).addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();const next=m==='queens'?'landscape':'queens';setMode(next);$('tab-'+next).focus();}
});
$('board-size').addEventListener('input',()=>{$('preset').value='random';resetSearch();});
$('preset').addEventListener('change',()=>{if(presetBoards[$('preset').value])$('board-size').value='8';resetSearch();});
for(const id of ['seed','sideways','auto-restart','sideways-limit','restart-limit','function-select','step-size'])$(id).addEventListener('change',()=>resetSearch());
$('shuffle-seed').addEventListener('click',()=>{
  const a=new Uint32Array(1);crypto.getRandomValues(a);$('seed').value=String(a[0]%100000);
  if(mode==='queens')$('preset').value='random';resetSearch();
});
$('speed').addEventListener('input',()=>{$('speed-output').textContent=`${$('speed').value} steps / sec`;});
for(const id of ['show-attacks','show-costs'])$(id).addEventListener('change',()=>render());
$('history').addEventListener('input',()=>{pause();reviewIndex=+$('history').value;if(reviewIndex===engine.history.length-1)reviewIndex=null;render();});
$('return-live').addEventListener('click',()=>{reviewIndex=null;render();});
for(const view of ['2d','3d'])$('view-'+view).addEventListener('click',()=>{
  landscape.setView(view);
  for(const v of ['2d','3d']){$('view-'+v).classList.toggle('active',v===view);$('view-'+v).setAttribute('aria-pressed',String(v===view));}
  $('rotation-control').hidden=view!=='3d';$('reset-view').hidden=view!=='3d';
  $('canvas-hint').textContent=view==='3d'?'Drag to rotate the surface':'Click the map to set a starting point';
});
$('rotation').addEventListener('input',()=>{landscape.yaw=+$('rotation').value*Math.PI/180;landscape.cache=null;landscape.render();});
$('reset-view').addEventListener('click',()=>landscape.reset());
function traceTab(which){
  $('trace-tab').setAttribute('aria-selected',String(which==='trace'));$('code-tab').setAttribute('aria-selected',String(which==='code'));
  $('trace-content').hidden=which!=='trace';$('code-content').hidden=which!=='code';
}
$('trace-tab').addEventListener('click',()=>traceTab('trace'));$('code-tab').addEventListener('click',()=>traceTab('code'));
for(const id of ['trace-tab','code-tab'])$(id).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();const next=id==='trace-tab'?'code':'trace';traceTab(next);$(next+'-tab').focus();}});
for(const id of ['help-open','help-bottom'])$(id).addEventListener('click',()=>{pause();render();$('help-dialog').showModal();});
for(const id of ['help-close','help-done'])$(id).addEventListener('click',()=>$('help-dialog').close());
$('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('keydown',e=>{
  if($('help-dialog').open||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,textarea,button,a,[contenteditable]'))return;
  if(e.code==='Space'){e.preventDefault();play();}if(e.key==='ArrowRight'){e.preventDefault();oneStep();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){pause();render();}});
resetSearch();
