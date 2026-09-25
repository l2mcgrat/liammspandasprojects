/* Offline Canvas viewer: no CDN, bundler, WebGL, or external application required. */
(() => {
  'use strict';
  const data = window.DIPOLE_ATLAS;
  if (!data || !data.conditions.length) return;
  const $ = id => document.getElementById(id);
  const select = $('condition'), slider = $('frame');
  let condition = data.conditions[0], frame = 0, playing = false, last = 0;
  let yaw = 0.55, pitch = -0.38, drag = null;
  data.conditions.forEach((entry, i) => {
    const s = entry.summary, option = document.createElement('option');
    option.value = i;
    option.textContent = `${s.label} · ${Number(s.temperature_K)} K · ${s.pressure_kPa ? Number(s.pressure_kPa) + ' kPa' : 'NVT'}`;
    select.append(option);
  });
  function choose() {
    condition = data.conditions[Number(select.value)]; frame = 0;
    slider.max = condition.frames.length - 1; slider.value = 0;
    const s = condition.summary;
    $('condition-detail').textContent = `${s.molecules} molecules · ${s.production_ps} ps production · ${s.ensemble.toUpperCase()} · seeded temperature path`;
    render();
  }
  function project(p, box, w, h) {
    let [x,y,z] = p.map(v => v / box - 0.5);
    [x,z] = [x*Math.cos(yaw)+z*Math.sin(yaw), -x*Math.sin(yaw)+z*Math.cos(yaw)];
    [y,z] = [y*Math.cos(pitch)-z*Math.sin(pitch), y*Math.sin(pitch)+z*Math.cos(pitch)];
    const scale = Math.min(w,h)*0.71, perspective = 3.5/(3.5-z);
    return [w/2+x*scale*perspective,h/2-y*scale*perspective,z,perspective];
  }
  function scene(state) {
    const canvas=$('scene'), ctx=canvas.getContext('2d'), w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);
    const glow=ctx.createRadialGradient(w/2,h/2,20,w/2,h/2,h/2);
    glow.addColorStop(0,'#24576922');glow.addColorStop(1,'#080e1b00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    const corners=[];for(let i=0;i<8;i++) corners.push(project([i&1?state.box:0,i&2?state.box:0,i&4?state.box:0],state.box,w,h));
    ctx.strokeStyle='#3e586d';ctx.lineWidth=1;
    for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit)){ctx.beginPath();ctx.moveTo(...corners[i].slice(0,2));ctx.lineTo(...corners[i|bit].slice(0,2));ctx.stroke();}
    const particles=state.points.map(p=>({p,q:project(p.slice(0,3),state.box,w,h)})).sort((a,b)=>a.q[2]-b.q[2]);
    for(const {p,q} of particles){
      const length=state.box*0.065, end=project(p.slice(0,3).map((v,i)=>v+p[i+3]*length),state.box,w,h);
      const hue=(Math.atan2(p[4],p[3])+Math.PI)/(2*Math.PI)*300+20;
      ctx.strokeStyle=`hsl(${hue},78%,66%)`;ctx.fillStyle=ctx.strokeStyle;ctx.globalAlpha=.65+.35*(q[2]+1)/2;
      ctx.lineWidth=2.4*q[3];ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(end[0],end[1]);ctx.stroke();
      const angle=Math.atan2(end[1]-q[1],end[0]-q[0]);
      ctx.beginPath();ctx.moveTo(end[0],end[1]);ctx.lineTo(end[0]-7*Math.cos(angle-.45),end[1]-7*Math.sin(angle-.45));ctx.lineTo(end[0]-7*Math.cos(angle+.45),end[1]-7*Math.sin(angle+.45));ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.arc(q[0],q[1],4.5*q[3],0,2*Math.PI);ctx.fill();
    }
    ctx.globalAlpha=1;ctx.fillStyle='#8fa5c3';ctx.font='13px system-ui';
    ctx.fillText(`L = ${state.box.toFixed(3)} nm   |   T = ${state.temperature.toFixed(1)} K (instantaneous)`,24,h-20);
  }
  function angles(state) {
    const c=$('angles'),ctx=c.getContext('2d'), bins=Array(80).fill(0), nx=10,ny=8;
    for(const p of state.points){const x=Math.min(nx-1,Math.floor((Math.atan2(p[4],p[3])+Math.PI)/(2*Math.PI)*nx));const y=Math.min(ny-1,Math.max(0,Math.floor((p[5]+1)/2*ny)));bins[y*nx+x]++;}
    const max=Math.max(1,...bins),cw=39,ch=26,left=62,top=30;
    ctx.clearRect(0,0,c.width,c.height);
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const v=bins[y*nx+x]/max;ctx.fillStyle=`hsl(${190-145*v},${32+55*v}%,${11+53*v}%)`;ctx.fillRect(left+x*cw,top+(ny-1-y)*ch,cw-2,ch-2);}
    ctx.fillStyle='#8fa5c3';ctx.font='12px system-ui';ctx.fillText('−180°',left-10,top+ny*ch+21);ctx.fillText('0°',left+nx*cw/2-10,top+ny*ch+21);ctx.fillText('+180°',left+nx*cw-36,top+ny*ch+21);ctx.fillText('φ',left+nx*cw/2,top+ny*ch+45);ctx.fillText('+1',32,top+10);ctx.fillText('−1',32,top+ny*ch);ctx.save();ctx.translate(18,150);ctx.rotate(-Math.PI/2);ctx.fillText('cos(θ)',0,0);ctx.restore();
  }
  function trace() {
    const c=$('trace'),ctx=c.getContext('2d'),frames=condition.frames,left=40,top=20,w=c.width-60,h=160;
    ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='#2c3e55';ctx.font='11px system-ui';ctx.fillStyle='#8fa5c3';
    for(const v of [0,.5,1]){const y=top+h*(1-v);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left+w,y);ctx.stroke();ctx.fillText(v.toFixed(1),9,y+4);}
    for(const [key,color] of [['order','#5eead4'],['fcc','#fbbf24']]){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=2;frames.forEach((f,i)=>{const x=left+i/Math.max(1,frames.length-1)*w,y=top+h*(1-f[key]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
    const x=left+frame/Math.max(1,frames.length-1)*w;ctx.strokeStyle='#e2e8f0';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+h);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#8fa5c3';ctx.fillText(`${frames[0].time.toFixed(2)} ps`,left,205);ctx.fillText(`${frames[frames.length-1].time.toFixed(2)} ps`,left+w-52,205);
  }
  function render(){const state=condition.frames[frame];for(const key of ['order','fcc','density','energy'])$(key).textContent=state[key].toFixed(3);$('clock').textContent=`${state.time.toFixed(3)} ps · ${frame+1}/${condition.frames.length}`;slider.value=frame;scene(state);angles(state);trace();}
  select.addEventListener('change',choose);
  slider.addEventListener('input',()=>{frame=Number(slider.value);render();});
  $('play').addEventListener('click',()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';last=0;});
  $('scene').addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];e.currentTarget.setPointerCapture(e.pointerId);});
  $('scene').addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.009;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-drag[1])*.009));drag=[e.clientX,e.clientY];render();});
  for(const event of ['pointerup','pointercancel'])$('scene').addEventListener(event,()=>{drag=null;});
  function tick(now){if(playing && now-last>=1000/Number($('speed').value)){frame=(frame+1)%condition.frames.length;last=now;render();}requestAnimationFrame(tick);}
  choose();requestAnimationFrame(tick);
})();