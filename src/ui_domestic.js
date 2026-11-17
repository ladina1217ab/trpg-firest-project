// ───────────────────────── BUILD-G1 UI: 지도 채색·도시 내정(S02)·국정(S03)·임명 팝업·월간 결산(DN-06) ─────────────────────────
// 이 파일은 빌드 때 ui.js 안(같은 스코프)에 끼워 넣는다. 화면은 엔진 상태를 읽기만 하고, 바꾸는 일은 전부 Sim.dom.command로 한다.
const Dm=Sim.dom,BAL=Dm.BAL;
const REALM={goryeo:'高麗',hubaekje:'後百濟',silla:'新羅'};
const UNV=u=>UN.filter(k=>k!=='adv'||(u&&u.adv>0));
const gate=()=>G.s&&G.s.dom?G.s.dom.gate:null;
const monthlyPaused=()=>{const g=gate();return !!(g&&g.phase==='PAUSED_MONTHLY')};
function gateHold(){if(monthlyPaused()){toast("월간 정비 중입니다. '정비 완료 · 진행 재개'를 눌러야 시간이 흐릅니다.");return true}return false}
const sgn=(v,d)=>(v>=0?'+':'−')+(d?Math.abs(v).toFixed(d):fmt(Math.abs(v)));
const lvPips=(lv,building)=>'<span class="lv" aria-label="Lv'+lv+'">'+[1,2,3].map(i=>`<i class="${i<=lv?'f':building&&i===lv+1?'b':''}"></i>`).join('')+'</span>';
function keep(sel,fn){const a=document.querySelector(sel),y=a?a.scrollTop:0;fn();const b=document.querySelector(sel);if(b)b.scrollTop=y}
function dcmd(type,p,okMsg){const r=Dm.command(G.s,me(),type,p);toast(r.ok?(r.queued?'예약했습니다. 정비를 끝내고 재개하면 다음 주부터 적용됩니다.'+(r.replaced?' (앞선 예약을 바꿨습니다)':''):okMsg):r.reason);drawAll();return r}
const dz=v=>v.ok?'':`aria-disabled="true" data-why="${esc(v.reason)}"`;

// ── 지도: 거점별 영역(보로노이)을 종주 색으로 칠하고, 섬기는 세력은 제 색 빗금을 얹는다 ──
function clipHalf(poly,a,b){const nx=b[0]-a[0],ny=b[1]-a[1],c=(b[0]*b[0]+b[1]*b[1]-a[0]*a[0]-a[1]*a[1])/2,out=[];
  for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=nx*p[0]+ny*p[1]-c,dq=nx*q[0]+ny*q[1]-c;
    if(dp<=0)out.push(p);if((dp<0&&dq>0)||(dp>0&&dq<0)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])}}
  return out}
const CELLS={};(function(){const B=[[-700,-600],[1600,-600],[1600,1600],[-700,1600]];for(const id of D.RIDS){let poly=B;for(const o of D.RIDS)if(o!==id&&poly.length)poly=clipHalf(poly,RP[id],RP[o]);CELLS[id]='M'+poly.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join('L')+'Z'}})();
function buildMap(){
  const land=smooth(COAST.map(p=>P(p[0],p[1])),true);
  const isle=(lat,lon,rx,ry,rot)=>{const p=P(lat,lon);return `<ellipse class="isle" cx="${p[0]}" cy="${p[1]}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${p[0]} ${p[1]})"/>`};
  const geo=(lat,lon,t,sz,rot,cls)=>{const p=P(lat,lon);return `<text class="geo ${cls||''}" x="${p[0]}" y="${p[1]}" font-size="${sz}" text-anchor="middle" transform="rotate(${rot||0} ${p[0]} ${p[1]})">${t}</text>`};
  const pats=D.FIDS.map(f=>`<pattern id="h-${f}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4.5" height="10" fill="${FM[f].color}"/></pattern>`).join('');
  svg.innerHTML=`<defs><pattern id="wv" width="46" height="18" patternUnits="userSpaceOnUse"><path d="M2,9 q5,-5 10,0 t10,0" fill="none" stroke="#a9c1c9" stroke-width="1" opacity=".2"/></pattern>
  <radialGradient id="lg" cx="45%" cy="40%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#3a2a12" stop-opacity=".2"/></radialGradient>
  <clipPath id="landclip"><path d="${land}"/></clipPath>${pats}</defs>
  <rect class="sea" x="-3000" y="-3000" width="7000" height="7000"/><rect x="-3000" y="-3000" width="7000" height="7000" fill="url(#wv)"/>
  <path class="land-sh" d="${land}" transform="translate(6,8)"/><path class="land" d="${land}"/>
  <g clip-path="url(#landclip)"><g id="terr"></g><rect x="-700" y="-600" width="2300" height="2200" fill="url(#lg)" pointer-events="none"/></g>
  ${isle(34.87,128.63,15,9,-30)}${isle(34.45,126.22,12,8,20)}${isle(34.78,127.98,9,7,0)}${isle(37.7,126.33,5,11,10)}${isle(34.35,126.98,8,5,0)}
  <g>${RIVERS.map(r=>`<path class="river" d="${smooth(r.map(p=>P(p[0],p[1])))}"/>`).join('')}</g>
  <g>${RIDGES.map(r=>`<path class="ridge${r[0]?' minor':''}" d="${ridge(r[1],r[0]?5:8,r[0]?9:11)}"/>`).join('')}</g>
  <path class="landline" d="${land}"/>
  ${geo(36.9,125.2,'西海',44)}${geo(37.2,130.05,'東海',44)}${geo(34.42,128.2,'南海',34)}${geo(37.62,128.42,'太白',17,62,'mt')}${geo(36.33,127.74,'小白',17,74,'mt')}
  <g>${D.EDGES.map(e=>`<path class="road${e[2]==='고개'?' pass':e[2]==='해로'?' sea-route':''}" d="${epath(e[0],e[1])}"/>`).join('')}</g>
  <g id="realms"></g><g id="hl"></g><g id="regions"></g><g id="armies"></g>`;
}
const RLAB={goryeo:[37.42,127.2],hubaekje:[35.48,127.45],silla:[35.66,129.02]};
function drawTerr(){
  const s=G.s,sel=G.sel&&G.sel.type==='region'?G.sel.id:null;let h='',r='';
  for(const id of D.RIDS){const c=s.regions[id].controller,hd=Sim.head(s,c);h+=`<path class="cell" d="${CELLS[id]}" fill="${fcol(hd)}"/>`;if(hd!==c)h+=`<path class="cell hatch" d="${CELLS[id]}" fill="url(#h-${c})"/>`}
  if(sel)h+=`<path class="cell sel" d="${CELLS[sel]}"/>`;
  $('#terr').innerHTML=h;
  for(const f in REALM){if(!s.factions[f].alive)continue;const n=D.RIDS.filter(id=>Sim.head(s,s.regions[id].controller)===f).length;if(!n)continue;const p=P(RLAB[f][0],RLAB[f][1]);r+=`<text class="realm" x="${p[0].toFixed(0)}" y="${p[1].toFixed(0)}" font-size="${Math.min(54,24+n*3)}" text-anchor="middle">${REALM[f]}</text>`}
  $('#realms').innerHTML=r;
}
const SHIELD='M-11.5,-12H11.5V2.5C11.5,9.5 5.5,14 0,16C-5.5,14 -11.5,9.5 -11.5,2.5Z';
function drawRegions(){
  const s=G.s;let h='';drawTerr();
  for(const id of D.RIDS){const R=s.regions[id],[x,y]=RP[id],cap=s.factions[R.controller].capitalId===id&&(FM[R.controller].kingdom||FM[R.controller].sovereign),g=garrText(id),L=LABEL[id],sel=G.sel&&G.sel.type==='region'&&G.sel.id===id;
    const tx=L==='r'?19:L==='l'?-19:0,ty=L==='t'?-(cap?46:40):L==='b'?35:-2,an=L==='r'?'start':L==='l'?'end':'middle',cd=s.dom&&s.dom.cityDomesticByRegion[id],work=cd&&cd.facilityConstruction&&share(me(),R.controller);
    let pp='';for(let i=0;i<5;i++)pp+=`<rect class="pip${i<R.fort?'':' off'}" x="${-12+i*5}" y="19" width="3.6" height="3.6"/>`;
    h+=`<g class="rg" data-region="${id}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(R.name)}"><circle class="hit" r="27"/>
    ${sel?'<circle class="selr" r="23"/>':''}${R.siege?'<circle class="siege" r="21"/>':''}
    <path class="shield" d="${SHIELD}" fill="${fcol(R.controller)}"/>${R.overlord!==R.controller?`<path class="chief" d="M-10.6,-11.1H10.6V-6H-10.6Z" fill="${fcol(R.overlord)}"/>`:''}
    ${cap?'<path class="crown" d="M-7.5,-13L-7.5,-19.5L-3.6,-16L0,-21L3.6,-16L7.5,-19.5L7.5,-13Z"/>':''}
    <text class="hj" y="2">${FM[R.controller].hanja}</text>${pp}${mobOf(R.controller)?'<text class="mob" x="12" y="-11">動</text>':''}${work?'<path class="wk" d="M-15,-14l4,4l-4,4l-4,-4z"><title>공사 중</title></path>':''}
    <text class="nm" x="${tx}" y="${ty}" text-anchor="${an}" dominant-baseline="${L==='t'?'auto':L==='b'?'hanging':'central'}">${esc(R.name)}</text>
    <text class="gr ${g.c}" x="${tx}" y="${ty+(L==='t'?11:L==='b'?19:16)}" text-anchor="${an}" dominant-baseline="${L==='b'?'hanging':'central'}">${g.t}</text></g>`}
  $('#regions').innerHTML=h;
}
function drawArmies(){
  const s=G.s,vis=Sim.visibleArmies(s,me()),stack={};let h='';
  for(const v of vis){const a=v.army,f=a?a.factionId:v.factionId,pos=a?armyPos(a):RP[v.loc],key=Math.round(pos[0]/6)+','+Math.round(pos[1]/6),k=stack[key]=(stack[key]||0)+1;
    const x=pos[0]+14,y=pos[1]-8-(k-1)*19,sel=a&&G.sel&&G.sel.type==='army'&&G.sel.id===a.id,txt=(v.ghost?'? ':'')+armyTxt(v),w=12+txt.length*6.4;
    h+=`<g class="army${v.conf==='estimated'?' est':''}${v.ghost?' ghost':''}${sel?' sel':''}" ${a?`data-army="${a.id}"`:''} transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><line class="pole" x1="0" y1="4" x2="0" y2="-28"/><path class="flag" d="M0,-28L19,-23.5L0,-18Z" fill="${fcol(f)}"/><rect class="plate" x="2" y="-14" width="${w.toFixed(0)}" height="16" rx="2"/><text class="an" x="${(2+w/2).toFixed(1)}" y="-2" text-anchor="middle">${txt}</text></g>`}
  $('#armies').innerHTML=h;
}

