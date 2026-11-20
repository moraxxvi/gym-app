/* ================= Хранение в телефоне ================= */
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
let profile=load("profile",null);   // ответы анкеты + замены упражнений
let logs=load("logs",[]);           // подходы: {ex,w,r,date,ts,sid}
let sessions=load("sessions",[]);   // тренировки: {sid,ts,date,day,dur}
let W=load("workout",null);         // текущая тренировка (переживает перезагрузку)
let tab=W?"workout":"today", libFilter="Все", chartEx=null, summary=null;

const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=n=>(+n).toLocaleString("ru-RU",{maximumFractionDigits:2});
const today=()=>new Date().toLocaleDateString("ru-RU");
const img=(id,n=0)=>`img/${id}-${n}.jpg`;

/* ================= План и цели ================= */
const baseSets=()=>profile.level==="new"?SETS.mass:SETS[profile.goal];
function target(ex){
  const s=ISO[ex]??baseSets(), m=s.match(/(\d+)\s*×\s*(\d+)(?:–(\d+))?/);
  return {s, sets:+m[1], lo:+m[2], hi:+(m[3]??m[2]), sec:s.includes(" с")};
}
const restSec=ex=>ISO[ex]?60:(profile.goal==="strength"&&profile.level!=="new"?150:90);
function days(){
  const sw=profile.swaps??{};
  return progOf(profile).d.map(id=>({id,t:DAYS[id].t,ex:DAYS[id].ex.map((e,i)=>sw[id+":"+i]??e)}));
}
function nextDayIdx(){
  const d=days(), last=sessions[sessions.length-1];
  if(!last||last.dayIdx==null) return 0;
  return (last.dayIdx+1)%d.length;
}

/* Последняя тренировка с этим упражнением */
function lastSets(ex){
  const ls=logs.filter(l=>l.ex===ex&&!(W&&l.sid===W.sid)); if(!ls.length) return null; // текущая тренировка не считается
  const key=l=>l.sid??l.date, k=key(ls[ls.length-1]);
  return ls.filter(l=>key(l)===k);
}
/* Подсказка по весу: двойная прогрессия. Это только совет — вес вводит сам человек */
function suggest(ex){
  const t=target(ex), last=lastSets(ex);
  if(!last) return {w:"",r:"",text:"Первый раз — возьми лёгкий вес и сосредоточься на технике.",prev:""};
  const prev=t.sec?last.map(s=>s.r+" с").join(", "):`${num(last[0].w)} кг × ${last.map(s=>s.r).join(", ")}`;
  if(t.sec) return {w:last[0].w,r:last[0].r,text:"Если было легко — добавь 5–10 секунд.",prev};
  const w=Math.max(...last.map(s=>+s.w));
  const done=last.filter(s=>+s.w>=w&&+s.r>=t.hi).length>=t.sets;
  if(done){const inc=ISO[ex]?1:2.5;return {w:+(w+inc).toFixed(2),r:t.lo,prev,up:true,
    text:`В прошлый раз все подходы по ${t.hi}+ — пора добавить вес: ${num(w+inc)} кг. Начни с ${t.lo} повторов.`};}
  return {w,r:"",prev,text:`Оставь ${num(w)} кг и добивай до ${t.hi} повторов во всех подходах.`};
}

/* ================= Отрисовка ================= */
function render(){
  document.body.classList.toggle("inwork",tab==="workout");
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.tab===tab));
  const v={today:todayView,plan:planView,lib:libView,progress:progressView,guides:guidesView,workout:workoutView}[tab];
  $("#app").innerHTML=(!profile&&["today","plan"].includes(tab))?quizView():v();
  if(tab==="workout") tick();
  window.scrollTo(0,0);
}

