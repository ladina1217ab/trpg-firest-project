(function(){
'use strict';
const D=Sim.DATA, U=D.UNIT, UN=D.UNITS, K=D.K, FM=D.FMETA;
const $=q=>document.querySelector(q);
const fmt=n=>Math.round(n).toLocaleString('ko-KR');
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const G={s:null,sel:null,speed:1,paused:true,acc:0,tab:'report',sheet:null,autoPause:true,seen:0,vb:null,veil:'start'};
const me=()=>G.s.playerFactionId;
const SAVE='sgk-p0r-save', AUTO='sgk-p0r-auto';
const store={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};

// ── 지도 좌표: 위경도를 실제 비율로 투영 ──
const SX=177,SY=220,LON0=125.5,LAT0=38.7;
const P=(lat,lon)=>[(lon-LON0)*SX,(LAT0-lat)*SY];
const RP={}; D.REG.forEach(r=>RP[r[0]]=P(r[3],r[4]));
const LABEL={gaegyeong:'r',cheorwon:'r',myeongju:'l',cheongju:'l',ungju:'b',unju:'l',gugwon:'t',sangju:'l',ilseon:'l',byeokjin:'l',gochang:'r',uiseong:'r',goul:'b',gyeongju:'b',daeya:'l',gangju:'b',wansan:'l',mujin:'r',naju:'l',nammijilbu:'r'};
const COAST=[[39.2,124.9],[38.1,124.7],[37.85,125.2],[37.7,125.35],[37.95,125.65],[37.72,125.95],[37.82,126.2],[37.75,126.42],[37.6,126.55],[37.45,126.6],[37.2,126.65],[37.0,126.8],[36.95,126.5],[36.9,126.2],[36.6,126.15],[36.4,126.35],[36.62,126.48],[36.3,126.5],[36.05,126.6],[35.98,126.7],[35.9,126.55],[35.7,126.45],[35.58,126.6],[35.4,126.4],[35.15,126.3],[35.0,126.38],[34.8,126.35],[34.55,126.3],[34.3,126.5],[34.45,126.8],[34.6,126.95],[34.5,127.15],[34.7,127.35],[34.6,127.75],[34.9,127.7],[34.75,127.95],[34.95,128.1],[34.85,128.45],[35.1,128.5],[35.2,128.6],[35.05,128.8],[35.08,129.05],[35.3,129.27],[35.5,129.42],[35.8,129.5],[36.08,129.57],[36.0,129.4],[36.1,129.43],[36.5,129.45],[37.0,129.42],[37.4,129.22],[37.75,128.99],[38.1,128.65],[38.4,128.47],[39.2,128.0]];
const RIDGES=[[0,[[39.1,127.85],[38.6,128.15],[38.15,128.45],[37.8,128.6],[37.45,128.85],[37.1,128.95],[36.75,129.1],[36.4,129.17],[36.05,129.2],[35.75,129.15],[35.45,129.1]]],
 [0,[[37.1,128.95],[36.96,128.5],[36.8,128.1],[36.55,127.88],[36.25,127.98],[36.0,127.85],[35.85,127.75],[35.6,127.7],[35.34,127.73]]],
 [1,[[37.0,127.7],[36.8,127.3],[36.6,127.0],[36.42,126.78]]],[1,[[35.85,127.6],[35.6,127.1],[35.45,126.85]]],[1,[[39.1,127.3],[38.5,127.5],[38.05,127.55]]],[1,[[38.7,125.8],[38.3,126.3],[38.15,126.7]]]];
const RIVERS=[[[37.1,128.93],[36.75,128.85],[36.56,128.7],[36.5,128.4],[36.42,128.25],[36.12,128.36],[35.85,128.45],[35.5,128.4],[35.38,128.5],[35.4,128.84],[35.1,128.95]],
 [[36.99,127.93],[37.15,127.75],[37.3,127.63],[37.5,127.5],[37.52,127.0],[37.72,126.68],[37.76,126.45]],[[38.2,127.75],[37.88,127.73],[37.52,127.32]],[[38.7,127.1],[38.05,127.0],[37.92,126.78],[37.76,126.68]],
 [[35.65,127.52],[36.1,127.5],[36.3,127.6],[36.47,127.48],[36.5,127.27],[36.46,127.12],[36.28,126.9],[36.12,126.98],[36.0,126.72]],
 [[35.32,126.98],[35.15,126.82],[35.02,126.71],[34.82,126.42]],[[35.7,127.4],[35.5,127.25],[35.28,127.3],[35.2,127.47],[35.07,127.75],[34.93,127.76]]];
const smooth=(pts,closed)=>{const n=pts.length,mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2],f=p=>p[0].toFixed(1)+','+p[1].toFixed(1);
  if(closed){let d='M'+f(mid(pts[n-1],pts[0]));for(let i=0;i<n;i++)d+='Q'+f(pts[i])+' '+f(mid(pts[i],pts[(i+1)%n]));return d+'Z'}
  let d='M'+f(pts[0]);for(let i=1;i<n-1;i++)d+='Q'+f(pts[i])+' '+f(mid(pts[i],pts[i+1]));return d+'L'+f(pts[n-1])};
// 대동여지도식 산줄기: 톱니 먹선
const ridge=(ll,amp,step)=>{const pts=ll.map(p=>P(p[0],p[1])),out=[];for(let i=0;i<pts.length-1;i++){const[x1,y1]=pts[i],[x2,y2]=pts[i+1],L=Math.hypot(x2-x1,y2-y1),n=Math.max(2,Math.round(L/step)),nx=-(y2-y1)/L,ny=(x2-x1)/L;
  for(let k=0;k<n;k++){const t=k/n,j=k%2?amp:-amp*.2;out.push([x1+(x2-x1)*t+nx*j,y1+(y2-y1)*t+ny*j])}}out.push(pts[pts.length-1]);return 'M'+out.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join('L')};
const egeom=(a,b)=>{const A=RP[a],B=RP[b],e=Sim.edgeBetween(a,b);return{A,B,c:e&&e.type==='해로'?[Math.min(A[0],B[0])-230,(A[1]+B[1])/2]:null,e}};
const epoint=(a,b,t)=>{const g=egeom(a,b);if(!g.c)return[g.A[0]+(g.B[0]-g.A[0])*t,g.A[1]+(g.B[1]-g.A[1])*t];const u=1-t;return[u*u*g.A[0]+2*u*t*g.c[0]+t*t*g.B[0],u*u*g.A[1]+2*u*t*g.c[1]+t*t*g.B[1]]};
const epath=(a,b)=>{const g=egeom(a,b);return g.c?`M${g.A}Q${g.c} ${g.B}`:`M${g.A}L${g.B}`};

const svg=$('#map');
function buildMap(){
  const land=smooth(COAST.map(p=>P(p[0],p[1])),true);
  const isle=(lat,lon,rx,ry,rot)=>{const p=P(lat,lon);return `<ellipse class="isle" cx="${p[0]}" cy="${p[1]}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${p[0]} ${p[1]})"/>`};
  const geo=(lat,lon,t,sz,rot)=>{const p=P(lat,lon);return `<text class="geo" x="${p[0]}" y="${p[1]}" font-size="${sz}" text-anchor="middle" transform="rotate(${rot||0} ${p[0]} ${p[1]})">${t}</text>`};
  svg.innerHTML=`<defs><pattern id="wv" width="46" height="18" patternUnits="userSpaceOnUse"><path d="M2,9 q5,-5 10,0 t10,0" fill="none" stroke="#7f918b" stroke-width="1" opacity=".38"/></pattern></defs>
  <rect class="sea" x="-3000" y="-3000" width="7000" height="7000"/><rect x="-3000" y="-3000" width="7000" height="7000" fill="url(#wv)"/>
  <path class="land-sh" d="${land}" transform="translate(4,5)"/><path class="land" d="${land}"/>
  ${isle(34.87,128.63,15,9,-30)}${isle(34.45,126.22,12,8,20)}${isle(34.78,127.98,9,7,0)}${isle(37.7,126.33,5,11,10)}${isle(34.35,126.98,8,5,0)}
  <g>${RIVERS.map(r=>`<path class="river" d="${smooth(r.map(p=>P(p[0],p[1])))}"/>`).join('')}</g>
  <g>${RIDGES.map(r=>`<path class="ridge${r[0]?' minor':''}" d="${ridge(r[1],r[0]?5:8,r[0]?9:11)}"/>`).join('')}</g>
  ${geo(36.9,125.2,'西海',44)}${geo(37.2,130.05,'東海',44)}${geo(34.42,128.2,'南海',34)}${geo(37.62,128.42,'太白',17,62)}${geo(36.33,127.74,'小白',17,74)}
  <g>${D.EDGES.map(e=>`<path class="road${e[2]==='고개'?' pass':e[2]==='해로'?' sea-route':''}" d="${epath(e[0],e[1])}"/>`).join('')}</g>
  <g id="hl"></g><g id="regions"></g><g id="armies"></g>`;
}
function fit(){const r=svg.getBoundingClientRect(),asp=Math.max(.3,r.width/Math.max(1,r.height));let h=1110,w=h*asp;if(w<900){w=900;h=w/asp}G.vb={x:389-w/2,y:470-h/2,w,h};applyVB()}
function applyVB(){const v=G.vb;svg.setAttribute('viewBox',`${v.x} ${v.y} ${v.w} ${v.h}`)}
function zoomAt(f,cx,cy){const v=G.vb,nw=Math.min(3200,Math.max(260,v.w/f)),k=nw/v.w;if(cx===undefined){cx=v.x+v.w/2;cy=v.y+v.h/2}v.x=cx-(cx-v.x)*k;v.y=cy-(cy-v.y)*k;v.w=nw;v.h*=k;applyVB()}
const toWorld=(ex,ey)=>{const r=svg.getBoundingClientRect(),v=G.vb;return[v.x+(ex-r.left)/r.width*v.w,v.y+(ey-r.top)/r.height*v.h]};

// ── 표시용 도우미 ──
const fcol=f=>FM[f].color, fnm=f=>G.s.factions[f].name;
const chip=f=>`<span class="chip" style="--c:${fcol(f)}">${esc(fnm(f))}</span>`;
const seal=(f,sm)=>`<span class="seal${sm?' sm':''}" style="background:${fcol(f)}">${FM[f].hanja}</span>`;
const pips=n=>'<span class="pips" aria-label="성 방어 '+n+'단계">'+'■'.repeat(n)+'<span style="opacity:.3">'+'■'.repeat(5-n)+'</span></span>';
const share=(f,c)=>Sim.shares(G.s,f,c);
const rel=f=>{const s=G.s,m=me();if(f===m)return'우리';if(s.factions[f].overlord===m)return'우리를 섬김';if(s.factions[m].overlord===f)return'우리의 종주';if(Sim.atWar(s,m,f))return'교전 중';if(Sim.sameBloc(s,m,f))return'같은 편';const t=Sim.trust(s,m,f);return t>=60?'우호':t<30?'적대적':'중립'};
function garrText(rid){const s=G.s,R=s.regions[rid];if(share(me(),R.controller))return{t:fmt(Sim.total(R.garrison)),c:'',tag:'<span class="tag c">확인</span>',long:fmt(Sim.total(R.garrison))+'명'};
  const it=Sim.regionIntel(s,me(),rid);if(it.conf==='unknown')return{t:'?',c:'unk',tag:'<span class="tag u">미확인</span>',long:'정보 없음. 정찰이 필요합니다.'};
  const ago=it.age?` (${it.age}주 전)`:'';if(!it.garr)return{t:'빈 성',c:'est',tag:'<span class="tag e">추정</span>',long:'지키는 병력이 거의 없어 보입니다'+ago};if(it.conf==='confirmed')return{t:fmt(it.garr),c:'',tag:'<span class="tag c">확인</span>',long:fmt(it.garr)+'명'+ago};
  return{t:'약 '+fmt(it.garr),c:'est',tag:'<span class="tag e">추정</span>',long:'약 '+fmt(it.garr*.75)+'~'+fmt(it.garr*1.25)+'명'+ago}}
const armyTxt=v=>v.conf==='confirmed'?fmt(v.est):'약 '+fmt(v.est);
function armyPos(a){const s=G.s;let L=a.leg,acc=G.paused&&!G.acc?0:G.acc;
  if(!L&&a.path.length){const e=Sim.edgeBetween(a.loc,a.path[0]);if(e)return epoint(a.loc,a.path[0],Math.min(1,acc/Sim.edgeWeeks(e,a.units,s.week)))}
  if(!L)return RP[a.loc];return epoint(L.a,L.b,L.f0+(L.f1-L.f0)*Math.min(1,(L.done+acc)/L.cost))}
function etaOf(a){const s=G.s;let w=a.leg?a.leg.cost-a.leg.done:0,cur=a.leg?a.leg.to:a.loc;for(const n of a.path){if(n===cur)continue;const e=Sim.edgeBetween(cur,n);if(e)w+=Sim.edgeWeeks(e,a.units,s.week);cur=n}return w}

// ── 지도 그리기 ──
function drawRegions(){
  const s=G.s;let h='';
  for(const id of D.RIDS){const R=s.regions[id],[x,y]=RP[id],cap=s.factions[R.controller].capitalId===id&&(FM[R.controller].kingdom||FM[R.controller].sovereign),g=garrText(id),L=LABEL[id],sel=G.sel&&G.sel.type==='region'&&G.sel.id===id;
    const tx=L==='r'?20:L==='l'?-20:0,ty=L==='t'?-38:L==='b'?31:-1,an=L==='r'?'start':L==='l'?'end':'middle';
    let pp='';for(let i=0;i<5;i++)pp+=`<rect class="pip${i<R.fort?'':' off'}" x="${-12+i*5}" y="${cap?15:14}" width="3.4" height="3.4"/>`;
    h+=`<g class="rg" data-region="${id}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(R.name)}"><circle class="hit" r="26"/>
    ${sel?'<circle class="selr" r="21"/>':''}${R.siege?'<circle class="siege" r="19"/>':''}
    ${cap?`<rect class="ring" x="-13" y="-13" width="26" height="26" stroke="${fcol(R.overlord)}"/><rect x="-9.5" y="-9.5" width="19" height="19" fill="${fcol(R.controller)}"/>`:`<circle class="ring" r="12.5" stroke="${fcol(R.overlord)}"/><circle r="9" fill="${fcol(R.controller)}"/>`}
    <text class="hj">${FM[R.controller].hanja}</text>${pp}${mobOf(R.controller)?'<text class="mob" x="9" y="-10">動</text>':''}
    <text class="nm" x="${tx}" y="${ty}" text-anchor="${an}" dominant-baseline="${L==='t'?'auto':L==='b'?'hanging':'central'}">${esc(R.name)}</text>
    <text class="gr ${g.c}" x="${tx}" y="${ty+(L==='t'?10:L==='b'?21:17)}" text-anchor="${an}" dominant-baseline="${L==='b'?'hanging':'central'}">${g.t}</text></g>`}
  $('#regions').innerHTML=h;
}
function drawArmies(){
  const s=G.s,vis=Sim.visibleArmies(s,me()),stack={};let h='';
  for(const v of vis){const a=v.army,f=a?a.factionId:v.factionId,pos=a?armyPos(a):RP[v.loc],key=Math.round(pos[0]/6)+','+Math.round(pos[1]/6),k=stack[key]=(stack[key]||0)+1;
    const x=pos[0]+12,y=pos[1]-6-(k-1)*17,sel=a&&G.sel&&G.sel.type==='army'&&G.sel.id===a.id;
    h+=`<g class="army${v.conf==='estimated'?' est':''}${v.ghost?' ghost':''}${sel?' sel':''}" ${a?`data-army="${a.id}"`:''} transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><line class="pole" x1="0" y1="2" x2="0" y2="-24"/><path class="flag" d="M0,-24L21,-19L0,-13Z" fill="${fcol(f)}"/><text class="an" x="5" y="-27">${v.ghost?'? ':''}${armyTxt(v)}</text></g>`}
  $('#armies').innerHTML=h;
}
function drawHL(){
  const s=G.s;let h='';const line=(from,path,cls)=>{let cur=from,d='';for(const n of path){d+=epath(cur,n);cur=n}return d?`<path class="hl ${cls||''}" d="${d}"/>`:''};
  if(G.sheet&&G.sheet.pv&&G.sheet.pv.ok&&G.sheet.pv.path)h+=line(G.sheet.from,G.sheet.pv.path);
  else if(G.sel&&G.sel.type==='army'){const a=s.armies[G.sel.id];if(a&&a.factionId===me()){const p=a.leg?[a.leg.to].concat(a.path.filter(n=>n!==a.leg.to)):a.path;h+=line(a.loc,p,'solid')}}
  $('#hl').innerHTML=h;
}

// ── 상단 ──
function drawTop(){
  const s=G.s,F=s.factions[me()],ru=s.characters[F.rulerId],sm=Sim.factionSummary(s,me()),gw=sm.use>0?sm.grain/sm.use:99,obl=Sim.obligations(s,me()),dueSoon=obl.mine.some(e=>e.ob.due!==null&&e.ob.due-s.week<=3);
  $('#plaque').innerHTML=`${seal(me())}<div><div class="who">${esc(ru.name)}</div><div class="ttl">${FM[me()].title} · ${esc(F.name)}${F.overlord?' · 종주 '+esc(fnm(F.overlord)):''}${sm.vassals.length?' · 섬기는 세력 '+sm.vassals.map(fnm).join('·'):''}</div></div>`;
  $('#clock').innerHTML=`<div><div class="date">${Sim.dateStr(s.week)}</div><div class="wk">${Math.min(s.week+1,K.weeks)} / ${K.weeks}주차</div></div><div class="bar" aria-hidden="true"><i id="wkbar"></i></div>
   <div class="seg" role="group" aria-label="시간 조절"><button data-act="pause" class="${G.paused?'on':''}" aria-label="일시정지">Ⅱ</button>${[1,2,4].map(v=>`<button data-act="speed" data-v="${v}" class="${!G.paused&&G.speed===v?'on':''}">${v}×</button>`).join('')}<button data-act="step" title="한 주만 넘기기">+1주</button></div>`;
  $('#res').innerHTML=`<div class="cell"><div class="k">국고</div><div class="v">${fmt(F.treasury)}</div><div class="d ${sm.income-sm.gold<0?'bad':''}">수입 +${fmt(sm.income)} · 유지 −${fmt(sm.gold)}</div></div>
   <div class="cell"><div class="k">군량</div><div class="v">${fmt(sm.grain)}</div><div class="d ${gw<8?'bad':''}">주당 −${fmt(sm.use)} · ${gw>=99?'충분':Math.floor(gw)+'주치'}</div></div>
   <div class="cell"><div class="k">병력</div><div class="v">${fmt(sm.troops+sm.field)}</div><div class="d">주둔 ${fmt(sm.troops)} · 출정 ${fmt(sm.field)}</div></div>
   <div class="cell" data-act="tab" data-v="court" role="button" tabindex="0"><div class="k">지킬 약속</div><div class="v ${dueSoon?'bad':''}">${obl.mine.length}건</div><div class="d ${dueSoon?'bad':''}">${obl.mine.length?(obl.mine[0].ob.due===null?'기한 없음':'가장 급한 것 '+Math.max(0,obl.mine[0].ob.due-s.week)+'주'):'밀린 약속 없음'}</div></div>`;
}

// ── 왼쪽: 선택한 거점·부대 ──
function unitTable(u){return `<table class="u"><tr><th>병종</th>${UN.map(k=>`<th>${U[k].name}</th>`).join('')}<th>합계</th></tr><tr><td>병력</td>${UN.map(k=>`<td>${fmt(u[k])}</td>`).join('')}<td><b>${fmt(Sim.total(u))}</b></td></tr></table>`}
function drawLeft(){
  const s=G.s,el=$('#left');if(!G.sel){el.innerHTML='';return}
  let h='';
  if(G.sel.type==='region'){const R=s.regions[G.sel.id],c=R.controller,mine=c===me(),sh=share(me(),c),g=garrText(R.id),lord=R.lord&&s.characters[R.lord];
    const chars=Object.values(s.characters).filter(x=>x.loc===R.id&&x.status==='active'&&(sh||x.id===R.lord));
    h+=`<div style="display:flex;gap:10px;align-items:center">${seal(c,1)}<div><h2>${esc(R.name)}</h2><div class="sub">지금의 ${esc(R.modern)} · ${chip(c)} ${rel(c)}</div></div></div>
    <dl class="kv" style="margin-top:12px"><dt>실제 지배</dt><dd>${esc(fnm(c))}</dd><dt>명목 종주</dt><dd>${esc(fnm(R.overlord))}${R.overlord!==c?' (자치 '+R.autonomy+')':''}</dd>
    <dt>지형 · 성 방어</dt><dd>${R.terrain} · ${pips(R.fort)}</dd><dt>주둔 병력 ${g.tag}</dt><dd>${g.long}</dd>
    ${!mine&&c!==me()?`<dt>우리와의 신뢰</dt><dd>${Sim.trust(s,me(),c)}</dd>`:''}</dl>`;
    if(R.siege)h+=`<div class="warn">포위 ${s.week-R.siege.start+1}주째 · ${esc(fnm(R.siege.by))}군</div>`;
    h+=relBlock(c);
    if(Sim.sameBloc(s,me(),c)||s.armies&&Object.values(s.armies).some(a=>a.factionId===me()&&!a.leg&&a.loc===R.id&&Sim.atWar(s,me(),c)))h+=callBlock(R.id);
    if(sh){const L=Sim.lordOf(s,R);h+=`<dl class="kv" style="margin-top:8px"><dt>성주</dt><dd>${L?esc(L.name)+' · 정치 '+L.po:'<span class="badc">비어 있음</span>'}</dd><dt>민심이 머무는 자리</dt><dd>${L?50+Math.round(L.po/4):45}</dd></dl>${Sim.defiant(s,R)?`<div class="warn">성주 ${esc(L.name)}의 충성이 ${L.loyalty}입니다. 군령을 따르지 않아 이곳에서는 출정도 모병도 할 수 없고, 세수도 절반만 들어옵니다.</div>`:''}`}
    if(sh){h+=`<h3>주둔군</h3>${unitTable(R.garrison)}<dl class="kv" style="margin-top:8px"><dt>곳간 군량</dt><dd>${fmt(R.grain)}</dd><dt>민심</dt><dd>${R.morale}</dd><dt>주둔군 사기</dt><dd>${R.gMorale}</dd><dt>징병 가능</dt><dd>${fmt(R.manpower)}명</dd><dt>세수</dt><dd>주당 ${fmt(R.tax*R.morale/100*(1-R.autonomy/100*.7))}</dd></dl>`;
      const ords=s.orders.filter(o=>o.status==='active'&&o.actorId===me()&&o.params.regionId===R.id);
      if(ords.length)h+=`<h3>진행 중</h3>`+ords.map(o=>`<div class="sub">${o.type==='RECRUIT'?U[o.params.unit].name+' '+o.params.count+'명 모병':o.type==='FORTIFY'?'성 보강':o.type==='REQUISITION'?'군량 징발':o.type==='BUY_GRAIN'?'곡식 매입 '+o.params.grain:o.type} · ${Math.max(1,o.duration-(s.week-o.startedAt))}주 남음</div>`).join('')}
    if(chars.length)h+=`<h3>인물</h3>`+chars.map(x=>`<div style="margin-bottom:4px"><b>${esc(x.name)}</b> <span class="sub">${esc(x.role)}${x.armyId==='appoint'?' · 부임 가는 중':x.armyId?' · 출정 중':''}${x.office?' · '+Sim.officeName(x.officeBy,x.office):''}</span><div class="sub">통솔 ${x.ld} · 무력 ${x.ma} · 지략 ${x.st} · 정치 ${x.po} · 신망 ${x.pr}${x.merit?' · 공적 '+x.merit:''}</div></div>`).join('');
    const caps=sh?Object.values(s.characters).filter(x=>x.status==='captive'&&x.loc===R.id):[];
    if(caps.length)h+=`<h3>갇힌 포로</h3>`+caps.map(x=>`<div class="sub"><b style="color:var(--text)">${esc(x.name)}</b> · ${esc(fnm(x.faction))} ${esc(x.role)} · 통솔 ${x.ld} 무력 ${x.ma} 지략 ${x.st}</div>`).join('')+`<div class="sub">포로의 처우(석방·회유·교환)는 아직 없습니다.</div>`;
    h+=`<h3>길</h3>`+D.ADJ[R.id].map(n=>{const N=s.regions[n.to];return `<div class="sub" style="display:flex;justify-content:space-between"><span><a href="#" data-act="sel" data-id="${n.to}" style="color:var(--text)">${esc(N.name)}</a> ${esc(fnm(N.controller))}</span><span>${n.e.type}${n.e.note?' · '+esc(n.e.note):''} · ${Sim.edgeWeeks(n.e,{light:1,heavy:0,archer:0,cav:0},s.week)}주</span></div>`}).join('');
    const eg=s.engagements.filter(e=>e.regionId===R.id&&engSeen(e)).slice(-1)[0];
    if(eg)h+=`<h3>최근 공방전</h3><div class="sub">${Sim.dateStr(eg.start)}${eg.end!==null?' ~ '+Sim.dateStr(eg.end):' · 진행 중'} · ${resultFor(eg).label}</div><button class="btn sm" style="margin-top:6px" data-act="result" data-id="${eg.id}">전투 결과 보기</button>`;
    h+=`<div class="note">사료 근거: ${esc(R.note)} <span class="tag">${{confirmed:'기록 있음',disputed:'해석 필요',designed:'게임용 재구성',traditional:'전승'}[R.conf]}</span></div>`;
  }else{const a=s.armies[G.sel.id];if(!a){G.sel=null;el.innerHTML='';return}
    const own=a.factionId===me(),sh=share(me(),a.factionId),cm=a.commanderId&&s.characters[a.commanderId],v=Sim.visibleArmies(s,me()).find(x=>x.army===a);
    h+=`<div style="display:flex;gap:10px;align-items:center">${seal(a.factionId,1)}<div><h2>${esc(fnm(a.factionId))} 부대</h2><div class="sub">${esc(s.regions[a.loc].name)}${a.leg?' → '+esc(s.regions[a.leg.to].name)+' 행군 중':' 주둔'}</div></div></div>`;
    if(sh){const up=Sim.upkeep(a.units),deps=(a.deputyIds||[]).map(id=>s.characters[id]).filter(Boolean),st=Sim.staff(cm||null,deps),lk=Sim.supplyLink(s,a);
      h+=`<h3>편성</h3>${unitTable(a.units)}<h3>지휘부</h3><dl class="kv"><dt>주장</dt><dd>${cm?esc(cm.name)+' · 통솔 '+cm.ld:'없음 (통솔 50 취급)'}</dd>${deps.map((d,i)=>`<dt>부장 ${i+1}</dt><dd>${esc(d.name)} · 무력 ${d.ma} 지략 ${d.st}</dd>`).join('')}
        <dt>전투 보정</dt><dd>지휘 ${pctS(cmdOf(st))} · 다병종 −${Math.round(Sim.mixPenalty(a.units,st.ld,deps.length)*100)}%</dd></dl>
      <dl class="kv" style="margin-top:8px"><dt>사기</dt><dd>${Math.round(a.morale)}</dd><dt>휴대 군량</dt><dd class="${a.supply<up*2?'badc':''}">${fmt(a.supply)} · ${up?Math.floor(a.supply/up):0}주치</dd>
        <dt>보급선</dt><dd class="${lk.linked?'':'badc'}">${lk.linked?'이어짐 ('+esc(s.regions[lk.via].name)+')':'끊김 '+(a.cut||0)+'주째'}</dd>
        <dt>임무</dt><dd>${{attack:'공격',guard:'우군 지원',station:'주둔 이동',return:'회군'}[a.mission]}</dd>
      ${a.leg||a.path.length?`<dt>목적지</dt><dd>${esc(s.regions[a.target].name)} · ${etaOf(a)}주 뒤</dd>`:''}</dl>
      <h3>작전 방침</h3><div class="seg stance" role="group" aria-label="작전 방침">${Object.keys(Sim.STANCE).map(k=>`<button data-act="stance" data-v="${k}" class="${a.stance===k?'on':''}" ${own?'':'disabled'}>${k}</button>`).join('')}</div><div class="sub" style="margin-top:4px">${STDESC[a.stance]}</div>`}
    else h+=`<dl class="kv" style="margin-top:12px"><dt>병력 <span class="tag ${v&&v.conf==='confirmed'?'c':'e'}">${v&&v.conf==='confirmed'?'확인':'추정'}</span></dt><dd>${v?(v.conf==='confirmed'?fmt(v.est)+'명':'약 '+fmt(v.est*.75)+'~'+fmt(v.est*1.25)+'명'):'알 수 없음'}</dd><dt>움직임</dt><dd>${a.leg?esc(s.regions[a.leg.to].name)+' 방면':'머무는 중'}</dd></dl><div class="note">적 부대의 편성과 지휘관은 알 수 없습니다. 병력은 관측한 범위에서만 표시됩니다.</div>`;
  }
  el.innerHTML=Sim.jo(`<div class="slab">${h}</div>`);
}

// ── 아래: 명령 ──
function drawBar(){
  const s=G.s,m=me();let h='';const b=(label,act,v,extra)=>`<button class="btn" data-act="${act}" ${extra||''} ${v&&!v.ok?`aria-disabled="true" data-why="${esc(v.reason)}"`:''}>${label}</button>`;
  if(!G.sel)h+=`<div class="grp ctx"><b>거점이나 깃발을 고르세요</b><span class="sub">지도를 끌어 옮기고, 휠로 확대합니다. 스페이스바로 시간을 멈춥니다.</span></div>`;
  else if(G.sel.type==='region'){const R=s.regions[G.sel.id],c=R.controller,mine=c===m;
    h+=`<div class="grp ctx"><b>${esc(R.name)}</b><span class="sub">${esc(fnm(c))} · ${rel(c)}</span></div>`;
    if(mine){h+=`<div class="grp"><span class="gl">군사</span><div class="btns">${b('출정','open-march',R.siege?{ok:false,reason:'포위된 거점에서는 출정할 수 없습니다.'}:null)}${b('모병','open-recruit',R.siege?{ok:false,reason:'포위된 거점에서는 모병할 수 없습니다.'}:null)}</div></div>
      <div class="grp"><span class="gl">내정</span><div class="btns">${b('군량 징발 +'+K.reqGrain,'cmd',Sim.validate(s,m,'REQUISITION',{regionId:R.id}),'data-type="REQUISITION"')}${b('성 보강 (국고 '+K.repairCost+')','cmd',Sim.validate(s,m,'FORTIFY',{regionId:R.id}),'data-type="FORTIFY"')}${b('곡식 매입','open-buy',Sim.validate(s,m,'BUY_GRAIN',{regionId:R.id,gold:50}))}${b('민심 수습 (국고 '+K.pacifyCost+')','cmd',Sim.validate(s,m,'PACIFY',{regionId:R.id}),'data-type="PACIFY"')}</div></div>
      <div class="grp"><span class="gl">인사</span><div class="btns">${b('성주 임명','open-appoint',R.siege?{ok:false,reason:'포위된 거점에는 보낼 수 없습니다.'}:null)}</div></div>`}
    else{const hasSrc=D.RIDS.some(r=>s.regions[r].controller===m&&!s.regions[r].siege);
      h+=`<div class="grp"><span class="gl">군사</span><div class="btns">${b(Sim.sameBloc(s,m,c)?'이곳으로 지원군':'이곳을 공격','open-march',hasSrc?null:{ok:false,reason:'출정할 수 있는 우리 거점이 없습니다.'})}</div></div>
      <div class="grp"><span class="gl">첩보</span><div class="btns">${b('정찰 (국고 '+K.scoutCost+')','cmd',Sim.validate(s,m,'SCOUT',{regionId:R.id}),'data-type="SCOUT"')}${b('동향 파악 (국고 '+K.probeCost+')','probe',Sim.validate(s,m,'PROBE',{targetFactionId:c}))}</div></div>
      <div class="grp"><span class="gl">외교</span><div class="btns">${b('협상','open-envoy')}</div></div>`}
  }else{const a=s.armies[G.sel.id];if(a&&a.factionId===m){h+=`<div class="grp ctx"><b>우리 부대 ${fmt(Sim.total(a.units))}명</b><span class="sub">${esc(s.regions[a.loc].name)}${a.leg?' → '+esc(s.regions[a.leg.to].name):''}</span></div>
      <div class="grp"><span class="gl">군사</span><div class="btns">${b('이동·공격','open-move',a.leg?{ok:false,reason:'행군 중인 부대에는 새 이동 명령을 내릴 수 없습니다. 회군만 가능합니다.'}:null)}${b('주둔군에 편입','acmd',Sim.validate(s,m,'GARRISON',{armyId:a.id}),'data-type="GARRISON"')}${b('회군','acmd',Sim.validate(s,m,'RETREAT',{armyId:a.id}),'data-type="RETREAT"')}</div></div>`}
    else h+=`<div class="grp ctx"><b>${a?esc(fnm(a.factionId))+' 부대':'부대'}</b><span class="sub">남의 부대에는 명령할 수 없습니다.</span></div>`}
  h+=`<div class="grp sys"><span class="gl">조정</span><div class="btns"><button class="btn" data-act="tab" data-v="court">국정</button><button class="btn" data-act="open-reward">논공행상</button></div></div><div class="grp"><span class="gl">기록</span><div class="btns"><button class="btn" data-act="save">저장</button><button class="btn" data-act="load">불러오기</button><button class="btn" data-act="new">처음으로</button><button class="btn fold" data-act="fold" data-v="left">정보</button><button class="btn fold" data-act="fold" data-v="right">전황</button></div></div>`;
  $('#bar').innerHTML=h;
}

// ── 오른쪽: 전황·연대기·편성 ──
function drawRight(){
  const s=G.s,el=$('#right');
  if(G.sheet){el.innerHTML=`<div id="sheet"></div>`;drawSheet();return}
  const np=s.proposals.filter(p=>p.status==='pending'&&p.to===me()).length,tabs=[['report','보고'+(np?' ('+np+')':'')],['court','국정'],['battle','전투'],['chron','연대기'],['ai','AI']];
  let h=`<div class="tabs" role="tablist">${tabs.map(t=>`<button role="tab" data-act="tab" data-v="${t[0]}" class="${G.tab===t[0]?'on':''}">${t[1]}</button>`).join('')}</div><div id="feed">`;
  if(G.tab==='report'){const F=s.factions[me()],wars=D.FIDS.filter(f=>s.factions[f].alive&&Sim.atWar(s,me(),f));
    h+=`<div class="it" style="background:var(--slab-2)"><span class="w">우리의 목표</span>${esc(F.strategicGoal)}<span class="w" style="margin-top:4px">${wars.length?'교전 중: '+wars.map(fnm).join('·'):'교전 중인 세력 없음'}${F.overlord?' · 종주 '+esc(fnm(F.overlord))+' (신뢰 '+Sim.trust(s,me(),F.overlord)+')':''}</span></div>`;
    for(const p of s.proposals.filter(p=>p.status==='pending'&&p.to===me()))h+=propCard(p);
    const rp=s.reports.slice(-60).reverse();
    h+=rp.length?rp.map(r=>`<div class="it${r.urgent?' urgent':''}" ${r.regionId?`data-act="sel" data-id="${r.regionId}" data-region="1"`:''}><span class="w">${Sim.dateStr(r.week)}</span>${esc(r.text)}</div>`).join(''):`<div class="it sub">아직 보고가 없습니다. 시간을 흘려 보내거나 명령을 내리세요.</div>`;
    h+=`<div class="it sub"><label><input type="checkbox" id="ap" ${G.autoPause?'checked':''}> 중요한 보고가 오면 시간을 멈춤</label></div>`;
  }else if(G.tab==='court'){h+=courtTab();
  }else if(G.tab==='battle'){
    const list=s.engagements.filter(engSeen).slice().reverse();
    h+=list.length?list.map(e=>{const r=resultFor(e);return `<div class="it" data-act="result" data-id="${e.id}" data-region="1"><span class="w">${Sim.dateStr(e.start)}${e.end!==null?' ~ '+Sim.dateStr(e.end):' · 진행 중'} · ${e.rounds}주 교전</span><b>${esc(s.regions[e.regionId].name)} 공방전</b> <span class="tag ${r.cls}">${r.label}</span><span class="w">${e.attackers.map(fnm).join('·')} → ${e.defenders.map(fnm).join('·')} · 잃은 병력 공 ${fmt(tot(e.lost.atk))} / 수 ${fmt(tot(e.lost.def))}</span></div>`}).join(''):`<div class="it sub">아직 지켜본 공방전이 없습니다. 우리 편이 싸운 공방전이 여기에 쌓입니다.</div>`;
  }else if(G.tab==='chron'){
    h+=s.chronicle.slice().reverse().map(c=>`<div class="it" ${c.regionId?`data-act="sel" data-id="${c.regionId}" data-region="1"`:''}><span class="w">${Sim.dateStr(c.week)}${c.cause?' · 원인: '+esc(c.cause):''}</span>${esc(c.text)}${c.stateChanges?`<span class="w">변화: ${esc(c.stateChanges)}</span>`:''}</div>`).join('');
  }else{
    h+=`<div class="it sub">개발 확인용입니다. 다른 세력의 속마음이 그대로 보이므로 실제 게임에서는 숨깁니다.</div>`;
    h+=s.log.filter(l=>l.ok&&l.faction!==me()&&l.why&&l.type!=='GARRISON').slice(-80).reverse().map(l=>`<div class="it dev"><span class="w">${Sim.dateStr(l.week)} · ${esc(fnm(l.faction))} · 효용 ${l.u}</span><b>${{MARCH:'출정',RECRUIT:'모병',FORTIFY:'성 보강',SCOUT:'정찰',REQUISITION:'징발',RETREAT:'회군',BUY_GRAIN:'곡식 매입',CALL_ARMS:'동원령',REWARD:'포상',APPOINT:'성주 임명',PACIFY:'민심 수습',COUNTER:'역제안 수락'}[l.type]||(l.type==='ENVOY'?D.KINDNAME[l.params.kind]:l.type)}</b> ${esc(l.why)}</div>`).join('');
  }
  el.innerHTML=Sim.jo(h+'</div>');
}
function pvMarch(){const sh=G.sheet,s=G.s;sh.pv=Sim.previewMarch(s,me(),{fromRegionId:sh.from,targetRegionId:sh.target,units:sh.units,commanderId:sh.commanderId||null,deputyIds:sh.deps.filter(Boolean),stance:sh.stance,breakTruce:!!sh.breakTruce});
  const p=sh.pv,el=$('#pv');if(!el)return;
  if(!p.ok){el.innerHTML=`<div class="warn">${esc(p.reason)}</div>${p.code==='truce'?`<button class="btn sm" style="margin-top:6px" data-act="break-truce">휴전을 깨고 출정한다</button><div class="sub">군이 그 땅에 닿는 순간 휴전이 깨집니다. 정통성 −8, 상대 신뢰 −30, 다른 모든 세력의 신뢰 −10, 평판 하락.</div>`:''}`;J(el);$('#go').setAttribute('aria-disabled','true');$('#go').dataset.why=p.reason;UN.forEach(k=>{const e=$('#ef-'+k);if(e){e.textContent='—';e.className=''}});drawHL();return}
  $('#go').removeAttribute('aria-disabled');
  const T=s.regions[sh.target];let odds='';
  UN.forEach(k=>{const e=$('#ef-'+k);if(e){const v=p.eff[k];e.textContent=T.terrain+(p.mission==='attack'&&T.fort?'·성'+T.fort:'')+' ×'+v.toFixed(2);e.className=v>1.001?'good':v<0.999?'badc':''}});
  if(p.odds&&p.odds.conf==='unknown')odds=`<div class="odds">예상 불가</div><div class="sub">적 병력을 모릅니다. 정찰을 먼저 보내면 예상이 나옵니다.</div>`;
  else if(p.odds){const o=p.odds;odds=`<div class="odds ${o.label==='유리'?'good':o.label==='접전'?'mid':'badc'}">함락 확률 ${o.win}%</div>
    <div class="wbar" aria-hidden="true"><i class="w1" style="width:${o.win}%"></i><i class="w2" style="width:${o.fail+o.rout}%"></i><i class="w3" style="width:${o.stall}%"></i></div>
    <div class="sub">함락 ${o.win}% · 격퇴당함 ${o.fail+o.rout}% · ${o.simWeeks}주 안에 결판 안 남 ${o.stall}%${o.weeks?' · 함락까지 평균 '+o.weeks+'주':''} · 예상 손실 ${fmt(o.loss)}명</div>
    <div class="sub" style="margin-top:4px">적 ${o.conf==='confirmed'?'':'약 '}${fmt(o.est)}명 기준${o.knownMix?' · 정찰로 본 편성':' · 편성은 짐작'}${o.defCmd?' · 수비 장수 '+esc([o.defCmd].concat(o.defStaff).join('·')):''}. 실제 전투와 같은 식으로 240번 굴린 결과입니다.</div>
    <div class="sub ${o.ambush>=25?'badc':''}">매복 위험 ${o.ambush}%${o.scouted?' (정찰로 낮춤)':' · 정찰하면 낮아집니다'}</div>`}
  else odds=`<div class="odds">${p.mission==='station'?'주둔 이동':'우군 지원'}</div><div class="sub">${p.mission==='station'?'도착하면 그곳 주둔군에 합류합니다.':'도착해서 함께 성을 지킵니다. 수비할 때는 방어 방침이 유리합니다.'}</div>`;
  el.innerHTML=`${odds}<dl class="kv" style="margin-top:8px"><dt>총 병력 · 기초 전력</dt><dd>${fmt(p.total)}명 · ${fmt(p.basePower)}</dd><dt>지휘 보정</dt><dd>${pctS(p.staff.cmdF)}${p.staff.mix>0.001?' · 다병종 −'+Math.round(p.staff.mix*100)+'%':''}</dd><dt>도착</dt><dd>${p.eta}주 뒤 (${Sim.dateStr(s.week+p.eta)})</dd><dt>군량 · 국고 유지</dt><dd>주당 ${fmt(p.perWeek)} · ${p.gold}</dd><dt>가져가는 군량</dt><dd>${fmt(p.carry)} · ${p.carryWeeks}주치</dd>
    <dt>목표지 보급선</dt><dd class="${p.supply.linked?'':'badc'}">${p.supply.linked?'이어짐 ('+esc(p.supply.via)+')':'끊김: 가져간 군량뿐'}</dd><dt>남는 주둔군</dt><dd>${fmt(p.remain)}명</dd></dl>
   ${p.short?'<div class="warn">군량이 모자랍니다. 굶기 시작하면 사기와 병력이 줄고 전투력이 20% 떨어집니다.</div>':''}${p.declaresWar?`<div class="warn">${esc(fnm(T.controller))}와(과) 전쟁이 시작됩니다. 다른 호족들의 신뢰도 떨어집니다.</div>`:''}${sh.breakTruce&&Sim.truceBetween(s,me(),T.controller)?'<div class="warn">휴전을 깨는 출정입니다. 군이 그 땅에 닿는 순간 휴전이 깨집니다.</div>':''}${Sim.sameBloc(s,me(),T.controller)?callBlock(sh.target):mobHint()}`;
  J(el);drawHL();
}
function drawSheet(){
  const s=G.s,sh=G.sheet,el=$('#sheet');let h='';
  if(sh.type==='march'){const R=s.regions[sh.from];
    const srcs=D.RIDS.filter(r=>s.regions[r].controller===me()&&!s.regions[r].siege);
    const chars=Object.values(s.characters).filter(c=>c.faction===me()&&c.loc===R.id&&!c.armyId&&c.status==='active').sort((a,b)=>b.ld-a.ld);
    const tg=D.RIDS.filter(r=>r!==sh.from).map(r=>{const T=s.regions[r],p=Sim.findPath(s,me(),sh.from,r,Sim.total(sh.units)?sh.units:R.garrison),kind=T.controller===me()?'주둔 이동':Sim.sameBloc(s,me(),T.controller)?'우군 지원':Sim.atWar(s,me(),T.controller)?'공격':'공격(선전포고)';return{r,T,p,kind}}).sort((a,b)=>(a.p?a.p.weeks:99)-(b.p?b.p.weeks:99));
    h+=`<h2>출정 편성</h2><div class="sub">지도에서 목표 거점을 눌러도 됩니다.</div>
    <label class="fld" for="m-from">출발</label><select id="m-from">${srcs.map(r=>`<option value="${r}" ${r===sh.from?'selected':''}>${esc(s.regions[r].name)} · 주둔 ${fmt(Sim.total(s.regions[r].garrison))}</option>`).join('')}</select>
    <label class="fld" for="m-to">목표</label><select id="m-to"><option value="">고르세요</option>${tg.map(t=>`<option value="${t.r}" ${t.r===sh.target?'selected':''} ${t.p?'':'disabled'}>${esc(t.T.name)} · ${t.kind} · ${t.p?t.p.weeks+'주':'길 없음'}</option>`).join('')}</select>
    <label class="fld" for="m-cmd">주장 · 통솔이 지휘 보정을 정합니다</label><select id="m-cmd"><option value="">없음 (통솔 50 취급)</option>${chars.map(c=>`<option value="${c.id}" ${c.id===sh.commanderId?'selected':''}>${esc(c.name)} · 통솔 ${c.ld} 무력 ${c.ma} 지략 ${c.st}</option>`).join('')}</select>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label class="fld" for="m-dep0">부장 1</label><select id="m-dep0" ${sh.commanderId?'':'disabled'}><option value="">없음</option>${chars.filter(c=>c.id!==sh.commanderId&&c.id!==sh.deps[1]).map(c=>`<option value="${c.id}" ${c.id===sh.deps[0]?'selected':''}>${esc(c.name)} 무${c.ma} 지${c.st}</option>`).join('')}</select></div>
    <div><label class="fld" for="m-dep1">부장 2</label><select id="m-dep1" ${sh.commanderId?'':'disabled'}><option value="">없음</option>${chars.filter(c=>c.id!==sh.commanderId&&c.id!==sh.deps[0]).map(c=>`<option value="${c.id}" ${c.id===sh.deps[1]?'selected':''}>${esc(c.name)} 무${c.ma} 지${c.st}</option>`).join('')}</select></div></div>
    <div class="sub" style="margin-top:3px">부장은 선봉(최고 무력)과 참모(최고 지략)를 맡고, 여러 병종을 섞을 때의 지휘 부담을 덜어 줍니다.</div>
    <h3>병종별 수량 <span style="display:flex;gap:4px;letter-spacing:0"><button class="btn sm" data-act="mq" data-v="0">비우기</button><button class="btn sm" data-act="mq" data-v="0.5">절반</button><button class="btn sm" data-act="mq" data-v="1">전부</button></span></h3>${UN.map(k=>`<div class="urow"><label for="u-${k}" title="${esc(U[k].note)}">${U[k].name}<small>전력 ${U[k].power.toFixed(1)} · <span id="ef-${k}">—</span></small></label><input type="range" id="r-${k}" data-u="${k}" min="0" max="${R.garrison[k]}" step="10" value="${sh.units[k]}" aria-label="${U[k].name} 수량"><input type="number" id="u-${k}" data-u="${k}" min="0" max="${R.garrison[k]}" step="10" value="${sh.units[k]}"></div>`).join('')}
    <label class="fld" for="m-st">작전 방침</label><select id="m-st">${Object.keys(Sim.STANCE).map(k=>`<option value="${k}" ${sh.stance===k?'selected':''}>${k}: ${STDESC[k]}</option>`).join('')}</select>
    <div class="pv" id="pv"></div><div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" id="go" data-act="go-march">출정</button><button class="btn" data-act="close">취소</button></div>`;
    el.innerHTML=h;pvMarch();return}
  if(sh.type==='move'){const a=s.armies[sh.armyId];if(!a){G.sheet=null;drawRight();return}
    const tg=D.RIDS.filter(r=>r!==a.loc).map(r=>{const T=s.regions[r],p=Sim.findPath(s,me(),a.loc,r,a.units),kind=T.controller===me()?'주둔 이동':Sim.sameBloc(s,me(),T.controller)?'우군 지원':Sim.atWar(s,me(),T.controller)?'공격':'공격(선전포고)';return{r,T,p,kind}}).sort((x,y)=>(x.p?x.p.weeks:99)-(y.p?y.p.weeks:99));
    const v=sh.target?Sim.validate(s,me(),'ARMY_ORDER',{armyId:a.id,targetRegionId:sh.target}):null;sh.from=a.loc;sh.pv=v&&v.ok?{ok:true,path:v.path}:null;
    h+=`<h2>부대 이동</h2><div class="sub">${esc(s.regions[a.loc].name)}의 ${fmt(Sim.total(a.units))}명. 지도에서 목표를 눌러도 됩니다.</div><label class="fld" for="mv-to">목표</label><select id="mv-to"><option value="">고르세요</option>${tg.map(t=>`<option value="${t.r}" ${t.r===sh.target?'selected':''} ${t.p?'':'disabled'}>${esc(t.T.name)} · ${t.kind} · ${t.p?t.p.weeks+'주':'길 없음'}</option>`).join('')}</select>
    <div class="pv">${v?(v.ok?`<dl class="kv"><dt>도착</dt><dd>${v.eta}주 뒤</dd><dt>임무</dt><dd>${{attack:'공격',guard:'우군 지원',station:'주둔 이동'}[v.mission]}</dd></dl>${v.mission==='attack'&&!Sim.atWar(s,me(),s.regions[sh.target].controller)?'<div class="warn">전쟁이 시작됩니다.</div>':''}`:`<div class="warn">${esc(v.reason)}</div>`):'<span class="sub">목표를 고르면 걸리는 시간이 나옵니다.</span>'}</div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" data-act="go-move" ${v&&v.ok?'':'aria-disabled="true" data-why="목표를 고르세요."'}>이동</button><button class="btn" data-act="close">취소</button></div>`;
    el.innerHTML=h;drawHL();return}
  if(sh.type==='recruit'){const R=s.regions[sh.from],F=s.factions[me()],u=U[sh.unit],max=Math.max(0,Math.min(R.manpower,Math.floor(F.treasury/u.cost)*100));sh.count=Math.min(sh.count,Math.floor(max/100)*100);
    h+=`<h2>${esc(R.name)} 모병</h2><div class="sub">징병 가능 ${fmt(R.manpower)}명 · 국고 ${fmt(F.treasury)}</div><label class="fld" for="rc-u">병종</label><select id="rc-u">${UN.map(k=>`<option value="${k}" ${k===sh.unit?'selected':''}>${U[k].name} · 전력 ${U[k].power.toFixed(1)} · 100명당 국고 ${U[k].cost}, 주당 군량 ${U[k].grain}</option>`).join('')}</select>
    <label class="fld" for="rc-n">인원</label><div class="urow" style="grid-template-columns:1fr 84px"><input type="range" id="rc-r" min="0" max="${max}" step="100" value="${sh.count}" aria-label="모병 인원"><input type="number" id="rc-n" min="0" max="${max}" step="100" value="${sh.count}"></div>
    <div class="pv" id="rc-pv"></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" id="rc-go" data-act="go-recruit">모병</button><button class="btn" data-act="close">취소</button></div>`;
    el.innerHTML=h;pvRecruit();return}
  if(sh.type==='result'){el.innerHTML=Sim.jo(resultSheet(sh.id));return}
  if(sh.type==='buy'){const R=s.regions[sh.from],F=s.factions[me()],max=Math.max(0,Math.min(K.buyMax,Math.floor(F.treasury/50)*50));sh.gold=Math.min(sh.gold,max);
    h+=`<h2>${esc(R.name)} 곡식 매입</h2><div class="sub">상인을 통해 국고로 곡식을 사들입니다. 국고 1당 군량 ${K.grainPerGold}, ${K.buyWeeks}주 뒤 곳간에 들어옵니다. 그 사이 포위되면 곡식은 흩어집니다.</div>
    <label class="fld" for="by-r">쓸 국고</label><div class="urow" style="grid-template-columns:1fr 84px"><input type="range" id="by-r" min="0" max="${max}" step="50" value="${sh.gold}" aria-label="쓸 국고"><input type="number" id="by-n" min="0" max="${max}" step="50" value="${sh.gold}"></div>
    <div class="pv" id="by-pv"></div><div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" id="by-go" data-act="go-buy">사들인다</button><button class="btn" data-act="close">취소</button></div>`;
    el.innerHTML=h;pvBuy();return}
  if(sh.type==='envoy'){el.innerHTML=Sim.jo(negoSheet());return}
  if(sh.type==='reward'){el.innerHTML=Sim.jo(rewardSheet());return}
  if(sh.type==='appoint'){el.innerHTML=Sim.jo(appointSheet());return}
}
const KDESC={offer:'자치를 걸고 우리 밑으로 들어오게 합니다. 맺어지면 그 땅을 지나갈 수 있고 정보를 나눕니다.',revise:'이미 우리를 섬기는 세력과 조건을 고칩니다. 동원 의무를 얻으려면 무언가 내줘야 합니다.',pledge:'그 나라를 종주로 섬깁니다. 지금의 종주와는 관계가 끊어집니다.',marriage:'왕실과 가문이 혼인으로 묶입니다. 신뢰 +15, 적국의 회유가 어려워집니다. 군대가 저절로 따라오지는 않습니다.',passage:'싸우지 않고 그 땅을 지나 행군할 권리를 얻습니다.',truce:'싸움을 멈춥니다. 남의 땅에 있는 군대는 양쪽 다 물러납니다. 기한이 지나면 다시 교전 상태가 됩니다.',aid:'우리 편 거점으로 병력을 보내 달라고 청합니다. 받아들이면 상대가 지킬 약속으로 장부에 오릅니다.',gift:'예물을 보내 신뢰를 올립니다.'};
function negoKinds(t){const s=G.s,m=me(),T=s.factions[t],a=[];
  if(FM[m].kingdom&&!FM[t].kingdom&&!FM[t].sovereign)a.push(T.overlord===m?'revise':'offer');
  if(!FM[m].kingdom&&!FM[m].sovereign&&FM[t].kingdom)a.push('pledge');
  if(FM[m].kingdom&&!FM[t].kingdom)a.push('marriage');
  if(Sim.atWar(s,m,t))a.push('truce');else{a.push('aid');a.push('passage');a.push('gift')}
  return a}
function relBlock(f){const s=G.s,m=me();if(f===m)return'';const bits=[],tr=Sim.truceBetween(s,m,f),F=s.factions[f];
  if(tr)bits.push('휴전 '+Sim.dateStr(tr.until)+'까지');if(s.passes[f+'>'+m]>=s.week)bits.push('통행 허락 '+Sim.dateStr(s.passes[f+'>'+m])+'까지');if(s.ties[[m,f].sort().join('|')])bits.push('혼인 관계');
  const ag=Sim.vassalAg(s,m,f)||Sim.vassalAg(s,f,m);if(ag)bits.push((ag.parties[0]===m?'우리를 섬김':'우리의 종주')+': '+ag.text.filter(x=>x!=='명목상 종주 관계').join(', '));
  let h=bits.length?`<div class="sub" style="margin-top:8px">${bits.map(esc).join(' · ')}</div>`:'';
  const e=s.intel[m].factions[f];
  if(e){const age=s.week-e.week;h+=`<h3>동향 보고 · ${age?age+'주 전':'이번 주'}</h3><dl class="kv">${Object.keys(e.trust).map(k=>`<dt>${esc(fnm(k))}에 대한 신뢰</dt><dd>${e.trust[k]}</dd>`).join('')}${Object.keys(e.lean).map(k=>`<dt>${esc(fnm(k))} 귀부 기울기</dt><dd class="${e.lean[k]>=0?'good':'badc'}">${e.lean[k]>0?'+':''}${e.lean[k]}</dd>`).join('')}<dt>국고 · 군량</dt><dd>${fmt(e.treasury)} · ${e.grainWeeks}주치</dd></dl>${e.envoys.length?`<div class="warn">${e.envoys.map(x=>esc(fnm(x.from))+'의 '+D.KINDNAME[x.kind]+' 사신').join(', ')}이 와 있습니다.</div>`:''}${e.unhappy.length?`<div class="sub">불만을 품은 인물: ${e.unhappy.map(esc).join(', ')}</div>`:''}${age>K.probeFresh?'<div class="sub">오래된 보고입니다. 협상 전망에는 쓰이지 않습니다.</div>':''}`}
  return h}
function negoSheet(){const s=G.s,sh=G.sheet,t=sh.target,T=s.factions[t],m=me(),kinds=negoKinds(t);
  if(kinds.indexOf(sh.kind)<0)sh.kind=kinds[0];
  const k=sh.kind,tm=sh.terms;
  if(k==='revise'&&sh.init!=='revise'){const ag=Sim.vassalAg(s,m,t);if(ag){tm.autonomy=ag.terms.autonomy;tm.mobilize=ag.terms.mobilize;tm.protect=ag.terms.protect}sh.init='revise'}
  if(k==='aid'&&!tm.regionId){const rs=D.RIDS.filter(r=>Sim.sameBloc(s,m,s.regions[r].controller)&&s.regions[r].controller!==t);tm.regionId=(rs.find(r=>s.regions[r].siege)||rs.find(r=>s.regions[r].controller===m)||rs[0]||'')}
  const pv=Sim.negoPreview(s,m,t,k,tm);
  const sel=(key,label,opts)=>`<label class="fld" for="n-${key}">${label}</label><select id="n-${key}" data-term="${key}">${opts.map(o=>`<option value="${o[0]}" ${String(key==='mobilize'?(tm[key]?1:0):tm[key])===String(o[0])?'selected':''}>${o[1]}</option>`).join('')}</select>`;
  const gold=sel('gold',k==='truce'?'얹어 줄 재물':'예물',[0,50,100,150,200,250,300].map(g=>[g,g?'국고 '+g:'없음']));
  let ed='';
  if(k==='offer'||k==='revise'){ed=sel('autonomy','자치',[['full','자치 보장 (상납 없음)'],['tribute10','세수 1할 상납'],['tribute20','세수 2할 상납']])+sel('mobilize','동원',[[0,'동원 의무 없음'],[1,'동원 의무 있음 (동원령을 내릴 수 있음)']])+sel('protect','우리의 구원 약속',[[8,'피침 시 8주 안에 구원'],[4,'피침 시 4주 안에 구원'],[0,'구원 약속 없음']])+sel('office','관직',[['none','없음'],['now','지금 관직 수여'],['later',K.officeWeeks+'주 안에 수여하겠다고 약속']])+gold}
  else if(k==='pledge'){ed=sel('autonomy','우리가 청하는 자치',[['full','자치 보장 (상납 없음)'],['tribute10','세수 1할 상납'],['tribute20','세수 2할 상납']])+sel('mobilize','동원',[[0,'동원 의무 없음'],[1,'동원 의무를 짐']])+sel('protect','종주의 구원 약속',[[8,'피침 시 8주 안에 구원'],[4,'피침 시 4주 안에 구원'],[0,'구원 약속 없음']])}
  else if(k==='passage')ed=gold;
  else if(k==='truce')ed=sel('weeks','기간',[[8,'8주'],[12,'12주'],[16,'16주']])+gold;
  else if(k==='aid'){const rs=D.RIDS.filter(r=>Sim.sameBloc(s,m,s.regions[r].controller)&&s.regions[r].controller!==t);ed=sel('regionId','원군을 받을 거점',rs.map(r=>[r,s.regions[r].name+(s.regions[r].siege?' · 포위 중':'')+(s.regions[r].controller!==m?' ('+fnm(s.regions[r].controller)+')':'')]))+gold}
  let pvh='';
  if(!pv.ok)pvh=`<div class="warn">${esc(pv.reason)}</div>`;
  else{if(pv.label)pvh+=`<div class="odds ${pv.label==='유리'?'good':pv.label==='접전'?'mid':'badc'}">전망: ${pv.label}</div><div class="sub">${pv.probed?'동향 파악으로 확인한 속사정 기준입니다.':'우리가 아는 정보로 본 예상입니다.'} 실제 판정에는 운이 섞입니다.${k==='offer'||k==='revise'||k==='passage'?' 조금 모자라면 상대가 조건을 바꿔 되물어 옵니다.':''}</div>
     <div class="parts">${Object.keys(pv.parts).map(x=>`<span>${x}</span><span class="${pv.parts[x]>0?'good':'badc'}">${pv.parts[x]>0?'+':''}${pv.parts[x]}</span>`).join('')}<span><b>합계</b></span><span><b>${pv.score>0?'+':''}${pv.score}</b></span></div>${pv.unknown.length?`<div class="sub">모르는 사정: ${pv.unknown.join(', ')}. 동향 파악을 보내면 알 수 있습니다.</div>`:''}`;
    if(pv.note)pvh+=`<div class="sub">${esc(pv.note)}</div>`;
    if(k==='offer'||k==='revise'){const d=[tm.protect?'피침 시 '+tm.protect+'주 안에 구원':null,tm.office==='later'?K.officeWeeks+'주 안에 관직 수여':null].filter(Boolean);pvh+=`<div class="sub" style="margin-top:6px">맺어지면 우리가 지킬 약속: ${d.join(', ')||'없음'}. 어기면 신뢰와 평판이 떨어집니다.</div>`}
    if(k==='pledge')pvh+=`<div class="sub" style="margin-top:6px">${tm.mobilize?'동원령이 오면 병력을 보내야 합니다. 거절하면 약속 위반입니다.':'동원 의무가 없으면 종주가 군사를 부를 수 없습니다.'}</div>`;
    pvh+=`<div class="sub" style="margin-top:6px">사신 비용 국고 ${pv.cost}${tm.gold&&k!=='pledge'&&k!=='marriage'&&k!=='gift'?' · 맺어질 때 재물 '+tm.gold:''} · ${K.envoyWeeks}주 뒤 답이 옵니다.</div>`}
  return `<div style="display:flex;gap:10px;align-items:center">${seal(t,1)}<div><h2>${esc(T.name)}와(과) 협상</h2><div class="sub">${rel(t)} · 신뢰 ${Sim.trust(s,m,t)}${T.overlord?' · 종주 '+esc(fnm(T.overlord)):''}${T.breaches?' · 어긴 약속 '+T.breaches+'건':''}</div></div></div>
   <div class="kinds" role="group" aria-label="용건">${kinds.map(x=>`<button class="btn sm ${x===k?'on':''}" data-act="nego-kind" data-v="${x}">${D.KINDNAME[x]}</button>`).join('')}</div>
   <div class="sub">${KDESC[k]}</div>${ed}<div class="pv">${pvh}</div>
   <div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" data-act="go-envoy" ${pv.ok?'':`aria-disabled="true" data-why="${esc(pv.reason)}"`}>사신 출발</button><button class="btn" data-act="close">닫기</button></div>${relBlock(t)}`}
function propCard(p){const s=G.s,m=me(),k=p.kind==='counter'?p.base:p.kind,Kf=k==='offer'||k==='revise'?(p.kind==='counter'?p.to:p.from):k==='pledge'?p.to:null;
  let body=`<b>${esc(Sim.propText(s,p))}</b>`,yes='받아들인다',no='물리친다';
  if(Kf){const tx=Sim.termsText(Sim.normTerms(p.terms,Kf));
    if(p.kind==='counter')body+=`<div class="sub" style="margin-top:4px">우리가 낸 조건: ${Sim.termsText(Sim.normTerms(p.asked,Kf)).join(', ')}</div><div style="margin-top:4px">되물은 조건: <b>${tx.join(', ')}</b></div><div class="sub">받아들이면 이 조건대로 바로 맺어집니다.</div>`;
    else body+=`<div style="margin-top:4px">조건: ${tx.join(', ')}</div><div class="sub">${k==='offer'?'받아들이면 종주가 '+esc(fnm(p.from))+'(으)로 바뀌고 성과 자치는 유지됩니다.'+(s.factions[m].overlord&&s.factions[m].overlord!==p.from?' 지금의 종주 '+esc(fnm(s.factions[m].overlord))+'와는 관계가 끊어집니다.':''):k==='pledge'?'받아들이면 그 땅을 지나갈 수 있고 정보를 나눕니다. 구원 약속은 우리가 지켜야 합니다.':'받아들이면 섬기는 조건이 이렇게 바뀝니다.'}</div>`}
  else if(k==='marriage')body+=`<div class="sub">받아들이면 신뢰 +15, 인척이 됩니다. ${esc(fnm(p.from))}의 적국이 우리를 회유하기 어려워집니다.</div>`;
  else if(k==='passage')body+=`<div class="sub">${K.passWeeks}주 동안 ${esc(fnm(p.from))}군이 우리 땅을 지나갑니다.${p.terms.gold?' 대가로 국고 '+p.terms.gold+'을 받습니다.':''}</div>`;
  else if(k==='truce')body+=`<div class="sub">${p.terms.weeks}주 동안 싸움을 멈춥니다. 남의 땅에 있는 군대는 양쪽 다 물러납니다.${p.terms.gold?' 국고 '+p.terms.gold+'을 얹어 준답니다.':''}</div>`;
  else if(k==='aid')body+=`<div class="sub">받아들이면 8주 안에 ${K.aidNeed}명 이상을 보내야 합니다. 못 보내면 약속 위반입니다.${p.terms.gold?' 대가로 국고 '+p.terms.gold+'을 받습니다.':''}</div>`;
  else if(k==='callarms'){body+=`<div class="sub">따르면 8주 안에 ${K.aidNeed}명 이상을 보내야 합니다. 거절하거나 답하지 않으면 동원 의무를 어긴 것으로 남습니다(신뢰 −12, 평판 하락).</div>`;yes='따른다';no='거절한다'}
  return `<div class="prop">${body}<div class="sub">${Math.max(0,p.expires-s.week+1)}주 안에 답하지 않으면 거절로 봅니다.</div><div class="row"><button class="btn pri" data-act="respond" data-id="${p.id}" data-v="1">${yes}</button><button class="btn" data-act="respond" data-id="${p.id}" data-v="0">${no}</button></div></div>`}
const mobOf=f=>{const ag=Sim.vassalAg(G.s,me(),f);return !!(ag&&ag.terms.mobilize)};
const dis=v=>v.ok?'':`aria-disabled="true" data-why="${esc(v.reason)}"`;
function callBlock(rid){const s=G.s,m=me();if(!rid)return'';const vs=D.FIDS.filter(f=>s.factions[f].alive&&s.factions[f].overlord===m&&f!==s.regions[rid].controller);if(!vs.length)return'';
  const on=vs.filter(mobOf),off=vs.filter(f=>!mobOf(f));
  return `<h3 style="margin-top:10px">동원할 수 있는 원군</h3>`+on.map(f=>{const v=Sim.validate(s,m,'CALL_ARMS',{vassalId:f,regionId:rid});return `<div class="sub" style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin:3px 0"><span>${esc(fnm(f))} · 신뢰 ${Sim.trust(s,m,f)}</span><button class="btn sm" data-act="call-arms" data-id="${f}" data-rid="${rid}" ${dis(v)}>동원령</button></div>`}).join('')+(on.length?`<div class="sub">${esc(s.regions[rid].name)}(으)로 군사를 내라는 명령입니다. 우리 편 거점을 지키거나 우리가 에워싼 성을 칠 때만 내릴 수 있고, 신뢰 30 미만이면 거부할 수 있습니다.</div>`:'')+(off.length?`<div class="sub">동원 의무 없음: ${off.map(f=>esc(fnm(f))).join(', ')}. 조건 변경으로 얻어야 부를 수 있습니다.</div>`:'')}
function mobHint(){const s=G.s,m=me(),vs=D.FIDS.filter(f=>s.factions[f].alive&&mobOf(f));return vs.length?`<div class="sub" style="margin-top:8px">동원 의무를 진 세력: ${vs.map(f=>esc(fnm(f))).join(', ')}. 우리 군이 이 성을 에워싼 뒤 거점 정보에서 동원령을 내릴 수 있습니다.</div>`:''}
function lbar(v){return `<span class="lb ${v<30?'lo':v<50?'mid':''}"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></span>`}
function courtTab(){const s=G.s,m=me(),F=s.factions[m],ob=Sim.obligations(s,m);let h='';
  const due=e=>e.ob.due===null?'기한 없음':(e.ob.due-s.week<0?'기한 지남':e.ob.due-s.week+'주 남음');
  h+=`<div class="sec">약속 장부</div>`;
  h+=ob.mine.length?ob.mine.map(e=>`<div class="ob ${e.ob.due!==null&&e.ob.due-s.week<=3?'due':''}"><span class="w">우리가 ${esc(fnm(e.ob.to))}에게 · ${due(e)}</span>${esc(e.text)}${e.ob.kind==='office'?` <button class="btn sm" data-act="go-reward" data-id="${e.ob.charId}" data-v="office" ${dis(Sim.validate(s,m,'REWARD',{charId:e.ob.charId,kind:'office'}))}>관직 내리기</button>`:''}${e.ob.regionId?` <a href="#" data-act="sel" data-id="${e.ob.regionId}" style="color:var(--gold)">지도</a>`:''}</div>`).join(''):`<div class="ob sub">우리가 지켜야 할 밀린 약속이 없습니다.</div>`;
  h+=ob.theirs.map(e=>`<div class="ob"><span class="w">${esc(fnm(e.ob.by))}가 우리에게 · ${due(e)}</span>${esc(e.text)}</div>`).join('');
  h+=ob.done.slice(0,5).map(e=>`<div class="ob sub"><span class="w">${e.ob.by===m?'우리':esc(fnm(e.ob.by))} → ${e.ob.to===m?'우리':esc(fnm(e.ob.to))} · ${e.ob.status==='fulfilled'?'<span class="good">지킴</span>':'<span class="badc">어김</span>'}</span>${esc(e.text)} · ${esc(e.ob.evidence||'')}</div>`).join('');
  if(F.breaches)h+=`<div class="ob"><span class="badc">우리가 어긴 약속 ${F.breaches}건</span> · 모든 협상에서 약속 이력 ${-Math.min(20,6*F.breaches)}</div>`;
  const ags=s.agreements.filter(g=>g.active&&g.parties.indexOf(m)>=0);
  h+=`<div class="sec">맺은 약정</div>`+(ags.length?ags.map(g=>{const o=g.parties[0]===m?g.parties[1]:g.parties[0];let tx='',bt='';
    if(g.type==='vassal'){tx=(g.parties[0]===m?'우리를 섬김':'우리의 종주')+' · '+g.text.filter(x=>x!=='명목상 종주 관계').join(', ');if(g.parties[0]===m)bt=`<button class="btn sm" data-act="open-nego" data-id="${o}" data-v="revise">조건 변경</button> <button class="btn sm" data-act="go-reward-open" data-id="${s.factions[o].rulerId}">포상</button>`}
    else if(g.type==='truce')tx='휴전 · '+Sim.dateStr(g.until)+'까지';else if(g.type==='passage')tx=(g.parties[0]===m?'우리가 통행을 허락함':'통행을 허락받음')+' · '+Sim.dateStr(g.until)+'까지';else if(g.type==='marriage')tx='혼인 관계';else if(g.type==='aid'){if(!g.obs.some(x=>x.status==='pending'))return'';tx='원군 약속'}
    return `<div class="ob"><span class="w">${esc(fnm(o))} · 신뢰 ${Sim.trust(s,m,o)}${g.breaches?' · 위반 '+g.breaches+'건':''}</span>${esc(tx)}${bt?`<div style="margin-top:5px">${bt}</div>`:''}</div>`}).join(''):`<div class="ob sub">맺은 약정이 없습니다.</div>`);
  const own=Object.values(s.characters).filter(c=>c.faction===m&&c.status==='active'&&c.id!==F.rulerId).sort((a,b)=>a.loyalty-b.loyalty);
  h+=`<div class="sec">인물</div>`+own.map(c=>{const lordAt=D.RIDS.find(r=>s.regions[r].lord===c.id&&s.regions[r].controller===m);return `<div class="ob"><span class="w">${esc(c.role)} · ${esc(s.regions[c.loc].name)}${lordAt?' 성주':''}${c.armyId==='appoint'?' · 부임 가는 중':c.armyId?' · 출정 중':''}${c.office?' · '+Sim.officeName(c.officeBy,c.office):''}${F.heir===c.id?' · 후계':''}</span><b>${esc(c.name)}</b> 충성${lbar(c.loyalty)}${c.loyalty}${c.merit?' · 공적 '+c.merit:''}${(c.wait||0)>6?' · <span class="badc">포상을 기다림</span>':''}${c.loyalty<30?' · <span class="badc">군령 거부</span>':''} <button class="btn sm" data-act="go-reward-open" data-id="${c.id}">포상</button></div>`}).join('');
  const caps=Object.values(s.characters).filter(c=>c.status==='captive'&&c.captor===m);if(caps.length)h+=caps.map(c=>`<div class="ob sub">포로: ${esc(c.name)} (${esc(fnm(c.faction))})</div>`).join('');
  h+=`<div class="sec">조정·가문</div>`;
  const hs=D.HEIRS[m];
  if(hs){h+=`<div class="ob"><span class="w">후계 · ${F.heir?'지금의 후계: '+esc(s.characters[F.heir].name):'아직 정하지 않음'}</span>${hs.map(id=>s.characters[id]).filter(c=>c.faction===m&&c.status==='active').map(c=>{const e=Sim.heirEffects(s,m,c.id),v=Sim.validate(s,m,'HEIR',{charId:c.id});return `<div style="margin-top:6px"><b>${esc(c.name)}</b> <span class="sub">충성 ${c.loyalty} · 야심 ${c.ambition}</span> <button class="btn sm" data-act="go-heir" data-id="${c.id}" ${dis(v)}>후계로 세운다</button><div class="sub">세우면: ${Object.keys(e.changes).map(x=>esc(s.characters[x].name)+' '+(e.changes[x]>0?'+':'')+e.changes[x]).join(', ')} · 정통성 ${e.legitimacy>0?'+':''}${e.legitimacy}</div></div>`}).join('')}</div>`}
  else h+=`<div class="ob sub">후계를 다툴 인물이 없습니다.</div>`;
  const kin=D.KIN.filter(k=>s.characters[k[0]].faction===m||s.characters[k[1]].faction===m),ties=Object.keys(s.ties).filter(k=>k.split('|').indexOf(m)>=0);
  h+=kin.map(k=>`<div class="ob sub">${esc(s.characters[k[0]].name)} — ${esc(s.characters[k[1]].name)}: ${k[2]}${s.characters[k[0]].faction!==s.characters[k[1]].faction?' (다른 세력)':''}</div>`).join('')+ties.map(k=>`<div class="ob sub">혼인: ${k.split('|').map(fnm).join(' — ')}</div>`).join('');
  h+=`<div class="ob sub">혈연과 혼인은 신뢰와 협상에만 영향을 줍니다. 군대는 약정에 동원 의무가 있어야 움직입니다.</div>`;
  return h}
function rewardSheet(){const s=G.s,m=me(),F=s.factions[m];
  const own=Object.values(s.characters).filter(c=>c.faction===m&&c.status==='active'&&c.id!==F.rulerId).sort((a,b)=>(b.merit||0)-(a.merit||0)||a.loyalty-b.loyalty);
  const vas=D.FIDS.filter(f=>s.factions[f].alive&&s.factions[f].overlord===m).map(f=>s.characters[s.factions[f].rulerId]).filter(c=>c&&c.status==='active');
  const due={};for(const e of Sim.obligations(s,m).mine)if(e.ob.kind==='office')due[e.ob.charId]=e.ob.due-s.week;
  const row=(c,isV)=>{const vg=Sim.validate(s,m,'REWARD',{charId:c.id,kind:'gold'}),vo=Sim.validate(s,m,'REWARD',{charId:c.id,kind:'office'});
    return `<div class="pv" ${G.sheet.charId===c.id?'style="outline:1px solid var(--gold)"':''}><b>${esc(c.name)}</b> <span class="sub">${isV?esc(fnm(c.faction))+' 우두머리':esc(c.role)}${c.office?' · '+Sim.officeName(c.officeBy,c.office):''}</span>
     <div class="sub">${isV?'신뢰 '+Sim.trust(s,m,c.faction):'충성'+lbar(c.loyalty)+c.loyalty} · 공적 ${c.merit||0}${(c.wait||0)>6?' · <span class="badc">포상을 기다리다 불만</span>':''}${due[c.id]!==undefined?` · <span class="badc">약속한 관직, ${due[c.id]}주 남음</span>`:''}</div>
     <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn sm" data-act="go-reward" data-id="${c.id}" data-v="gold" ${dis(vg)}>재물 ${K.rewardGold} · ${isV?'신뢰 +6':'충성 +10'}</button><button class="btn sm" data-act="go-reward" data-id="${c.id}" data-v="office" ${dis(vo)}>관직 ${K.officeCost} · ${isV?'신뢰 +8':'충성 +15'}</button></div></div>`};
  return `<h2>논공행상</h2><div class="sub">국고 ${fmt(F.treasury)}. 재물은 공적 15를, 관직은 공적 30을 갚습니다. 관직은 단계마다 봉록이 주당 ${K.officeSalary}씩 나갑니다. 공적 15 이상을 6주 넘게 묵히면 충성이 깎입니다.</div>
   ${own.length?'<h3>우리 신하</h3>'+own.map(c=>row(c,false)).join(''):''}${vas.length?'<h3>우리를 섬기는 세력</h3>'+vas.map(c=>row(c,true)).join(''):''}
   <div style="margin-top:12px"><button class="btn" data-act="close">닫기</button></div>`}
function appointSheet(){const s=G.s,m=me(),R=s.regions[G.sheet.from],L=Sim.lordOf(s,R),F=s.factions[m];
  const cs=Object.values(s.characters).filter(c=>c.faction===m&&c.status==='active'&&c.id!==F.rulerId).sort((a,b)=>b.po-a.po);
  return `<h2>${esc(R.name)} 성주 임명</h2><div class="sub">지금 성주: ${L?esc(L.name)+' (정치 '+L.po+')':'없음'} · 민심 ${R.morale}, 머무는 자리 ${L?50+Math.round(L.po/4):45}. 성주의 정치력이 민심이 머무는 자리를 정하고, 성주는 수비를 지휘합니다. 성주가 출정하면 자리가 빕니다.</div>
   ${cs.map(c=>{const v=Sim.validate(s,m,'APPOINT',{regionId:R.id,charId:c.id}),at=D.RIDS.find(r=>s.regions[r].lord===c.id&&s.regions[r].controller===m);return `<div class="pv"><b>${esc(c.name)}</b> <span class="sub">${esc(s.regions[c.loc].name)}${at?' 성주':''} · 정치 ${c.po} · 통솔 ${c.ld} · 충성 ${c.loyalty}</span><div class="sub">부임하면 민심이 머무는 자리 ${50+Math.round(c.po/4)}${v.ok?' · 가는 데 '+v.weeks+'주':''}${at&&at!==R.id?' · '+esc(s.regions[at].name)+' 성주 자리는 빕니다':''}</div>${v.ok?'':`<div class="warn">${esc(v.reason)}</div>`}<button class="btn sm" style="margin-top:6px" data-act="go-appoint" data-id="${c.id}" ${dis(v)}>보낸다</button></div>`}).join('')||'<div class="pv sub">보낼 수 있는 인물이 없습니다.</div>'}
   <div style="margin-top:12px"><button class="btn" data-act="close">닫기</button></div>`}
function refreshTargets(){const s=G.s,sh=G.sheet,sel=$('#m-to');if(!sel)return;const R=s.regions[sh.from];
  for(const o of sel.options){if(!o.value)continue;const T=s.regions[o.value],p=Sim.findPath(s,me(),sh.from,o.value,Sim.total(sh.units)?sh.units:R.garrison),kind=T.controller===me()?'주둔 이동':Sim.sameBloc(s,me(),T.controller)?'우군 지원':Sim.atWar(s,me(),T.controller)?'공격':'공격(선전포고)';o.textContent=T.name+' · '+kind+' · '+(p?p.weeks+'주':'길 없음');o.disabled=!p}}
function pvRecruit(){const s=G.s,sh=G.sheet,u=U[sh.unit],v=Sim.validate(s,me(),'RECRUIT',{regionId:sh.from,unit:sh.unit,count:sh.count}),go=$('#rc-go');
  $('#rc-pv').innerHTML=`<dl class="kv"><dt>비용</dt><dd>국고 ${fmt(Math.ceil(sh.count/100*u.cost))}</dd><dt>완료</dt><dd>${K.recruitWeeks}주 뒤</dd><dt>늘어나는 소모</dt><dd>군량 주당 ${fmt(sh.count/100*u.grain*K.garrisonGrain)} · 국고 주당 ${(sh.count/100*u.gold).toFixed(1)}</dd></dl><div class="sub">${esc(u.note)}</div>${v.ok?'':`<div class="warn">${esc(v.reason)}</div>`}`;
  if(v.ok)go.removeAttribute('aria-disabled');else{go.setAttribute('aria-disabled','true');go.dataset.why=v.reason}}
const OUT={capture:'함락',repulsed:'격퇴',rout:'궤멸',lifted:'포위 풀림'};
const STDESC={공세:'전력 +10%, 손실 +15%, 매복에 잘 걸림, 사기 25까지 버팀',신중:'기본 전력, 매복 위험 낮음, 사기 35 이하면 물러남',방어:'수비할 때 +12%, 공격할 때 −10%, 손실 −10%',지연:'전력 −15%, 손실 −30%, 추격 피해 적음, 사기 45 이하면 물러남'};
const pctS=v=>(v>=1?'+':'−')+Math.abs(Math.round((v-1)*100))+'%';
const cmdOf=st=>Math.min(1.2,Math.max(0.8,1+0.004*(st.ld-50)));
const tot=u=>u.light+u.heavy+u.archer+u.cav;
function engSeen(e){return e.attackers.concat(e.defenders).some(f=>share(me(),f))}
function resultFor(e){const m=me(),inA=e.attackers.some(f=>share(m,f)),inD=e.defenders.some(f=>share(m,f));
  if(e.end===null)return{label:'교전 중',cls:''};
  const atkWon=e.outcome==='capture';if(!inA&&!inD)return{label:OUT[e.outcome],cls:''};
  const won=inA?atkWon:!atkWon;return{label:(won?'승리':'패배')+' · '+OUT[e.outcome],cls:won?'c':'u',won}}
function resultSheet(id){
  const s=G.s,e=Sim.engById(s,id);if(!e)return `<h2>기록이 없습니다</h2><div class="sub">오래된 전투 기록은 지워졌습니다.</div><button class="btn" data-act="close">닫기</button>`;
  const R=s.regions[e.regionId],r=resultFor(e),m=me(),mineA=e.attackers.some(f=>share(m,f)),mineD=e.defenders.some(f=>share(m,f));
  const rounds=e.battleIds.map(b=>s.battles.find(x=>x.id===b)).filter(Boolean),lastB=rounds[rounds.length-1];
  const nm=ids=>ids.map(i=>s.characters[i]).filter(Boolean).slice(0,3).map(c=>esc(c.name)).join('·')||'없음';
  const unitRows=UN.map(k=>`<tr><td>${U[k].name} 손실</td><td>${mineA?fmt(e.lost.atk[k]):'—'}</td><td>${mineD?fmt(e.lost.def[k]):'—'}</td></tr>`).join('');
  let h=`<div class="sub">${Sim.dateStr(e.start)}${e.end!==null?' ~ '+Sim.dateStr(e.end):' · 진행 중'} · ${e.rounds}주 교전</div><h2>${esc(R.name)} 공방전</h2>
  <div style="margin:6px 0 8px"><span class="tag ${r.cls}" style="font-size:14px;padding:2px 8px">${r.label}</span></div>
  <table class="u cmp"><tr><th></th><th>공격</th><th>수비</th></tr>
   <tr><td>세력</td><td>${e.attackers.map(fnm).join('·')}</td><td>${e.defenders.map(fnm).join('·')}</td></tr>
   <tr><td>지휘부</td><td>${nm(e.officers.atk)}</td><td>${nm(e.officers.def)}</td></tr>
   <tr><td>최대 병력</td><td>${fmt(e.peak.atk)}</td><td>${fmt(e.peak.def)}</td></tr>
   <tr><td><b>잃은 병력</b></td><td><b>${fmt(tot(e.lost.atk))}</b></td><td><b>${fmt(tot(e.lost.def))}</b></td></tr>${unitRows}</table>
  <div class="sub">병종별 손실은 우리 편만 정확히 압니다. 적은 전장에서 센 합계만 보입니다.</div>`;
  if(lastB){const keys=['지휘','무력','지략','사기','보급','작전','지형','운'];
    h+=`<h3>무엇이 갈랐나 · 마지막 교전</h3><table class="u cmp"><tr><th>보정</th><th>공격</th><th>수비</th></tr>${keys.map(k=>{const a=lastB.atk.f[k],d=lastB.def.f[k],big=Math.abs(a-d)>=0.05;return `<tr${big?' class="hot"':''}><td>${k}</td><td class="${a>d+0.001?'good':''}">${pctS(a)}</td><td class="${d>a+0.001?'good':''}">${pctS(d)}</td></tr>`}).join('')}
     <tr><td>기초 전력</td><td>${fmt(lastB.atk.base)}</td><td>${fmt(lastB.def.base)}</td></tr><tr><td><b>최종 전력</b></td><td><b>${fmt(lastB.atk.power)}</b></td><td><b>${fmt(lastB.def.power)}</b></td></tr></table>
     ${lastB.rationale.map(x=>`<div class="sub">· ${esc(x)}</div>`).join('')}`;
    h+=`<h3>주차별 전황</h3>`+rounds.map(b=>{const w=b.atk.power/(b.atk.power+b.def.power)*100;return `<div class="rnd"><span class="sub">${Sim.dateStr(b.week).replace(/^\d+년 /,'')}</span><span class="pbar" title="전력 공 ${b.atk.power} : 수 ${b.def.power}"><i style="width:${w.toFixed(0)}%"></i></span><span class="sub">${fmt(b.atk.after)} / ${fmt(b.def.after)}</span></div>`}).join('')+`<div class="sub">막대의 붉은 부분이 공격측 전력 비중입니다. 숫자는 그 주가 끝난 뒤 남은 병력(공/수)입니다.</div>`}
  if(e.events.length)h+=`<h3>사건</h3>`+e.events.map(v=>v.type==='ambush'?`<div class="sub">· 매복 ${v.ok?'<b class="badc">성공</b>':'실패'} (확률 ${v.chance}%): ${esc(v.by)} 대 ${esc(v.vs)}${v.scouted?', 정찰로 대비함':''}${v.ok?' → '+esc(fnm(v.faction))+'군 '+fmt(tot(v.lost))+'명 손실':''}</div>`
    :v.type==='pursuit'?`<div class="sub">· ${esc(fnm(v.faction))}군이 물러나다 추격으로 ${fmt(tot(v.lost))}명 손실 (${v.rate}%, 쫓는 기병 ${fmt(v.pursuerCav)}, 물러나는 쪽 지략 ${v.st})</div>`
    :v.type==='captured'?`<div class="sub">· <b>${esc(v.name)}</b> 포로 (${esc(fnm(v.faction))} → ${esc(fnm(v.captor))})</div>`
    :v.type==='escape'?`<div class="sub">· ${esc(v.name)}: ${esc(v.note)}</div>`:v.type==='rout'?`<div class="sub">· ${esc(fnm(v.faction))}군 궤멸</div>`:'').join('');
  if(e.changes.length||e.merit.length)h+=`<h3>전후 변화</h3>`+e.changes.map(c=>`<div class="sub">· ${esc(c)}</div>`).join('')+e.merit.filter(x=>share(m,x.faction)).map(x=>`<div class="sub">· ${esc(x.name)} 공적 ${x.d>0?'+':''}${x.d} (${esc(x.why)})</div>`).join('')+(e.merit.some(x=>x.faction===m&&x.d>0)?`<div class="sub">공을 세운 장수를 오래 두면 불만이 쌓입니다.</div><button class="btn sm" style="margin-top:6px" data-act="open-reward">논공행상</button>`:'');
  h+=`<div style="display:flex;gap:8px;margin-top:14px"><button class="btn" data-act="sel" data-id="${R.id}">지도에서 보기</button><button class="btn pri" data-act="close">닫기</button></div>`;
  return h;
}
function pvBuy(){const s=G.s,sh=G.sheet,v=Sim.validate(s,me(),'BUY_GRAIN',{regionId:sh.from,gold:sh.gold}),go=$('#by-go'),sm=Sim.factionSummary(s,me());
  $('#by-pv').innerHTML=`<dl class="kv"><dt>들어올 군량</dt><dd>${fmt(sh.gold*K.grainPerGold)}</dd><dt>지금 군량</dt><dd>${fmt(sm.grain)} · ${sm.use?Math.floor(sm.grain/sm.use):'∞'}주치</dd><dt>사들인 뒤</dt><dd>${sm.use?Math.floor((sm.grain+sh.gold*K.grainPerGold)/sm.use):'∞'}주치</dd></dl>${v.ok?'':`<div class="warn">${esc(v.reason)}</div>`}`;
  if(v.ok)go.removeAttribute('aria-disabled');else{go.setAttribute('aria-disabled','true');go.dataset.why=v.reason}}
function drawLegend(){$('#legend').innerHTML=`<span><svg width="26" height="26" viewBox="-14 -14 28 28"><circle r="11.5" fill="#e6e2d3" stroke="#1f4e79" stroke-width="3"/><circle r="8" fill="#2f6b4f"/></svg> 속 = 실제 지배, 테 = 명목 종주</span><span><span class="tag c">확인</span> 본 숫자 · <span class="tag e">추정</span> 어림 · <span class="tag u">미확인</span></span><span>■ 성 방어 단계</span>`}
function drawAll(){if(!G.s)return;drawRegions();drawArmies();drawHL();drawTop();drawLeft();drawBar();drawRight()}
function J(el){if(el&&/\((가|를|는|과|으)\)/.test(el.innerHTML))el.innerHTML=Sim.jo(el.innerHTML)}
let toastT=0;function toast(t){const el=$('#toast');el.textContent=Sim.jo(t);el.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>el.style.display='none',3600)}

