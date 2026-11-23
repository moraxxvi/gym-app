/* ================= Аккаунт, демо-тур и облачная синхронизация ================= */
let DEMO=false;                       // во время тура ничего не сохраняется
let ACCT=load("acct",null);           // {id,email,name} — кто вошёл на этом телефоне
let authMode="signup", authMsg="", syncState="";
let sb=null;
try{ if(window.supabase&&!SUPABASE_URL.includes("XXX"))
  sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}) }catch{}

/* ---------- Приветствие ---------- */
function welcomeView(){
  return `<div class="welcome"><img src="icon.svg" alt="" class="wlogo">
    <div class="kicker">Бесплатно и на русском</div><h1>Зал для новичка</h1>
    <p class="muted">План тренировок как от тренера, техника с фото и подсказки, когда добавлять вес.</p>
    <ul class="wl"><li>10 готовых программ или своя</li><li>53 упражнения с фото и картой мышц</li><li>Таймер отдыха и дневник прогресса</li></ul>
    <button class="btn big" onclick="startTour()">Посмотреть, как это работает</button>
    <button class="link" onclick="authMode='login';authMsg='';tab='auth';render()">Уже есть аккаунт? Войти</button></div>`;
}

/* ---------- Демо-тур: показываем настоящее приложение на выдуманных данных ---------- */
let saved=null, step=0;
function demoData(){
  const d=n=>{const t=new Date();t.setDate(t.getDate()-n);return t};
  const L=[],S=[];
  [[16,35],[9,37.5],[2,40]].forEach(([ago,w],k)=>{const t=d(ago),sid="demo"+k;
    S.push({sid,ts:+t,date:t.toLocaleDateString("ru-RU"),day:"Фулбади A",dayIdx:0,prog:"fb3",dur:52});
    ["squat","bench","pulldown","ohp"].forEach(ex=>[0,1,2].forEach(()=>L.push({ex,w:ex==="bench"?w:w-10,r:12,sec:false,date:t.toLocaleDateString("ru-RU"),ts:+t,sid})))});
  return {profile:{level:"new",days:3,split:"fb3",goal:"mass",injury:false,swaps:{}},logs:L,sessions:S};
}
const TOUR=[
  {tab:"today",sel:".hero",t:"Твой день",b:"Приложение само знает, какая тренировка сегодня, и показывает серию недель без пропусков."},
  {tab:"today",sel:".list",t:"План на сегодня",b:"Все упражнения с подходами и повторами. Под каждым — что ты делал в прошлый раз."},
  {tab:"workout",sel:".card",t:"Тренер в кармане",b:"Во время тренировки приложение ведёт подход за подходом и подсказывает, когда пора добавить вес."},
  {tab:"workout",sel:".links",t:"Техника и замена",b:"Забыл технику — открой фото и подсказки. Тренажёр занят — замени на похожее упражнение. После подхода включится таймер отдыха."},
  {tab:"lib",sel:".list",t:"53 упражнения",b:"Фото начала и конца движения, карта мышц, как делать и частые ошибки."},
  {tab:"progress",sel:".cal",t:"Прогресс",b:"Календарь тренировок и график, как растут твои веса."},
  {tab:"plan",sel:".seg",t:"Свои программы",b:"Бери готовую программу из 10 или собери свою: дни, упражнения, подходы — как хочешь."}
];
function startTour(){
  saved={profile,logs,sessions,W}; DEMO=true;
  const d=demoData(); profile=d.profile; logs=d.logs; sessions=d.sessions; step=0; showStep();
}
function showStep(){
  const s=TOUR[step];
  W=s.tab==="workout"?{dayIdx:0,prog:"fb3",title:"Фулбади A",ex:days()[0].ex,tg:days()[0].tg,i:1,set:1,sid:"demo-now",start:Date.now(),restUntil:null}:null;
  planMode="cur"; tab=s.tab; render();
  const el=document.querySelector("#app "+s.sel); if(!el) return nextStep();
  const tall=el.offsetHeight>innerHeight*.45;            // длинный список подсвечиваем только сверху
  el.scrollIntoView({block:tall?"start":"center"}); if(tall) scrollBy(0,-16);
  requestAnimationFrame(()=>{
    const r=el.getBoundingClientRect(), h=Math.min(r.height,innerHeight*.45), bottom=r.top+h, below=bottom+200<innerHeight;
    $("#tour").innerHTML=`<div class="spot" style="top:${r.top-6}px;left:${r.left-6}px;width:${r.width+12}px;height:${h+12}px"></div>
      <div class="tip" style="${below?`top:${bottom+16}px`:`bottom:${Math.max(16,innerHeight-r.top+16)}px`}">
        <div class="kicker">${step+1} / ${TOUR.length}</div><h3>${s.t}</h3><p>${s.b}</p>
        <div class="row"><button class="link" onclick="endTour()">Пропустить</button>
        <button class="btn" onclick="nextStep()">${step===TOUR.length-1?"Создать аккаунт":"Дальше"}</button></div></div>`;
    $("#tour").hidden=false;
  });
}
function nextStep(){step++; step<TOUR.length?showStep():endTour()}
function endTour(){
  $("#tour").hidden=true; $("#tour").innerHTML="";
  ({profile,logs,sessions,W}=saved); DEMO=false; summary=null;
  authMode="signup"; authMsg=""; tab="auth"; render();
}