/* ---------- Анкета ---------- */
let draft={level:"new",days:3,split:"fb3",goal:"mass",injury:false};
function quizView(){
  const q=(key,label,opts)=>`<h2>${label}</h2><div class="opts">${opts.map(([v,t])=>
    `<button class="opt ${draft[key]===v?"on":""}" onclick="pick('${key}',${typeof v==="string"?`'${v}'`:v})">${t}</button>`).join("")}</div>`;
  return `<div class="hero"><div class="kicker">Добро пожаловать</div><h1>Собери свой план</h1>
    <p class="muted">4 вопроса — и у тебя программа как от тренера.</p></div>
    ${q("level","Какой у тебя опыт?",[["new","Только начинаю"],["back","Возвращаюсь после перерыва"],["stuck","Застрял, хочу сменить программу"]])}
    ${q("days","Сколько раз в неделю можешь ходить?",[[2,"2"],[3,"3"],[4,"4"],[5,"5"],[6,"6"]])}
    ${draft.level==="new"&&draft.days>=5?`<div class="card warn">Новичку обычно хватает 3–4 тренировок: мышцы растут во время отдыха. Но выбор за тобой.</div>`:""}
    <h2>Какая схема?</h2>${PROGRAMS[draft.days].map(p=>`<div class="card pick ${p.id===draft.split?"sel":""}" onclick="pick('split','${p.id}')">
      <h3>${p.t}</h3><div class="muted">${p.about}</div></div>`).join("")}
    ${q("goal","Какая цель?",[["mass","Набрать мышцы"],["strength","Стать сильнее"],["tone","Подтянуть форму"]])}
    ${q("injury","Есть травмы или боли?",[[false,"Нет"],[true,"Да"]])}
    <button class="btn" onclick="makePlan()">Составить план</button>`;
}
function pick(k,v){draft[k]=v;if(k==="days")draft.split=PROGRAMS[v][0].id;render()}
function makePlan(){profile={...draft,swaps:{}};save("profile",profile);tab="today";render()}

/* ---------- Сегодня ---------- */
function weekKey(d){const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()-((t.getDay()+6)%7));return t.getTime()}
function streak(){
  const S=new Set(sessions.map(s=>weekKey(s.ts)));
  let d=new Date(); if(!S.has(weekKey(d))) d.setDate(d.getDate()-7);
  let n=0; while(S.has(weekKey(d))){n++;d.setDate(d.getDate()-7)} return n;
}
const thisWeek=()=>sessions.filter(s=>weekKey(s.ts)===weekKey(Date.now())).length;
let pickDay=null;
function todayView(){
  const d=days(), i=pickDay??nextDayIdx(), day=d[i];
  const date=new Date().toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});
  return `${profile.injury?`<div class="card warn">Раз есть травмы или боли — перед началом покажись врачу. Если упражнение вызывает боль, пропусти его.</div>`:""}
  <div class="hero"><div class="kicker">${date}</div><h1>День ${i+1}: ${day.t}</h1></div>
  <div class="stats"><div class="stat"><div class="muted">Серия</div><b class="acc">${streak()} нед</b></div>
    <div class="stat"><div class="muted">На этой неделе</div><b>${thisWeek()} / ${profile.days}</b></div></div>
  <div class="list">${day.ex.map(e=>{const t=target(e),s=suggest(e);return `<div class="ex" onclick="openEx('${e}')">
    <img src="${img(e)}" alt="" loading="lazy"><div class="grow"><div class="name">${EX[e].n}</div>
    <div class="muted small">${s.prev?"прошлый: "+s.prev:"ещё не делал"}</div></div><span class="tag">${t.s}</span></div>`}).join("")}</div>
  <button class="btn big" onclick="startWorkout(${i})">Начать тренировку</button>
  <details class="other"><summary>Выбрать другой день</summary><div class="opts">${d.map((x,j)=>
    `<button class="opt ${j===i?"on":""}" onclick="pickDay=${j};render()">День ${j+1}: ${x.t}</button>`).join("")}</div></details>
  <div class="card muted small">Перед тренировкой: 5–10 мин кардио + 1–2 лёгких разминочных подхода в первом упражнении.</div>`;
}