// ── 시작·종료 화면 ──
function showStart(){
  G.veil='start';$('#app').classList.add('idle');const au=store.get(AUTO),tmp=Sim.newGame('goryeo',1);
  const card=f=>{const F=tmp.factions[f],sm=Sim.factionSummary(tmp,f),ru=tmp.characters[F.rulerId];return `<button class="card" data-act="pick" data-v="${f}"><span class="hd"><span class="seal" style="background:${FM[f].color}">${FM[f].hanja}</span><span><span class="nm">${esc(F.name)}</span><br><span class="sub">${FM[f].title} ${esc(ru.name)}</span></span></span><p>${FM[f].blurb}</p><span class="st"><span><b>${sm.regions}</b>거점</span><span><b>${fmt(sm.troops)}</b>병력</span><span><b>${fmt(sm.grain)}</b>군량</span><span><b>${fmt(F.treasury)}</b>국고</span></span></button>`};
  $('#veil').style.display='grid';
  $('#veil').innerHTML=`<div class="inner"><h1><small>後三國 · R3 시제품</small>천하의 주인</h1><p class="lede">929년 가을, 고창 전역. 60주 동안 여덟 세력이 같은 규칙으로 움직입니다. 고른 세력의 군주가 되어 장수와 병종을 짜 보내고, 조건을 걸어 호족과 약속을 맺으세요. 지킨 약속과 어긴 약속은 장부에 남습니다. 싸움의 때와 장소, 승패는 정해져 있지 않습니다.</p>
  <div class="cards">${['goryeo','hubaekje','gochang'].map(card).join('')}</div>
  <div class="opts"><label for="seed">난수 시드</label><input type="number" id="seed" value="${929}" min="1" max="999999"><span>같은 시드와 같은 명령이면 같은 전개가 나옵니다.</span>${au&&au.s&&au.s.v===3?`<button class="btn" data-act="continue">이어하기 · ${esc(au.s.factions[au.s.playerFactionId].name)} ${Sim.dateStr(au.s.week)}</button>`:''}</div></div>`;
}
function showEnd(){
  const s=G.s;G.veil='end';G.paused=true;
  const rows=D.FIDS.map(f=>{const F=s.factions[f],sm=Sim.factionSummary(s,f);return `<tr><td>${chip(f)}${f===me()?' ◀':''}</td><td>${F.alive?sm.regions:'멸망'}</td><td>${fmt(sm.troops+sm.field)}</td><td>${F.overlord?esc(fnm(F.overlord)):'—'}</td><td>${sm.vassals.map(fnm).join('·')||'—'}</td></tr>`}).join('');
  const key=s.chronicle.filter(c=>['capture','submit','fall','breach','defect','retreat','war'].indexOf(c.type)>=0);
  $('#veil').style.display='grid';
  $('#veil').innerHTML=`<div class="inner slab" style="padding:24px"><h2 style="font-size:34px">${s.over.type==='defeat'?'마지막 성이 떨어졌다':'930년이 저물었다'}</h2><p class="sub">${Sim.dateStr(s.over.week)} · 시드 ${s.seed}. 이 시제품은 판도만 보여 줍니다. 승패 판정과 세력별 목표 달성은 R4에서 붙습니다.</p>
  <table class="end"><tr><th>세력</th><th>거점</th><th>병력</th><th>종주</th><th>섬기는 세력</th></tr>${rows}</table>
  <h3>이번 판의 굵은 사건 ${key.length}건</h3><div style="max-height:220px;overflow:auto">${key.map(c=>`<div class="sub">${Sim.dateStr(c.week)} · ${esc(c.text)}</div>`).join('')||'<div class="sub">큰 사건 없이 지나갔습니다.</div>'}</div>
  <div style="display:flex;gap:8px;margin-top:16px"><button class="btn pri" data-act="new">새 판 시작</button><button class="btn" data-act="peek">지도 살펴보기</button></div></div>`;
}
function start(s){$('#app').classList.remove('idle');G.s=s;G.sel={type:'region',id:s.factions[s.playerFactionId].capitalId};G.sheet=null;G.tab='report';G.acc=0;G.paused=true;G.seen=s.reports.length;G.veil=null;$('#veil').style.display='none';fit();drawAll();if(s.over)showEnd()}

