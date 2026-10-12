// Portfolio rendering. Project data lives in projects.json (edited via admin.html).
// cover: { shot: "path", pos: "center top" } | { gifts: [...] } | { glyph: "Text", tint: "#hex", sub: {ru, en} }
// links: page = section of this site, live = working site, code = public repo. visible: false hides a project.
// home: true puts a project into "Selected work" on the main page.
// Pages: <body data-page="home|projects|contact">. admin.html and design-system.html have no data-page
// and only reuse cardHTML / coverHTML.

let CATEGORIES = [];
let PROJECTS = [];

// Everything about me that is not a project (source: my CV). Channels with an empty href are not shown.
const PROFILE = {
  since: 2020, // first job in 3D — drives the "years in 3D & motion" stat
  cv: { ru: "assets/cv-ru.pdf", en: "assets/cv-en.pdf" },
  channels: [
    { name: "Telegram", handle: "@EyeAnton", href: "https://t.me/EyeAnton" },
    { name: "Email", handle: "leritosha@gmail.com", href: "mailto:leritosha@gmail.com" },
    { name: "Behance", handle: "EyeAnton", href: "https://www.behance.net/EyeAnton" },
    { name: "GitHub", handle: "EyeAnton", href: "https://github.com/EyeAnton" },
  ],
  skills: [
    { icon: "01", ru: "AI-генерация", en: "AI generation",
      d: { ru: "Видео, изображения и звук для продукта — от промпта до готового ассета", en: "Video, imagery and sound for products — from prompt to finished asset" },
      tools: ["ComfyUI", "Nano Banana", "Flux", "Midjourney", "Recraft", "Kling", "ElevenLabs", "Suno"] },
    { icon: "02", ru: "Автоматизация", en: "Automation",
      d: { ru: "Пайплайны, которые превращают генерацию в масштабируемый продакшен", en: "Pipelines that turn generation into scalable production" },
      tools: ["Google Cloud Run", "Gemini API", "Make", "Claude", "Cursor", "ffmpeg", "Python", "Node.js"] },
    { icon: "03", ru: "Motion & 3D", en: "Motion & 3D",
      d: { ru: "3D-подарки, иконки, онбординг-анимации и промо-ролики", en: "3D gifts, icons, onboarding animations and promo videos" },
      tools: ["After Effects", "Premiere Pro", "Blender", "Marvelous Designer", "Substance Painter"] },
    { icon: "04", ru: "Дизайн", en: "Design",
      d: { ru: "Ассеты под разработку: mobile, web, Figma", en: "Dev-ready assets for mobile, web and Figma" },
      tools: ["Figma", "Photoshop"] },
  ],
  soft: {
    ru: ["Связка креатива и технологий", "Аудит и автоматизация процессов", "Быстрое прототипирование", "Оценка AI-инструментов", "Объясняю AI нетехническим командам", "Кросс-функциональная работа"],
    en: ["Bridging creative & tech", "Process audit & automation", "Rapid prototyping", "AI tool evaluation", "Explaining AI to non-tech teams", "Cross-functional collaboration"],
  },
  experience: [
    { role: "Senior CG Artist", org: "Social Discovery Group", when: { ru: "Янв 2025 — Окт 2026", en: "Jan 2025 — Oct 2026" },
      points: {
        ru: ["Пайплайн автоматической генерации видеоподарков: Kling API + Gemini + ffmpeg, хромакей, экспорт webm/hevc (Node.js)",
             "Пайплайн «фото → стикер»: Make + Google Cloud Run + Gemini API",
             "Генерация визуальных новелл на RunningHub: сценарии, персонажи и иллюстрации — автоматически",
             "3D-motion: подарки, иконки, онбординг-анимации; motion-процесс от сториборда до правок"],
        en: ["Automated video-gift pipeline: Kling API + Gemini + ffmpeg, chroma key, webm/hevc export (Node.js)",
             "Photo-to-sticker pipeline: Make + Google Cloud Run + Gemini API",
             "Visual-novel generation on RunningHub: scripts, characters and illustrations, fully automated",
             "3D motion: gifts, icons, onboarding animations; motion workflow from storyboard to revisions"],
      } },
    { role: "3D Motion Designer", org: "Social Discovery Group", when: { ru: "Мар 2024 — Дек 2024", en: "Mar 2024 — Dec 2024" },
      points: {
        ru: ["Промо-ролики для разных платформ в After Effects", "3D-анимация в Blender, генерация изображений и видео при помощи AI"],
        en: ["Promo videos for multiple platforms in After Effects", "3D animation in Blender, AI-generated imagery and video"],
      } },
    { role: "Freelance", org: "", when: { ru: "Ноя 2022 — Мар 2024", en: "Nov 2022 — Mar 2024" },
      points: {
        ru: ["3D и motion-дизайн для брендов и digital-платформ", "Промо-материалы и инфографика для соцсетей"],
        en: ["3D and motion design for brands and digital platforms", "Social media promo content and infographics"],
      } },
    { role: "3D Modeller", org: "Comme Des Creators", when: { ru: "Май 2020 — Ноя 2022", en: "May 2020 — Nov 2022" },
      points: {
        ru: ["3D-модели одежды и 3D-анимация", "Внедрение OpenGL-технологий в проект"],
        en: ["3D clothing modelling and 3D animation", "OpenGL-based renders: modelling, texturing, asset integration"],
      } },
  ],
};