/* ---------- План ---------- */
function planView(){
  const p=progOf(profile);
  const tips={new:"Первые 2–4 недели бери лёгкий вес и учи технику.",
    back:"Первые 2 недели делай на 1 подход меньше и бери ~60% от прежних весов. Мышцы вспомнят быстро, связки — медленнее.",
    stuck:"Новая схема — уже стимул. Записывай каждый подход, и приложение подскажет, когда добавлять вес."};
  return `<div class="hero"><div class="kicker">${profile.days} раза в неделю</div><h1>${p.t}</h1><p class="muted">${p.about}</p></div>
  <div class="card small">Подходы × повторы: <b class="acc">${baseSets()}</b> в базовых. ${tips[profile.level]}</div>
  ${days().map((d,i)=>`<h2>День ${i+1} — ${d.t}</h2><div class="list">${d.ex.map((e,j)=>`<div class="ex" onclick="openEx('${e}','${d.id}:${j}')">
    <img src="${img(e)}" alt="" loading="lazy"><div class="grow"><div class="name">${EX[e].n}</div>
    ${profile.swaps?.[d.id+":"+j]?`<div class="small acc">заменено</div>`:""}</div><span class="tag">${target(e).s}</span></div>`).join("")}</div>`).join("")}
  <button class="btn ghost" onclick="if(confirm('Пройти анкету заново? Дневник и прогресс сохранятся.')){profile=null;save('profile',null);render()}">Пройти анкету заново</button>
  <p class="muted small">Это общий план, не замена тренеру или врачу.</p>`;
}

/* ---------- Библиотека ---------- */
function libView(){
  const g=GROUPS[libFilter];
  const list=Object.keys(EX).filter(id=>!g||MG[id].some(m=>g.includes(m)));
  return `<div class="hero"><h1>Упражнения</h1></div>
  <div class="opts scroll">${["Все",...Object.keys(GROUPS)].map(f=>`<button class="opt ${f===libFilter?"on":""}" onclick="libFilter='${f}';render()">${f}</button>`).join("")}</div>
  <div class="list">${list.map(id=>`<div class="ex" onclick="openEx('${id}')"><img src="${img(id)}" alt="" loading="lazy">
    <div class="grow"><div class="name">${EX[id].n}</div><div class="muted small">${EX[id].m}</div></div><span class="tag">›</span></div>`).join("")}</div>`;
}

/* ---------- Карточка упражнения ---------- */
function openEx(id,slot){
  const e=EX[id], hist=[...new Set(logs.filter(l=>l.ex===id).map(l=>l.sid??l.date))].slice(-5).reverse();
  const orig=slot?DAYS[slot.split(":")[0]].ex[+slot.split(":")[1]]:null;
  $("#dlg").innerHTML=`<button class="x" onclick="$('#dlg').close()" aria-label="Закрыть">✕</button>
    <h2 style="margin-top:0">${e.n}</h2><div class="muted">${e.m}</div>
    <div class="pics"><figure><img src="${img(id,0)}" alt=""><figcaption>начало</figcaption></figure>
      <figure><img src="${img(id,1)}" alt=""><figcaption>конец</figcaption></figure></div>
    ${muscleMap(MG[id])}
    <h3>Как делать</h3><ul>${e.cues.map(c=>`<li>${c}</li>`).join("")}</ul>
    <h3 class="acc">Частые ошибки</h3><ul>${e.err.map(c=>`<li>${c}</li>`).join("")}</ul>
    ${ALT[id].length||orig?`<h3>Тренажёр занят? Замени на</h3><div class="opts">${ALT[id].map(a=>slot
      ?`<button class="opt" onclick="swapEx('${slot}','${a}')">${EX[a].n}</button>`
      :`<button class="opt" onclick="openEx('${a}')">${EX[a].n}</button>`).join("")}
      ${slot&&orig!==id?`<button class="opt" onclick="swapEx('${slot}',null)">Вернуть: ${EX[orig].n}</button>`:""}</div>`:""}
    ${hist.length?`<h3>История</h3>${hist.map(k=>{const ls=logs.filter(l=>l.ex===id&&(l.sid??l.date)===k);
      return `<div class="muted small">${ls[0].date}: ${ls.map(l=>target(id).sec?l.r+" с":num(l.w)+"×"+l.r).join(", ")}</div>`}).join("")}`:""}
    <p class="muted small">Фото: Free Exercise DB (public domain)</p>`;
  if(!$("#dlg").open)$("#dlg").showModal();
  $("#dlg").scrollTop=0;
}
function swapEx(slot,to){
  profile.swaps=profile.swaps??{};
  if(to) profile.swaps[slot]=to; else delete profile.swaps[slot];
  save("profile",profile);
  if(W){const d=days()[W.dayIdx];W.ex=d.ex;save("workout",W)}
  $("#dlg").close();render();
}

