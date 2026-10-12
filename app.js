// Portfolio rendering. Project data lives in projects.json (edited via admin.html).
// cover: { shot: "path", pos: "center top" } | { gifts: [...] } | { glyph: "Text", tint: "#hex", sub: {ru, en} }
// links: page = section of this site, live = working site, code = public repo. visible: false hides a project.
// home: true puts a project into "Selected work" on the main page.
// Pages: <body data-page="home|projects|contact">. admin.html and design-system.html have no data-page
// and only reuse cardHTML / coverHTML.

let CATEGORIES = [];
let PROJECTS = [];

// Everything about me that is not a project. Channels with an empty href are not shown.
const PROFILE = {
  cv: { ru: "assets/cv-ru.pdf", en: "assets/cv-en.pdf" },
  channels: [
    { name: "GitHub", handle: "EyeAnton", href: "https://github.com/EyeAnton" },
    { name: "Email", handle: "", href: "" },
    { name: "Telegram", handle: "", href: "" },
  ],
};

const AREA_ICON = { design: "✦", web: "◐", hardware: "◈", ai: "✺", tools: "⚙" };

const UI = {
  ru: {
    "nav.home": "Главная", "nav.work": "Проекты", "nav.contact": "Контакты",
    "hero.eyebrow": "Привет, я Антон",
    "hero.title": "Дизайн, AI-визуал и вещи, которые я собираю руками и кодом",
    "hero.lead": "Здесь собраны мои проекты: от коллекции 3D-подарков для соцприложения до веб-каталогов, прошивок для клавиатуры и Telegram-ботов.",
    "hero.cta": "Смотреть проекты",
    "hero.cv": "Контакты и CV",
    "areas.eyebrow": "Навыки",
    "areas.title": "Что я делаю",
    "areas.text": "Пять направлений — от визуала до железа. Навыки взяты из реальных проектов.",
    "show.eyebrow": "Избранное",
    "show.title": "Проекты, которыми я горжусь",
    "show.all": "Все проекты →",
    "stack.title": "Стек и инструменты",
    "path.eyebrow": "Путь",
    "path.title": "Что и когда я делал",
    "work.eyebrow": "Каталог",
    "work.title": "Проекты",
    "work.text": "Дизайн-кейсы, живые сайты, прошивки и инструменты — всё, что сделано своими руками.",
    "contact.eyebrow": "Контакты",
    "contact.title": "Давайте поговорим",
    "contact.text": "Открыт к проектам и сотрудничеству. Резюме и все способы связи — на странице контактов.",
    "contact.lead": "Открыт к проектам и сотрудничеству. Скачайте резюме или напишите там, где удобно.",
    "cv.title": "Резюме",
    "cv.text": "Опыт, навыки и проекты на одной странице — в PDF.",
    "cv.soon": "CV скоро появится",
    "ch.title": "Где меня найти",
    "help.title": "Чем могу помочь",
    "foot.note": "Сделано без фреймворков · работает на любом устройстве",
    "foot.ds": "Дизайн-система",
    page: "Каталог подарков", live: "Открыть сайт", code: "Код", code2: "ZMK-конфиг", private: "Приватный", online: "Онлайн",
    sProjects: "проектов", sLive: "живых сайтов", sAreas: "направлений",
    cvRu: "Скачать CV · RU", cvEn: "Скачать CV · EN",
    projects: (n) => `${n} ${plural(n, "проект", "проекта", "проектов")}`,
    areas: {
      design: "Арт-дирекшн, AI-3D и моушн для продуктов",
      web: "Сайты и веб-приложения — от идеи до деплоя",
      hardware: "Прошивки, устройства и компаньон-приложения",
      ai: "Боты и пайплайны генерации изображений",
      tools: "Утилиты, которые экономят часы рутины",
    },
  },
  en: {
    "nav.home": "Home", "nav.work": "Work", "nav.contact": "Contact",
    "hero.eyebrow": "Hi, I'm Anton",
    "hero.title": "Design, AI visuals and things I build by hand and in code",
    "hero.lead": "A collection of my projects: from a 3D gift collection for a social app to web catalogs, keyboard firmware and Telegram bots.",
    "hero.cta": "View work",
    "hero.cv": "Contact & CV",
    "areas.eyebrow": "Skills",
    "areas.title": "What I do",
    "areas.text": "Five areas — from visuals to hardware. Skills come straight from real projects.",
    "show.eyebrow": "Selected",
    "show.title": "Projects I'm proud of",
    "show.all": "All projects →",
    "stack.title": "Stack & tools",
    "path.eyebrow": "Timeline",
    "path.title": "What I built and when",
    "work.eyebrow": "Catalog",
    "work.title": "Work",
    "work.text": "Design cases, live sites, firmware and tools — all made by hand.",
    "contact.eyebrow": "Contact",
    "contact.title": "Let's talk",
    "contact.text": "Open to projects and collaboration. My CV and every way to reach me are on the contact page.",
    "contact.lead": "Open to projects and collaboration. Download my CV or reach out wherever is convenient.",
    "cv.title": "CV",
    "cv.text": "Experience, skills and projects on a single page — as a PDF.",
    "cv.soon": "CV coming soon",
    "ch.title": "Find me",
    "help.title": "How I can help",
    "foot.note": "Built without frameworks · works on any device",
    "foot.ds": "Design system",
    page: "Gift catalog", live: "Open site", code: "Code", code2: "ZMK config", private: "Private", online: "Live",
    sProjects: "projects", sLive: "live sites", sAreas: "areas",
    cvRu: "Download CV · RU", cvEn: "Download CV · EN",
    projects: (n) => `${n} ${n === 1 ? "project" : "projects"}`,
    areas: {
      design: "Art direction, AI 3D and motion for products",
      web: "Websites and web apps — from idea to deploy",
      hardware: "Firmware, devices and companion apps",
      ai: "Bots and image-generation pipelines",
      tools: "Utilities that save hours of routine",
    },
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
  const areas = new Set(PROJECTS.map((p) => p.cat)).size;
  return [[PROJECTS.length, t.sProjects], [live, t.sLive], [areas, t.sAreas]]
    .map(([n, l], i) => `<div class="stat reveal" style="--d:${i * 90}ms"><b>${n}</b><span>${l}</span></div>`).join("");
}

// one card per category that has projects: what I do there + the skills those projects used
function areasHTML(compact) {
  const t = UI[lang];
  return CATEGORIES.filter((c) => c.id !== "all").map((c, i) => {
    const ps = PROJECTS.filter((p) => p.cat === c.id);
    if (!ps.length) return "";
    const skills = uniq(ps.flatMap((p) => p.tags)).slice(0, compact ? 4 : 7);
    return `<a class="area reveal" href="projects.html#cat=${c.id}" style="--d:${i * 80}ms">
      <span class="area-top"><span class="area-ico">${AREA_ICON[c.id] || "✦"}</span><span class="area-n">${t.projects(ps.length)}</span></span>
      <h3>${esc(c[lang])}</h3>
      <p>${esc((t.areas || {})[c.id] || "")}</p>
      ${tagsHTML(skills)}
    </a>`;
  }).join("");
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
  const tags = uniq(PROJECTS.flatMap((p) => p.tags));
  const half = Math.ceil(tags.length / 2);
  const row = (list) => { const s = list.map((x) => `<span>${esc(x)}</span>`).join(""); return s + s; };
  $("#stack").innerHTML = `<div class="marquee-row">${row(tags.slice(0, half))}</div>
    <div class="marquee-row rev">${row(tags.slice(half))}</div>`;

  const years = uniq(PROJECTS.map((p) => p.year)).sort((a, b) => b - a);
  $("#path").innerHTML = years.map((y) => {
    const ps = PROJECTS.filter((p) => p.year === y);
    return `<div class="path-year reveal">
      <div class="path-head"><b>${y}</b><span>${t.projects(ps.length)}</span></div>
      <ul>${ps.map((p) => `<li><span>${esc(p.title[lang])}</span><small>${catName(p.cat)}</small></li>`).join("")}</ul>
    </div>`;
  }).join("");
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
    ? `<a class="btn${k === "en" ? " ghost" : ""}" href="${PROFILE.cv[k]}" download>${label} ↓</a>` : "";
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
