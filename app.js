// Portfolio rendering. Project data lives in projects.json (edited via admin.html).
// cover: { shot: "path", pos: "center top" } | { gifts: [...] } | { glyph: "Text", tint: "#hex", sub: {ru, en} }
// links: page = section of this site, live = working site, code = public repo. visible: false hides a project.

let CATEGORIES = [];
let PROJECTS = [];

const UI = {
  ru: {
    "nav.work": "Проекты", "nav.contact": "Контакты",
    "hero.eyebrow": "Портфолио",
    "hero.title": "Дизайн, AI-визуал и вещи, которые я собираю руками и кодом",
    "hero.lead": "Здесь собраны мои проекты: от коллекции 3D-подарков для соцприложения до веб-каталогов, прошивок для клавиатуры и Telegram-ботов.",
    "contact.title": "Давайте поговорим",
    "contact.text": "Открыт к проектам и сотрудничеству. Проще всего найти меня на GitHub.",
    "foot.note": "Сделано без фреймворков · работает на любом устройстве",
    page: "Каталог подарков", live: "Открыть сайт", code: "Код", code2: "ZMK-конфиг", private: "Приватный", online: "Онлайн",
    sProjects: "проектов", sLive: "живых сайтов", sAreas: "направлений",
  },
  en: {
    "nav.work": "Work", "nav.contact": "Contact",
    "hero.eyebrow": "Portfolio",
    "hero.title": "Design, AI visuals and things I build by hand and in code",
    "hero.lead": "A collection of my projects: from a 3D gift collection for a social app to web catalogs, keyboard firmware and Telegram bots.",
    "contact.title": "Let's talk",
    "contact.text": "Open to projects and collaboration. The easiest way to reach me is GitHub.",
    "foot.note": "Built without frameworks · works on any device",
    page: "Gift catalog", live: "Open site", code: "Code", code2: "ZMK config", private: "Private", online: "Live",
    sProjects: "projects", sLive: "live sites", sAreas: "areas",
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

function cardHTML(p, i) {
  const t = UI[lang];
  const cat = (CATEGORIES.find((c) => c.id === p.cat) || { [lang]: p.cat })[lang];
  const badge = p.links.live
    ? `<span class="badge live">● ${t.online}</span>`
    : p.private ? `<span class="badge">${t.private}</span>` : "";
  const links = [
    p.links.page && `<a class="btn" href="${p.links.page}">${t.page} →</a>`,
    p.links.live && `<a class="btn" href="${p.links.live}" target="_blank" rel="noopener">${t.live} ↗</a>`,
    p.links.code && `<a class="btn ghost" href="${p.links.code}" target="_blank" rel="noopener">${t.code}</a>`,
    p.links.code2 && `<a class="btn ghost" href="${p.links.code2}" target="_blank" rel="noopener">${t.code2}</a>`,
  ].filter(Boolean).join("");
  return `<article class="card${p.featured ? " featured" : ""}" style="animation-delay:${i * 40}ms">
    ${coverHTML(p)}
    <div class="body">
      <div class="meta"><span>${cat} · ${p.year}</span>${badge}</div>
      <h3>${esc(p.title[lang])}</h3>
      <p>${esc(p.desc[lang])}</p>
      <div class="tags">${p.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>
      ${links ? `<div class="links">${links}</div>` : ""}
      ${p.note ? `<div class="note">${esc(p.note[lang])}</div>` : ""}
    </div>
  </article>`;
}

function render() {
  const t = UI[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t[el.dataset.i18n]; });
  $("#lang").textContent = lang === "ru" ? "EN" : "RU";

  const live = PROJECTS.filter((p) => p.links.live).length;
  const areas = new Set(PROJECTS.map((p) => p.cat)).size;
  $("#stats").innerHTML = [[PROJECTS.length, t.sProjects], [live, t.sLive], [areas, t.sAreas]]
    .map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");

  $("#filters").innerHTML = CATEGORIES.map((c) => {
    const n = c.id === "all" ? PROJECTS.length : PROJECTS.filter((p) => p.cat === c.id).length;
    if (!n) return "";
    return `<button class="chip" role="tab" data-cat="${c.id}" aria-selected="${c.id === filter}">${c[lang]}<small>${n}</small></button>`;
  }).join("");

  const list = PROJECTS.filter((p) => filter === "all" || p.cat === filter);
  $("#grid").innerHTML = list.map(cardHTML).join("");
}

// admin.html reuses cardHTML for its preview and has no #grid, so only boot the page here.
if ($("#grid")) {
  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    filter = b.dataset.cat;
    history.replaceState(null, "", filter === "all" ? location.pathname : `#cat=${filter}`);
    render();
  });
  $("#lang").addEventListener("click", () => {
    lang = lang === "ru" ? "en" : "ru";
    store.set("lang", lang);
    render();
  });
  $("#year").textContent = new Date().getFullYear();

  fetch("projects.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((data) => {
      CATEGORIES = [{ id: "all", ru: "Все", en: "All" }, ...data.categories];
      PROJECTS = data.projects.filter((p) => p.visible !== false);
      if (!CATEGORIES.some((c) => c.id === filter)) filter = "all";
      render();
    })
    .catch((err) => { console.error(err); $("#grid").textContent = "Could not load projects."; });
}