// ── 위·아래 띠 ──
function drawTop(){
  const s=G.s,m=me(),F=s.factions[m],ru=s.characters[F.rulerId],sm=Sim.factionSummary(s,m),gw=sm.use>0?sm.grain/sm.use:99,obl=Sim.obligations(s,m),dueSoon=obl.mine.some(e=>e.ob.due!==null&&e.ob.due-s.week<=3),ad=Dm.adminOf(s,m),rsv=Dm.reservedOf(s,m),mp=monthlyPaused();
  $('#plaque').innerHTML=`<span class="port" style="background:${fcol(m)}">${FM[m].hanja}</span><div style="min-width:0"><div class="who">${esc(ru.name)}</div><div class="ttl">${FM[m].title}${F.overlord?' · 종주 '+esc(fnm(F.overlord)):''}${sm.vassals.length?'<br>섬기는 세력 '+sm.vassals.map(fnm).join('·'):''}</div></div>`;
  $('#clock').innerHTML=`<div class="row"><div><span class="date">${Sim.dateStr(s.week)}</span> <span class="wk">${Math.min(s.week+1,K.weeks)}/${K.weeks}주차</span></div><span class="phase">${mp?'월간 정비 중':G.paused?'멈춤':''}</span></div>
   <div class="row"><div class="bar" aria-hidden="true"><i id="wkbar"></i></div></div>
   <div class="row"><div class="seg" role="group" aria-label="시간 조절" style="flex:1"><button data-act="pause" class="${G.paused?'on':''}" aria-label="일시정지" style="flex:1">Ⅱ</button>${[1,2,4].map(v=>`<button data-act="speed" data-v="${v}" class="${!G.paused&&G.speed===v?'on':''}" style="flex:1">${v}×</button>`).join('')}<button data-act="step" title="한 주만 넘기기" style="flex:1.4">+1주</button></div></div>`;
  $('#res').innerHTML=`<div class="cell"><span class="ic">金</span><div class="v">${fmt(F.treasury)}${rsv?`<small>예약 ${fmt(rsv)}</small>`:''}</div><div class="d ${sm.income-sm.gold<0?'bad':''}">국고 · 주 ${sgn(sm.income-sm.gold)} (수입 ${fmt(sm.income)})</div></div>
   <div class="cell"><span class="ic">粮</span><div class="v">${fmt(sm.grain)}</div><div class="d ${gw<8?'bad':''}">군량 · 주 −${fmt(sm.use)} · ${gw>=99?'충분':Math.floor(gw)+'주치'}</div></div>
   <div class="cell"><span class="ic">兵</span><div class="v">${fmt(sm.troops+sm.field)}</div><div class="d">병력 · 출정 ${fmt(sm.field)}</div></div>
   <div class="cell" data-act="tab" data-v="nation" role="button" tabindex="0"><span class="ic">政</span><div class="v ${ad.ratio>1?'bad':''}">${ad.burden.toFixed(1)}<small>/ ${ad.capacity.toFixed(1)}</small></div><div class="d ${ad.ratio>1?'bad':''}">행정 부담 · 징수 ${Math.round(ad.eff*100)}%</div></div>
   <div class="cell" data-act="tab" data-v="court" role="button" tabindex="0"><span class="ic">約</span><div class="v ${dueSoon?'bad':''}">${obl.mine.length}건</div><div class="d ${dueSoon?'bad':''}">${obl.mine.length?(obl.mine[0].ob.due===null?'약속 · 기한 없음':'약속 · 급한 것 '+Math.max(0,obl.mine[0].ob.due-s.week)+'주'):'지킬 약속 없음'}</div></div>`;
}
function unitTable(u){const ks=UNV(u);return `<table class="u"><tr><th>병종</th>${ks.map(k=>`<th>${U[k].name}</th>`).join('')}<th>합계</th></tr><tr><td>병력</td>${ks.map(k=>`<td>${fmt(u[k])}</td>`).join('')}<td><b>${fmt(Sim.total(u))}</b></td></tr></table>`}

// ── 왼쪽 창: 거점(개요·내정)·부대 ──
function meter(lbl,v,cls,txt){return `<div class="meter"><span class="lbl">${lbl}</span><span class="track ${cls||''}"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></span><span class="val">${txt===undefined?Math.round(v):txt}</span></div>`}
function slotRow(slotId,role,can,why){
  const s=G.s,m=me(),cid=Dm.holderOf(s,slotId),c=cid&&s.characters[cid],as=cid&&s.dom.assignments[cid],sl=Dm.parseSlot(slotId),q=Dm.pendingOf(s,m).find(x=>x.keys.indexOf('slot:'+slotId)>=0),d=can?'':`aria-disabled="true" data-why="${esc(why)}"`;
  let info='';if(c){const dm=sl.kind==='city'&&sl.role==='deputy'?s.dom.cityDomesticByRegion[sl.regionId].deputyDomains[sl.idx]:null,rl=sl.kind==='city'?(sl.role==='governor'?'governor':dm):sl.kind==='national'?sl.cat:sl.role==='commander'?'commander':'armyDeputy';
    info=`<b>${esc(c.name)}</b>${dm?` <span class="tag gold">${Dm.DOMAIN[dm].name}</span>`:''}<span class="sub">${sl.kind==='army'?'통솔 '+c.ld+' · 무력 '+c.ma+' · 지략 '+c.st:'정치 '+c.po+' · 적성 '+Dm.fit(c,rl)}${as&&as.status==='TRANSIT'?' · <span class="mid">부임 중, '+Math.max(1,as.effectiveWeek-s.week)+'주 뒤 도착</span>':''}</span>`}
  else info='공석 <span class="sub">'+(sl.kind==='city'?'일반 관료가 기본 행정을 맡습니다':sl.kind==='national'?'담당관이 있어야 과제가 진행됩니다':'통솔 50 취급')+'</span>';
  return `<div class="slot${c?'':' empty'}"><span class="role">${role}</span><span class="who">${info}${q?`<span class="queued">예약: ${esc(q.text)}</span>`:''}</span><span class="acts"><button class="btn sm" data-act="opk" data-slot="${slotId}" ${d}>${c?'교체':'임명'}</button>${c?`<button class="btn sm" data-act="dismiss" data-slot="${slotId}" ${d}>해임</button>`:''}</span></div>`}
function cityTab(R){
  const s=G.s,m=me(),v=Dm.cityView(s,m,R.id),rt=v.rights,cd=v.cd,g=v.gov,c=R.controller,sh=share(m,c),lord=R.lord&&s.characters[R.lord],why=rt.reason,dis1=rt.can?'':`aria-disabled="true" data-why="${esc(why)}"`;
  const own=c===m,ovl=s.factions[c].overlord===m&&Sim.vassalAg(s,m,c),pend=Dm.pendingOf(s,m).filter(q=>q.payload.regionId===R.id&&q.type!=='ASSIGN_CITY_OFFICER');
  let h=`<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center"><span class="tag gold">${rt.label}</span><span class="tag ${rt.can?'g':'u'}">임명·건설권 ${rt.can?'있음':'없음'}</span><span class="tag">군권 ${esc(fnm(c))}</span>${lord?`<span class="tag">지역 성주 ${esc(lord.name)}</span>`:''}</div>`;
  if(!rt.can)h+=`<div class="warn">${esc(why)}</div>`;
  if(g.transition)h+=`<div class="govbox"><b class="mid">통치 방식 전환 중</b> <span class="sub">${g.transition.to==='DIRECT'?'직할':'자치'}(으)로 · ${Math.max(1,g.transition.doneWeek-s.week)}주 남음</span></div>`;
  if(sh){h+=`<h3>도시 상태</h3>${meter('안정도',g.stability,g.stability<40?'bad':'ok')}${meter('민심',R.morale,R.morale<40?'bad':'ok')}${meter('훈련도',cd.training,'')}${own&&!(FM[m].kingdom||FM[m].sovereign)&&!s.factions[m].overlord?'':meter('불만',g.grievance,'bad',Math.round(g.grievance)+' '+v.bandName)}
    <dl class="kv" style="margin-top:6px"><dt>세수(주)</dt><dd>기초 ${v.income.base.toFixed(1)} → 실제 <b>${v.income.actual.toFixed(1)}</b> <span class="sub">×${v.income.mult.toFixed(3)}</span></dd><dt>수확 배율</dt><dd>×${v.harvestMult.toFixed(3)}${cd.granary?' <span class="tag g">곡창 정비</span>':''}</dd><dt>시설 유지비(주)</dt><dd>${v.upkeep}</dd></dl>`}
  else h+=`<div class="sub" style="margin-top:8px">남의 거점의 안정도·시설은 알 수 없습니다. 통치 방식과 권한만 표시합니다.</div>`;
  // 통치 방식
  const gb=(label,to,force,cls)=>{const pv=Sim.validate(s,m,'REQUEST_GOVERNANCE_CHANGE',{regionId:R.id,to,force:!!force});return `<button class="btn sm ${cls||''}" data-act="gov" data-to="${to}" data-force="${force?1:0}" ${dz(pv)}>${label}</button>`};
  h+=`<h3>통치 방식</h3><div class="govbox"><div class="sub">${rt.mode==='DIRECT'?'직할: 담당관·시설·조세를 직접 다룹니다. 행정 부담 '+BAL.administration.burdenDirect+', 유지비 주 '+BAL.administration.weeklyGoldCostDirect+'.':rt.mode==='AUTONOMOUS'?'자치: 지역 세력이 도시를 운영합니다. 행정 부담 '+BAL.administration.burdenAutonomous+', 유지비 주 '+BAL.administration.weeklyGoldCostAutonomous+'.':'독립: 우리 권한이 미치지 않습니다.'}</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${own?(g.admin===m?gb('지방 자치에 맡기기','AUTONOMOUS'):g.admin===null?gb('직할로 돌리기','DIRECT'):gb('직할로 돌리기','DIRECT')):ovl?(g.admin===m?gb('자치 재보장','AUTONOMOUS'):gb('직할 협상','DIRECT')+gb('강제 직할','DIRECT',1,'pri')):gb('직할 요구','DIRECT',1)}</div></div>`;
  // 담당관
  h+=`<h3>담당관</h3>${slotRow('city:'+R.id+':governor','성주',rt.can,why)}${slotRow('city:'+R.id+':deputy:0','부관 1',rt.can,why)}${slotRow('city:'+R.id+':deputy:1','부관 2',rt.can,why)}<div class="sub">성주 정치 50이 기준(±10%). 부관은 맡은 분야 +8%(적성에 따라 가감), 같은 분야 둘째는 절반.</div>`;
  // 중점·5분야
  h+=`<h3>중점 분야 · 시설</h3><div class="seg wrap" role="group" aria-label="도시 중점 분야">${Dm.DOMAINS.map(d=>`<button data-act="focus" data-v="${d}" class="${cd.focusDomain===d?'on':''}" ${dis1}>${Dm.DOMAIN[d].name}</button>`).join('')}</div><div class="sub" style="margin:3px 0 6px">중점 분야는 효율 +10%. 한 거점에 하나만 둡니다. 다시 누르면 풉니다.</div>`;
  for(const d of v.domains){const bv=Sim.validate(s,m,'START_FACILITY_BUILD',{regionId:R.id,facility:d.facilityId}),q=Dm.pendingOf(s,m).find(x=>x.type==='START_FACILITY_BUILD'&&x.payload.regionId===R.id&&x.payload.facility===d.facilityId);
    h+=`<div class="dom${d.focus?' focus':''}"><span class="dn">${d.name}<small>${d.measure}</small></span><span class="mid2"><b>${d.facility}</b>${sh?lvPips(d.level,!!d.building):''} <span class="sub">${d.effect}${sh?' · 담당 효율 ×'+d.eff.toFixed(2):''}</span>${d.building?`<span class="sub mid">공사 중 · ${Math.max(1,d.building.doneWeek-s.week)}주 남음 (완공 뒤부터 효과·유지비)</span>`:''}${q?'<span class="queued">착공 예약됨</span>':''}</span>
      <span>${d.building?'':d.nextCost===null&&sh?'<span class="tag gold">최고</span>':`<button class="btn sm" data-act="build" data-v="${d.facilityId}" ${dz(bv)}>증축 ${d.nextCost===null?'':d.nextCost}</button>`}</span></div>`}
  if(pend.length)h+=`<h3>예약한 명령</h3>`+pend.map(q=>`<div class="queued">${esc(q.text)}${q.reservedGold?' · 국고 '+q.reservedGold+' 예약':''} <button class="btn sm" data-act="unqueue" data-id="${q.id}">취소</button></div>`).join('');
  h+=`<div class="note">내정 수치는 모두 플레이테스트 전 가안(DRAFT_BALANCE)입니다. 세수와 수확은 기존 주간 수입·수확 때만 이 배율로 들어오고, 월말에 따로 지급되지 않습니다.</div>`;
  return h}