// ── 시간 ──
function doTick(){
  const s=G.s;if(!s||s.over)return;Sim.tick(s);
  const urg=s.reports.filter(r=>r.week===s.week&&r.urgent);G.seen=s.reports.length;
  if(G.sheet&&G.sheet.type==='move'&&!s.armies[G.sheet.armyId])G.sheet=null;
  if(G.sel&&G.sel.type==='army'&&!s.armies[G.sel.id])G.sel=null;
  store.set(AUTO,{s});
  const fin=(s.pendingResults||[]).map(id=>Sim.engById(s,id)).filter(e=>e&&e.attackers.concat(e.defenders).indexOf(me())>=0);
  if(fin.length&&(!G.sheet||G.sheet.type==='result')){G.sheet={type:'result',id:fin[fin.length-1].id};if(G.autoPause)G.paused=true}
  else if(urg.length&&G.autoPause&&!G.paused){G.paused=true;G.tab='report';toast('시간을 멈췄습니다: '+urg[urg.length-1].text)}
  if(!G.sheet&&s.proposals.some(p=>p.to===me()&&p.status==='pending'&&p.week===s.week)){G.tab='report';if(G.autoPause)G.paused=true}
  drawAll();if(s.over)showEnd();
}
let last=performance.now(),fc=0;
function frame(now){const dt=Math.min(.25,(now-last)/1000);last=now;
  if(G.s&&!G.paused&&!G.veil&&!G.s.over){G.acc+=dt*G.speed/K.week_s;if(G.acc>=1){G.acc=0;doTick()}else if(++fc%4===0&&Object.keys(G.s.armies).length)drawArmies();const b=$('#wkbar');if(b)b.style.width=(G.acc*100).toFixed(1)+'%'}
  requestAnimationFrame(frame)}