/* ---------- Регистрация и вход ---------- */
function authView(){
  const su=authMode==="signup";
  return `<div class="hero"><div class="kicker">${su?"Последний шаг":"С возвращением"}</div><h1>${su?"Создай аккаунт":"Вход"}</h1>
    <p class="muted">${su?"Чтобы собрать свой план и не потерять прогресс, даже если сменишь телефон.":"Войди, и твой прогресс подтянется."}</p></div>
    ${su?`<label class="lbl">Имя<input class="txt" id="an" autocomplete="given-name" placeholder="Как к тебе обращаться"></label>`:""}
    <label class="lbl">Почта<input class="txt" id="ae" type="email" autocomplete="email" inputmode="email" placeholder="name@mail.com"></label>
    <label class="lbl">Пароль<input class="txt" id="ap" type="password" autocomplete="${su?"new-password":"current-password"}" placeholder="${su?"Минимум 8 символов":""}"></label>
    ${su?`<label class="chk"><input type="checkbox" id="ac"> Согласен с <a href="privacy.html" target="_blank">политикой конфиденциальности</a></label>`:""}
    <div id="err" class="err">${esc(authMsg)}</div>
    <button class="btn big" id="ab" onclick="doAuth()">${su?"Зарегистрироваться":"Войти"}</button>
    <button class="link" onclick="authMode='${su?"login":"signup"}';authMsg='';render()">${su?"Уже есть аккаунт? Войти":"Нет аккаунта? Зарегистрироваться"}</button>
    ${!su&&RESET_ENABLED?`<button class="link" onclick="resetPw()">Забыл пароль</button>`:""}
    <button class="link" onclick="tab='welcome';render()">← Назад</button>`;
}
const ruErr=e=>{const m=String(e?.message??e);
  if(/Invalid login credentials/i.test(m)) return "Неверная почта или пароль";
  if(/already registered|already been registered/i.test(m)) return "Эта почта уже зарегистрирована — войди";
  if(/Email not confirmed/i.test(m)) return "Почта не подтверждена — открой ссылку из письма";
  if(/rate limit|too many/i.test(m)) return "Слишком много попыток. Подожди пару минут";
  if(/fetch|network|Failed/i.test(m)) return "Нет интернета или сервер недоступен. Попробуй ещё раз";
  if(/password/i.test(m)) return "Пароль слишком простой — минимум 8 символов";
  return "Что-то пошло не так. Попробуй ещё раз";};
async function doAuth(){
  const su=authMode==="signup", e=$("#ae").value.trim(), p=$("#ap").value, n=su?$("#an").value.trim():"";
  const err=m=>{$("#err").textContent=m};
  if(!sb) return err("Сервер ещё не подключён");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return err("Проверь почту");
  if(su&&p.length<8) return err("Пароль — минимум 8 символов");
  if(!p) return err("Введи пароль");
  if(su&&!$("#ac").checked) return err("Нужно согласие с политикой конфиденциальности");
  $("#ab").disabled=true; $("#ab").textContent="Секунду…";
  try{
    const r=su?await sb.auth.signUp({email:e,password:p,options:{data:{name:n}}}):await sb.auth.signInWithPassword({email:e,password:p});
    if(r.error) throw r.error;
    if(!r.data.session){authMode="login";authMsg="Мы отправили письмо — подтверди почту и войди";return render()}
    await onSignedIn(r.data.user);
  }catch(x){authMsg=ruErr(x);render()}
}
async function resetPw(){const e=$("#ae").value.trim();if(!e)return $("#err").textContent="Введи почту выше";
  const r=await sb.auth.resetPasswordForEmail(e,{redirectTo:location.origin+location.pathname});
  $("#err").textContent=r.error?ruErr(r.error):"Если такая почта есть, мы отправили ссылку для смены пароля"}

const KEYS=["profile","logs","sessions","myprogs","myex"];
const rawSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
function clearLocal(){[...KEYS,"objts","workout"].forEach(k=>{try{localStorage.removeItem(k)}catch{}});
  profile=null;logs=[];sessions=[];myProgs={};myEx={};W=null}
async function onSignedIn(user){
  const owner=load("owner",null);
  if(owner&&owner!==user.id) clearLocal();   // на телефоне были данные другого человека — не смешиваем
  rawSet("owner",user.id);
  ACCT={id:user.id,email:user.email,name:user.user_metadata?.name||""}; rawSet("acct",ACCT);
  await sync(); tab="today"; render();
}