function regionInfo(R){
  const s=G.s,c=R.controller,mine=c===me(),sh=share(me(),c),g=garrText(R.id),rt=Dm.rights(s,me(),R.id);let h='';
  const chars=Object.values(s.characters).filter(x=>x.loc===R.id&&x.status==='active'&&(sh||x.id===R.lord));
  h+=`<dl class="kv"><dt>실제 지배</dt><dd>${esc(fnm(c))}</dd><dt>명목 종주</dt><dd>${esc(fnm(R.overlord))}${R.overlord!==c?' (자치 '+R.autonomy+')':''}</dd><dt>통치 방식</dt><dd><a href="#" data-act="ltab" data-v="city">${rt.label}</a></dd>
    <dt>지형 · 성 방어</dt><dd>${R.terrain} · ${pips(R.fort)}</dd><dt>주둔 병력 ${g.tag}</dt><dd>${g.long}</dd>
    ${!mine&&c!==me()?`<dt>우리와의 신뢰</dt><dd>${Sim.trust(s,me(),c)}</dd>`:''}</dl>`;
  if(R.siege)h+=`<div class="warn">포위 ${s.week-R.siege.start+1}주째 · ${esc(fnm(R.siege.by))}군</div>`;
  h+=relBlock(c);
  if(Sim.sameBloc(s,me(),c)||Object.values(s.armies).some(a=>a.factionId===me()&&!a.leg&&a.loc===R.id&&Sim.atWar(s,me(),c)))h+=callBlock(R.id);
  if(sh){const L=Sim.lordOf(s,R);h+=`<dl class="kv" style="margin-top:8px"><dt>지역 성주</dt><dd>${L?esc(L.name)+' · 정치 '+L.po:'<span class="badc">비어 있음</span>'}</dd><dt>민심이 머무는 자리</dt><dd>${(L?50+Math.round(L.po/4):45)+Sim.EXT.moraleGoalAdj(s,R)}</dd></dl>${Sim.defiant(s,R)?`<div class="warn">성주 ${esc(L.name)}의 충성이 ${L.loyalty}입니다. 군령을 따르지 않아 이곳에서는 출정도 모병도 할 수 없고, 세수도 절반만 들어옵니다.</div>`:''}`}
  if(sh){h+=`<h3>주둔군</h3>${unitTable(R.garrison)}<dl class="kv" style="margin-top:8px"><dt>곳간 군량</dt><dd>${fmt(R.grain)}</dd><dt>민심</dt><dd>${R.morale}</dd><dt>주둔군 사기 · 훈련도</dt><dd>${R.gMorale} · ${Math.round(s.dom.cityDomesticByRegion[R.id].training)}</dd><dt>징병 가능</dt><dd>${fmt(R.manpower)}명</dd><dt>세수</dt><dd>주당 ${Sim.regionIncome(s,R).toFixed(1)}</dd></dl>`;
    const ords=s.orders.filter(o=>o.status==='active'&&o.actorId===me()&&o.params.regionId===R.id);
    if(ords.length)h+=`<h3>진행 중</h3>`+ords.map(o=>`<div class="sub">${o.type==='RECRUIT'?U[o.params.unit].name+' '+o.params.count+'명 모병':o.type==='FORTIFY'?'성 보강':o.type==='REQUISITION'?'군량 징발':o.type==='BUY_GRAIN'?'곡식 매입 '+o.params.grain:o.type==='FACILITY_BUILD'?Dm.FACILITY[o.params.facility].name+' Lv'+o.params.toLevel+' 공사':o.type==='PACIFY'?'민심 수습':o.type} · ${Math.max(1,o.duration-(s.week-o.startedAt))}주 남음</div>`).join('')}
  if(chars.length)h+=`<h3>인물</h3>`+chars.map(x=>{const pr=sh?Dm.primaryOf(s,x.id):null;return `<div style="margin-bottom:4px"><b>${esc(x.name)}</b> <span class="sub">${esc(x.role)}${pr&&pr.type!=='RULER'?' · '+esc(pr.label):''}${x.armyId==='appoint'?' · 부임 가는 중':''}${x.office?' · '+Sim.officeName(x.officeBy,x.office):''}</span><div class="sub">통솔 ${x.ld} · 무력 ${x.ma} · 지략 ${x.st} · 정치 ${x.po} · 신망 ${x.pr}${x.merit?' · 공적 '+x.merit:''}</div></div>`}).join('');
  const caps=sh?Object.values(s.characters).filter(x=>x.status==='captive'&&x.loc===R.id):[];
  if(caps.length)h+=`<h3>갇힌 포로</h3>`+caps.map(x=>`<div class="sub"><b style="color:var(--text)">${esc(x.name)}</b> · ${esc(fnm(x.faction))} ${esc(x.role)} · 통솔 ${x.ld} 무력 ${x.ma} 지략 ${x.st}</div>`).join('')+`<div class="sub">포로의 처우(석방·회유·교환)는 아직 없습니다.</div>`;
  h+=`<h3>길</h3>`+D.ADJ[R.id].map(n=>{const N=s.regions[n.to];return `<div class="sub" style="display:flex;justify-content:space-between"><span><a href="#" data-act="sel" data-id="${n.to}" style="color:var(--text)">${esc(N.name)}</a> ${esc(fnm(N.controller))}</span><span>${n.e.type}${n.e.note?' · '+esc(n.e.note):''} · ${Sim.edgeWeeks(n.e,{light:1,heavy:0,archer:0,cav:0,adv:0},s.week)}주</span></div>`}).join('');
  const eg=s.engagements.filter(e=>e.regionId===R.id&&engSeen(e)).slice(-1)[0];
  if(eg)h+=`<h3>최근 공방전</h3><div class="sub">${Sim.dateStr(eg.start)}${eg.end!==null?' ~ '+Sim.dateStr(eg.end):' · 진행 중'} · ${resultFor(eg).label}</div><button class="btn sm" style="margin-top:6px" data-act="result" data-id="${eg.id}">전투 결과 보기</button>`;
  h+=`<div class="note">사료 근거: ${esc(R.note)} <span class="tag">${{confirmed:'기록 있음',disputed:'해석 필요',designed:'게임용 재구성',traditional:'전승'}[R.conf]}</span></div>`;
  return h}
function drawLeft(){
  const s=G.s,el=$('#left');if(!G.sel){el.innerHTML='';return}
  let h='';
  if(G.sel.type==='region'){const R=s.regions[G.sel.id],c=R.controller;
    h=`<div class="win-h">${seal(c,1)}<div style="flex:1;min-width:0"><h2>${esc(R.name)}</h2><div class="sub">지금의 ${esc(R.modern)} · ${chip(c)} ${rel(c)}</div></div><button class="x" data-act="desel" aria-label="창 닫기">×</button></div>
     <div class="tabs" role="tablist"><button role="tab" data-act="ltab" data-v="info" class="${G.ltab==='info'?'on':''}">개요</button><button role="tab" data-act="ltab" data-v="city" class="${G.ltab==='city'?'on':''}">내정</button></div><div class="body">${G.ltab==='city'?cityTab(R):regionInfo(R)}</div>`;
  }else{const a=s.armies[G.sel.id];if(!a){G.sel=null;el.innerHTML='';return}
    const own=a.factionId===me(),sh=share(me(),a.factionId),cm=a.commanderId&&s.characters[a.commanderId],v=Sim.visibleArmies(s,me()).find(x=>x.army===a);
    h=`<div class="win-h">${seal(a.factionId,1)}<div style="flex:1;min-width:0"><h2>${esc(fnm(a.factionId))} 부대</h2><div class="sub">${esc(s.regions[a.loc].name)}${a.leg?' → '+esc(s.regions[a.leg.to].name)+' 행군 중':' 주둔'}</div></div><button class="x" data-act="desel" aria-label="창 닫기">×</button></div><div class="body">`;
    if(sh){const up=Sim.upkeep(a.units),deps=(a.deputyIds||[]).map(id=>s.characters[id]).filter(Boolean),st=Sim.staff(cm||null,deps),lk=Sim.supplyLink(s,a),lock=Sim.validate(s,me(),'ASSIGN_ARMY_OFFICER',{armyId:a.id,slot:'commander',charId:null}),can=own&&!/행군·교전/.test(lock.reason||''),why=own?'행군·교전 중인 부대의 지휘부는 바꿀 수 없습니다.':'우리 부대가 아닙니다.';
      h+=`<h3>편성</h3>${unitTable(a.units)}<h3>지휘부</h3>${slotRow('army:'+a.id+':commander','주장',can,why)}${slotRow('army:'+a.id+':deputy:0','부장 1',can&&!!a.commanderId,a.commanderId?why:'부장을 두려면 주장을 먼저 정하세요.')}${deps.length?slotRow('army:'+a.id+':deputy:1','부장 2',can,why):''}
      <dl class="kv" style="margin-top:6px"><dt>전투 보정</dt><dd>지휘 ${pctS(cmdOf(st))} · 다병종 −${Math.round(Sim.mixPenalty(a.units,st.ld,deps.length)*100)}%${a.training!==undefined&&Math.round(a.training)!==50?' · 훈련 '+pctS(1+(a.training-50)*0.002):''}</dd><dt>사기</dt><dd>${Math.round(a.morale)}</dd><dt>휴대 군량</dt><dd class="${a.supply<up*2?'badc':''}">${fmt(a.supply)} · ${up?Math.floor(a.supply/up):0}주치</dd>
        <dt>보급선</dt><dd class="${lk.linked?'':'badc'}">${lk.linked?'이어짐 ('+esc(s.regions[lk.via].name)+')':'끊김 '+(a.cut||0)+'주째'}</dd>
        <dt>임무</dt><dd>${{attack:'공격',guard:'우군 지원',station:'주둔 이동',return:'회군'}[a.mission]}</dd>
      ${a.leg||a.path.length?`<dt>목적지</dt><dd>${esc(s.regions[a.target].name)} · ${etaOf(a)}주 뒤</dd>`:''}</dl>
      <h3>작전 방침</h3><div class="seg stance" role="group" aria-label="작전 방침">${Object.keys(Sim.STANCE).map(k=>`<button data-act="stance" data-v="${k}" class="${a.stance===k?'on':''}" ${own?'':'disabled'}>${k}</button>`).join('')}</div><div class="sub" style="margin-top:4px">${STDESC[a.stance]}</div>`}
    else h+=`<dl class="kv"><dt>병력 <span class="tag ${v&&v.conf==='confirmed'?'c':'e'}">${v&&v.conf==='confirmed'?'확인':'추정'}</span></dt><dd>${v?(v.conf==='confirmed'?fmt(v.est)+'명':'약 '+fmt(v.est*.75)+'~'+fmt(v.est*1.25)+'명'):'알 수 없음'}</dd><dt>움직임</dt><dd>${a.leg?esc(s.regions[a.leg.to].name)+' 방면':'머무는 중'}</dd></dl><div class="note">적 부대의 편성과 지휘관은 알 수 없습니다. 병력은 관측한 범위에서만 표시됩니다.</div>`;
    h+='</div>'}
  keep('#left .body',()=>{el.innerHTML=Sim.jo(`<div class="slab orn">${h}</div>`)});
}