K.week_s=25;

// ── 입력 ──
function act(type,params,okMsg){const r=Sim.issueOrder(G.s,me(),type,params);toast(r.ok?okMsg:r.reason);drawAll();return r}
function openMarch(){const s=G.s,m=me(),R=s.regions[G.sel.id];let from=R.id,target='';
  if(R.controller!==m){target=R.id;let best=null;for(const r of D.RIDS){const S=s.regions[r];if(S.controller!==m||S.siege)continue;const p=Sim.findPath(s,m,r,target,S.garrison);if(p&&(!best||p.weeks<best.w))best={r,w:p.weeks}}from=best?best.r:D.RIDS.find(r=>s.regions[r].controller===m&&!s.regions[r].siege)}
  const g=s.regions[from].garrison,units={};UN.forEach(k=>units[k]=Math.floor(g[k]/2/10)*10);
  const cm=Object.values(s.characters).filter(c=>c.faction===m&&c.loc===from&&!c.armyId&&c.status==='active'&&c.id!==s.factions[m].rulerId).sort((a,b)=>b.ld-a.ld)[0];
  G.sheet={type:'march',from,target,units,commanderId:cm?cm.id:'',deps:['',''],stance:'신중'};drawAll()}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t)return;if(t.tagName==='A')e.preventDefault();
  if(t.getAttribute('aria-disabled')==='true'){toast(t.dataset.why||'지금은 할 수 없습니다.');return}
  const a=t.dataset.act,v=t.dataset.v,s=G.s;
  if(a==='pick'){const seed=parseInt(($('#seed')||{}).value,10)||929;start(Sim.newGame(v,seed));toast('시간은 멈춰 있습니다. 준비가 되면 1×를 누르세요.')}
  else if(a==='continue'){const au=store.get(AUTO);if(au&&au.s&&au.s.v===3)start(au.s)}
  else if(a==='new'){G.paused=true;showStart()}
  else if(a==='peek'){G.veil=null;$('#veil').style.display='none'}
  else if(a==='pause'){G.paused=true;drawTop()}
  else if(a==='speed'){if(s.over){toast('캠페인이 끝났습니다.');return}G.speed=+v;G.paused=false;drawTop()}
  else if(a==='step'){if(s.over){toast('캠페인이 끝났습니다.');return}G.paused=true;G.acc=0;doTick()}
  else if(a==='zoom')zoomAt(+v); else if(a==='fit')fit();
  else if(a==='tab'){G.tab=v;drawRight()}
  else if(a==='sel'){G.sel={type:'region',id:t.dataset.id};const p=RP[t.dataset.id],vb=G.vb;if(p[0]<vb.x+vb.w*.2||p[0]>vb.x+vb.w*.8||p[1]<vb.y+vb.h*.15||p[1]>vb.y+vb.h*.85){vb.x=p[0]-vb.w/2;vb.y=p[1]-vb.h/2;applyVB()}drawAll()}
  else if(a==='fold'){$('#'+v).classList.toggle('closed')}
  else if(a==='save'){toast(store.set(SAVE,{s})?'저장했습니다. 이 브라우저에만 남습니다.':'이 환경에서는 저장할 수 없습니다.')}
  else if(a==='load'){const sv=store.get(SAVE);if(sv&&sv.s&&sv.s.v===3){start(sv.s);toast('불러왔습니다: '+Sim.dateStr(sv.s.week))}else toast(sv&&sv.s?'예전 버전에서 저장한 판은 이어할 수 없습니다.':'저장한 판이 없습니다.')}
  else if(a==='close'){G.sheet=null;drawAll()}
  else if(a==='cmd'){const R=s.regions[G.sel.id];act(t.dataset.type,{regionId:R.id},{PACIFY:R.name+'의 민심을 수습합니다. '+K.pacifyWeeks+'주 걸립니다.',REQUISITION:R.name+'에서 군량을 거둡니다. 다음 주에 들어옵니다.',FORTIFY:R.name+' 성 보강을 시작했습니다. '+K.repairWeeks+'주 걸립니다.',SCOUT:R.name+'(으)로 정찰병을 보냈습니다.'}[t.dataset.type])}
  else if(a==='acmd'){act(t.dataset.type,{armyId:G.sel.id},t.dataset.type==='GARRISON'?'부대가 주둔군에 합류했습니다.':'가까운 우리 거점으로 회군합니다.')}
  else if(a==='open-march')openMarch();
  else if(a==='open-move'){G.sheet={type:'move',armyId:G.sel.id,target:''};drawAll()}
  else if(a==='open-recruit'){G.sheet={type:'recruit',from:G.sel.id,unit:'light',count:500};drawAll()}
  else if(a==='open-envoy'){G.sheet={type:'envoy',target:s.regions[G.sel.id].controller,kind:'',terms:{autonomy:'full',office:'none',gold:0,mobilize:false,protect:8,weeks:12,regionId:''}};drawAll()}
  else if(a==='open-nego'){G.sheet={type:'envoy',target:t.dataset.id,kind:v||'',terms:{autonomy:'full',office:'none',gold:0,mobilize:false,protect:8,weeks:12,regionId:''}};drawAll()}
  else if(a==='nego-kind'){G.sheet.kind=v;drawRight()}
  else if(a==='probe'){act('PROBE',{targetFactionId:s.regions[G.sel.id].controller},'사람을 보냈습니다. '+K.probeWeeks+'주 뒤 동향 보고가 옵니다.')}
  else if(a==='open-reward'||a==='go-reward-open'){G.sheet={type:'reward',charId:t.dataset.id||''};drawAll()}
  else if(a==='go-reward'){const c=s.characters[t.dataset.id];act('REWARD',{charId:c.id,kind:v},c.name+'에게 '+(v==='office'?'관직을 내렸습니다.':'재물을 내렸습니다.'))}
  else if(a==='open-appoint'){G.sheet={type:'appoint',from:G.sel.id};drawAll()}
  else if(a==='go-appoint'){const c=s.characters[t.dataset.id],r=act('APPOINT',{regionId:G.sheet.from,charId:c.id},c.name+'이(가) 부임길에 올랐습니다.');if(r.ok){G.sheet=null;drawAll()}}
  else if(a==='go-heir'){const c=s.characters[t.dataset.id];act('HEIR',{charId:c.id},c.name+'을(를) 후계로 세웠습니다.')}
  else if(a==='call-arms'){act('CALL_ARMS',{vassalId:t.dataset.id,regionId:t.dataset.rid},s.factions[t.dataset.id].name+'에 동원령을 보냈습니다. 다음 주에 답이 옵니다.')}
  else if(a==='break-truce'){G.sheet.breakTruce=true;pvMarch()}
  else if(a==='mq'){const g=s.regions[G.sheet.from].garrison;UN.forEach(k=>G.sheet.units[k]=Math.floor(g[k]*+v/10)*10);drawRight()}
  else if(a==='go-march'){const sh=G.sheet,r=Sim.issueOrder(s,me(),'MARCH',{fromRegionId:sh.from,targetRegionId:sh.target,units:sh.units,commanderId:sh.commanderId||null,deputyIds:sh.deps.filter(Boolean),stance:sh.stance,breakTruce:!!sh.breakTruce});
    if(r.ok){G.sheet=null;G.sel={type:'army',id:r.armyId};toast('출정했습니다. '+r.eta+'주 뒤 도착합니다.')}else toast(r.reason);drawAll()}
  else if(a==='go-move'){const sh=G.sheet,r=Sim.issueOrder(s,me(),'ARMY_ORDER',{armyId:sh.armyId,targetRegionId:sh.target});if(r.ok){G.sheet=null;toast('이동을 시작합니다. '+r.eta+'주 걸립니다.')}else toast(r.reason);drawAll()}
  else if(a==='go-recruit'){const sh=G.sheet,r=act('RECRUIT',{regionId:sh.from,unit:sh.unit,count:sh.count},U[sh.unit].name+' '+sh.count+'명을 모으기 시작했습니다. '+K.recruitWeeks+'주 걸립니다.');if(r.ok){G.sheet=null;drawAll()}}
  else if(a==='go-envoy'){const sh=G.sheet,r=act('ENVOY',{targetFactionId:sh.target,kind:sh.kind,terms:sh.terms},D.KINDNAME[sh.kind]+' 사신이 떠났습니다. '+K.envoyWeeks+'주 뒤에 답이 옵니다.');if(r.ok){G.sheet=null;drawAll()}}
  else if(a==='result'){G.sheet={type:'result',id:+t.dataset.id};drawAll()}
  else if(a==='open-buy'){const F=s.factions[me()];G.sheet={type:'buy',from:G.sel.id,gold:Math.min(200,Math.floor(F.treasury/50)*50)};drawAll()}
  else if(a==='go-buy'){const sh=G.sheet,r=act('BUY_GRAIN',{regionId:sh.from,gold:sh.gold},'곡식을 사들였습니다. '+K.buyWeeks+'주 뒤 군량 '+fmt(sh.gold*K.grainPerGold)+'이 들어옵니다.');if(r.ok){G.sheet=null;drawAll()}}
  else if(a==='stance'){act('SET_STANCE',{armyId:G.sel.id,stance:v},'작전 방침을 '+v+'(으)로 바꿨습니다.')}
  else if(a==='respond'){act('RESPOND',{proposalId:+t.dataset.id,accept:v==='1'},v==='1'?'받아들였습니다.':'물리쳤습니다.')}
});
document.addEventListener('input',e=>{const t=e.target,sh=G.sheet;if(t.id==='ap'){G.autoPause=t.checked;return}if(!sh)return;
  if(sh.type==='march'&&t.dataset.u){const k=t.dataset.u,mx=G.s.regions[sh.from].garrison[k],n=Math.max(0,Math.min(mx,parseInt(t.value,10)||0));sh.units[k]=n;const o=t.type==='range'?$('#u-'+k):$('#r-'+k);if(o)o.value=n;pvMarch()}
  if(sh.type==='buy'&&(t.id==='by-r'||t.id==='by-n')){sh.gold=Math.max(0,Math.floor((parseInt(t.value,10)||0)/50)*50);const o=t.id==='by-r'?$('#by-n'):$('#by-r');if(o)o.value=sh.gold;pvBuy()}
  if(sh.type==='recruit'&&(t.id==='rc-r'||t.id==='rc-n')){sh.count=Math.max(0,Math.floor((parseInt(t.value,10)||0)/100)*100);const o=t.id==='rc-r'?$('#rc-n'):$('#rc-r');if(o)o.value=sh.count;pvRecruit()}
});
document.addEventListener('change',e=>{const t=e.target,sh=G.sheet;if(!sh)return;
  if(t.id==='m-from'){sh.breakTruce=false;sh.from=t.value;const g=G.s.regions[sh.from].garrison;UN.forEach(k=>sh.units[k]=Math.floor(g[k]/2/10)*10);sh.commanderId='';sh.deps=['',''];if(sh.target===sh.from)sh.target='';drawAll()}
  else if(t.id==='m-to'){sh.target=t.value;sh.breakTruce=false;pvMarch()} else if(t.id==='m-cmd'){sh.commanderId=t.value;sh.deps=sh.deps.map(d=>d===t.value||!t.value?'':d);drawRight()} else if(t.id==='m-dep0'||t.id==='m-dep1'){sh.deps[+t.id.slice(-1)]=t.value;drawRight()} else if(t.id==='m-st'){sh.stance=t.value;pvMarch()}
  else if(sh.type==='envoy'&&t.dataset.term){const k=t.dataset.term;let v=t.value;if(k==='gold'||k==='protect'||k==='weeks')v=+v;if(k==='mobilize')v=v==='1';sh.terms[k]=v;const id=t.id;drawRight();const n=document.getElementById(id);if(n)n.focus()}
  else if(t.id==='mv-to'){sh.target=t.value;drawRight()} else if(t.id==='rc-u'){sh.unit=t.value;drawRight()}
  else if(sh.type==='march'&&t.dataset.u)refreshTargets();
});
// 지도: 선택·끌기·확대
let drag=null;
svg.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,vx:G.vb.x,vy:G.vb.y,moved:false}});
window.addEventListener('pointermove',e=>{if(!drag)return;const r=svg.getBoundingClientRect(),dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5){drag.moved=true;svg.classList.add('drag')}if(drag.moved){G.vb.x=drag.vx-dx/r.width*G.vb.w;G.vb.y=drag.vy-dy/r.height*G.vb.h;applyVB()}});
window.addEventListener('pointerup',e=>{const d=drag;drag=null;svg.classList.remove('drag');if(!d||d.moved||!G.s)return;const el=document.elementFromPoint(e.clientX,e.clientY);if(!el||!svg.contains(el))return;pick(el)});
function pick(el){const ar=el.closest('[data-army]'),rg=el.closest('[data-region]'),sh=G.sheet;
  if(rg&&sh&&(sh.type==='march'||sh.type==='move')){const id=rg.dataset.region;if(id!==sh.from){sh.target=id;drawAll()}return}
  if(ar){G.sel={type:'army',id:ar.dataset.army};G.sheet=null;drawAll();return}
  if(rg){G.sel={type:'region',id:rg.dataset.region};if(sh&&sh.type!=='march'&&sh.type!=='move')G.sheet=null;drawAll()}}
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#res .cell[data-act]')){e.preventDefault();e.target.click()}});
svg.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const rg=e.target.closest('[data-region]');if(rg){e.preventDefault();pick(rg)}}});
svg.addEventListener('wheel',e=>{e.preventDefault();const w=toWorld(e.clientX,e.clientY);zoomAt(e.deltaY<0?1.15:1/1.15,w[0],w[1])},{passive:false});
document.addEventListener('keydown',e=>{if(!G.s||G.veil||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(e.code==='Space'&&!e.target.closest('button,[data-region]')){e.preventDefault();if(G.s.over)return;G.paused=!G.paused;drawTop()}
  else if(e.key==='Escape'&&G.sheet){G.sheet=null;drawAll()}});
window.addEventListener('resize',()=>{if(G.vb)fit()});

// ── 부팅 ──
buildMap();drawLegend();fit();
function boot(data){if(data&&data.s&&data.s.v===3){start(data.s)}else{G.s=Sim.newGame('goryeo',929);drawRegions();drawArmies();G.s=null;showStart()}requestAnimationFrame(frame)}
if(window.claude&&window.claude.hot&&window.claude.hot.snapshot)window.claude.hot.snapshot(()=>({s:G.s}));
if(window.claude&&window.claude.hot&&window.claude.hot.ready)window.claude.hot.ready(boot);else boot((window.claude&&window.claude.hot&&window.claude.hot.data)||{});
window.__G=G;
})();