/* ---------- Профиль ---------- */
function accountView(){
  return `<div class="hero"><div class="kicker">Аккаунт</div><h1>${esc(ACCT.name||"Профиль")}</h1><p class="muted">${esc(ACCT.email)}</p></div>
    <div class="card small">☁️ ${syncState||"Прогресс сохраняется в облако автоматически."}</div>
    <button class="btn ghost" onclick="sync(true)">Синхронизировать сейчас</button>
    <button class="btn ghost" onclick="logout()">Выйти</button>
    <h2>Опасная зона</h2>
    <button class="btn ghost danger" onclick="deleteAccount()">Удалить аккаунт и все данные</button>
    <p class="muted small"><a href="privacy.html" target="_blank">Политика конфиденциальности</a></p>`;
}
async function logout(){
  if(!(await sync()) && !confirm("Нет связи — последние тренировки ещё не сохранились в облако. Всё равно выйти? Они пропадут с этого телефона.")) return;
  try{await sb?.auth.signOut()}catch{}
  clearLocal(); ACCT=null; ["acct","owner"].forEach(k=>{try{localStorage.removeItem(k)}catch{}});
  tab="welcome"; render();
}
async function deleteAccount(){
  if(!confirm("Удалить аккаунт? Все программы, тренировки и прогресс удалятся навсегда, вернуть будет нельзя.")) return;
  if(!confirm("Точно удалить? Это последнее предупреждение.")) return;
  const r=await sb.rpc("delete_my_account");
  if(r.error) return alert(ruErr(r.error));
  try{await sb.auth.signOut()}catch{}
  clearLocal(); ACCT=null; ["acct","owner"].forEach(k=>{try{localStorage.removeItem(k)}catch{}});
  tab="welcome"; render(); alert("Аккаунт удалён");
}

/* ---------- Синхронизация: телефон ⇄ облако ---------- */
// Подходы и тренировки объединяются (ничего не теряется), анкета и программы — берётся более свежая версия.
function merge(a,b){
  const u=(x,y,key)=>{const m=new Map();[...(x??[]),...(y??[])].forEach(i=>{const k=key(i);if(!m.has(k))m.set(k,i)});return [...m.values()].sort((p,q)=>(p.ts??0)-(q.ts??0))};
  const newer=(b.objts??0)>(a.objts??0)?b:a;
  return {logs:u(a.logs,b.logs,l=>[l.sid??l.date,l.ts??"",l.ex,l.w,l.r].join("|")),sessions:u(a.sessions,b.sessions,s=>s.sid),
    profile:newer.profile??a.profile??b.profile??null,myprogs:newer.myprogs??{},myex:{...(b.myex??{}),...(a.myex??{})},objts:Math.max(a.objts??0,b.objts??0)};
}
let syncing=null, again=false, qt;
function queueSync(){ if(!ACCT||DEMO) return; clearTimeout(qt); qt=setTimeout(()=>sync(),2000) }
async function sync(show){
  if(!sb||!ACCT) return false;
  if(syncing){again=true;return syncing}
  syncing=(async()=>{
    try{
      const local={profile,logs,sessions,myprogs:myProgs,myex:myEx,objts:load("objts",0)};
      const {data,error}=await sb.from("user_data").select("data").eq("user_id",ACCT.id).maybeSingle();
      if(error) throw error;
      const m=data?merge(local,data.data):local;
      const up=await sb.from("user_data").upsert({user_id:ACCT.id,data:m,updated_at:new Date().toISOString()});
      if(up.error) throw up.error;
      profile=m.profile; logs=m.logs; sessions=m.sessions; myProgs=m.myprogs; myEx=m.myex;
      KEYS.forEach(k=>rawSet(k,m[k])); rawSet("objts",m.objts);
      syncState="Сохранено в облако: "+new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
      return true;
    }catch(e){syncState="Не удалось сохранить в облако (нет интернета?). Попробуем снова автоматически.";return false}
    finally{syncing=null; if(again){again=false;queueSync()} if(show||tab==="account")render()}
  })();
  return syncing;
}
addEventListener("online",()=>queueSync());

/* При запуске: проверяем, что вход ещё действует, и подтягиваем данные с других устройств */
async function authInit(){
  if(!ACCT||!sb) return;
  try{
    const {data}=await sb.auth.getSession();
    if(!data.session&&navigator.onLine){ACCT=null;try{localStorage.removeItem("acct")}catch{};authMode="login";authMsg="Войди снова, чтобы продолжить";tab="auth";return render()}
  }catch{}
  if(await sync()&&tab!=="workout") render();
}

/* ================= Запуск приложения ================= */
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{if(tab==="edit"&&!confirm("Выйти из конструктора без сохранения?"))return;ED=null;tab=b.dataset.tab;render()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&tab==="workout")tick()});
if(W&&!W.tg){W=null;save("workout",null);tab="today"} // незаконченная тренировка из старой версии
if(!ACCT) tab="welcome";
render();
authInit();
if("serviceWorker" in navigator&&location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