// ── 아래 명령대 ──
function drawBar(){
  const s=G.s,m=me();let h='';const b=(label,act,v,extra)=>`<button class="btn" data-act="${act}" ${extra||''} ${v&&!v.ok?`aria-disabled="true" data-why="${esc(v.reason)}"`:''}>${label}</button>`;
  if(!G.sel)h+=`<div class="grp ctx"><b>거점이나 깃발을 고르세요</b><span class="sub">끌어서 옮기고 휠로 확대 · 스페이스바로 멈춤</span></div>`;
  else if(G.sel.type==='region'){const R=s.regions[G.sel.id],c=R.controller,mine=c===m,rt=Dm.rights(s,m,R.id);
    h+=`<div class="grp ctx"><b>${esc(R.name)}</b><span class="sub">${esc(fnm(c))} · ${rt.label}</span></div>`;
    if(mine){h+=`<div class="grp"><span class="gl">군사</span><div class="btns">${b('출정','open-march',R.siege?{ok:false,reason:'포위된 거점에서는 출정할 수 없습니다.'}:null)}${b('모병','open-recruit',R.siege?{ok:false,reason:'포위된 거점에서는 모병할 수 없습니다.'}:null)}</div></div>
      <div class="grp"><span class="gl">내정</span><div class="btns">${b('도시 내정','ltab',null,'data-v="city"')}${b('징발 +'+K.reqGrain,'cmd',Sim.validate(s,m,'REQUISITION',{regionId:R.id}),'data-type="REQUISITION"')}${b('성 보강 '+K.repairCost,'cmd',Sim.validate(s,m,'FORTIFY',{regionId:R.id}),'data-type="FORTIFY"')}${b('곡식 매입','open-buy',Sim.validate(s,m,'BUY_GRAIN',{regionId:R.id,gold:50}))}${b('민심 수습 '+K.pacifyCost,'cmd',Sim.validate(s,m,'PACIFY',{regionId:R.id}),'data-type="PACIFY"')}</div></div>
      <div class="grp"><span class="gl">인사</span><div class="btns">${b('성주 임명','opk',rt.can?null:{ok:false,reason:rt.reason},'data-slot="city:'+R.id+':governor"')}</div></div>`}
    else{const hasSrc=D.RIDS.some(r=>s.regions[r].controller===m&&!s.regions[r].siege);
      h+=`<div class="grp"><span class="gl">군사</span><div class="btns">${b(Sim.sameBloc(s,m,c)?'지원군':'공격','open-march',hasSrc?null:{ok:false,reason:'출정할 수 있는 우리 거점이 없습니다.'})}</div></div>
      <div class="grp"><span class="gl">첩보</span><div class="btns">${b('정찰 '+K.scoutCost,'cmd',Sim.validate(s,m,'SCOUT',{regionId:R.id}),'data-type="SCOUT"')}${b('동향 파악 '+K.probeCost,'probe',Sim.validate(s,m,'PROBE',{targetFactionId:c}))}</div></div>
      <div class="grp"><span class="gl">외교·통치</span><div class="btns">${b('협상','open-envoy')}${b('통치 방식','ltab',null,'data-v="city"')}${b('성주 임명','opk',rt.can?null:{ok:false,reason:rt.reason},'data-slot="city:'+R.id+':governor"')}</div></div>`}
  }else{const a=s.armies[G.sel.id];if(a&&a.factionId===m){h+=`<div class="grp ctx"><b>우리 부대 ${fmt(Sim.total(a.units))}명</b><span class="sub">${esc(s.regions[a.loc].name)}${a.leg?' → '+esc(s.regions[a.leg.to].name):''}</span></div>
      <div class="grp"><span class="gl">군사</span><div class="btns">${b('이동·공격','open-move',a.leg?{ok:false,reason:'행군 중인 부대에는 새 이동 명령을 내릴 수 없습니다. 회군만 가능합니다.'}:null)}${b('주둔군에 편입','acmd',Sim.validate(s,m,'GARRISON',{armyId:a.id}),'data-type="GARRISON"')}${b('회군','acmd',Sim.validate(s,m,'RETREAT',{armyId:a.id}),'data-type="RETREAT"')}</div></div>`}
    else h+=`<div class="grp ctx"><b>${a?esc(fnm(a.factionId))+' 부대':'부대'}</b><span class="sub">남의 부대에는 명령할 수 없습니다.</span></div>`}
  const keys=Dm.settlementKeys(s,m);
  h+=`<div class="grp sys"><span class="gl">조정</span><div class="btns"><button class="btn" data-act="open-reward">논공행상</button>${b('지난 결산','review',keys.length?null:{ok:false,reason:'아직 끝난 달이 없습니다. 달이 바뀌면 결산이 나옵니다.'},'data-v="'+(keys[keys.length-1]||'')+'"')}</div></div><div class="grp"><span class="gl">기록</span><div class="btns"><button class="btn" data-act="save">저장</button><button class="btn" data-act="load">불러오기</button><button class="btn" data-act="new">처음으로</button><button class="btn fold" data-act="fold" data-v="left">정보</button></div></div>`;
  $('#bar').innerHTML=h;
}

// ── 오른쪽: 세로 메뉴 + 장부 ──
const AITYPE={MARCH:'출정',RECRUIT:'모병',FORTIFY:'성 보강',SCOUT:'정찰',REQUISITION:'징발',RETREAT:'회군',BUY_GRAIN:'곡식 매입',CALL_ARMS:'동원령',REWARD:'포상',APPOINT:'성주 임명',PACIFY:'민심 수습',COUNTER:'역제안 수락',SET_CITY_FOCUS:'도시 중점',ASSIGN_CITY_OFFICER:'도시 인사',ASSIGN_NATIONAL_OFFICER:'국정 인사',ASSIGN_ARMY_OFFICER:'군 인사',START_FACILITY_BUILD:'시설 착공',REQUEST_GOVERNANCE_CHANGE:'통치 전환',START_NATIONAL_PROJECT:'국정 과제',CHANGE_NATIONAL_BUDGET:'국정 예산',ENACT_POLICY:'제도 시행'};
function nationalTab(){
  const s=G.s,m=me(),ad=Dm.adminOf(s,m),nv=Dm.nationalView(s,m),keys=Dm.settlementKeys(s,m);let h='';
  h+=`<div class="sec">행정</div><div class="ob">${meter('부담',Math.min(100,ad.ratio*100/1.5),ad.ratio>1?'bad':'ok',ad.burden.toFixed(1)+'/'+ad.capacity.toFixed(1))}<span class="w">징수 효율 ${Math.round(ad.eff*100)}% · 행정 유지비 주당 ${ad.expense} · 직할 ${ad.direct.length}곳 · 자치 ${ad.auto.length}곳</span><span class="w">역량 = ${Object.keys(ad.parts).map(k=>k+' '+ad.parts[k].toFixed(1)).join(' + ')}</span>${ad.ratio>1?'<div class="warn">과부하입니다. 넘친 만큼 세수가 새고 지방의 불만이 쌓입니다. 거점을 자치에 맡기거나 제도를 정비하세요.</div>':''}</div>`;
  if(s.dom.fixture)h+=`<div class="ob"><span class="fx">QA fixture · ${esc(s.dom.fixture)}</span> <span class="sub">연구 사전 진척을 넣은 검증용 판입니다.</span></div>`;
  for(const n of nv){const sl=n.slot,slotId='national:'+m+':'+n.cat,active=!!sl.projectId,def=active?Dm.PROJECTS[sl.projectId]:null,offOk=n.officer&&n.officerStatus==='ACTIVE';
    h+=`<div class="nat"><div class="nat-h"><b>${n.name}</b><div class="seg" role="group" aria-label="${n.name} 월 예산">${Object.keys(BAL.national.budgetTiers).map(t=>`<button data-act="budget" data-cat="${n.cat}" data-v="${t}" class="${sl.budgetTier===t?'on':''}" title="월 ${BAL.national.budgetTiers[t].goldMonthly} · 속도 ×${BAL.national.budgetTiers[t].speedMultiplier}">${Dm.TIERNAME[t]} ${BAL.national.budgetTiers[t].goldMonthly}</button>`).join('')}</div></div><div class="nat-b">${slotRow(slotId,'담당관',true,'')}`;
    if(active){h+=`<div style="margin-top:6px"><b>${esc(def.name)}</b>${sl.targetRegionId?' <span class="tag">'+esc(s.regions[sl.targetRegionId].name)+'</span>':''}<div class="prog"><i style="width:${sl.progress.toFixed(1)}%"></i><span>${sl.progress.toFixed(1)}%</span></div>
      <div class="sub">${offOk?'달마다 +'+n.perMonth.toFixed(1)+'%p (담당관 ×'+n.officerFactor.toFixed(2)+' · 예산 ×'+BAL.national.budgetTiers[sl.budgetTier].speedMultiplier+') · 약 '+n.etaMonths+'달 뒤 완료':'<span class="badc">담당관이 자리에 없어 멈춰 있습니다. 예산도 나가지 않습니다.</span>'}</div>
      <div class="sub">이번 달 지급 ${sl.paidInMonth.toFixed(0)} / ${n.monthly} · 주마다 ${n.weeklyDue.toFixed(1)}${sl.unpaidWeeks?' · <span class="badc">국고 부족 '+sl.unpaidWeeks+'주</span>':''}</div><div class="sub">${esc(def.effect)}</div></div>`}
    else for(const p of n.list){const id=p.id,d=p.def;let st='',btn='';
      if(d.target){const opts=D.RIDS.filter(r=>s.regions[r].controller===m&&Dm.rights(s,m,r).can&&!s.dom.cityDomesticByRegion[r].granary);if(G.prjT&&opts.indexOf(G.prjT)<0)G.prjT='';const tr=G.prjT||opts[0]||'',pv=Sim.validate(s,m,'START_NATIONAL_PROJECT',{category:n.cat,projectId:id,targetRegionId:tr});
        st=p.granaries.length?'<span class="tag g">완료: '+p.granaries.map(r=>esc(s.regions[r].name)).join('·')+'</span>':'';
        btn=`<div style="display:flex;gap:6px;margin-top:4px"><select id="prj-target" aria-label="사업 대상 거점">${opts.map(r=>`<option value="${r}" ${r===tr?'selected':''}>${esc(s.regions[r].name)} · 세수 ${s.regions[r].tax}</option>`).join('')||'<option value="">직할 거점 없음</option>'}</select><button class="btn sm" data-act="proj" data-cat="${n.cat}" data-v="${id}" ${dz(pv)}>착수</button></div>`}
      else if(p.done){st=d.policy?(p.enacted?'<span class="tag g">시행 중</span>':'<span class="tag m">시행 대기</span>'):'<span class="tag g">완료</span>';if(d.policy&&!p.enacted)btn=`<button class="btn sm gold" style="margin-top:4px" data-act="enact" data-v="${id}">시행한다</button>`}
      else{const pv=Sim.validate(s,m,'START_NATIONAL_PROJECT',{category:n.cat,projectId:id});st=p.locked.length?'<span class="tag">선행: '+p.locked.map(r=>Dm.PROJECTS[r].name).join(', ')+'</span>':p.saved?'<span class="tag m">진척 '+p.saved+'%</span>':'';btn=`<button class="btn sm" style="margin-top:4px" data-act="proj" data-cat="${n.cat}" data-v="${id}" ${dz(pv)}>착수</button>`}
      h+=`<div class="proj"><b>${esc(d.name)}</b> ${st}<div class="sub">${esc(d.effect)}</div>${btn}</div>`}
    h+=`</div></div>`}
  h+=`<div class="ob sub">국정은 분야마다 한 과제만 진행합니다. 월 예산은 주마다 나눠 내고, 실제로 낸 주와 담당관이 일한 주만큼만 월말에 진척됩니다. 신규 재화는 없습니다.</div>`;
  h+=`<div class="sec">지난 결산</div>`+(keys.length?keys.slice().reverse().map(k=>`<div class="it" data-act="review" data-v="${k}" data-region="1">${Dm.monthName(k)} 결산 <span class="w">조회 전용 · 다시 열어도 기록은 바뀌지 않습니다</span></div>`).join(''):`<div class="ob sub">아직 끝난 달이 없습니다.</div>`);
  return h}
function governSheet(){
  const s=G.s,m=me(),sh=G.sheet,R=s.regions[sh.regionId],pv=Dm.governancePreview(s,m,R.id,sh.to,sh.force),ttl={own:'직할로 돌리기',delegate:'지방 자치에 맡기기',consent:'직할 협상',force:'강제 직할',reassure:'자치 재보장'};
  if(!pv.ok)return `<h2>${esc(R.name)} 통치 방식</h2><div class="warn">${esc(pv.reason)}</div><div style="margin-top:12px"><button class="btn" data-act="close">닫기</button></div>`;
  return `<h2>${esc(R.name)} · ${ttl[pv.kind]}</h2><div class="sub">${esc(fnm(R.controller))} · 지금 ${Dm.rights(s,m,R.id).label}</div>
   <div class="pv">${pv.score!==undefined?`<div class="odds ${pv.label==='유리'?'good':pv.label==='접전'?'mid':'badc'}">수락 전망 ${pv.label} (${pv.score>0?'+':''}${pv.score})</div><div class="parts">${Object.keys(pv.parts).map(k=>`<span>${k}</span><span class="${pv.parts[k]<0?'badc':'good'}">${pv.parts[k]>0?'+':''}${pv.parts[k]}</span>`).join('')}</div>`:''}
   ${pv.lines.map(l=>`<div class="sub" style="margin-top:5px">${esc(l)}</div>`).join('')}${pv.cost?`<div class="sub" style="margin-top:5px">사신 비용 국고 ${pv.cost}</div>`:''}</div>
   <div class="sub" style="margin-top:8px">전환은 약정 조건을 고쳐 쓰는 방식입니다. 거점의 주인·군대는 그대로이고, 누르자마자 반란이 일어나지는 않습니다.</div>
   <div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" data-act="go-gov">${ttl[pv.kind]}${monthlyPaused()?' 예약':''}</button><button class="btn" data-act="close">취소</button></div>`}
