/* ================= Хранение в телефоне ================= */
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
let profile=load("profile",null);   // анкета + замены + выбранная своя программа
let logs=load("logs",[]);           // подходы: {ex,w,r,sec,date,ts,sid}
let sessions=load("sessions",[]);   // тренировки: {sid,ts,date,day,dayIdx,prog,dur}
let myProgs=load("myprogs",{});     // свои программы: {id:{name,days:[{t,ex:[{id,sets,lo,hi,sec}]}]}}
let myEx=load("myex",{});           // свои упражнения: {id:{n,m,cues,err}}
let W=load("workout",null);         // текущая тренировка (переживает перезагрузку)
let tab=W?"workout":"today", libFilter="Все", chartEx=null, summary=null, planMode="cur", ED=null, pickDi=0;

const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=n=>(+n).toLocaleString("ru-RU",{maximumFractionDigits:2});
const today=()=>new Date().toLocaleDateString("ru-RU");
const X=id=>EX[id]??myEx[id]??{n:"Удалённое упражнение",m:"",cues:[],err:[]};   // любое упражнение по id
const img=(id,n=0)=>EX[id]?`img/${id}-${n}.jpg`:"icon.svg";
const nm=id=>esc(X(id).n);

/* ================= Цели (подходы × повторы) ================= */
const baseSets=()=>profile?.level==="new"?SETS.mass:SETS[profile?.goal??"mass"];
const tstr=t=>`${t.sets} × ${t.lo===t.hi?t.lo:t.lo+"–"+t.hi}${t.sec?" с":""}`;
function target(ex){
  const s=ISO[ex]??baseSets(), m=s.match(/(\d+)\s*×\s*(\d+)(?:–(\d+))?/);
  const t={sets:+m[1],lo:+m[2],hi:+(m[3]??m[2]),sec:s.includes(" с")}; t.s=tstr(t); return t;
}
const mkT=c=>{const t={sets:+c.sets,lo:+c.lo,hi:+c.hi,sec:!!c.sec};t.s=tstr(t);return t};
const restSec=(ex,t)=>(ISO[ex]||t.sec)?60:(profile.goal==="strength"&&profile.level!=="new"?150:90);

/* ================= Текущая программа ================= */
const progKey=()=>profile.custom&&myProgs[profile.custom]?profile.custom:profile.split;
function curProg(){
  const c=profile.custom&&myProgs[profile.custom];
  if(c) return {custom:true,t:c.name,about:"Твоя программа",days:c.days.map(d=>({t:d.t,ex:d.ex.map(e=>e.id),tg:d.ex.map(mkT)}))};
  const p=progOf(profile);
  return {t:p.t,about:p.about,days:p.d.map(id=>({t:DAYS[id].t,ex:[...DAYS[id].ex],tg:DAYS[id].ex.map(target)}))};
}
const slotKey=(di,ei)=>progKey()+"|"+di+"|"+ei;
function days(){   // дни с учётом замен «тренажёр занят»
  const p=curProg(), sw=profile.swaps??{};
  return p.days.map((d,di)=>{const ex=d.ex.map((e,ei)=>sw[slotKey(di,ei)]??e);
    return {...d,orig:d.ex,ex,tg:ex.map((e,ei)=>p.custom||e===d.ex[ei]?d.tg[ei]:target(e))}});
}
function nextDayIdx(){
  const d=days(), last=[...sessions].reverse().find(s=>s.prog===progKey());
  return last?(last.dayIdx+1)%d.length:0;
}

/* Последняя тренировка с этим упражнением (текущая не считается) */
function lastSets(ex){
  const ls=logs.filter(l=>l.ex===ex&&!(W&&l.sid===W.sid)); if(!ls.length) return null;
  const key=l=>l.sid??l.date, k=key(ls[ls.length-1]);
  return ls.filter(l=>key(l)===k);
}
/* Подсказка по весу: двойная прогрессия. Только совет — вес вводит сам человек */
function suggest(ex,t){
  const last=lastSets(ex);
  if(!last) return {w:"",r:"",text:"Первый раз — возьми лёгкий вес и сосредоточься на технике.",prev:""};
  const sec=last[0].sec??t.sec;
  const prev=sec?last.map(s=>s.r+" с").join(", "):`${num(last[0].w)} кг × ${last.map(s=>s.r).join(", ")}`;
  if(t.sec) return {w:last[0].w,r:last[0].r,text:"Если было легко — добавь 5–10 секунд.",prev};
  const w=Math.max(...last.map(s=>+s.w));
  const done=last.filter(s=>+s.w>=w&&+s.r>=t.hi).length>=t.sets;
  if(done&&w>0){const inc=ISO[ex]?1:2.5;return {w:+(w+inc).toFixed(2),r:t.lo,prev,up:true,
    text:`В прошлый раз все подходы по ${t.hi}+ — пора добавить вес: ${num(w+inc)} кг. Начни с ${t.lo} повторов.`};}
  if(done) return {w,r:"",prev,up:true,text:`Цель выполнена! Добавь повторы или возьми вес.`};
  return {w,r:"",prev,text:`Оставь ${num(w)} кг и добивай до ${t.hi} повторов во всех подходах.`};
}