const UI = {
  ru: {
    "nav.home": "Главная", "nav.work": "Проекты", "nav.contact": "Контакты",
    "hero.eyebrow": "Антон Егоров · AI Creative Technologist",
    "hero.title": "Превращаю AI-генерацию в масштабируемый продакшен",
    "hero.lead": "Дизайнер на стыке AI-генерации, motion/3D и автоматизации креативных процессов. От промптов и ComfyUI-воркфлоу до пакетной генерации и готовых ассетов для разработки.",
    "hero.where": "Ереван · удалённо или релокация",
    "hero.cta": "Смотреть проекты",
    "hero.cv": "Контакты и CV",
    "areas.eyebrow": "Навыки",
    "areas.title": "Что я делаю",
    "areas.text": "Делал видео-подарки, стикеры, 3D-иконки и онбординг-анимации для продукта с большим объёмом контента.",
    "soft.title": "Soft skills",
    "show.eyebrow": "Избранное",
    "show.title": "Проекты, которыми я горжусь",
    "show.all": "Все проекты →",
    "stack.title": "Стек и инструменты",
    "exp.eyebrow": "Опыт",
    "exp.title": "Где я работал",
    "work.eyebrow": "Каталог",
    "work.title": "Проекты",
    "work.text": "Рабочие кейсы и личные проекты: AI-визуал, сайты, прошивки и инструменты.",
    "contact.eyebrow": "Контакты",
    "contact.title": "Давайте поговорим",
    "contact.text": "Открыт к работе удалённо или с релокацией. Резюме и все способы связи — на странице контактов.",
    "contact.lead": "Открыт к работе удалённо или с релокацией. Скачайте резюме или напишите там, где удобно — быстрее всего в Telegram.",
    "cv.title": "Резюме",
    "cv.text": "Опыт, навыки и инструменты на одной странице — в PDF.",
    "cv.soon": "CV скоро появится",
    "ch.title": "Где меня найти",
    "help.title": "Чем могу помочь",
    "foot.note": "Сделано без фреймворков · работает на любом устройстве",
    "foot.ds": "Дизайн-система",
    page: "Каталог подарков", live: "Открыть сайт", code: "Код", code2: "ZMK-конфиг", private: "Приватный", online: "Онлайн",
    sYears: "лет в 3D и motion", sProjects: "проектов", sLive: "живых сайтов",
    cvRu: "Скачать CV · RU", cvEn: "Скачать CV · EN",
    projects: (n) => `${n} ${plural(n, "проект", "проекта", "проектов")}`,
    tools: (n) => `${n} ${plural(n, "инструмент", "инструмента", "инструментов")}`,
  },
  en: {
    "nav.home": "Home", "nav.work": "Work", "nav.contact": "Contact",
    "hero.eyebrow": "Anton Egorov · AI Creative Technologist",
    "hero.title": "I turn AI generation into scalable production",
    "hero.lead": "Designer working at the intersection of generative AI, motion/3D and creative automation. From prompts and ComfyUI workflows to batch generation and dev-ready assets.",
    "hero.where": "Yerevan, Armenia · remote or relocation",
    "hero.cta": "View work",
    "hero.cv": "Contact & CV",
    "areas.eyebrow": "Skills",
    "areas.title": "What I do",
    "areas.text": "Shipped video gifts, stickers, 3D icons and onboarding animations for a high-volume content product.",
    "soft.title": "Soft skills",
    "show.eyebrow": "Selected",
    "show.title": "Projects I'm proud of",
    "show.all": "All projects →",
    "stack.title": "Stack & tools",
    "exp.eyebrow": "Experience",
    "exp.title": "Where I've worked",
    "work.eyebrow": "Catalog",
    "work.title": "Work",
    "work.text": "Work cases and personal projects: AI visuals, websites, firmware and tools.",
    "contact.eyebrow": "Contact",
    "contact.title": "Let's talk",
    "contact.text": "Open to remote work or relocation. My CV and every way to reach me are on the contact page.",
    "contact.lead": "Open to remote work or relocation. Download my CV or reach out wherever is convenient — Telegram is fastest.",
    "cv.title": "CV",
    "cv.text": "Experience, skills and tools on a single page — as a PDF.",
    "cv.soon": "CV coming soon",
    "ch.title": "Find me",
    "help.title": "How I can help",
    "foot.note": "Built without frameworks · works on any device",
    "foot.ds": "Design system",
    page: "Gift catalog", live: "Open site", code: "Code", code2: "ZMK config", private: "Private", online: "Live",
    sYears: "years in 3D & motion", sProjects: "projects", sLive: "live sites",
    cvRu: "Download CV · RU", cvEn: "Download CV · EN",
    projects: (n) => `${n} ${n === 1 ? "project" : "projects"}`,
    tools: (n) => `${n} ${n === 1 ? "tool" : "tools"}`,
  },
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let lang = store.get("lang") || ((navigator.language || "ru").toLowerCase().startsWith("ru") ? "ru" : "en");
let filter = (location.hash.match(/^#cat=(\w+)/) || [])[1] || "all";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PAGE = document.body.dataset.page;
const uniq = (a) => [...new Set(a)];

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const catName = (id) => (CATEGORIES.find((c) => c.id === id) || { [lang]: id })[lang];

function coverHTML(p) {
  const c = p.cover;
  if (c.gifts) {
    return `<div class="cover gifts">${c.gifts.map((k) =>
      `<img src="assets/gifts/${k}.webp" alt="" loading="lazy">`).join("")}</div>`;
  }
  if (c.shot) {
    const pos = c.pos ? ` style="object-position:${esc(c.pos)}"` : "";
    return `<div class="cover"><img class="shot" src="${esc(c.shot)}"${pos} alt="${esc(p.title[lang])}" loading="lazy"></div>`;
  }
  return `<div class="cover type" style="--tint:${c.tint}">
    <span class="glyph">${esc(c.glyph || "")}</span>
    ${c.sub ? `<span class="glyph-sub">${esc(c.sub[lang])}</span>` : ""}
  </div>`;
}

function badgeHTML(p) {
  const t = UI[lang];
  return p.links.live
    ? `<span class="badge live">${t.online}</span>`
    : p.private ? `<span class="badge">${t.private}</span>` : "";
}

function linksHTML(p) {
  const t = UI[lang];
  return [
    p.links.page && `<a class="btn" href="${p.links.page}">${t.page} →</a>`,
    p.links.live && `<a class="btn" href="${p.links.live}" target="_blank" rel="noopener">${t.live} ↗</a>`,
    p.links.code && `<a class="btn ghost" href="${p.links.code}" target="_blank" rel="noopener">${t.code}</a>`,
    p.links.code2 && `<a class="btn ghost" href="${p.links.code2}" target="_blank" rel="noopener">${t.code2}</a>`,
  ].filter(Boolean).join("");
}

const tagsHTML = (tags) => `<div class="tags">${tags.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>`;

function cardHTML(p, i) {
  const links = linksHTML(p);
  return `<article class="card${p.featured ? " featured" : ""}" style="animation-delay:${i * 40}ms">
    ${coverHTML(p)}
    <div class="body">
      <div class="meta"><span>${catName(p.cat)} · ${p.year}</span>${badgeHTML(p)}</div>
      <h3>${esc(p.title[lang])}</h3>
      <p>${esc(p.desc[lang])}</p>
      ${tagsHTML(p.tags)}
      ${links ? `<div class="links">${links}</div>` : ""}
      ${p.note ? `<div class="note">${esc(p.note[lang])}</div>` : ""}
    </div>
  </article>`;
}

/* ---------------- shared bits ---------------- */

function statsHTML() {
  const t = UI[lang];
  const live = PROJECTS.filter((p) => p.links.live).length;
  const years = new Date().getFullYear() - PROFILE.since;
  return [[`${years}+`, t.sYears], [PROJECTS.length, t.sProjects], [live, t.sLive]]
    .map(([n, l], i) => `<div class="stat reveal" style="--d:${i * 90}ms"><b>${n}</b><span>${l}</span></div>`).join("");
}

// skill groups from the CV: what I do + the tools for it
function areasHTML(compact) {
  const t = UI[lang];
  return PROFILE.skills.map((g, i) => `<div class="area reveal" style="--d:${i * 80}ms">
      <span class="area-top"><span class="area-ico">${g.icon}</span><span class="area-n">${t.tools(g.tools.length)}</span></span>
      <h3>${esc(g[lang])}</h3>
      <p>${esc(g.d[lang])}</p>
      ${tagsHTML(compact ? g.tools.slice(0, 4) : g.tools)}
    </div>`).join("");
}

const softHTML = () => PROFILE.soft[lang].map((x) => `<span class="tag">${esc(x)}</span>`).join("");

function expHTML() {
  return PROFILE.experience.map((e, i) => `<article class="exp-item reveal" style="--d:${i * 60}ms">
      <div class="exp-when">${esc(e.when[lang])}</div>
      <div class="exp-body">
        <h3>${esc(e.role)}${e.org ? ` <span>· ${esc(e.org)}</span>` : ""}</h3>
        <ul>${e.points[lang].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
    </article>`).join("");
}

/* ---------------- pages ---------------- */

function renderHome() {
  const t = UI[lang];
  $("#stats").innerHTML = statsHTML();
  $("#areas").innerHTML = areasHTML(false);

  let picks = PROJECTS.filter((p) => p.home);
  if (!picks.length) picks = PROJECTS.slice(0, 4);
  $("#showcase").innerHTML = picks.map((p, i) => {
    const links = linksHTML(p);
    return `<article class="show reveal">
      <div class="show-media">${coverHTML(p)}</div>
      <div class="show-body">
        <span class="show-num">${String(i + 1).padStart(2, "0")}</span>
        <div class="meta"><span>${catName(p.cat)} · ${p.year}</span>${badgeHTML(p)}</div>
        <h3>${esc(p.title[lang])}</h3>
        <p>${esc(p.desc[lang])}</p>
        ${tagsHTML(p.tags)}
        ${links ? `<div class="links">${links}</div>` : ""}
      </div>
    </article>`;
  }).join("");

  // stack ticker: every tag once, the row duplicated so the loop is seamless
  const tags = uniq([...PROFILE.skills.flatMap((g) => g.tools), ...PROJECTS.flatMap((p) => p.tags)]);
  const half = Math.ceil(tags.length / 2);
  const row = (list) => { const s = list.map((x) => `<span>${esc(x)}</span>`).join(""); return s + s; };
  $("#stack").innerHTML = `<div class="marquee-row">${row(tags.slice(0, half))}</div>
    <div class="marquee-row rev">${row(tags.slice(half))}</div>`;

  $("#soft").innerHTML = softHTML();
  $("#exp").innerHTML = expHTML();
}

function renderProjects() {
  $("#filters").innerHTML = CATEGORIES.map((c) => {
    const n = c.id === "all" ? PROJECTS.length : PROJECTS.filter((p) => p.cat === c.id).length;
    if (!n) return "";
    return `<button class="chip" role="tab" data-cat="${c.id}" aria-selected="${c.id === filter}">${c[lang]}<small>${n}</small></button>`;
  }).join("");
  const list = PROJECTS.filter((p) => filter === "all" || p.cat === filter);
  $("#grid").innerHTML = list.map(cardHTML).join("");
}

let cvAvailable = {};
function renderContact() {
  const t = UI[lang];
  const cvBtn = (k, label) => cvAvailable[k]
    ? `<a class="btn${k === "en" ? " ghost" : ""}" href="${PROFILE.cv[k]}" download="Anton-Egorov-CV-${k.toUpperCase()}.pdf">${label} ↓</a>` : "";
  const btns = cvBtn("ru", t.cvRu) + cvBtn("en", t.cvEn);
  $("#cvLinks").innerHTML = btns || `<span class="btn quiet" aria-disabled="true">${t["cv.soon"]}</span>`;
  $("#channels").innerHTML = PROFILE.channels.filter((c) => c.href).map((c) =>
    `<a class="channel" href="${esc(c.href)}" target="_blank" rel="noopener">
      <span>${esc(c.name)}</span><b>${esc(c.handle)}</b><i>↗</i>
    </a>`).join("");
  $("#areas").innerHTML = areasHTML(true);
}

/* ---------------- reveal on scroll ---------------- */

const io = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px", threshold: 0.12 })
  : null;
let firstRender = true;
function watchReveal() {
  document.querySelectorAll(".reveal:not(.in)").forEach((el) => {
    // after a language switch the content is rebuilt; don't replay the entrance
    if (!io || !firstRender) el.classList.add("in"); else io.observe(el);
  });
  firstRender = false;
}

function render() {
  const t = UI[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t[el.dataset.i18n]; });
  $("#lang").textContent = lang === "ru" ? "EN" : "RU";
  if (PAGE === "home") renderHome();
  if (PAGE === "projects") renderProjects();
  if (PAGE === "contact") renderContact();
  watchReveal();
}

if (PAGE) {
  document.documentElement.classList.add("js");
  $("#lang").addEventListener("click", () => {
    lang = lang === "ru" ? "en" : "ru";
    store.set("lang", lang);
    render();
  });
  $("#year").textContent = new Date().getFullYear();

  if (PAGE === "projects") {
    $("#filters").addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      filter = b.dataset.cat;
      history.replaceState(null, "", filter === "all" ? location.pathname : `#cat=${filter}`);
      render();
    });
  }

  const cvCheck = PAGE === "contact"
    ? Promise.all(Object.entries(PROFILE.cv).map(([k, url]) =>
        fetch(url, { method: "HEAD", cache: "no-cache" })
          .then((r) => { cvAvailable[k] = r.ok; })
          .catch(() => { cvAvailable[k] = false; })))
    : Promise.resolve();

  Promise.all([fetch("projects.json", { cache: "no-cache" }).then((r) => r.json()), cvCheck])
    .then(([data]) => {
      CATEGORIES = [{ id: "all", ru: "Все", en: "All" }, ...data.categories];
      PROJECTS = data.projects.filter((p) => p.visible !== false);
      if (!CATEGORIES.some((c) => c.id === filter)) filter = "all";
      render();
    })
    .catch((err) => {
      console.error(err);
      const box = $("#grid") || $("#showcase") || $("#channels");
      if (box) box.textContent = "Could not load projects.";
    });
}
