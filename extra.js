/* Какие мышцы работают в каждом упражнении (для карты мышц) */
const MG = {
  squat:["quads","glutes"], bbsquat:["quads","glutes","abs"], bench:["chest","triceps","shoulders"],
  rdl:["hams","glutes","back"], pulldown:["back","biceps"], row:["back","biceps","reardelt"],
  ohp:["shoulders","triceps"], legpress:["quads","glutes"], lunge:["quads","glutes"],
  incline:["chest","shoulders","triceps"], seatedrow:["back","biceps","reardelt"], glute:["glutes","hams"],
  curl:["biceps"], pushdown:["triceps"], dbbench:["chest","triceps"], pullup:["back","biceps"],
  dips:["chest","triceps"], fly:["chest"], latraise:["shoulders"], facepull:["reardelt","traps"],
  legcurl:["hams"], legext:["quads"], calf:["calves"], hammer:["biceps","forearms"],
  kneeraise:["abs"], plank:["abs"]
};

/* Чем заменить, если тренажёр занят или его нет (та же мышца) */
const ALT = {
  squat:["legpress","bbsquat","lunge"], bbsquat:["squat","legpress"], bench:["dbbench","incline","dips"],
  rdl:["glute","legcurl"], pulldown:["pullup","seatedrow"], row:["seatedrow","pulldown"],
  ohp:["latraise","incline"], legpress:["squat","lunge"], lunge:["squat","legpress"],
  incline:["dbbench","bench"], seatedrow:["row","pulldown"], glute:["rdl","lunge"],
  curl:["hammer"], pushdown:["dips"], dbbench:["bench","incline"], pullup:["pulldown"],
  dips:["pushdown","dbbench"], fly:["dbbench","incline"], latraise:["ohp"], facepull:["row","seatedrow"],
  legcurl:["rdl","glute"], legext:["squat","legpress"], calf:[], hammer:["curl"],
  kneeraise:["plank"], plank:["kneeraise"]
};

/* Фильтр в библиотеке */
const GROUPS = {
  "Грудь":["chest"], "Спина":["back","traps","reardelt"], "Ноги":["quads","hams","glutes","calves"],
  "Плечи":["shoulders","reardelt"], "Руки":["biceps","triceps","forearms"], "Пресс":["abs"]
};

/* Гайды для новичка */
const GUIDES = [
  {t:"Первая неделя в зале", b:[
    "Бери лёгкие веса. Первые 2–4 недели главная цель — выучить технику, а не поднять больше всех.",
    "Не делай подходы до полного отказа. Оставляй 2–3 повтора в запасе.",
    "3 тренировки в неделю с днём отдыха между ними — идеальный старт.",
    "Через 1–2 дня мышцы будут болеть — это нормально, со временем пройдёт."]},
  {t:"Сколько отдыхать между подходами", b:[
    "Тяжёлые базовые упражнения (присед, жим, тяги): 1,5–3 минуты.",
    "Лёгкие упражнения на одну мышцу (бицепс, махи, пресс): 60–90 секунд.",
    "Приложение само ставит таймер отдыха во время тренировки."]},
  {t:"Как правильно дышать", b:[
    "Выдох — на усилии (когда поднимаешь), вдох — когда опускаешь.",
    "В тяжёлых базовых упражнениях перед повтором вдохни животом и напряги пресс — так спина защищена.",
    "Если есть проблемы с давлением или сердцем — не задерживай дыхание, посоветуйся с врачом."]},
  {t:"Когда добавлять вес", b:[
    "Схема называется «двойная прогрессия». Например, цель 3 × 8–12.",
    "Сначала держишь вес и добавляешь повторы, пока во всех подходах не сделаешь 12.",
    "Как только сделал 12 во всех подходах — добавляешь вес (+2,5 кг) и снова начинаешь с 8.",
    "Приложение подсказывает это само, но решение всегда за тобой: если техника плывёт — не добавляй."]},
  {t:"Мышцы болят — это нормально?", b:[
    "Тянущая боль в мышцах через 1–3 дня после тренировки (крепатура) — нормально.",
    "Резкая боль во время упражнения, боль в суставе, щелчки с болью — сразу остановись.",
    "Если боль не проходит несколько дней или мешает двигаться — к врачу."]},
  {t:"Питание и сон коротко", b:[
    "Мышцы растут не в зале, а во время отдыха. Спи 7–9 часов.",
    "Ешь достаточно белка: мясо, рыба, яйца, творог, бобовые. Ориентир для тех, кто тренируется, — около 1,6 г на кг веса в день.",
    "Пей воду, особенно в день тренировки.",
    "Это общие советы, не медицинская рекомендация."]},
  {t:"Как не стесняться в зале", b:[
    "Все когда-то пришли в первый раз. Большинству вообще не до тебя — каждый занят своим.",
    "Когда план открыт в телефоне, ты не теряешься и выглядишь уверенно.",
    "Не знаешь, как работает тренажёр — спроси у дежурного тренера, это нормально.",
    "Убирай за собой блины и гантели — и тебя будут уважать."]}
];

/* Простая карта мышц: спереди и сзади */
function muscleMap(active){
  const on = m => active.includes(m) ? "#ff5a1f" : "#2a2a2a";
  const E=(m,cx,cy,rx,ry)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${on(m)}"/>`;
  const R=(m,x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${on(m)}"/>`;
  const head=cx=>`<circle cx="${cx}" cy="16" r="9" fill="#2a2a2a"/>`;
  const front = head(50)+E("shoulders",33,38,8,7)+E("shoulders",67,38,8,7)+E("chest",43,47,9,8)+E("chest",57,47,9,8)
    +E("biceps",26,57,5,10)+E("biceps",74,57,5,10)+E("forearms",23,79,4,10)+E("forearms",77,79,4,10)
    +R("abs",42,57,16,30)+E("quads",43,112,7,20)+E("quads",57,112,7,20)+E("x",43,152,5,14)+E("x",57,152,5,14);
  const back = head(150)+E("traps",150,32,12,6)+E("reardelt",133,39,8,7)+E("reardelt",167,39,8,7)
    +E("back",142,54,9,14)+E("back",158,54,9,14)+R("back",144,68,12,16)
    +E("triceps",126,57,5,10)+E("triceps",174,57,5,10)+E("forearms",123,79,4,10)+E("forearms",177,79,4,10)
    +E("glutes",143,94,8,8)+E("glutes",157,94,8,8)+E("hams",143,118,7,17)+E("hams",157,118,7,17)
    +E("calves",143,150,6,14)+E("calves",157,150,6,14);
  return `<svg viewBox="0 0 200 172" class="mmap" role="img" aria-label="Карта мышц">${front}${back}
    <text x="50" y="171" text-anchor="middle">спереди</text><text x="150" y="171" text-anchor="middle">сзади</text></svg>`;
}
