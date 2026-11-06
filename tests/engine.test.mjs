import test from 'node:test';
import assert from 'node:assert/strict';
import { attackingPairs, attacks, queenNeighbors, HillSearch, landscapes, landscapeNeighbors } from '../dist/engine.js';

test('attacking pairs count unordered horizontal and diagonal conflicts once',()=>{
  assert.equal(attackingPairs([0,0,0,0]),6);
  assert.equal(attackingPairs([0,1,2,3]),6);
  assert.equal(attackingPairs([1,3,0,2]),0);
  assert.equal(attackingPairs([0,4,7,5,2,6,1,3]),0);
  assert.equal(attacks([5,2,4,7,0,4,6,1]).length,1);
});
test('neighborhood changes exactly one column and evaluates all alternatives',()=>{
  const board=[0,1,2,3],neighbors=queenNeighbors(board);
  assert.equal(neighbors.length,12);
  for(const n of neighbors){
    assert.equal(n.state.filter((v,i)=>v!==board[i]).length,1);
    assert.equal(n.score,attackingPairs(n.state));
  }
  assert.deepEqual(board,[0,1,2,3]);
});
test('strict local minimum is shown before an automatic restart',()=>{
  const e=new HillSearch({seed:2,autoRestart:true},[1,6,0,3,7,4,2,5]);
  const stuck=e.step();assert.equal(stuck.kind,'stuck');assert.equal(stuck.reason,'local-minimum');
  assert.equal(stuck.pendingRestart,true);assert.equal(e.restarts,0);assert.equal(e.iteration,0);
  assert.equal(e.step().kind,'restart');assert.equal(e.restarts,1);
  assert.equal(e.bestScore,1);assert.equal(e.sidewaysCount,0);
});
test('sideways moves preserve score and obey the consecutive limit',()=>{
  const e=new HillSearch({sideways:true,sidewaysLimit:1,autoRestart:false,seed:31415},[5,2,4,7,0,4,6,1]);
  const first=e.step();assert.equal(first.kind,'sideways');assert.equal(first.score,1);assert.equal(e.sidewaysCount,1);
  // On this plateau either an improving move resets the streak or another equal neighbor is rejected.
  const second=e.step();
  if(second.kind==='stuck'){assert.equal(second.reason,'plateau');assert.equal(e.done,true);}
  else {assert.ok(second.score<first.score);assert.equal(e.sidewaysCount,0);}
});
test('disabled sideways moves stop on a plateau',()=>{
  const e=new HillSearch({sideways:false,autoRestart:false},[5,2,4,7,0,4,6,1]);
  assert.equal(e.step().kind,'stuck');assert.equal(e.history.at(-1).reason,'plateau');assert.equal(e.done,true);
});
test('restart budgets and preserved best state bound a run',()=>{
  const e=new HillSearch({maxRestarts:0},[1,6,0,3,7,4,2,5]);
  assert.equal(e.step().pendingRestart,false);assert.equal(e.done,true);
  assert.equal(e.restart().kind,'limit');assert.equal(e.restarts,0);
  assert.deepEqual(e.bestState,[1,6,0,3,7,4,2,5]);
});
test('seeded runs reproduce states, tie breaks, and restart decisions',()=>{
  const a=new HillSearch({seed:'demo',sidewaysLimit:4}),b=new HillSearch({seed:'demo',sidewaysLimit:4});
  for(let i=0;i<100;i++){assert.deepEqual(a.step(),b.step());if(a.done)break;}
});
test('each accepted queen move is best among the full neighborhood, with no uphill moves',()=>{
  for(let seed=0;seed<60;seed++){
    const e=new HillSearch({seed,sidewaysLimit:8,maxRestarts:4});
    while(!e.done){
      const previous=e.current.slice(),prior=e.score,s=e.step();
      if(['improve','sideways','solved'].includes(s.kind)&&s.move){
        const min=Math.min(...queenNeighbors(previous).map(n=>n.score));
        assert.equal(s.score,min);assert.ok(s.score<=prior);
      }
    }
    if(e.history.at(-1).kind==='solved')assert.equal(attackingPairs(e.current),0);
  }
});
test('known one-move solution stops at h=0',()=>{
  const e=new HillSearch({},[1,4,7,5,2,6,1,3]);assert.equal(e.step().kind,'solved');assert.equal(e.score,0);
  const before=e.history.length;e.step();assert.equal(e.history.length,before);
});
test('landscape neighbors stay in bounds with eight directions inside the domain',()=>{
  const fn=landscapes.bowl.fn;
  assert.equal(landscapeNeighbors([0,0],fn,.25).length,8);
  assert.equal(landscapeNeighbors([3,3],fn,.25).length,3);
  for(const n of landscapeNeighbors([3,3],fn,.25))assert.ok(n.state.every(v=>v>=-3&&v<=3));
});
test('smooth bowl reaches its global minimum on the aligned grid',()=>{
  const e=new HillSearch({mode:'landscape',function:'bowl',stepSize:.25,autoRestart:false},[2.5,1.75]);
  while(!e.done)e.step();assert.equal(e.score,0);assert.deepEqual(e.current,[0,0]);assert.equal(e.history.at(-1).kind,'solved');
});
test('finite step minimum is not falsely labeled a continuous global optimum',()=>{
  const e=new HillSearch({mode:'landscape',function:'bowl',stepSize:.25,autoRestart:false,sideways:false},[.1,.1]);
  assert.equal(e.step().kind,'stuck');assert.ok(e.score>0);assert.equal(e.history.at(-1).reason,'local-minimum');
});
test('multimodal and terraced functions remain bounded, finite and monotone between restarts',()=>{
  for(const key of Object.keys(landscapes)){
    const e=new HillSearch({mode:'landscape',function:key,maxRestarts:2,sidewaysLimit:3},landscapes[key].start);
    while(!e.done){const old=e.score,s=e.step();assert.ok(Number.isFinite(s.score));if(s.move)assert.ok(s.score<=old+1e-8);}
    assert.ok(e.restarts<=2);assert.ok(e.history.length<1000);
  }
});