/* ================= Режим тренировки ================= */
let audio;
function beep(){
  try{navigator.vibrate?.([300,150,300])}catch{}
  try{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=880;o.connect(g);g.connect(audio.destination);
    g.gain.setValueAtTime(.3,audio.currentTime);o.start();o.stop(audio.currentTime+.5)}catch{}
}
function startWorkout(i){
  try{audio=audio??new (window.AudioContext||window.webkitAudioContext)()}catch{}
  W={dayIdx:i,ex:days()[i].ex,i:0,set:1,sid:"s"+Date.now(),start:Date.now(),restUntil:null};
  save("workout",W);pickDay=null;tab="workout";render();
}
function workoutView(){
  if(summary) return summaryView();
  const ex=W.ex[W.i], t=target(ex), s=suggest(ex), d=days()[W.dayIdx];
  const done=logs.filter(l=>l.sid===W.sid&&l.ex===ex);
  const bar=`<div class="wbar"><span>${d.t} · ${W.i+1}/${W.ex.length}</span><button class="link" onclick="endWorkout()">Завершить</button></div>
    <div class="prog"><i style="width:${Math.round(W.i/W.ex.length*100)}%"></i></div>`;
  if(W.restUntil){
    return `${bar}<div class="rest"><div class="kicker">Отдых</div><div id="cd" class="cd">--:--</div>
      <div class="muted">Дальше: подход ${W.set} из ${t.sets} — ${EX[ex].n}</div>
      <div class="row"><button class="btn ghost" onclick="W.restUntil+=30000;save('workout',W);tick()">+30 с</button>
      <button class="btn" onclick="W.restUntil=null;save('workout',W);render()">Поехали</button></div></div>`;
  }
  return `${bar}<div class="pics wk"><img src="${img(ex,0)}" alt=""><img src="${img(ex,1)}" alt=""></div>
    <h1 class="wname">${EX[ex].n}</h1>
    <div class="setinfo"><b class="acc">Подход ${W.set} из ${t.sets}</b><span>цель: ${t.lo===t.hi?t.lo:t.lo+"–"+t.hi}${t.sec?" с":" повт."}</span></div>
    <div class="card small ${s.up?"up":""}">${s.prev?`Прошлый раз: <b>${s.prev}</b><br>`:""}${s.text}</div>
    ${done.length?`<div class="muted small">Сегодня: ${done.map(l=>t.sec?l.r+" с":num(l.w)+"×"+l.r).join(", ")}</div>`:""}
    <div class="row inputs">${t.sec?"":`<label>Вес, кг<input id="w" type="number" inputmode="decimal" step="0.5" value="${done.length?done[done.length-1].w:s.w}"></label>`}
      <label>${t.sec?"Секунд":"Повторы"}<input id="r" type="number" inputmode="numeric" value="${s.r||""}"></label></div>
    <div id="err" class="err"></div>
    <button class="btn big" onclick="doneSet()">Подход сделан</button>
    <div class="row links"><button class="link" onclick="openEx('${ex}','${d.id}:${W.i}')">Техника и замена</button>
      <button class="link" onclick="nextEx()">Пропустить упражнение</button></div>`;
}
function doneSet(){
  const ex=W.ex[W.i], t=target(ex);
  const w=t.sec?0:parseFloat(String($("#w").value).replace(",",".")), r=parseInt($("#r").value);
  if(!t.sec&&!(w>=0)) return $("#err").textContent="Введи вес (0, если без веса)";
  if(!(r>0)) return $("#err").textContent=t.sec?"Введи, сколько секунд держал":"Введи количество повторов";
  logs.push({ex,w,r,date:today(),ts:Date.now(),sid:W.sid});save("logs",logs);
  if(W.set<t.sets){W.set++;W.restUntil=Date.now()+restSec(ex)*1000}
  else if(W.i<W.ex.length-1){W.i++;W.set=1;W.restUntil=Date.now()+restSec(ex)*1000}
  else return finish();
  save("workout",W);render();
}
function nextEx(){if(W.i<W.ex.length-1){W.i++;W.set=1;W.restUntil=null;save("workout",W);render()}else endWorkout()}
function endWorkout(){
  const n=logs.filter(l=>l.sid===W.sid).length;
  if(!n){if(confirm("Ни одного подхода не записано. Отменить тренировку?")){W=null;save("workout",null);tab="today";render()}return}
  if(confirm("Завершить тренировку?")) finish();
}
function finish(){
  const ls=logs.filter(l=>l.sid===W.sid), d=days()[W.dayIdx];
  const s={sid:W.sid,ts:W.start,date:today(),day:d.t,dayIdx:W.dayIdx,dur:Math.round((Date.now()-W.start)/60000)};
  sessions.push(s);save("sessions",sessions);
  W=null;save("workout",null);
  summary={...s,sets:ls.length,ton:ls.reduce((a,l)=>a+l.w*l.r,0),ups:[...new Set(ls.map(l=>l.ex))].filter(e=>suggest(e).up).length};
  render();
}
function summaryView(){
  const s=summary;
  return `<div class="rest"><div class="kicker">Тренировка завершена</div><h1>Красава 🔥</h1>
    <div class="stats"><div class="stat"><div class="muted">Подходов</div><b>${s.sets}</b></div>
      <div class="stat"><div class="muted">Минут</div><b>${s.dur}</b></div>
      <div class="stat"><div class="muted">Тоннаж</div><b>${num(Math.round(s.ton))} кг</b></div></div>
    ${s.ups?`<div class="card up small">В ${s.ups} упр. ты выполнил цель — в следующий раз приложение предложит добавить вес.</div>`:""}
    <button class="btn big" onclick="summary=null;tab='today';render()">Готово</button></div>`;
}
let timer;
function tick(){
  clearInterval(timer);
  if(!W||!W.restUntil) return;
  const upd=()=>{const left=Math.max(0,Math.ceil((W.restUntil-Date.now())/1000));
    const el=$("#cd"); if(el) el.textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}`;
    if(left<=0){clearInterval(timer);beep();W.restUntil=null;save("workout",W);render()}};
  upd();timer=setInterval(upd,250);
}

/* ---------- Прогресс ---------- */
function progressView(){
  const now=new Date(), y=now.getFullYear(), mo=now.getMonth();
  const daysIn=new Date(y,mo+1,0).getDate(), off=(new Date(y,mo,1).getDay()+6)%7;
  const trained=new Set(sessions.filter(s=>{const d=new Date(s.ts);return d.getFullYear()===y&&d.getMonth()===mo}).map(s=>new Date(s.ts).getDate()));
  const cal=`<div class="cal">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d=>`<span class="muted">${d}</span>`).join("")}
    ${"<span></span>".repeat(off)}${Array.from({length:daysIn},(_,i)=>`<span class="${trained.has(i+1)?"on":""} ${i+1===now.getDate()?"now":""}">${i+1}</span>`).join("")}</div>`;
  const used=[...new Set(logs.map(l=>l.ex))].filter(e=>EX[e]);
  if(!chartEx||!used.includes(chartEx)) chartEx=used[0]??null;
  return `<div class="hero"><h1>Прогресс</h1></div>
  <div class="stats"><div class="stat"><div class="muted">Тренировок</div><b>${sessions.length}</b></div>
    <div class="stat"><div class="muted">Серия</div><b class="acc">${streak()} нед</b></div>
    <div class="stat"><div class="muted">В этом месяце</div><b>${trained.size}</b></div></div>
  <h2>${now.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</h2>${cal}
  <h2>Рост по упражнению</h2>
  ${used.length?`<select onchange="chartEx=this.value;render()">${used.map(e=>`<option value="${e}" ${e===chartEx?"selected":""}>${EX[e].n}</option>`).join("")}</select>${chart(chartEx)}`
    :`<div class="card muted">Начни первую тренировку — здесь появится график.</div>`}
  ${sessions.length?`<h2>Последние тренировки</h2><div class="list">${[...sessions].reverse().slice(0,10).map(s=>
    `<div class="ex"><div class="grow"><div class="name">${esc(s.day)}</div><div class="muted small">${s.date} · ${s.dur} мин</div></div></div>`).join("")}</div>`:""}`;
}
function chart(ex){
  const sec=target(ex).sec, by={};
  logs.filter(l=>l.ex===ex).forEach(l=>{const k=l.sid??l.date,v=sec?+l.r:+l.w;if(!by[k]||v>by[k].v)by[k]={v,d:l.date}});
  const pts=Object.values(by).slice(-12);
  if(pts.length<2) return `<div class="card muted small">Нужно минимум 2 тренировки с этим упражнением. Сейчас: ${pts.length?num(pts[0].v)+(sec?" с":" кг"):"—"}</div>`;
  const vs=pts.map(p=>p.v), mn=Math.min(...vs), mx=Math.max(...vs), H=140, Wd=320, pad=24;
  const X=i=>pad+i*(Wd-2*pad)/(pts.length-1), Y=v=>mx===mn?H/2:H-pad-(v-mn)/(mx-mn)*(H-2*pad);
  return `<div class="card"><svg viewBox="0 0 ${Wd} ${H}" class="chart">
    <polyline fill="none" stroke="#ff5a1f" stroke-width="3" points="${pts.map((p,i)=>X(i)+","+Y(p.v)).join(" ")}"/>
    ${pts.map((p,i)=>`<circle cx="${X(i)}" cy="${Y(p.v)}" r="4" fill="#ff5a1f"/>`).join("")}
    <text x="${X(0)}" y="${H-4}" text-anchor="start">${pts[0].d}</text><text x="${X(pts.length-1)}" y="${H-4}" text-anchor="end">${pts[pts.length-1].d}</text>
    <text x="${X(pts.length-1)}" y="${Y(pts[pts.length-1].v)-10}" text-anchor="end" class="hi">${num(pts[pts.length-1].v)}${sec?" с":" кг"}</text></svg>
    <div class="muted small">Лучший результат за тренировку. Было ${num(pts[0].v)}, стало ${num(vs[vs.length-1])}${sec?" с":" кг"}.</div></div>`;
}

/* ---------- Гайды ---------- */
function guidesView(){
  return `<div class="hero"><h1>Гайды</h1><p class="muted">Коротко о том, что важно знать новичку.</p></div>
  ${GUIDES.map(g=>`<details class="card guide"><summary>${g.t}</summary><ul>${g.b.map(x=>`<li>${x}</li>`).join("")}</ul></details>`).join("")}`;
}

/* ================= Запуск ================= */
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&tab==="workout")tick()});
render();
if("serviceWorker" in navigator&&location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