function drawRight(){
  const s=G.s,el=$('#right'),m=me();
  const np=s.proposals.filter(p=>p.status==='pending'&&p.to===m).length,ob=Sim.obligations(s,m).mine.filter(e=>e.ob.due!==null&&e.ob.due-s.week<=3).length,nv=Dm.nationalView(s,m),nb=nv.filter(n=>n.list.some(p=>p.done&&p.def.policy&&!p.enacted)).length;
  const tabs=[['report','報','보고',np],['nation','政','국정',nb],['court','朝','조정',ob],['battle','戰','전투',0],['chron','史','연대기',0],['ai','算','AI',0]],open=G.rightOpen||!!G.sheet;
  $('#rail').innerHTML=tabs.map(t=>`<button data-act="tab" data-v="${t[0]}" class="${open&&!G.sheet&&G.tab===t[0]?'on':''}" aria-label="${t[2]}" title="${t[2]}"><b>${t[1]}</b><span>${t[2]}</span>${t[3]?`<i>${t[3]}</i>`:''}</button>`).join('');
  el.classList.toggle('shut',!open);$('#app').classList.toggle('noright',!open);
  if(G.sheet){el.innerHTML=`<div id="sheet"></div>`;drawSheet();return}
  if(!open){el.innerHTML='';return}
  const name=tabs.find(t=>t[0]===G.tab)[2];
  let h=`<div class="win-h"><h2>${name}</h2><button class="x" data-act="rclose" aria-label="장부 닫기">×</button></div><div id="feed">`;
  if(G.tab==='report'){const F=s.factions[m],wars=D.FIDS.filter(f=>s.factions[f].alive&&Sim.atWar(s,m,f));
    h+=`<div class="it" style="background:#1a1510"><span class="w">우리의 목표</span>${esc(F.strategicGoal)}<span class="w" style="margin-top:4px">${wars.length?'교전 중: '+wars.map(fnm).join('·'):'교전 중인 세력 없음'}${F.overlord?' · 종주 '+esc(fnm(F.overlord))+' (신뢰 '+Sim.trust(s,m,F.overlord)+')':''}</span></div>`;
    for(const p of s.proposals.filter(p=>p.status==='pending'&&p.to===m))h+=propCard(p);
    const rp=s.reports.slice(-60).reverse();
    h+=rp.length?rp.map(r=>`<div class="it${r.urgent?' urgent':''}" ${r.regionId?`data-act="sel" data-id="${r.regionId}" data-region="1"`:''}><span class="w">${Sim.dateStr(r.week)}</span>${esc(r.text)}</div>`).join(''):`<div class="it sub">아직 보고가 없습니다. 시간을 흘려 보내거나 명령을 내리세요.</div>`;
    h+=`<div class="it sub"><label><input type="checkbox" id="ap" ${G.autoPause?'checked':''}> 중요한 보고가 오면 시간을 멈춤</label><br><label><input type="checkbox" id="apm" ${s.dom.gate.autoPauseMonthly?'checked':''}> 달이 바뀌면 결산하고 멈춤 (월간 정비)</label></div>`;
  }else if(G.tab==='nation')h+=nationalTab();
  else if(G.tab==='court')h+=courtTab();
  else if(G.tab==='battle'){const list=s.engagements.filter(engSeen).slice().reverse();
    h+=list.length?list.map(e=>{const r=resultFor(e);return `<div class="it" data-act="result" data-id="${e.id}" data-region="1"><span class="w">${Sim.dateStr(e.start)}${e.end!==null?' ~ '+Sim.dateStr(e.end):' · 진행 중'} · ${e.rounds}주 교전</span><b>${esc(s.regions[e.regionId].name)} 공방전</b> <span class="tag ${r.cls}">${r.label}</span><span class="w">${e.attackers.map(fnm).join('·')} → ${e.defenders.map(fnm).join('·')} · 잃은 병력 공 ${fmt(tot(e.lost.atk))} / 수 ${fmt(tot(e.lost.def))}</span></div>`}).join(''):`<div class="it sub">아직 지켜본 공방전이 없습니다. 우리 편이 싸운 공방전이 여기에 쌓입니다.</div>`;
  }else if(G.tab==='chron')h+=s.chronicle.slice().reverse().map(c=>`<div class="it" ${c.regionId?`data-act="sel" data-id="${c.regionId}" data-region="1"`:''}><span class="w">${Sim.dateStr(c.week)}${c.cause?' · 원인: '+esc(c.cause):''}</span>${esc(c.text)}${c.stateChanges?`<span class="w">변화: ${esc(c.stateChanges)}</span>`:''}</div>`).join('');
  else{h+=`<div class="it sub">개발 확인용입니다. 다른 세력의 속마음이 그대로 보이므로 실제 게임에서는 숨깁니다.</div>`;
    h+=s.log.filter(l=>l.ok&&l.faction!==m&&l.why&&l.type!=='GARRISON').slice(-80).reverse().map(l=>`<div class="it dev"><span class="w">${Sim.dateStr(l.week)} · ${esc(fnm(l.faction))} · 효용 ${l.u}</span><b>${AITYPE[l.type]||(l.type==='ENVOY'?D.KINDNAME[l.params.kind]:l.type)}</b> ${esc(l.why)}</div>`).join('')}
  keep('#feed',()=>{el.innerHTML=Sim.jo(h+'</div>')});
}

// ── 공통 장수 임명 팝업 (OfficerPickerDialog): 도시·국정·군사·월간 정비가 같은 창을 쓴다 ──
const OPK_COLS=[['name','이름'],['post','현재 직책'],['ld','통솔'],['ma','무력'],['st','지략'],['po','정치'],['pr','신망'],['loyalty','충성'],['fit','적성'],['status','임명 상태']];
const ST_ORD={OK:0,TRANSFER_REQUIRED:1,SAME_SLOT:2,UNAVAILABLE:3,KING_ROLE:4,NO_APPOINT_RIGHT:5,DEAD:6,UNVERIFIED:7};
const ST_TAG={OK:['가능','g'],TRANSFER_REQUIRED:['전출 필요','m'],SAME_SLOT:['현직','gold'],UNAVAILABLE:['불가','u'],KING_ROLE:['군주','u'],NO_APPOINT_RIGHT:['임명권 없음','u'],DEAD:['사망','u'],UNVERIFIED:['미검증','u']};
function openPicker(slotId,domain){
  const s=G.s,sl=Dm.parseSlot(slotId),fb=document.querySelector('#left .body'),fd=$('#feed'),rb=document.querySelector('.rv-b');
  let dm=domain||null;if(sl.kind==='city'&&sl.role==='deputy'){const cd=s.dom.cityDomesticByRegion[sl.regionId];dm=dm||cd.deputyDomains[sl.idx]||cd.focusDomain||'commerce'}
  G.picker={slotId,domain:dm,filter:'all',q:'',sort:'fit',desc:true,sel:null,stage:'COMPARE',ack:false,msg:'',
    origin:{originScreen:G.review&&!G.reviewHidden?'DN-06':sl.kind==='city'?'S02':sl.kind==='national'?'S03':'S06',originTab:G.tab,ltab:G.ltab,selectedEntity:G.sel?{type:G.sel.type,id:G.sel.id}:null,scrollL:fb?fb.scrollTop:0,scrollR:fd?fd.scrollTop:0,scrollV:rb?rb.scrollTop:0,rightOpen:G.rightOpen,prePausePhase:monthlyPaused()?'PAUSED_MONTHLY':G.paused?'PAUSED_USER':'RUNNING',worldRevision:s.dom.revision}};
  G.paused=true;drawTop();drawPicker();const q=$('#opk-q');if(q)q.focus();
}
function closePicker(){
  const o=G.picker.origin;G.picker=null;const md=$('#modal');md.hidden=true;md.innerHTML='';
  G.tab=o.originTab;G.ltab=o.ltab;G.sel=o.selectedEntity;G.rightOpen=o.rightOpen;G.paused=o.prePausePhase!=='RUNNING'; // 열기 전에 흐르고 있었을 때만 다시 흐른다
  drawAll();const fb=document.querySelector('#left .body'),fd=$('#feed'),rb=document.querySelector('.rv-b');if(fb)fb.scrollTop=o.scrollL;if(fd)fd.scrollTop=o.scrollR;if(rb)rb.scrollTop=o.scrollV;
}
function pickerCmd(charId){const pk=G.picker,sl=Dm.parseSlot(pk.slotId);
  if(sl.kind==='city')return['ASSIGN_CITY_OFFICER',{regionId:sl.regionId,slot:sl.role==='governor'?'governor':'deputy:'+sl.idx,charId,domain:pk.domain}];
  if(sl.kind==='national')return['ASSIGN_NATIONAL_OFFICER',{category:sl.cat,charId}];
  return['ASSIGN_ARMY_OFFICER',{armyId:sl.armyId,slot:sl.role==='commander'?'commander':'deputy:'+sl.idx,charId}]}
