// Portfolio data + rendering. To add a project, append an entry to PROJECTS.
// cover: { shot: "path" } | { gifts: [...] } | { glyph: "Text", tint: "#hex" }
// links: page = section of this site, live = working site, code = public repo. Private repos get no code link.

const CATEGORIES = [
  { id: "all",      ru: "Все",          en: "All" },
  { id: "design",   ru: "Дизайн",       en: "Design" },
  { id: "web",      ru: "Веб",          en: "Web" },
  { id: "hardware", ru: "Железо",       en: "Hardware" },
  { id: "ai",       ru: "AI и боты",    en: "AI & bots" },
  { id: "tools",    ru: "Инструменты",  en: "Tools" },
];

const PROJECTS = [
  {
    id: "virtual-gifts", cat: "design", featured: true, year: 2026,
    cover: { gifts: ["wed__wedding_kiss", "sep__yacht_3d", "wed__wedding_rings", "sep__glass_heart_3d",
                     "sep__crown_ai_3d", "wed__wedding_cake", "sep__panda_with_heart_ai_3d", "sep__merry_go_round"] },
    title: { ru: "Virtual Gifts", en: "Virtual Gifts" },
    desc: {
      ru: "Коллекция анимированных 3D-подарков для соцприложения: от идеи и единого стиля до пакета, который разработчики выкладывают без ручной работы. 56 подарков, анимация с альфа-каналом и звук.",
      en: "A collection of animated 3D gifts for a social app: from the idea and one shared style to a package developers ship with no manual work. 56 gifts, alpha-channel animation and sound.",
    },
    tags: ["AI 3D", "Motion", "Art direction", "VP9 alpha"],
    links: { page: "/gift-catalog/" },
    note: { ru: "Полный кейс скоро здесь", en: "Full case study coming soon" },
  },
  {
    id: "boardex", cat: "web", year: 2026,
    cover: { shot: "assets/shots/boardex.jpg" },
    title: { ru: "Boardex.am", en: "Boardex.am" },
    desc: {
      ru: "Каталог б/у настольных игр в Армении: поиск, фильтры по языку, игрокам и цене, рейтинг BoardGameGeek и связь с продавцом в Telegram. Интерфейс на трёх языках.",
      en: "A catalog of second-hand board games in Armenia: search, filters by language, players and price, BoardGameGeek ratings and contacting sellers via Telegram. Three-language UI.",
    },
    tags: ["HTML/CSS/JS", "Python", "Cloudflare Pages"],
    links: { live: "https://nastolki-catalog.pages.dev", code: "https://github.com/EyeAnton/nastolki-catalog" },
  },
  {
    id: "wishlist", cat: "web", year: 2026,
    cover: { shot: "assets/shots/wishlist.jpg" },
    title: { ru: "Вишлист", en: "Wishlist" },
    desc: {
      ru: "Вишлист с календарём до праздника и анонимным бронированием подарков: владелец не видит, кто что выбрал, так что сюрприз остаётся сюрпризом. Тёмная и светлая темы, пересчёт валют.",
      en: "A wishlist with a countdown calendar and anonymous gift booking: the owner can't see who picked what, so the surprise stays a surprise. Dark and light themes, currency conversion.",
    },
    tags: ["JavaScript", "GitHub Pages"],
    links: { live: "https://eyeanton.github.io/wishlist/", code: "https://github.com/EyeAnton/wishlist" },
  },
  {
    id: "card-constructor", cat: "web", year: 2026, private: true,
    cover: { glyph: "A4", tint: "#3b2a22", sub: { ru: "печать · PNG", en: "print · PNG" } },
    title: { ru: "Карточки родословной", en: "Family Tree Cards" },
    desc: {
      ru: "Конструктор листа A4 с карточками родственников: фото, имя, кем приходится, линии родства и брака. Вход через Google, синхронизация между устройствами, экспорт в PNG и печать.",
      en: "A builder for an A4 sheet of relatives' cards: photo, name, relation, kinship and marriage lines. Google sign-in, sync across devices, PNG export and print.",
    },
    tags: ["HTML/CSS/JS", "Firebase", "html2canvas"],
    links: {},
  },
  {
    id: "archive", cat: "web", year: 2026, private: true,
    cover: { glyph: "∞", tint: "#3a2430", sub: { ru: "таймлайн", en: "timeline" } },
    title: { ru: "Наш архив", en: "Our Archive" },
    desc: {
      ru: "Личный сайт-таймлайн: события и фотографии на одной ленте, с инструментами импорта фото и подбора событий.",
      en: "A personal timeline site: events and photos on one feed, with tools for importing photos and picking events.",
    },
    tags: ["HTML/JS", "Firebase"],
    links: {},
  },
  {
    id: "soultemple", cat: "design", year: 2025,
    cover: { shot: "assets/shots/soultemple.jpg" },
    title: { ru: "Temple Soul", en: "Temple Soul" },
    desc: {
      ru: "Прототип браузерной игры-путешествия: сгенерированные AI сцены и персонажи, переходы между локациями.",
      en: "A prototype of a browser journey game: AI-generated scenes and characters, transitions between locations.",
    },
    tags: ["React", "TypeScript", "AI art"],
    links: { code: "https://github.com/EyeAnton/SoulTemple" },
  },
  {
    id: "stasik", cat: "hardware", year: 2026, private: true,
    cover: { glyph: "M5", tint: "#1f3330", sub: { ru: "ESP32 · Android", en: "ESP32 · Android" } },
    title: { ru: "Стасик", en: "Stasik" },
    desc: {
      ru: "Прошивка для M5Stack (ESP32): счётчик здоровья с экраном, кнопками и звуком, обновление по Wi-Fi. Плюс Android-приложение — пульт для устройства.",
      en: "Firmware for M5Stack (ESP32): a health counter with screen, buttons and sound, over-the-air updates. Plus an Android app that works as its remote.",
    },
    tags: ["C++", "PlatformIO", "M5Unified", "Android"],
    links: {},
  },
  {
    id: "qmk-hid-host", cat: "hardware", year: 2026, private: true,
    cover: { glyph: "HID", tint: "#262a3a", sub: { ru: "Rust", en: "Rust" } },
    title: { ru: "QMK HID Host", en: "QMK HID Host" },
    desc: {
      ru: "Приложение-компаньон для клавиатуры Ergohaven K:03 PRO: передаёт на её экран время, громкость, раскладку, трек и погоду через Raw HID. Windows, Linux, macOS.",
      en: "A companion app for the Ergohaven K:03 PRO keyboard: sends time, volume, layout, now playing and weather to its screen over Raw HID. Windows, Linux, macOS.",
    },
    tags: ["Rust", "Raw HID", "Cross-platform"],
    links: {},
  },
  {
    id: "keyboard-firmware", cat: "hardware", year: 2026,
    cover: { glyph: "K:03", tint: "#2c2a1e", sub: { ru: "QMK · ZMK", en: "QMK · ZMK" } },
    title: { ru: "Прошивка клавиатуры", en: "Keyboard Firmware" },
    desc: {
      ru: "Своя сборка Vial-QMK и конфиг ZMK для Ergohaven K:03 PRO: раскладка, слои и интеграция с HID Host.",
      en: "A custom Vial-QMK build and ZMK config for the Ergohaven K:03 PRO: keymap, layers and HID Host integration.",
    },
    tags: ["C", "QMK", "Vial", "ZMK"],
    links: { code: "https://github.com/EyeAnton/my-first-keyboard", code2: "https://github.com/EyeAnton/ergohaven-zmk-config" },
  },
  {
    id: "sticker-bot", cat: "ai", year: 2026, private: true,
    cover: { glyph: "✦", tint: "#2a2340", sub: { ru: "Telegram", en: "Telegram" } },
    title: { ru: "Sticker Bot", en: "Sticker Bot" },
    desc: {
      ru: "Telegram-бот, который превращает фото в стикеры и стилизованные портреты через AI-пайплайны RunningHub. Мультиязычный, работает в Docker.",
      en: "A Telegram bot that turns photos into stickers and stylised portraits through RunningHub AI pipelines. Multilingual, runs in Docker.",
    },
    tags: ["Python", "aiogram", "ComfyUI", "Docker"],
    links: {},
  },
  {
    id: "echoes-of-peru", cat: "ai", year: 2025,
    cover: { glyph: "FLUX", tint: "#3a2a1a", sub: { ru: "ComfyUI · Replicate", en: "ComfyUI · Replicate" } },
    title: { ru: "Echoes of Peru", en: "Echoes of Peru" },
    desc: {
      ru: "Генерация изображений на FLUX: воркфлоу ComfyUI, упакованные в модель для Replicate (Cog), с набором промптов.",
      en: "Image generation with FLUX: ComfyUI workflows packaged as a Replicate model (Cog), with a prompt set.",
    },
    tags: ["Python", "FLUX", "ComfyUI", "Replicate"],
    links: { code: "https://github.com/EyeAnton/echoes-of-peru-flux-comfy" },
  },
  {
    id: "photosort", cat: "tools", year: 2026, private: true,
    cover: { glyph: "RAW", tint: "#22303a", sub: { ru: "десктоп", en: "desktop" } },
    title: { ru: "PhotoSort", en: "PhotoSort" },
    desc: {
      ru: "Десктоп-программа для разбора фотоархива: превью RAW и видео, бэкап перед разбором, разметка и дедупликация, перенос в архив с нужным форматом имён.",
      en: "A desktop app for sorting a photo archive: RAW and video previews, backup before sorting, tagging and dedup, moving into the archive with consistent file names.",
    },
    tags: ["Python", "rawpy", "OpenCV"],
    links: {},
  },
];

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
    return `<div class="cover"><img class="shot" src="${c.shot}" alt="${esc(p.title[lang])}" loading="lazy"></div>`;
  }
  return `<div class="cover type" style="--tint:${c.tint}">
    <span class="glyph">${esc(c.glyph)}</span>
    ${c.sub ? `<span class="glyph-sub">${esc(c.sub[lang])}</span>` : ""}
  </div>`;
}

function cardHTML(p, i) {
  const t = UI[lang];
  const cat = CATEGORIES.find((c) => c.id === p.cat)[lang];
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
    return `<button class="chip" role="tab" data-cat="${c.id}" aria-selected="${c.id === filter}">${c[lang]}<small>${n}</small></button>`;
  }).join("");

  const list = PROJECTS.filter((p) => filter === "all" || p.cat === filter);
  $("#grid").innerHTML = list.map(cardHTML).join("");
}

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
render();
