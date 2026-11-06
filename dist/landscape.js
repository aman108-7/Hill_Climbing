import { landscapes, landscapeNeighbors } from './engine.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const palette = [[30,95,78],[68,131,102],[126,166,121],[184,195,136],[220,207,155],[235,221,184]];
function color(t, alpha = 1) {
  const v = clamp(t,0,1)*(palette.length-1), i = Math.min(palette.length-2,Math.floor(v)), f=v-i;
  const c=palette[i].map((a,k)=>Math.round(a*(1-f)+palette[i+1][k]*f));
  return `rgba(${c.join(',')},${alpha})`;
}

export class LandscapeView {
  constructor(canvas, onStart) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.onStart=onStart;
    this.view='3d'; this.yaw=-35*Math.PI/180; this.pitch=.56; this.current=null; this.width=0;
    this.drag=null; this.cache=null;
    this.observer=new ResizeObserver(()=>{ this.cache=null; this.render(); }); this.observer.observe(canvas);
    canvas.addEventListener('pointerdown',e=>{
      if(this.view==='3d'){this.drag={x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch};canvas.setPointerCapture(e.pointerId);}
    });
    canvas.addEventListener('pointermove',e=>{
      if(!this.drag)return;
      this.yaw=this.drag.yaw+(e.clientX-this.drag.x)*.009;
      this.pitch=clamp(this.drag.pitch+(e.clientY-this.drag.y)*.006,.25,1.05);
      this.cache=null; this.render(); this.onRotate?.(this.yaw);
    });
    const end=()=>{this.drag=null;};
    canvas.addEventListener('pointerup',end); canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('click',e=>{
      if(this.view!=='2d'||!this.current)return;
      const r=canvas.getBoundingClientRect(),p=this.plotRect();
      const px=e.clientX-r.left,py=e.clientY-r.top;
      if(px<p.x||px>p.x+p.w||py<p.y||py>p.y+p.h)return;
      const step=this.current.step;
      const snap=v=>clamp(Math.round(v/step)*step,-3,3);
      this.onStart([snap((px-p.x)/p.w*6-3),snap(3-(py-p.y)/p.h*6)]);
    });
    canvas.addEventListener('keydown',e=>{
      if(this.view==='3d'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        e.preventDefault();e.stopPropagation();
        if(e.key==='ArrowLeft')this.yaw-=.12;if(e.key==='ArrowRight')this.yaw+=.12;
        if(e.key==='ArrowUp')this.pitch=clamp(this.pitch+.08,.25,1.05);
        if(e.key==='ArrowDown')this.pitch=clamp(this.pitch-.08,.25,1.05);
        this.cache=null;this.render();this.onRotate?.(this.yaw);
      }
    });
  }
  update(data){this.current=data;this.render();}
  setView(view){this.view=view;this.cache=null;this.render();}
  reset(){this.yaw=-35*Math.PI/180;this.pitch=.56;this.cache=null;this.render();this.onRotate?.(this.yaw);}
  plotRect(){return {x:38,y:17,w:this.width-54,h:this.height-53};}
  render(){
    if(!this.current||!this.canvas.clientWidth)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    this.width=this.canvas.clientWidth;this.height=this.canvas.clientHeight;
    const w=Math.round(this.width*dpr),h=Math.round(this.height*dpr);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.cache=null;}
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.ctx.clearRect(0,0,this.width,this.height);
    const key=[this.current.function,this.view,this.width,this.height,this.yaw,this.pitch].join('|');
    if(this.cache?.key!==key){
      if(this.view==='2d')this.drawContour();else this.drawSurface();
      this.cache={key,image:this.ctx.getImageData(0,0,w,h)};
    } else this.ctx.putImageData(this.cache.image,0,0);
    this.drawPath();
  }
  range(){
    const fn=landscapes[this.current.function].fn;let min=Infinity,max=-Infinity;
    for(let i=0;i<=40;i++)for(let j=0;j<=40;j++){let z=fn(-3+i*.15,-3+j*.15);min=Math.min(min,z);max=Math.max(max,z);}
    return {min,max,fn};
  }
  drawContour(){
    const ctx=this.ctx,p=this.plotRect(),{fn,min,max}=this.range();
    const n=100;
    ctx.fillStyle='#f5f7f1';ctx.fillRect(0,0,this.width,this.height);
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      const z=fn(-3+(i+.5)*6/n,3-(j+.5)*6/n);
      ctx.fillStyle=color((z-min)/(max-min));ctx.fillRect(p.x+i*p.w/n,p.y+j*p.h/n,p.w/n+.5,p.h/n+.5);
    }
    // Marching squares: draw actual isocontours rather than decorative rings.
    const cells=60,dx=6/cells;
    ctx.strokeStyle='rgba(255,255,237,.24)';ctx.lineWidth=.7;
    for(let lev=1;lev<14;lev++){
      const level=min+(max-min)*lev/14;ctx.beginPath();
      for(let i=0;i<cells;i++)for(let j=0;j<cells;j++){
        const x=-3+i*dx,y=-3+j*dx;
        const pts=[[x,y],[x+dx,y],[x+dx,y+dx],[x,y+dx]];
        const zs=pts.map(q=>fn(...q)),cross=[];
        for(let k=0;k<4;k++){
          const next=(k+1)%4,a=zs[k],b=zs[next];
          if((a<level&&b>=level)||(b<level&&a>=level)){
            const t=(level-a)/(b-a);cross.push([pts[k][0]+(pts[next][0]-pts[k][0])*t,pts[k][1]+(pts[next][1]-pts[k][1])*t]);
          }
        }
        const to=q=>[p.x+(q[0]+3)/6*p.w,p.y+(3-q[1])/6*p.h];
        for(let k=0;k+1<cross.length;k+=2){const a=to(cross[k]),b=to(cross[k+1]);ctx.moveTo(...a);ctx.lineTo(...b);}
      }ctx.stroke();
    }
    ctx.font='9px system-ui';ctx.fillStyle='#8b9c81';ctx.textAlign='center';
    for(let t=-3;t<=3;t++){
      ctx.fillText(String(t),p.x+(t+3)/6*p.w,p.y+p.h+16);
      ctx.textAlign='right';ctx.fillText(String(t),p.x-10,p.y+(3-t)/6*p.h+3);ctx.textAlign='center';
    }
    ctx.fillText('x',p.x+p.w/2,this.height-4);ctx.fillText('y',13,p.y+p.h/2);
    ctx.strokeStyle='#b0bf9e';ctx.lineWidth=.5;ctx.strokeRect(p.x,p.y,p.w,p.h);
  }
  project(x,y,z){
    const {min,max}=this.bounds;
    const xx=x*Math.cos(this.yaw)-y*Math.sin(this.yaw);
    const depth=x*Math.sin(this.yaw)+y*Math.cos(this.yaw);
    const height=(z-min)/(max-min)*3.8;
    const scale=Math.min(this.width/10.2,this.height/8.7);
    return [this.width/2+xx*scale,this.height*.69+(depth*Math.sin(this.pitch)-height*Math.cos(this.pitch))*scale,depth];
  }
  drawSurface(){
    const ctx=this.ctx;this.bounds=this.range();const{fn,min,max}=this.bounds;
    ctx.fillStyle='#f5f7f1';ctx.fillRect(0,0,this.width,this.height);
    // Render the ground grid before the mesh, then sort surface tiles by depth.
    ctx.lineWidth=.6;ctx.strokeStyle='#dce5d5';
    for(let i=-3;i<=3;i++){
      const a=this.project(i,-3,min),b=this.project(i,3,min),c=this.project(-3,i,min),d=this.project(3,i,min);
      ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.moveTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.stroke();
    }
    const n=this.current.function==='rastrigin'?66:40,dx=6/n,tiles=[];
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      const x=-3+i*dx,y=-3+j*dx;
      const world=[[x,y],[x+dx,y],[x+dx,y+dx],[x,y+dx]].map(q=>[...q,fn(...q)]);
      const points=world.map(q=>this.project(...q));
      tiles.push({points,z:world.reduce((s,q)=>s+q[2],0)/4,depth:points.reduce((s,q)=>s+q[2],0)/4});
    }
    tiles.sort((a,b)=>a.depth-b.depth);
    for(const tile of tiles){
      ctx.beginPath();tile.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
      ctx.fillStyle=color((tile.z-min)/(max-min));ctx.fill();
      ctx.strokeStyle='rgba(245,250,231,.20)';ctx.lineWidth=.45;ctx.stroke();
    }
    ctx.fillStyle='#8b9f7d';ctx.font='9px system-ui';ctx.textAlign='center';
    const axes=[[-3.5,0,min,'x'],[0,3.5,min,'y'],[-3,-3,max,'f(x, y)']];
    for(const[x,y,z,text]of axes){const p=this.project(x,y,z);ctx.fillText(text,p[0],clamp(p[1],15,this.height-9));}
    // A compact cost scale reinforces that color and height encode the same value.
    const gx=14,gy=17,gw=70,gh=5;
    for(let i=0;i<gw;i++){ctx.fillStyle=color(i/gw);ctx.fillRect(gx+i,gy,1,gh);}
    ctx.textAlign='left';ctx.fillStyle='#8da080';ctx.font='7px system-ui';ctx.fillText('LOW COST',gx,gy+16);ctx.fillText('HIGH',gx+52,gy+16);
  }
  point(state){
    if(this.view==='3d')return this.project(...state,landscapes[this.current.function].fn(...state));
    const p=this.plotRect();return[p.x+(state[0]+3)/6*p.w,p.y+(3-state[1])/6*p.h];
  }
  drawPath(){
    const ctx=this.ctx,{history,index,state,step,function:key}=this.current;
    const visible=history.slice(0,index+1);let previous=null;
    const attempt=visible.at(-1)?.restarts||0;
    for(const event of visible){
      if(event.kind==='start'||event.kind==='restart')previous=null;
      const p=this.point(event.state);
      if(previous){ctx.beginPath();ctx.moveTo(previous[0],previous[1]);ctx.lineTo(p[0],p[1]);ctx.strokeStyle=event.restarts===attempt?'#ffffffee':'#ffffff70';ctx.lineWidth=event.restarts===attempt?2.3:1.2;ctx.stroke();}
      if(['improve','sideways','solved'].includes(event.kind)){ctx.beginPath();ctx.arc(p[0],p[1],event.restarts===attempt?2.6:1.6,0,Math.PI*2);ctx.fillStyle=event.kind==='sideways'?'#f3d17c':'#fff';ctx.fill();}
      previous=p;
    }
    const neighbors=landscapeNeighbors(state,landscapes[key].fn,step),score=landscapes[key].fn(...state);
    for(const n of neighbors){const p=this.point(n.state);ctx.beginPath();ctx.arc(p[0],p[1],2.5,0,Math.PI*2);ctx.fillStyle=n.score<score-1e-8?'#9ae4be':'#f6eed1bb';ctx.fill();ctx.strokeStyle='#315d4c77';ctx.lineWidth=.6;ctx.stroke();}
    const p=this.point(state);
    ctx.beginPath();ctx.arc(p[0],p[1],10,0,Math.PI*2);ctx.fillStyle='#ffffff3b';ctx.fill();
    ctx.beginPath();ctx.arc(p[0],p[1],5.4,0,Math.PI*2);ctx.fillStyle='#174d3f';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();
    const label=`(${state[0].toFixed(2)}, ${state[1].toFixed(2)})`;
    ctx.font='9px system-ui';const labelW=ctx.measureText(label).width+13;
    const lx=clamp(p[0]+12,5,this.width-labelW-5),ly=clamp(p[1]-21,7,this.height-25);
    ctx.fillStyle='#ffffffed';ctx.beginPath();ctx.roundRect(lx,ly,labelW,21,4);ctx.fill();ctx.fillStyle='#365e45';ctx.textAlign='left';ctx.fillText(label,lx+7,ly+14);
  }
}