function drawPicker(){
  const s=G.s,m=me(),pk=G.picker,md=$('#modal');if(!pk){md.hidden=true;return}
  const sl=Dm.parseSlot(pk.slotId),isDep=sl.kind==='city'&&sl.role==='deputy',all=Dm.candidates(s,m,pk.slotId,pk.domain),cur=Dm.holderOf(s,pk.slotId),curC=cur&&s.characters[cur];
  const rightLbl=sl.kind==='city'?Dm.rights(s,m,sl.regionId).label:sl.kind==='national'?'우리 조정':'우리 부대',post=x=>x.primary?x.primary.label:'없음';
  const val=(x,k)=>k==='name'?x.c.name:k==='post'?post(x):k==='fit'?x.fit:k==='status'?ST_ORD[x.status.code]:x.c[k];
  let list=all.filter(x=>pk.filter==='all'||(pk.filter==='ok'&&x.status.code==='OK')||(pk.filter==='transfer'&&x.status.code==='TRANSFER_REQUIRED')||(pk.filter==='na'&&!x.status.ok));
  const q=pk.q.trim();if(q)list=list.filter(x=>(x.c.name+' '+x.c.role+' '+(x.c.traits||'')+' '+post(x)+' '+fnm(x.c.faction)).indexOf(q)>=0);
  list.sort((a,b)=>{const x=val(a,pk.sort),y=val(b,pk.sort),d=typeof x==='string'?x.localeCompare(y,'ko'):x-y;return(pk.desc?-d:d)||(a.id<b.id?-1:1)});
  const selX=pk.sel&&all.find(x=>x.id===pk.sel),cnt=k=>all.filter(x=>k==='ok'?x.status.code==='OK':k==='transfer'?x.status.code==='TRANSFER_REQUIRED':k==='na'?!x.status.ok:true).length;
  const rows=list.map(x=>{const t=ST_TAG[x.status.code];return `<tr data-act="opk-row" data-id="${x.id}" class="${pk.sel===x.id?'sel':''}${x.status.ok?'':' na'}" tabindex="0" aria-selected="${pk.sel===x.id}"><td><b>${esc(x.c.name)}</b></td><td>${esc(post(x))}</td>${['ld','ma','st','po','pr','loyalty'].map(k=>`<td class="${pk.sort===k?'hi':''}">${x.c[k]}</td>`).join('')}<td class="fit ${pk.sort==='fit'?'hi':''}">${x.fit}</td><td><span class="tag ${t[1]}" title="${esc(x.status.reason||'')}">${t[0]}</span></td></tr>`}).join('');
  let side='';
  if(selX){const c=selX.c,ef=Dm.assignEffect(s,m,pk.slotId,c.id,pk.domain),st=selX.status,t=ST_TAG[st.code];
    side=`<h2 style="font-size:18px">${esc(c.name)}</h2><div class="sub">${esc(c.role)} · ${esc(s.regions[c.loc].name)}${c.traits?' · '+esc(c.traits):''}</div>
     <div style="margin-top:8px">${[['통솔','ld'],['무력','ma'],['지략','st'],['정치','po'],['신망','pr'],['충성','loyalty']].map(a=>`<div class="stat"><span class="lbl sub">${a[0]}</span><span class="track ${a[1]==='loyalty'&&c.loyalty<40?'bad':''}"><i style="width:${c[a[1]]}%"></i></span><span>${c[a[1]]}</span></div>`).join('')}</div>
     <dl class="kv" style="margin-top:8px"><dt>이 자리 적성</dt><dd><b class="${selX.fit>=70?'good':selX.fit<50?'badc':''}">${selX.fit}</b></dd><dt>현재 직책</dt><dd>${esc(post(selX))}</dd><dt>임명 상태</dt><dd><span class="tag ${t[1]}">${t[0]}</span></dd>${st.ok&&st.weeks?`<dt>부임까지</dt><dd>${st.weeks}주 (그동안 자리는 비어 있음)</dd>`:''}</dl>
     ${st.ok?'':`<div class="loss">${esc(st.reason)}</div>`}
     ${st.ok?`<h3>예상 효과${curC?' · 지금 '+esc(curC.name)+' 대비':''}</h3>${ef.gain.map(g=>`<div class="gain">${esc(g)}</div>`).join('')}`:''}
     ${st.ok&&ef.loss.length?`<h3>떠나는 자리·위험</h3>${ef.loss.map(g=>`<div class="loss">${esc(g)}</div>`).join('')}`:''}`}
  else side=`<h2 style="font-size:18px">${esc(Dm.slotLabel(s,pk.slotId))}</h2><dl class="kv" style="margin-top:8px"><dt>지금 담당자</dt><dd>${curC?esc(curC.name):'공석'}</dd><dt>임명권</dt><dd>${rightLbl}</dd></dl><div class="sub" style="margin-top:10px">표에서 인물을 고르면 이 자리에서의 적성, 지금 담당자와 견준 효과, 그 인물이 떠나는 자리의 공백이 여기에 나옵니다. 고르는 것만으로는 아무것도 바뀌지 않습니다.</div><div class="sub" style="margin-top:8px">자리를 비워 둬도 기본 행정은 돌아갑니다. 군주는 실무 보직에 앉힐 수 없습니다.</div>`;
  const ok=selX&&selX.status.ok,needAck=ok&&selX.status.code==='TRANSFER_REQUIRED';
  const foot=pk.stage==='CONFIRM'&&ok?`<div class="sum"><b>${esc(selX.c.name)}</b>을(를) <b>${esc(Dm.slotLabel(s,pk.slotId))}</b>${isDep?'('+Dm.DOMAIN[pk.domain].name+')':''}에 임명합니다.${monthlyPaused()?' 월간 정비 중이라 예약되고, 재개한 다음 주부터 적용됩니다.':''}${needAck?`<br><label class="badc"><input type="checkbox" id="opk-ack" ${pk.ack?'checked':''}> ${esc(selX.status.transfer.label)} 자리가 비는 것을 확인했습니다</label>`:''}</div><button class="btn" data-act="opk-back">뒤로</button><button class="btn pri" id="opk-go" data-act="opk-go" ${needAck&&!pk.ack?'aria-disabled="true" data-why="떠나는 자리가 비는 것을 먼저 확인하세요."':''}>임명 확정</button>`
    :`<div class="sum">대상 <b>${esc(Dm.slotLabel(s,pk.slotId))}</b> · 선택 ${selX?'<b>'+esc(selX.c.name)+'</b>'+(needAck?' <span class="mid">(전출: '+esc(selX.status.transfer.label)+' 공석)</span>':''):'없음'}${pk.msg?'<br><span class="badc">'+esc(pk.msg)+'</span>':''}</div>${curC?`<button class="btn" data-act="opk-dismiss">${esc(curC.name)} 해임</button>`:''}<button class="btn" data-act="opk-close">취소</button><button class="btn pri" id="opk-next" data-act="opk-next" ${ok?'':`aria-disabled="true" data-why="${selX?esc(selX.status.reason):'먼저 표에서 인물을 고르세요.'}"`}>임명 확인</button>`;
  const tblY=(md.querySelector('.opk-tbl')||{}).scrollTop||0;
  md.hidden=false;
  md.innerHTML=Sim.jo(`<div class="slab orn opk" role="dialog" aria-modal="true" aria-label="장수 임명"><div class="win-h">${seal(m,1)}<div style="flex:1;min-width:0"><h2>${esc(Dm.slotLabel(s,pk.slotId))} 임명</h2><div class="sub">${esc(fnm(m))} · 임명권 ${rightLbl} · 호출 ${pk.origin.originScreen}${monthlyPaused()?' · 월간 정비 중':pk.origin.prePausePhase==='RUNNING'?' · 창을 여는 동안 시간 멈춤':''}</div></div><button class="x" data-act="opk-close" aria-label="임명 창 닫기">×</button></div>
   <div class="opk-top"><input type="search" id="opk-q" placeholder="이름·직책·특성 검색" value="${esc(pk.q)}" aria-label="인물 검색"><div class="seg" role="group" aria-label="임명 상태 필터">${[['all','전체'],['ok','가용'],['transfer','전출 필요'],['na','불가']].map(f=>`<button data-act="opk-filter" data-v="${f[0]}" class="${pk.filter===f[0]?'on':''}">${f[1]} ${cnt(f[0])}</button>`).join('')}</div>
     ${isDep?`<span class="sub">맡길 분야</span><div class="seg" role="group" aria-label="부관이 맡을 분야">${Dm.DOMAINS.map(d=>`<button data-act="opk-domain" data-v="${d}" class="${pk.domain===d?'on':''}">${Dm.DOMAIN[d].name}</button>`).join('')}</div>`:''}<span class="sub" style="margin-left:auto">${list.length}명 표시</span></div>
   <div class="opk-main"><div class="opk-tbl"><table class="off"><thead><tr>${OPK_COLS.map(c=>`<th scope="col"><button data-act="opk-sort" data-v="${c[0]}" class="${pk.sort===c[0]?'on':''}" aria-sort="${pk.sort===c[0]?(pk.desc?'descending':'ascending'):'none'}">${c[1]}${pk.sort===c[0]?(pk.desc?' ▼':' ▲'):''}</button></th>`).join('')}</tr></thead><tbody id="opk-body">${rows||`<tr><td colspan="10" style="text-align:left;padding:14px">조건에 맞는 인물이 없습니다. 필터를 '전체'로 바꾸거나 검색어를 지워 보세요. 자리를 비워 둬도 기본 행정은 계속됩니다.</td></tr>`}</tbody></table></div><div class="opk-side">${side}</div></div>
   <div class="opk-foot">${foot}</div></div>`);
  const tb=md.querySelector('.opk-tbl');if(tb)tb.scrollTop=tblY;
}

// ── 월간 결산·정비 (DN-06) ──
const GOLDCAT={tax:'세수',tribute:'상납',upkeep:'병사 급료',salary:'관직 봉록',admin:'행정 유지비',facility_upkeep:'시설 유지비',national:'국정 예산',facility:'시설 착공',recruit:'모병',fortify:'성 보강',buy_grain:'곡식 매입',intel:'정찰·첩보',diplomacy:'외교',pacify:'민심 수습',reward:'포상',arrears:'못 준 급료(탕감)',etc:'기타'};
const GRAINCAT={harvest:'수확',buy:'매입',requisition:'징발',garrison:'주둔군 소모',army:'출정군 소모',transport:'수송 손실',capture:'점령·상실',etc:'기타(흩어진 부대 등)'};
function ledTable(obj,names){const ks=Object.keys(names).filter(k=>obj[k]&&Math.abs(obj[k])>=0.05);let t=0;for(const k in obj)t+=obj[k];
  return `<table class="led">${ks.map(k=>`<tr><td>${names[k]}</td><td class="${obj[k]<0?'badc':'good'}">${sgn(obj[k],1)}</td></tr>`).join('')||'<tr><td>거래 없음</td><td></td></tr>'}<tr class="tot"><td>순증감</td><td class="${t<0?'badc':'good'}">${sgn(t,1)}</td></tr></table>`}