/* ================= Отрисовка ================= */
function render(){
  if(tab==="workout"&&!W&&!summary) tab="today";
  document.body.classList.toggle("inwork",tab==="workout");
  const nt=tab==="edit"?"plan":tab;
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.tab===nt));
  const v={today:todayView,plan:planView,lib:libView,progress:progressView,guides:guidesView,workout:workoutView,edit:editView}[tab];
  $("#app").innerHTML=(!profile&&["today","plan"].includes(tab))?quizView():v();
  if(tab==="workout") tick();
  window.scrollTo(0,0);
}
const exRow=(e,right,click,sub="")=>`<div class="ex" onclick="${click}"><img src="${img(e)}" alt="" loading="lazy">
  <div class="grow"><div class="name">${nm(e)}</div>${sub}</div><span class="tag">${right}</span></div>`;

/* ---------- Анкета ---------- */
let draft={level:"new",days:3,split:"fb3",goal:"mass",injury:false};
function quizView(){
  const q=(key,label,opts)=>`<h2>${label}</h2><div class="opts">${opts.map(([v,t])=>
    `<button class="opt ${draft[key]===v?"on":""}" onclick="pick('${key}',${typeof v==="string"?`'${v}'`:v})">${t}</button>`).join("")}</div>`;
  return `<div class="hero"><div class="kicker">Добро пожаловать</div><h1>Собери свой план</h1>
    <p class="muted">5 вопросов — и у тебя программа как от тренера.</p></div>
    <button class="btn ghost" onclick="ownStart()">У меня своя программа →</button>
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
function ownStart(){profile={...draft,level:"stuck",swaps:{}};save("profile",profile);newProg()}

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
  const d=days(); if(pickDay>=d.length) pickDay=null;
  const i=pickDay??nextDayIdx(), day=d[i];
  const date=new Date().toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});
  return `${profile.injury?`<div class="card warn">Раз есть травмы или боли — перед началом покажись врачу. Если упражнение вызывает боль, пропусти его.</div>`:""}
  <div class="hero"><div class="kicker">${date}</div><h1>День ${i+1}: ${esc(day.t)}</h1>
    <div class="muted small">${esc(curProg().t)}</div></div>
  <div class="stats"><div class="stat"><div class="muted">Серия</div><b class="acc">${streak()} нед</b></div>
    <div class="stat"><div class="muted">На этой неделе</div><b>${thisWeek()} / ${d.length}</b></div></div>
  <div class="list">${day.ex.map((e,j)=>{const t=day.tg[j],s=suggest(e,t);
    return exRow(e,t.s,`openEx('${e}',${i},${j})`,`<div class="muted small">${s.prev?"прошлый: "+s.prev:"ещё не делал"}</div>`)}).join("")}</div>
  <button class="btn big" onclick="startWorkout(${i})">Начать тренировку</button>
  ${d.length>1?`<details class="other"><summary>Выбрать другой день</summary><div class="opts">${d.map((x,j)=>
    `<button class="opt ${j===i?"on":""}" onclick="pickDay=${j};render()">День ${j+1}: ${esc(x.t)}</button>`).join("")}</div></details>`:""}
  <div class="card muted small">Перед тренировкой: 5–10 мин кардио + 1–2 лёгких разминочных подхода в первом упражнении.</div>`;
}

/* ---------- План ---------- */
function planView(){
  const seg=`<div class="seg"><button class="${planMode==="cur"?"on":""}" onclick="planMode='cur';render()">Текущая</button>
    <button class="${planMode==="mine"?"on":""}" onclick="planMode='mine';render()">Мои программы</button></div>`;
  return seg+(planMode==="mine"?mineView():curView());
}
function curView(){
  const p=curProg();
  const tips={new:"Первые 2–4 недели бери лёгкий вес и учи технику.",
    back:"Первые 2 недели делай на 1 подход меньше и бери ~60% от прежних весов. Мышцы вспомнят быстро, связки — медленнее.",
    stuck:"Записывай каждый подход — приложение подскажет, когда добавлять вес."};
  return `<div class="hero"><div class="kicker">${p.days.length} дн. в неделю${p.custom?" · своя":""}</div><h1>${esc(p.t)}</h1><p class="muted">${esc(p.about)}</p></div>
  ${p.custom?"":`<div class="card small">Подходы × повторы: <b class="acc">${baseSets()}</b> в базовых. ${tips[profile.level]}</div>`}
  ${days().map((d,i)=>`<h2>День ${i+1} — ${esc(d.t)}</h2><div class="list">${d.ex.map((e,j)=>
    exRow(e,d.tg[j].s,`openEx('${e}',${i},${j})`,e!==d.orig[j]?`<div class="small acc">заменено</div>`:"")).join("")}</div>`).join("")}
  ${p.custom?`<button class="btn" onclick="editProg('${profile.custom}')">Редактировать программу</button>
    <button class="btn ghost" onclick="useProg(null)">Вернуться к программе из анкеты</button>`
   :`<button class="btn" onclick="copyProg()">Изменить под себя</button>
    <button class="btn ghost" onclick="if(confirm('Пройти анкету заново? Дневник и прогресс сохранятся.')){profile=null;save('profile',null);render()}">Пройти анкету заново</button>`}
  <p class="muted small">Это общий план, не замена тренеру или врачу.</p>`;
}
function mineView(){
  const ids=Object.keys(myProgs);
  return `<div class="hero"><h1>Мои программы</h1><p class="muted">Собери свою программу или переделай нашу.</p></div>
  ${ids.map(id=>{const p=myProgs[id],on=profile.custom===id;return `<div class="card ${on?"sel":""}"><h3>${esc(p.name)}</h3>
    <div class="muted small">${p.days.length} дн. · ${p.days.reduce((a,d)=>a+d.ex.length,0)} упражнений${on?" · <span class='acc'>сейчас используешь</span>":""}</div>
    <div class="row" style="margin-top:10px">${on?"":`<button class="opt on" onclick="useProg('${id}')">Использовать</button>`}
      <button class="opt" onclick="editProg('${id}')">Изменить</button></div></div>`}).join("")}
  ${ids.length?"":`<div class="card muted">Пока нет своих программ.</div>`}
  <button class="btn" onclick="newProg()">+ Создать программу</button>
  <button class="btn ghost" onclick="copyProg()">Скопировать текущую и изменить</button>`;
}
function useProg(id){profile.custom=id;save("profile",profile);pickDay=null;planMode="cur";tab="plan";render()}

/* ---------- Конструктор программы ---------- */
const cfgOf=t=>({sets:t.sets,lo:t.lo,hi:t.hi,sec:t.sec});
function newProg(){ED={id:null,name:"",days:[{t:"День 1",ex:[]}]};tab="edit";render()}
function copyProg(){const p=curProg();
  ED={id:null,name:p.t+" (моя)",days:days().map(d=>({t:d.t,ex:d.ex.map((e,j)=>({id:e,...cfgOf(d.tg[j])}))}))};tab="edit";render()}
function editProg(id){ED=JSON.parse(JSON.stringify({id,...myProgs[id]}));tab="edit";render()}
function editView(){
  return `<div class="hero"><div class="kicker">${ED.id?"Редактирование":"Новая программа"}</div><h1>Конструктор</h1></div>
  <label class="lbl">Название<input class="txt" value="${esc(ED.name)}" placeholder="Например: Мой сплит" oninput="ED.name=this.value"></label>
  ${ED.days.map((d,di)=>`<div class="card eday">
    <div class="row"><input class="txt" value="${esc(d.t)}" oninput="ED.days[${di}].t=this.value" aria-label="Название дня">
      <button class="ib" onclick="edDelDay(${di})" aria-label="Удалить день">✕</button></div>
    ${d.ex.map((e,ei)=>`<div class="erow"><div class="ename">${nm(e.id)}</div>
      <div class="ectl"><input type="number" inputmode="numeric" value="${e.sets}" oninput="edNum(${di},${ei},'sets',this.value)" aria-label="Подходы">
        <span>×</span><input type="number" inputmode="numeric" value="${e.lo}" oninput="edNum(${di},${ei},'lo',this.value)" aria-label="Повторы от">
        <span>–</span><input type="number" inputmode="numeric" value="${e.hi}" oninput="edNum(${di},${ei},'hi',this.value)" aria-label="Повторы до">
        <button class="unit" onclick="ED.days[${di}].ex[${ei}].sec=!ED.days[${di}].ex[${ei}].sec;render()">${e.sec?"сек":"повт"}</button>
        <button class="ib" onclick="edMove(${di},${ei},-1)" aria-label="Выше">↑</button>
        <button class="ib" onclick="edMove(${di},${ei},1)" aria-label="Ниже">↓</button>
        <button class="ib" onclick="ED.days[${di}].ex.splice(${ei},1);render()" aria-label="Удалить">✕</button></div></div>`).join("")}
    <button class="opt" style="margin-top:10px" onclick="openPicker(${di})">+ Упражнение</button></div>`).join("")}
  <button class="btn ghost" onclick="ED.days.push({t:'День '+(ED.days.length+1),ex:[]});render()">+ Добавить день</button>
  <div id="err" class="err"></div>
  <button class="btn big" onclick="edSave()">Сохранить и использовать</button>
  <div class="row links"><button class="link" onclick="ED=null;tab='plan';render()">Отмена</button>
    ${ED.id?`<button class="link" onclick="edDelete()">Удалить программу</button>`:""}</div>`;
}
function edNum(di,ei,f,v){ED.days[di].ex[ei][f]=v}
function edMove(di,ei,dir){const a=ED.days[di].ex,j=ei+dir;if(j<0||j>=a.length)return;[a[ei],a[j]]=[a[j],a[ei]];render()}
function edDelDay(di){if(ED.days.length===1)return alert("Должен остаться хотя бы один день");
  if(!ED.days[di].ex.length||confirm("Удалить день «"+ED.days[di].t+"»?")){ED.days.splice(di,1);render()}}
function edSave(){
  const err=m=>{$("#err").textContent=m;$("#err").scrollIntoView({block:"center"})};
  ED.name=ED.name.trim(); if(!ED.name) return err("Придумай название программы");
  for(const [i,d] of ED.days.entries()){
    d.t=d.t.trim()||"День "+(i+1);
    if(!d.ex.length) return err(`В дне «${d.t}» нет упражнений`);
    for(const e of d.ex){
      e.sets=+e.sets;e.lo=+e.lo;e.hi=+e.hi;
      if(!(e.sets>=1&&e.sets<=10&&Number.isInteger(e.sets))) return err(`${X(e.id).n}: подходов должно быть от 1 до 10`);
      if(!(e.lo>=1&&e.hi>=e.lo&&e.hi<=(e.sec?600:100))) return err(`${X(e.id).n}: проверь повторы (от меньшего к большему)`);
    }
  }
  const id=ED.id??"p"+Date.now(); const {id:_,...data}=ED;
  if(ED.id&&profile.swaps) for(const k in profile.swaps) if(k.startsWith(id+"|")) delete profile.swaps[k]; // программа изменилась — старые замены сбрасываем
  myProgs[id]=data;save("myprogs",myProgs);ED=null;useProg(id);
}
function edDelete(){if(!confirm("Удалить программу «"+ED.name+"»? Дневник и прогресс сохранятся."))return;
  delete myProgs[ED.id];save("myprogs",myProgs);if(profile.custom===ED.id)profile.custom=null;save("profile",profile);
  ED=null;planMode="mine";tab="plan";render()}

/* Выбор упражнения для конструктора */
let pq="",pg="Все";
function openPicker(di){pickDi=di;pq="";pg="Все";drawPicker();$("#dlg").showModal()}
function drawPicker(){
  const g=GROUPS[pg], q=pq.trim().toLowerCase();
  const all=[...Object.keys(EX),...Object.keys(myEx)].filter(id=>(!g||(MG[id]??[]).some(m=>g.includes(m)))&&(!q||X(id).n.toLowerCase().includes(q)));
  $("#dlg").innerHTML=`<button class="x" onclick="$('#dlg').close()" aria-label="Закрыть">✕</button>
    <h2 style="margin-top:0">Добавить упражнение</h2>
    <input class="txt" id="pqi" placeholder="Поиск: жим, тяга, присед…" value="${esc(pq)}" oninput="pq=this.value;drawPicker();const i=$('#pqi');i.focus();i.setSelectionRange(i.value.length,i.value.length)">
    <div class="opts scroll">${["Все",...Object.keys(GROUPS)].map(f=>`<button class="opt ${f===pg?"on":""}" onclick="pg='${f}';drawPicker()">${f}</button>`).join("")}</div>
    <div class="list">${all.map(id=>exRow(id,"+",`pickerAdd('${id}')`,`<div class="muted small">${esc(X(id).m)}</div>`)).join("")||`<div class="ex muted">Ничего не нашлось</div>`}</div>
    <h3>Нет в списке? Добавь своё</h3>
    <div class="row"><input class="txt" id="own" placeholder="Название упражнения"><button class="opt on" style="flex:none" onclick="addOwnEx()">Добавить</button></div>`;
}
function pickerAdd(id){const t=EX[id]?target(id):mkT({sets:3,lo:8,hi:12});ED.days[pickDi].ex.push({id,...cfgOf(t)});$("#dlg").close();render()}
function addOwnEx(){const n=$("#own").value.trim(); if(!n) return $("#own").focus();
  const id="u"+Date.now(); myEx[id]={n,m:"Своё упражнение",cues:[],err:[]}; save("myex",myEx); pickerAdd(id)}

/* ---------- Библиотека ---------- */
function libView(){
  const g=GROUPS[libFilter];
  const list=[...Object.keys(EX),...(g?[]:Object.keys(myEx))].filter(id=>!g||(MG[id]??[]).some(m=>g.includes(m)));
  return `<div class="hero"><h1>Упражнения</h1><p class="muted small">${Object.keys(EX).length} упражнений с фото и техникой</p></div>
  <div class="opts scroll">${["Все",...Object.keys(GROUPS)].map(f=>`<button class="opt ${f===libFilter?"on":""}" onclick="libFilter='${f}';render()">${f}</button>`).join("")}</div>
  <div class="list">${list.map(id=>exRow(id,"›",`openEx('${id}')`,`<div class="muted small">${esc(X(id).m)}</div>`)).join("")}</div>`;
}

/* ---------- Карточка упражнения ---------- */
function openEx(id,di,ei){
  const e=X(id), slot=di!=null, hist=[...new Set(logs.filter(l=>l.ex===id).map(l=>l.sid??l.date))].slice(-5).reverse();
  const orig=slot?days()[di].orig[ei]:null, alts=ALT[id]??[];
  $("#dlg").innerHTML=`<button class="x" onclick="$('#dlg').close()" aria-label="Закрыть">✕</button>
    <h2 style="margin-top:0">${esc(e.n)}</h2><div class="muted">${esc(e.m)}</div>
    ${EX[id]?`<div class="pics"><figure><img src="${img(id,0)}" alt=""><figcaption>начало</figcaption></figure>
      <figure><img src="${img(id,1)}" alt=""><figcaption>конец</figcaption></figure></div>${muscleMap(MG[id]??[])}`:""}
    ${e.cues.length?`<h3>Как делать</h3><ul>${e.cues.map(c=>`<li>${c}</li>`).join("")}</ul>`:""}
    ${e.err.length?`<h3 class="acc">Частые ошибки</h3><ul>${e.err.map(c=>`<li>${c}</li>`).join("")}</ul>`:""}
    ${alts.length||(slot&&orig!==id)?`<h3>${slot?"Тренажёр занят? Замени на":"Похожие упражнения"}</h3><div class="opts">${alts.map(a=>slot
      ?`<button class="opt" onclick="swapEx(${di},${ei},'${a}')">${nm(a)}</button>`
      :`<button class="opt" onclick="openEx('${a}')">${nm(a)}</button>`).join("")}
      ${slot&&orig!==id?`<button class="opt on" onclick="swapEx(${di},${ei},null)">Вернуть: ${nm(orig)}</button>`:""}</div>`:""}
    ${hist.length?`<h3>История</h3>${hist.map(k=>{const ls=logs.filter(l=>l.ex===id&&(l.sid??l.date)===k);
      return `<div class="muted small">${ls[0].date}: ${ls.map(l=>(l.sec??target(id).sec)?l.r+" с":num(l.w)+"×"+l.r).join(", ")}</div>`}).join("")}`:""}
    ${EX[id]?`<p class="muted small">Фото: Free Exercise DB (public domain)</p>`:""}`;
  if(!$("#dlg").open)$("#dlg").showModal();
  $("#dlg").scrollTop=0;
}
function swapEx(di,ei,to){
  profile.swaps=profile.swaps??{};
  const k=slotKey(di,ei); if(to&&to!==days()[di].orig[ei]) profile.swaps[k]=to; else delete profile.swaps[k];
  save("profile",profile);
  if(W&&W.dayIdx===di){const d=days()[di];W.ex=d.ex;W.tg=d.tg;save("workout",W)}
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
  const d=days()[i];
  W={dayIdx:i,prog:progKey(),title:d.t,ex:d.ex,tg:d.tg,i:0,set:1,sid:"s"+Date.now(),start:Date.now(),restUntil:null};
  save("workout",W);pickDay=null;tab="workout";render();
}
function workoutView(){
  if(summary) return summaryView();
  const ex=W.ex[W.i], t=W.tg[W.i], s=suggest(ex,t);
  const done=logs.filter(l=>l.sid===W.sid&&l.ex===ex);
  const bar=`<div class="wbar"><span>${esc(W.title)} · ${W.i+1}/${W.ex.length}</span><button class="link" onclick="endWorkout()">Завершить</button></div>
    <div class="prog"><i style="width:${Math.round(W.i/W.ex.length*100)}%"></i></div>`;
  if(W.restUntil){
    return `${bar}<div class="rest"><div class="kicker">Отдых</div><div id="cd" class="cd">--:--</div>
      <div class="muted">Дальше: подход ${W.set} из ${t.sets} — ${nm(ex)}</div>
      <div class="row"><button class="btn ghost" onclick="W.restUntil+=30000;save('workout',W);tick()">+30 с</button>
      <button class="btn" onclick="W.restUntil=null;save('workout',W);render()">Поехали</button></div></div>`;
  }
  return `${bar}${EX[ex]?`<div class="pics wk"><img src="${img(ex,0)}" alt=""><img src="${img(ex,1)}" alt=""></div>`:""}
    <h1 class="wname">${nm(ex)}</h1>
    <div class="setinfo"><b class="acc">Подход ${W.set} из ${t.sets}</b><span>цель: ${t.lo===t.hi?t.lo:t.lo+"–"+t.hi}${t.sec?" с":" повт."}</span></div>
    <div class="card small ${s.up?"up":""}">${s.prev?`Прошлый раз: <b>${s.prev}</b><br>`:""}${s.text}</div>
    ${done.length?`<div class="muted small">Сегодня: ${done.map(l=>t.sec?l.r+" с":num(l.w)+"×"+l.r).join(", ")}</div>`:""}
    <div class="row inputs">${t.sec?"":`<label>Вес, кг<input id="w" type="number" inputmode="decimal" step="0.5" value="${done.length?done[done.length-1].w:s.w}"></label>`}
      <label>${t.sec?"Секунд":"Повторы"}<input id="r" type="number" inputmode="numeric" value="${s.r||""}"></label></div>
    <div id="err" class="err"></div>
    <button class="btn big" onclick="doneSet()">Подход сделан</button>
    <div class="row links"><button class="link" onclick="openEx('${ex}',${W.prog===progKey()?W.dayIdx:"undefined"},${W.i})">Техника и замена</button>
      <button class="link" onclick="nextEx()">Пропустить упражнение</button></div>`;
}
function doneSet(){
  const ex=W.ex[W.i], t=W.tg[W.i];
  const w=t.sec?0:parseFloat(String($("#w").value).replace(",",".")), r=parseInt($("#r").value);
  if(!t.sec&&!(w>=0)) return $("#err").textContent="Введи вес (0, если без веса)";
  if(!(r>0)) return $("#err").textContent=t.sec?"Введи, сколько секунд держал":"Введи количество повторов";
  logs.push({ex,w,r,sec:t.sec,date:today(),ts:Date.now(),sid:W.sid});save("logs",logs);
  if(W.set<t.sets){W.set++;W.restUntil=Date.now()+restSec(ex,t)*1000}
  else if(W.i<W.ex.length-1){W.i++;W.set=1;W.restUntil=Date.now()+restSec(ex,t)*1000}
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
  const ls=logs.filter(l=>l.sid===W.sid), w=W;
  const s={sid:w.sid,ts:w.start,date:today(),day:w.title,dayIdx:w.dayIdx,prog:w.prog,dur:Math.round((Date.now()-w.start)/60000)};
  sessions.push(s);save("sessions",sessions);
  W=null;save("workout",null);
  const ups=[...new Set(ls.map(l=>l.ex))].filter(e=>suggest(e,w.tg[w.ex.indexOf(e)]??target(e)).up).length;
  summary={...s,sets:ls.length,ton:ls.reduce((a,l)=>a+l.w*(l.sec?0:l.r),0),ups};
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
  const used=[...new Set(logs.map(l=>l.ex))];
  if(!chartEx||!used.includes(chartEx)) chartEx=used[0]??null;
  return `<div class="hero"><h1>Прогресс</h1></div>
  <div class="stats"><div class="stat"><div class="muted">Тренировок</div><b>${sessions.length}</b></div>
    <div class="stat"><div class="muted">Серия</div><b class="acc">${streak()} нед</b></div>
    <div class="stat"><div class="muted">В этом месяце</div><b>${trained.size}</b></div></div>
  <h2>${now.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</h2>${cal}
  <h2>Рост по упражнению</h2>
  ${used.length?`<select onchange="chartEx=this.value;render()">${used.map(e=>`<option value="${e}" ${e===chartEx?"selected":""}>${nm(e)}</option>`).join("")}</select>${chart(chartEx)}`
    :`<div class="card muted">Начни первую тренировку — здесь появится график.</div>`}
  ${sessions.length?`<h2>Последние тренировки</h2><div class="list">${[...sessions].reverse().slice(0,10).map(s=>
    `<div class="ex"><div class="grow"><div class="name">${esc(s.day)}</div><div class="muted small">${s.date} · ${s.dur} мин</div></div></div>`).join("")}</div>`:""}`;
}
function chart(ex){
  const by={}; let sec=false;
  logs.filter(l=>l.ex===ex).forEach(l=>{const s=l.sec??target(ex).sec;sec=s;const k=l.sid??l.date,v=s?+l.r:+l.w;if(!by[k]||v>by[k].v)by[k]={v,d:l.date}});
  const pts=Object.values(by).slice(-12), u=sec?" с":" кг";
  if(pts.length<2) return `<div class="card muted small">Нужно минимум 2 тренировки с этим упражнением. Сейчас: ${pts.length?num(pts[0].v)+u:"—"}</div>`;
  const vs=pts.map(p=>p.v), mn=Math.min(...vs), mx=Math.max(...vs), H=140, Wd=320, pad=24;
  const Xp=i=>pad+i*(Wd-2*pad)/(pts.length-1), Y=v=>mx===mn?H/2:H-pad-(v-mn)/(mx-mn)*(H-2*pad);
  return `<div class="card"><svg viewBox="0 0 ${Wd} ${H}" class="chart">
    <polyline fill="none" stroke="#ff5a1f" stroke-width="3" points="${pts.map((p,i)=>Xp(i)+","+Y(p.v)).join(" ")}"/>
    ${pts.map((p,i)=>`<circle cx="${Xp(i)}" cy="${Y(p.v)}" r="4" fill="#ff5a1f"/>`).join("")}
    <text x="${Xp(0)}" y="${H-4}" text-anchor="start">${pts[0].d}</text><text x="${Xp(pts.length-1)}" y="${H-4}" text-anchor="end">${pts[pts.length-1].d}</text>
    <text x="${Xp(pts.length-1)}" y="${Y(pts[pts.length-1].v)-10}" text-anchor="end" class="hi">${num(pts[pts.length-1].v)}${u}</text></svg>
    <div class="muted small">Лучший результат за тренировку. Было ${num(pts[0].v)}, стало ${num(vs[vs.length-1])}${u}.</div></div>`;
}

/* ---------- Гайды ---------- */
function guidesView(){
  return `<div class="hero"><h1>Гайды</h1><p class="muted">Коротко о том, что важно знать новичку.</p></div>
  ${GUIDES.map(g=>`<details class="card guide"><summary>${g.t}</summary><ul>${g.b.map(x=>`<li>${x}</li>`).join("")}</ul></details>`).join("")}`;
}

/* ================= Запуск ================= */
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{if(tab==="edit"&&!confirm("Выйти из конструктора без сохранения?"))return;ED=null;tab=b.dataset.tab;render()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&tab==="workout")tick()});
if(W&&!W.tg){W=null;save("workout",null);tab="today"} // незаконченная тренировка из старой версии
render();
if("serviceWorker" in navigator&&location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
