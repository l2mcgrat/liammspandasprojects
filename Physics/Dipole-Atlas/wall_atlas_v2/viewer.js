/* Offline Canvas viewer: no CDN, bundler, WebGL, or external application required. */
(() => {
  'use strict';
  const data = window.DIPOLE_ATLAS;
  if (!data || !data.conditions.length) return;
  const $ = id => document.getElementById(id);
  const slider = $('frame');
  const metrics = data.metrics, dimensions = ['potential','molecule','temperature','pressure'];
  const fields = {potential:'potential',molecule:'molecule',temperature:'temperature_K',pressure:'pressure_kPa'};
  const valueOf = (s,id) => ['temperature','pressure'].includes(id) ? (s[fields[id]] === '' ? '' : String(Number(s[fields[id]]))) : s[fields[id]];
  let requested = new URLSearchParams(location.search);
  let condition = data.conditions[0], frame = 0, playing = false, last = 0;
  let yaw = 0.55, pitch = -0.38, drag = null;
  for (const [id, [,label]] of Object.entries(metrics)) $('metric').add(new Option(label,id));
  $('metric').value = metrics[requested.get('metric')] ? requested.get('metric') : 'o6';
  function syncURL(push=false) {
    const url = new URL(location.href);
    for (const id of [...dimensions,'metric','display']) url.searchParams.set(id,$(id).value);
    // file:// viewers have differing history restrictions; downloads still work.
    try { history[push?'pushState':'replaceState'](null,'',url); } catch (_) { /* local-file fallback */ }
    $('share').href=url.href;
  }
  function choose(push=false) {
    let candidates=data.conditions, fallback=false;
    for(const id of dimensions){
      const wanted=requested.has(id)?requested.get(id):$(id).value;
      const values=[...new Set(candidates.map(e=>valueOf(e.summary,id)))];
      if(['temperature','pressure'].includes(id))values.sort((a,b)=>Number(a)-Number(b));
      $(id).replaceChildren();
      for(const v of values){const s=candidates.find(e=>valueOf(e.summary,id)===v).summary;
        const label=id==='molecule'?s.label:id==='potential'?data.potentials[v]:id==='temperature'?`${v} K`:v?`${v} kPa`:'Not controlled · NVT';
        $(id).add(new Option(label,v));}
      if(values.includes(wanted))$(id).value=wanted;else if(wanted)fallback=true;
      $(id).disabled=values.length===1;
      candidates=candidates.filter(e=>valueOf(e.summary,id)===$(id).value);
    }
    requested=new URLSearchParams();condition=candidates[0];frame=0;
    for(const option of $('metric').options)option.disabled=!condition.frames.some(f=>Number.isFinite(f[metrics[option.value][2]]));
    if($('metric').selectedOptions[0].disabled){$('metric').value='o6';fallback=true;}
    slider.max = condition.frames.length - 1; slider.value = 0;
    const s = condition.summary;
    $('selection-status').textContent=fallback?'That exact combination is not recorded; showing an available selection.':'';
    $('condition-detail').textContent = `${s.molecules} molecules · ${s.production_ps} ps production · ${s.ensemble.toUpperCase()} · ${s.boundary} boundaries · ${s.density_mode} density start · ${data.runId}`;
    for(const a of document.querySelectorAll('.figures [data-potential]'))a.hidden=!['all',s.potential].includes(a.dataset.potential);
    empirical();diagnostics();syncURL(push);surface();render();
  }
  function empirical(){
    const e=condition.empirical, s=condition.summary, ref=e.vaporization, rho=e.density;
    $('empirical-reason').textContent=e.reason;
    $('empirical-value').textContent=ref?`${ref.value.toFixed(2)}${ref.uncertainty_kJ_mol?' ± '+ref.uncertainty_kJ_mol:''} kJ/mol at ${ref.temperature_K} K; ${ref.pressure_kPa===null?'pressure not specified in reference':ref.pressure_kPa+' kPa'}.`:'No curated value for this molecule.';
    $('empirical-source').hidden=!ref;if(ref){$('empirical-source').href=ref.source;$('empirical-source').title=ref.citation;}
    $('empirical-match').textContent=e.matched_vaporization_TP?'Reference T/P matches, but the quantity and molecular model differ.':'No matched empirical energy value at this selection. The literature value is context only, not a T/P-matched target.';
    const energy=Number(s.intermolecular_kJ_mol_molecule??s.potential_kJ_mol_molecule),proxy=-energy+.008314462618*Number(s.temperature_K);
    $('energy-proxy').textContent=s.boundary==='walls'||s.potential==='wca'?'Vaporization proxy withheld: a confined system or purely repulsive reference is not an established bulk liquid.':`Model −⟨Uinter⟩/N + RT = ${proxy.toFixed(2)} kJ/mol (ideal-gas vaporization proxy only if this state is liquid—not established here; liquid PV, gas association, flexibility and quantum corrections omitted).`;
    $('density-reference').textContent=`Literature: ${rho.value_g_cm3} g/cm³ at ${rho.temperature_K} K. ${rho.note} ${s.density_mode==='legacy'?'This archived run used sigma-based FCC spacing, not the reference anchor.':`Actual initial bulk density: ${Number(s.initial_density_g_cm3).toFixed(4)} g/cm³ (reference or configured override).`} ${s.ensemble==='nvt'?'NVT keeps the chosen bulk density fixed; pressure is not controlled.':'NPT allows density to change after initialization.'}`;
    $('density-source').href=rho.source;
  }
  function diagnostics(){
    const s=condition.summary,labels={local_q6:'Mean local q₆',rotation_c2:'Mean C₂',msd_slope_proxy_nm2_ps:'MSD-slope / 6 proxy (nm²/ps)',cp_fluct_J_mol_K:'Cp fluctuation estimate (J/mol/K)',cv_fluct_J_mol_K:'Cv fluctuation estimate (J/mol/K)',compressibility_fluct_kPa_inv:'Compressibility (1/kPa)',expansion_fluct_K_inv:'Expansion (1/K)'};
    $('diagnostics').textContent=Object.entries(labels).filter(([key])=>s[key]!==undefined&&s[key]!=='').map(([key,label])=>`${label}: ${Number(s[key]).toPrecision(4)}`).join(' · ')||'Additional diagnostics were not recorded in this legacy run.';
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
      if($('display').value==='centers'){
        ctx.fillStyle='#5eead4';ctx.beginPath();ctx.arc(q[0],q[1],5*q[3],0,2*Math.PI);ctx.fill();continue;
      }
      if($('display').value==='sites'){
        const charged=condition.summary.potential.startsWith('coulomb_');
        for(const sign of [-1,1]){const site=project(p.slice(0,3).map((v,i)=>v+sign*p[i+3]*state.box*.027),state.box,w,h);
          ctx.fillStyle=charged?(sign<0?'#60a5fa':'#fb7185'):'#94a3b8';ctx.beginPath();ctx.arc(site[0],site[1],5*site[3],0,2*Math.PI);ctx.fill();}
        continue;
      }
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
    const [,label,key]=metrics[$('metric').value],values=frames.map(f=>f[key]).filter(Number.isFinite);
    let lo=Math.min(...values),hi=Math.max(...values);if(hi-lo<1e-8){lo-=.05;hi+=.05;}
    for(const v of [0,.5,1]){const y=top+h*(1-v);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left+w,y);ctx.stroke();ctx.fillText((lo+v*(hi-lo)).toPrecision(2),1,y+4);}
    ctx.beginPath();ctx.strokeStyle='#5eead4';ctx.lineWidth=2;frames.forEach((f,i)=>{const x=left+i/Math.max(1,frames.length-1)*w,y=top+h*(1-(f[key]-lo)/(hi-lo));i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
    $('trace-caption').textContent=label+' · adaptive vertical scale · saved frames';
    const x=left+frame/Math.max(1,frames.length-1)*w;ctx.strokeStyle='#e2e8f0';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+h);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#8fa5c3';ctx.fillText(`${frames[0].time.toFixed(2)} ps`,left,205);ctx.fillText(`${frames[frames.length-1].time.toFixed(2)} ps`,left+w-52,205);
  }
  function surface(){
    const s=condition.summary,id=$('metric').value,grid=data.surfaces[`${s.potential}/${s.molecule}`]?.[id];
    const c=$('surface'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
    $('surface-title').textContent=metrics[id][1]+' · '+s.label;
    c.hidden=!grid;
    if(!grid){$('surface-caption').textContent='No complete temperature–pressure grid for this metric. NVT does not control pressure; see the timeline and downloadable data.';return;}
    let {t,p,z}=grid;
    if($('surface-mode').value==='samples'){
      t=[...new Set(grid.samples.map(a=>a[0]))];p=[...new Set(grid.samples.map(a=>a[1]))];
      z=p.map(y=>t.map(x=>grid.samples.find(a=>a[0]===x&&a[1]===y)[2]));
    }
    const zs=grid.samples.map(a=>a[2]),lo=Math.min(...zs),hi=Math.max(...zs),span=Math.max(hi-lo,1e-9);
    const pt=(x,y,v)=>{const a=(x-t[0])/(t.at(-1)-t[0]),b=Math.log(y/p[0])/Math.log(p.at(-1)/p[0]);return[480+350*a-310*b,340+145*a+110*b-250*(v-lo)/span];};
    for(let j=p.length-2;j>=0;j--)for(let i=0;i<t.length-1;i++){
      const verts=[pt(t[i],p[j],z[j][i]),pt(t[i+1],p[j],z[j][i+1]),pt(t[i+1],p[j+1],z[j+1][i+1]),pt(t[i],p[j+1],z[j+1][i])];
      const v=(z[j][i]+z[j][i+1]+z[j+1][i]+z[j+1][i+1])/4;
      ctx.fillStyle=`hsl(${250-200*(v-lo)/span},58%,${32+24*(v-lo)/span}%)`;ctx.beginPath();verts.forEach(([x,y],k)=>k?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
    }
    for(const [x,y,v] of grid.samples){const q=pt(x,y,v);ctx.fillStyle=(x===Number(s.temperature_K)&&y===Number(s.pressure_kPa))?'#fb7185':'#fbbf24';ctx.beginPath();ctx.arc(...q,4,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#b7c5d9';ctx.font='17px system-ui';ctx.fillText(`T: ${t[0]} → ${t.at(-1)} K`,640,535);ctx.fillText(`P: ${p[0]} → ${p.at(-1)} kPa (log)`,100,530);ctx.fillText(`${lo.toPrecision(4)} → ${hi.toPrecision(4)}`,30,70);
    $('surface-caption').textContent=`${grid.samples.length} actual plateaus · gold = ${id==='msd'?'end-of-plateau MSD':'sampled means'} · pink = selected condition. ${$('surface-mode').value==='smooth'?'Shape-preserving PCHIP in temperature and log pressure; interpolation adds no simulated evidence.':'Only the original sampled grid is connected.'} No extrapolation; not a coexistence boundary. Available error estimates are in the CSV/figure book.`;
  }
  function render(){const state=condition.frames[frame];for(const key of ['fcc','density','energy'])$(key).textContent=state[key].toFixed(3);$('order').textContent=state[metrics[$('metric').value][2]]?.toFixed(3)??'—';$('metric-label').textContent=metrics[$('metric').value][1];$('clock').textContent=`${state.time.toFixed(3)} ps · ${frame+1}/${condition.frames.length}`;slider.value=frame;scene(state);angles(state);trace();}
  for(const id of dimensions)$(id).addEventListener('change',()=>choose(true));
  $('metric').addEventListener('change',()=>{syncURL(true);surface();render();});
  $('display').addEventListener('change',()=>{syncURL(true);render();});
  $('surface-mode').addEventListener('change',surface);
  addEventListener('popstate',()=>{requested=new URLSearchParams(location.search);$('metric').value=metrics[requested.get('metric')]?requested.get('metric'):'o6';$('display').value=['dipoles','sites','centers'].includes(requested.get('display'))?requested.get('display'):'dipoles';choose();});
  slider.addEventListener('input',()=>{frame=Number(slider.value);render();});
  $('play').addEventListener('click',()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';last=0;});
  $('scene').addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];e.currentTarget.setPointerCapture(e.pointerId);});
  $('scene').addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.009;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-drag[1])*.009));drag=[e.clientX,e.clientY];render();});
  for(const event of ['pointerup','pointercancel'])$('scene').addEventListener(event,()=>{drag=null;});
  function tick(now){if(playing && now-last>=1000/Number($('speed').value)){frame=(frame+1)%condition.frames.length;last=now;render();}requestAnimationFrame(tick);}
  if(['dipoles','sites','centers'].includes(requested.get('display')))$('display').value=requested.get('display');
  choose();requestAnimationFrame(tick);
})();