function priorities(x,ro){
  const s=G.s,m=me(),F=s.factions[m],out=[],add=(p,text,act)=>out.push({p,text,act:act||''}),go=(label,attrs)=>`<button class="btn sm" ${attrs}>${label}</button>`,toR=id=>go('거점 보기',`data-act="rv-goto" data-id="${id}"`);
  const sm=Sim.factionSummary(s,m),net=sm.income-sm.gold,gw=sm.use>0?sm.grain/sm.use:99;
  if(!ro){if(net<0&&F.treasury<-net*8)add(0,'국고가 '+Math.max(0,Math.floor(F.treasury/-net))+'주 안에 바닥납니다. 주간 수지 '+sgn(net)+'.',go('국정 예산',`data-act="rv-tab" data-v="nation"`));
    if(gw<8)add(0,'군량이 '+Math.floor(gw)+'주치뿐입니다.',toR(F.capitalId));
    for(const r of D.RIDS){const R=s.regions[r];if(R.siege&&Sim.sameBloc(s,m,R.controller))add(0,R.name+'이(가) 포위돼 있습니다 ('+fnm(R.siege.by)+'군, '+(s.week-R.siege.start+1)+'주째).',toR(r))}
    for(const e of Sim.obligations(s,m).mine)if(e.ob.due!==null&&e.ob.due-s.week<=3)add(0,'지킬 약속의 기한이 '+Math.max(0,e.ob.due-s.week)+'주 남았습니다: '+e.text,go('조정',`data-act="rv-tab" data-v="court"`))}
  for(const a of x.politicalAlerts)add(a.type==='CRISIS_CANDIDATE'?0:1,a.text,a.regionId?toR(a.regionId):'');
  for(const p of x.projectDeltas){if(p.completed)add(1,p.name+' 완료.'+(p.awaitingEnact?' 시행해야 효과가 납니다.':''),p.awaitingEnact&&!ro&&s.dom.nationalProjectsByFaction[m].enacted[p.projectId]===undefined?go('시행한다',`data-act="enact" data-v="${p.projectId}"`):go('국정',`data-act="rv-tab" data-v="nation"`));
    else if(p.vacantWeeks)add(1,Dm.CATNAME[p.category]+' 담당관이 '+p.vacantWeeks+'주 자리를 비워 '+p.name+' 진척이 줄었습니다.',ro?'':go('담당관 임명',`data-act="opk" data-slot="national:${m}:${p.category}"`));
    else if(p.unpaidWeeks)add(1,'국고가 모자라 '+p.name+' 예산을 '+p.unpaidWeeks+'주 못 냈습니다.',go('국정 예산',`data-act="rv-tab" data-v="nation"`))}
  if(!ro){for(const n of Dm.nationalView(s,m)){if(!n.slot.projectId&&n.list.some(p=>!p.done&&!p.locked.length))add(1,n.name+': 진행 중인 과제가 없습니다.'+(n.officer?'':' 담당관도 공석입니다.'),n.officer?go('과제 고르기',`data-act="rv-tab" data-v="nation"`):go('담당관 임명',`data-act="opk" data-slot="national:${m}:${n.cat}"`))}
    const vac=x.cityDeltas.filter(c=>c.vacant&&Dm.rights(s,m,c.regionId).can);if(vac.length)add(1,'성주가 없는 직할 거점 '+vac.length+'곳: '+vac.map(c=>s.regions[c.regionId].name).join('·')+'. 비워 둬도 기본 행정은 돕니다.',go('성주 임명',`data-act="opk" data-slot="city:${vac[0].regionId}:governor"`));
    const np=s.proposals.filter(p=>p.status==='pending'&&p.to===m).length;if(np)add(1,'답을 기다리는 제안 '+np+'건.',go('보고',`data-act="rv-tab" data-v="report"`))}
  for(const r of s.reports)if(x.weeks.indexOf(r.week-1)>=0&&/완공됐습니다|자리를 떠나|자리를 비우고|보직\(/.test(r.text))add(/완공/.test(r.text)?2:1,r.text,r.regionId?toR(r.regionId):'');
  const dg=x.resourceDelta.gold.close-x.resourceDelta.gold.open,dr=x.resourceDelta.grain.close-x.resourceDelta.grain.open;
  add(2,'국고 '+sgn(dg)+' ('+fmt(x.resourceDelta.gold.open)+' → '+fmt(x.resourceDelta.gold.close)+'), 군량 '+sgn(dr)+'.','');
  for(const c of x.cityDeltas)if(c.notes.length)add(2,s.regions[c.regionId].name+': '+c.notes.join(' · '),toR(c.regionId));
  const quiet=x.cityDeltas.filter(c=>!c.notes.length).length;if(quiet)add(3,'달라진 것이 없는 거점 '+quiet+'곳.','');
  return out.sort((a,b)=>a.p-b.p)}
function openReview(mk,ro){G.review={mk,readonly:!!ro};G.reviewHidden=false;drawReview()}
function drawBanner(){const el=$('#banner'),s=G.s;if(!s||!monthlyPaused()||(G.review&&!G.reviewHidden&&!G.review.readonly)){el.hidden=true;return}
  const n=Dm.pendingOf(s,me()).length,d=Sim.dateOf(s.week);el.hidden=false;
  el.innerHTML=`<b>${d.year}년 ${d.month}월 정비 중</b><span class="sub">시간이 멈춰 있습니다 · 예약 ${n}건</span><button class="btn sm" data-act="rv-show">결산 보기</button><button class="btn sm pri" data-act="rv-resume">정비 완료 · 진행 재개</button>`}
function drawReview(){
  const el=$('#review'),s=G.s,m=me();
  if(!s||!G.review||G.reviewHidden){el.hidden=true;el.innerHTML='';drawBanner();return}
  const x=Dm.viewSettlement(s,m,G.review.mk);if(!x){G.review=null;el.hidden=true;drawBanner();return}
  const ro=G.review.readonly||!monthlyPaused()||s.dom.gate.activeSettlementId!==x.settlementId,d=Sim.dateOf(s.week),F=s.factions[m],ru=s.characters[F.rulerId],Q=Dm.pendingOf(s,m),rsv=Dm.reservedOf(s,m);
  const kp=(k,o,c,dec,inv,unit)=>{const dv=c-o,bad=inv?dv>0.004:dv<-0.004,gd=inv?dv<-0.004:dv>0.004;return `<div class="kpi"><div class="k">${k}</div><div class="v">${dec?c.toFixed(dec):fmt(c)}${unit||''}</div><div class="d ${bad?'badc':gd?'good':'sub'}">${Math.abs(dv)<0.005?'변화 없음':'전월 대비 '+sgn(dv,dec)}</div></div>`};
  const pr=priorities(x,ro),pn=['P0 위기','P1 결정','P2 성과','P3 일반'];
  const arrow=(a,dec)=>{const dv=a[1]-a[0];return (dec?a[1].toFixed(dec):Math.round(a[1]))+(Math.abs(dv)>=0.05?` <span class="${dv>0?'good':'badc'}">${sgn(dv,Math.abs(dv)%1>0.04?1:0)}</span>`:'')};
  const garrow=a=>{const dv=a[1]-a[0];return Math.round(a[1])+(Math.abs(dv)>=0.05?` <span class="${dv>0?'badc':'good'}">${sgn(dv,0)}</span>`:'')};
  const cityRow=(c,who)=>`<tr><td><a href="#" data-act="rv-goto" data-id="${c.regionId}">${esc(s.regions[c.regionId].name)}</a>${who?' <span class="sub">'+esc(fnm(c.factionId))+'</span>':''}<br><span class="tag">${c.mode}</span>${c.vacant&&!who?' <span class="tag m">성주 공석</span>':''}</td><td>${arrow(c.stability,0)}</td><td>${arrow(c.morale,0)}</td><td>${arrow(c.training,1)}</td><td>${garrow(c.grievance)}</td><td class="why">${c.notes.map(esc).join('<br>')||'—'}</td></tr>`;
  const projRow=p=>`<div class="proj"><div style="display:flex;justify-content:space-between;gap:8px"><b>${Dm.CATNAME[p.category]} · ${esc(p.name)}${p.targetRegionId?' ('+esc(s.regions[p.targetRegionId].name)+')':''}</b><span>${p.from.toFixed(1)}% → <b class="good">${p.to.toFixed(1)}%</b>${p.completed?' <span class="tag g">완료</span>':''}${p.awaitingEnact?' <span class="tag m">시행 대기</span>':''}</span></div>
     <div class="prog"><i style="width:${p.to.toFixed(1)}%"></i><span>+${p.delta.toFixed(1)}%p</span></div><div class="sub">담당관 ${p.officerId?esc(s.characters[p.officerId].name)+' ×'+p.officerFactor.toFixed(2):'공석'} · 예산 ${Dm.TIERNAME[p.budgetTier]} ${p.paid.toFixed(0)}/${p.committed} 지급 · 일한 주 ${p.creditWeeks}/${p.weeks}${p.vacantWeeks?' · 공석 '+p.vacantWeeks+'주':''}${p.unpaidWeeks?' · 미지급 '+p.unpaidWeeks+'주':''}</div></div>`;
  const quick=ro?'':`<h3>정비</h3><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" data-act="rv-tab" data-v="nation">국정 과제·예산·담당관</button><button class="btn" data-act="rv-goto" data-id="${F.capitalId}" data-v="city">도시 중점·시설·부관</button>${x.vassalDeltas.length?`<button class="btn" data-act="rv-goto" data-id="${x.vassalDeltas[0].regionId}" data-v="city">호족 통치·협상</button>`:''}<button class="btn" data-act="rv-goto" data-id="${F.capitalId}" data-v="info">군사 편성</button><button class="btn" data-act="rv-tab" data-v="court">조정·약속</button></div>
     <div class="sub" style="margin-top:4px">정비 중에 내린 내정 명령은 예약되고, 재개한 다음 주부터 적용됩니다. 지난달 결산은 바뀌지 않습니다.</div>`;
  const body=`<div class="kpis">${kp('국고',x.resourceDelta.gold.open,x.resourceDelta.gold.close)}${kp('군량',x.resourceDelta.grain.open,x.resourceDelta.grain.close)}${kp('병력',x.resourceDelta.troops.open,x.resourceDelta.troops.close)}${kp('행정 부담',x.admin.open.burden/x.admin.open.capacity,x.admin.close.burden/x.admin.close.capacity,2,true)}${kp('지역 안정도',x.stability.open,x.stability.close,1)}${kp('민심(민생)',x.morale.open,x.morale.close,1)}</div>
   <div class="rv-grid"><div><h3>보고</h3>${pr.filter(p=>p.p<3).map(p=>`<div class="pri p${p.p}"><span class="p">${pn[p.p].slice(0,2)}</span><span>${esc(p.text)}</span><span>${p.act}</span></div>`).join('')}${pr.some(p=>p.p===3)?`<details class="fold2"><summary>일반 보고 ${pr.filter(p=>p.p===3).length}건</summary>${pr.filter(p=>p.p===3).map(p=>`<div class="pri p3"><span class="p">P3</span><span>${esc(p.text)}</span><span></span></div>`).join('')}</details>`:''}${quick}
     <h3>국정 진척</h3>${x.projectDeltas.length?x.projectDeltas.map(projRow).join(''):'<div class="sub">이번 달에 진행한 국정 과제가 없습니다.</div>'}
     <h3>이달의 사건</h3>${x.events.length?x.events.map(e=>`<div class="sub" style="margin:2px 0"><span style="color:var(--text)">${Sim.dateStr(e.week)}</span> ${esc(e.text)}${e.cause?' <span class="tag">'+esc(e.cause)+'</span>':''}</div>`).join(''):'<div class="sub">큰 사건 없이 지나갔습니다.</div>'}</div>
    <div><h3>국고 장부</h3>${ledTable(x.ledger.gold,GOLDCAT)}<h3>군량 장부</h3>${ledTable(x.ledger.grain,GRAINCAT)}<div class="sub" style="margin-top:4px">주마다 실제로 오간 거래의 합입니다 (원장 ${x.ledgerEventIds.length}건). 결산은 이를 확정할 뿐 국고·군량을 따로 주지 않습니다.</div>
     <h3>도시</h3><div style="overflow-x:auto"><table class="city"><tr><th>거점</th><th>안정</th><th>민심</th><th>훈련</th><th>불만</th><th style="text-align:left">까닭</th></tr>${x.cityDeltas.map(c=>cityRow(c,false)).join('')}</table></div>
     ${x.vassalDeltas.length?`<h3>섬기는 호족</h3><div style="overflow-x:auto"><table class="city"><tr><th>거점</th><th>안정</th><th>민심</th><th>훈련</th><th>불만</th><th style="text-align:left">까닭</th></tr>${x.vassalDeltas.map(c=>cityRow(c,true)).join('')}</table></div>`:''}</div></div>`;
  const foot=ro?`<div class="q"><span class="sub">지난 결산은 조회 전용입니다. ${esc(x.settlementId)}</span></div><button class="btn" data-act="rv-close">닫기</button>`
    :`<div class="q"><b>예약 ${Q.length}건</b>${rsv?` · 약정 국고 ${fmt(rsv)} (가용 ${fmt(F.treasury-rsv)})`:''} ${Q.map(q=>`<span class="qc">${esc(q.text)}<button data-act="unqueue" data-id="${q.id}" aria-label="예약 취소">×</button></span>`).join('')}<label class="sub" style="margin-left:6px"><input type="checkbox" id="apm" ${s.dom.gate.autoPauseMonthly?'checked':''}> 달마다 멈춤</label></div><button class="btn" data-act="rv-hide">지도에서 정비하기</button><button class="btn pri" id="rv-resume" data-act="rv-resume">정비 완료 · 진행 재개</button>`;
  const y=(el.querySelector('.rv-b')||{}).scrollTop||0;
  el.hidden=false;
  el.innerHTML=Sim.jo(`<div class="slab orn rv" role="dialog" aria-label="월간 결산"><div class="rv-h">${seal(m,1)}<div><h2>${Dm.monthName(x.monthKey)} 결산</h2><div class="sub">${esc(F.name)} · ${esc(ru.name)} · ${ro?'조회 전용':d.year+'년 '+d.month+'월 '+d.wk+'주 진행 전 · 시간 자동 정지'}${x.fixture?' · <span class="fx">QA fixture</span>':''}</div></div>
    <div class="steps" aria-label="단계"><span class="done">결산 확정</span><span class="${ro?'':'on'}">정비</span><span>재개</span></div>${ro?'<button class="x" data-act="rv-close" aria-label="결산 닫기">×</button>':''}</div><div class="rv-b">${body}</div><div class="rv-f">${foot}</div></div>`);
  const nb=el.querySelector('.rv-b');if(nb)nb.scrollTop=y;drawBanner();
}
function resumeMonthly(){
  const s=G.s,r=Sim.issueOrder(s,me(),'RESUME_FROM_MONTHLY_PAUSE',{});if(!r.ok){toast(r.reason);return}
  G.review=null;G.reviewHidden=false;G.paused=!G.wasRunning;G.acc=0;
  toast('정비를 마쳤습니다.'+(r.committed?' 예약한 명령 '+r.committed+'건을 실행했습니다.':'')+(r.failed.length?' '+r.failed.length+'건은 조건이 바뀌어 실행하지 못했습니다(보고 참고).':'')+(G.paused?' 시간은 멈춰 있습니다.':''));
  store.set(AUTO,{s});drawAll();
}

// ── 전체 그리기·시작·시간 ──
function drawAll(){if(!G.s)return;drawRegions();drawArmies();drawHL();drawTop();drawLeft();drawBar();drawRight();drawReview();if(G.picker)drawPicker()}
function startOpts(){const fx=$('#fx'),ap=$('#apm0');return{fixture:fx&&fx.checked?'devFastResearch':null,autoPauseMonthly:ap?ap.checked:true}}
function showStart(){
  G.veil='start';$('#app').classList.add('idle');$('#review').hidden=true;$('#modal').hidden=true;$('#banner').hidden=true;const au=store.get(AUTO),tmp=Sim.newGame('goryeo',1),sv=au&&au.s&&(au.s.v===3||au.s.v===4)?au.s:null;
  const card=f=>{const F=tmp.factions[f],sm=Sim.factionSummary(tmp,f),ru=tmp.characters[F.rulerId];return `<button class="card" data-act="pick" data-v="${f}"><span class="hd"><span class="seal" style="background:${FM[f].color}">${FM[f].hanja}</span><span><span class="nm">${esc(F.name)}</span><br><span class="sub">${FM[f].title} ${esc(ru.name)}</span></span></span><p>${FM[f].blurb}</p><span class="st"><span><b>${sm.regions}</b>거점</span><span><b>${fmt(sm.troops)}</b>병력</span><span><b>${fmt(sm.grain)}</b>군량</span><span><b>${fmt(F.treasury)}</b>국고</span></span></button>`};
  $('#veil').style.display='grid';
  $('#veil').innerHTML=`<div class="inner"><h1><small>後三國 · BUILD-G1 내정 시험판</small>천하의 주인</h1><p class="lede">929년 가을, 고창 전역. 60주 동안 여덟 세력이 같은 규칙으로 움직입니다. 이번 판부터 도시마다 성주와 부관을 두고 시설을 올리며, 조정에서는 군사 연구·사회 제도·국가사업을 하나씩 진행합니다. 달이 바뀌면 시간이 멈추고 결산이 나옵니다. 거기서 다음 달을 정비한 뒤 다시 흘려 보내세요. 수치는 모두 플레이테스트 전 가안입니다.</p>
  <div class="cards">${['goryeo','hubaekje','gochang'].map(card).join('')}</div>
  <div class="opts"><label for="seed">난수 시드</label><input type="number" id="seed" value="${929}" min="1" max="999999"><label><input type="checkbox" id="apm0" checked> 달이 바뀌면 결산하고 멈춤</label><label title="군사·사회 연구에 사전 진척을 넣어 12~14주 안에 해금을 확인하는 검증용 설정"><input type="checkbox" id="fx"> QA fixture: 연구 사전 진척</label>${sv?`<button class="btn" data-act="continue">이어하기 · ${esc(sv.factions[sv.playerFactionId].name)} ${Sim.dateStr(sv.week)}</button>`:''}</div>
  <p class="sub" style="margin-top:10px">같은 시드와 같은 명령이면 같은 전개가 나옵니다. 저장은 이 브라우저에만 남습니다.</p></div>`;
}
function start(s){$('#app').classList.remove('idle');G.s=s;G.sel={type:'region',id:s.factions[s.playerFactionId].capitalId};G.sheet=null;G.tab='report';G.ltab='info';G.rightOpen=true;G.picker=null;G.acc=0;G.paused=true;G.wasRunning=false;G.seen=s.reports.length;G.veil=null;$('#veil').style.display='none';$('#modal').hidden=true;
  G.review=monthlyPaused()?{mk:Dm.settlementKeys(s,s.playerFactionId).slice(-1)[0],readonly:false}:null;G.reviewHidden=false;fit();drawAll();if(s.over)showEnd()}
function doTick(){
  const s=G.s;if(!s||s.over)return;if(monthlyPaused()){G.paused=true;drawTop();return}
  const wasRun=!G.paused;Sim.tick(s);
  const urg=s.reports.filter(r=>r.week===s.week&&r.urgent);G.seen=s.reports.length;
  if(G.sheet&&G.sheet.type==='move'&&!s.armies[G.sheet.armyId])G.sheet=null;
  if(G.sel&&G.sel.type==='army'&&!s.armies[G.sel.id])G.sel=null;
  store.set(AUTO,{s});
  const fin=(s.pendingResults||[]).map(id=>Sim.engById(s,id)).filter(e=>e&&e.attackers.concat(e.defenders).indexOf(me())>=0);
  if(monthlyPaused()){G.wasRunning=wasRun;s.dom.gate.originSpeed=G.speed;G.paused=true;G.acc=0;G.review={mk:Dm.settlementKeys(s,me()).slice(-1)[0],readonly:false};G.reviewHidden=false;if(fin.length&&(!G.sheet||G.sheet.type==='result'))G.sheet={type:'result',id:fin[fin.length-1].id}}
  else if(fin.length&&(!G.sheet||G.sheet.type==='result')){G.sheet={type:'result',id:fin[fin.length-1].id};if(G.autoPause)G.paused=true}
  else if(urg.length&&G.autoPause&&!G.paused){G.paused=true;G.tab='report';G.rightOpen=true;toast('시간을 멈췄습니다: '+urg[urg.length-1].text)}
  if(!monthlyPaused()&&!G.sheet&&s.proposals.some(p=>p.to===me()&&p.status==='pending'&&p.week===s.week)){G.tab='report';G.rightOpen=true;if(G.autoPause)G.paused=true}
  drawAll();if(s.over)showEnd();
}
function escKey(){
  const pk=G.picker;
  if(pk){if(pk.stage==='CONFIRM'){pk.stage='COMPARE';drawPicker()}else if(pk.sel){pk.sel=null;pk.msg='';drawPicker()}else closePicker();return true}
  if(G.review&&!G.reviewHidden){if(G.review.readonly||!monthlyPaused())G.review=null;else G.reviewHidden=true;drawAll();return true}
  if(G.sheet){G.sheet=null;drawAll();return true}
  return false}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t||t.getAttribute('aria-disabled')==='true')return;
  const a=t.dataset.act,v=t.dataset.v,s=G.s,m=s&&me(),pk=G.picker;
  if(a==='desel'){G.sel=null;drawAll()}
  else if(a==='ltab'){G.ltab=v;if($('#left'))$('#left').classList.remove('closed');drawLeft()}
  else if(a==='rclose'){G.rightOpen=false;drawAll()}
  else if(a==='opk')openPicker(t.dataset.slot);
  else if(a==='dismiss'){const sl=Dm.parseSlot(t.dataset.slot),nm=s.characters[Dm.holderOf(s,t.dataset.slot)].name;
    if(sl.kind==='city')dcmd('ASSIGN_CITY_OFFICER',{regionId:sl.regionId,slot:sl.role==='governor'?'governor':'deputy:'+sl.idx,charId:null},nm+'을(를) 자리에서 물렸습니다.');
    else if(sl.kind==='national')dcmd('ASSIGN_NATIONAL_OFFICER',{category:sl.cat,charId:null},nm+'을(를) 자리에서 물렸습니다.');
    else dcmd('ASSIGN_ARMY_OFFICER',{armyId:sl.armyId,slot:sl.role==='commander'?'commander':'deputy:'+sl.idx,charId:null},nm+'을(를) 지휘부에서 뺐습니다.')}
  else if(a==='focus'){const R=s.regions[G.sel.id],cur=s.dom.cityDomesticByRegion[R.id].focusDomain;dcmd('SET_CITY_FOCUS',{regionId:R.id,domain:cur===v?null:v},cur===v?R.name+'의 중점 분야를 풀었습니다.':R.name+'의 중점을 '+Dm.DOMAIN[v].name+'(으)로 정했습니다.')}
  else if(a==='build'){const R=s.regions[G.sel.id];dcmd('START_FACILITY_BUILD',{regionId:R.id,facility:v},R.name+' '+Dm.FACILITY[v].name+' 공사를 시작했습니다. '+BAL.cityFacilities.constructionWeeks+'주 뒤 완공됩니다.')}
  else if(a==='gov'){G.sheet={type:'govern',regionId:G.sel.id,to:t.dataset.to,force:t.dataset.force==='1'};drawAll()}
  else if(a==='go-gov'){const sh=G.sheet,R=s.regions[sh.regionId],pv=Dm.governancePreview(s,m,R.id,sh.to,sh.force),r=dcmd('REQUEST_GOVERNANCE_CHANGE',{regionId:R.id,to:sh.to,force:sh.force},pv.kind==='consent'?'사신이 떠났습니다. '+K.envoyWeeks+'주 뒤 답이 옵니다.':pv.kind==='reassure'?R.name+'의 자치를 다시 보장했습니다.':R.name+'의 통치 방식을 바꾸기 시작했습니다. '+pv.weeks+'주 걸립니다.');if(r.ok){G.sheet=null;drawAll()}}
  else if(a==='budget')dcmd('CHANGE_NATIONAL_BUDGET',{category:t.dataset.cat,budgetTier:v},Dm.CATNAME[t.dataset.cat]+' 예산을 '+Dm.TIERNAME[v]+'(으)로 바꿨습니다. 다음 주 지급분부터 적용됩니다.');
  else if(a==='proj'){const d=Dm.PROJECTS[v],sel=$('#prj-target');dcmd('START_NATIONAL_PROJECT',{category:t.dataset.cat,projectId:v,targetRegionId:d.target?(sel?sel.value:G.prjT):undefined},d.name+'에 착수했습니다. 달마다 결산에서 진척됩니다.')}
  else if(a==='enact')dcmd('ENACT_POLICY',{policyId:v},Dm.PROJECTS[v].name+'을(를) 시행했습니다. 행정 역량이 올랐습니다.');
  else if(a==='unqueue'){const r=Dm.cancelPending(s,t.dataset.id);toast(r.ok?'예약을 취소했습니다.':r.reason);drawAll()}
  else if(a==='review')openReview(v,!(monthlyPaused()&&s.dom.gate.activeSettlementId===Dm.sidOf(s,m,v)));
  else if(a==='rv-close'){G.review=null;drawAll()}
  else if(a==='rv-hide'){G.reviewHidden=true;drawAll();toast('지도에서 정비합니다. 시간은 계속 멈춰 있습니다. 위쪽 띠에서 결산으로 돌아가거나 재개할 수 있습니다.')}
  else if(a==='rv-show'){G.review={mk:Dm.settlementKeys(s,m).slice(-1)[0],readonly:false};G.reviewHidden=false;drawAll()}
  else if(a==='rv-tab'){if(G.review&&!G.review.readonly)G.reviewHidden=true;else G.review=null;G.tab=v;G.sheet=null;G.rightOpen=true;drawAll()}
  else if(a==='rv-goto'){e.preventDefault();if(G.review&&!G.review.readonly&&monthlyPaused())G.reviewHidden=true;else G.review=null;G.sel={type:'region',id:t.dataset.id};G.ltab=v||'city';G.sheet=null;const p=RP[t.dataset.id],vb=G.vb;vb.x=p[0]-vb.w/2;vb.y=p[1]-vb.h/2;applyVB();drawAll()}
  else if(a==='rv-resume')resumeMonthly();
  else if(!pk)return;
  else if(a==='opk-close')closePicker();
  else if(a==='opk-row'){pk.sel=pk.sel===t.dataset.id?null:t.dataset.id;pk.stage='COMPARE';pk.ack=false;pk.msg='';drawPicker()}
  else if(a==='opk-sort'){if(pk.sort===v)pk.desc=!pk.desc;else{pk.sort=v;pk.desc=v!=='name'&&v!=='post'&&v!=='status'}drawPicker();const b=document.querySelector(`#modal [data-act="opk-sort"][data-v="${v}"]`);if(b)b.focus()}
  else if(a==='opk-filter'){pk.filter=v;drawPicker()}
  else if(a==='opk-domain'){pk.domain=v;pk.stage='COMPARE';drawPicker()}
  else if(a==='opk-next'){pk.stage='CONFIRM';pk.ack=false;drawPicker();const g=$('#opk-ack')||$('#opk-go');if(g)g.focus()}
  else if(a==='opk-back'){pk.stage='COMPARE';drawPicker()}
  else if(a==='opk-dismiss'){const c=pickerCmd(null),nm=s.characters[Dm.holderOf(s,pk.slotId)].name,r=Dm.command(s,m,c[0],c[1]);if(r.ok){closePicker();toast(r.queued?nm+' 해임을 예약했습니다.':nm+'을(를) 자리에서 물렸습니다.')}else{pk.msg=r.reason;drawPicker()}}
  else if(a==='opk-go'){const c=pickerCmd(pk.sel),ch=s.characters[pk.sel],stale=s.dom.revision!==pk.origin.worldRevision,r=Dm.command(s,m,c[0],c[1]); // 확정 직전에 엔진이 권한·주직·소속을 다시 검증한다
    if(r.ok){const lbl=Dm.slotLabel(s,pk.slotId);closePicker();toast(r.queued?ch.name+' 임명을 예약했습니다. 재개한 다음 주부터 적용됩니다.':ch.name+'을(를) '+lbl+'에 임명했습니다.'+(r.weeks?' '+r.weeks+'주 뒤 도착합니다.':'')+(r.vacated?' '+r.vacated+' 자리는 비었습니다.':''))}
    else{pk.stage='COMPARE';pk.msg=(stale?'그 사이 상황이 바뀌어 다시 확인했습니다. ':'')+r.reason;drawPicker()}}
});
document.addEventListener('input',e=>{const t=e.target,pk=G.picker;
  if(t.id==='apm'&&G.s){Dm.setAutoPause(G.s,t.checked);toast(t.checked?'달이 바뀌면 결산하고 멈춥니다.':'결산 기록은 남기되 멈추지 않습니다.');return}
  if(t.id==='prj-target'){G.prjT=t.value;drawRight();return}
  if(!pk)return;
  if(t.id==='opk-q'){pk.q=t.value;const p=t.selectionStart;drawPicker();const n=$('#opk-q');if(n){n.focus();try{n.setSelectionRange(p,p)}catch(_){}}}
  else if(t.id==='opk-ack'){pk.ack=t.checked;drawPicker();const n=$('#opk-ack');if(n)n.focus()}
});
// 겹창이 떠 있는 동안: Esc는 확인 단계 → 선택 → 닫기 순, Tab은 창 안에서만 돈다
document.addEventListener('keydown',e=>{
  const box=G.picker?$('#modal'):G.review&&!G.reviewHidden?$('#review'):null;if(!box)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();escKey();return}
  if(e.key==='Tab'){const f=[...box.querySelectorAll('button,input,select,a[href],[tabindex="0"]')].filter(x=>x.getAttribute('aria-disabled')!=='true'&&!x.disabled&&x.offsetParent!==null);if(!f.length)return;const i=f.indexOf(document.activeElement);
    if(e.shiftKey&&(i<=0)){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&(i===f.length-1||i<0)){e.preventDefault();f[0].focus()}}
  else if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('tr[data-act="opk-row"]')){e.preventDefault();e.target.click()}
  if(e.code==='Space'&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();e.stopPropagation()}
},true);
