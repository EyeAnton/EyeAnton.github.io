// Portfolio rendering.
// Content: site.json (texts RU/EN, home blocks order/visibility, profile: skills, stack, experience, contacts)
// and projects.json (projects). Both are edited in admin.html; the home page also has a visual editor there.
// project.cover: { shot: "path", pos: "center top" } | { gifts: [...] } | { glyph: "Text", tint: "#hex", sub: {ru, en} }
// project.links: page = section of this site, live = working site, code = public repo. visible: false hides it.
// project.home: true puts it into "Selected work" on the main page.
// project.page: [content blocks] — the project's own page project.html?id=<id> (cards link to it when not empty).
// project.head: { eyebrow, lead, accent (part of the title in gradient), ctas: [{label, href}], cloud: [images] } — its hero.
// Content block: { id, type (see BLOCK_HTML), visible, w: "half" (project pages), anchor, eyebrow/title/text (section head), items, ... };
// localized fields are {ru, en}. Custom home blocks are the same objects in site.json → blocks (they have a type).
// Pages: <body data-page="home|projects|project|contact">. admin.html and design-system.html have no data-page
// and only reuse cardHTML / coverHTML (after loadSite()).

let CATEGORIES = [];
let PROJECTS = [];
let SITE = null;
let PROFILE = { channels: [], skills: [], stack: [[], []], soft: { ru: [], en: [] }, experience: [], cv: {} };

// Strings come from site.json (applySite); only the plural helpers live in code.
const UI = {
  ru: {
    projects: (n) => `${n} ${plural(n, "проект", "проекта", "проектов")}`,
  },
  en: {
    projects: (n) => `${n} ${n === 1 ? "project" : "projects"}`,
  },
};

function applySite(site) {
  SITE = site;
  PROFILE = site.profile;
  for (const l of ["ru", "en"]) Object.assign(UI[l], site.text[l]);
}
const loadSite = () => fetch("site.json", { cache: "no-cache" }).then((r) => r.json()).then(applySite);

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let lang = store.get("lang") || ((navigator.language || "ru").toLowerCase().startsWith("ru") ? "ru" : "en");
let filter = (location.hash.match(/^#cat=(\w+)/) || [])[1] || "all";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PAGE = document.body.dataset.page;

// Visual editor: the home / project page inside admin.html's iframe (?edit), driven by window.parent.siteEditor.
const EDITOR = (() => {
  if (!["home", "project"].includes(PAGE) || !new URLSearchParams(location.search).has("edit") || window.parent === window) return null;
  try { return window.parent.siteEditor || null; } catch { return null; }
})();

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const catName = (id) => (CATEGORIES.find((c) => c.id === id) || { [lang]: id })[lang];
const num = (i) => String(i + 1).padStart(2, "0");

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
    ? `<span class="badge live">${esc(t.online)}</span>`
    : p.private ? `<span class="badge">${esc(t.private)}</span>` : "";
}

// a section of this site (links.page) wins; otherwise the project's own page, once it has blocks
const pageURL = (p) => p.links.page || (p.page?.length ? `project.html?id=${encodeURIComponent(p.id)}` : "");

function linksHTML(p, onOwnPage) {
  const t = UI[lang];
  const page = onOwnPage ? "" : pageURL(p);
  return [
    page && `<a class="btn" href="${esc(page)}">${esc(t.page)} →</a>`,
    p.links.live && `<a class="btn" href="${p.links.live}" target="_blank" rel="noopener">${esc(t.live)} ↗</a>`,
    PROFILE.showCode && p.links.code && `<a class="btn ghost" href="${p.links.code}" target="_blank" rel="noopener">${esc(t.code)}</a>`,
    PROFILE.showCode && p.links.code2 && `<a class="btn ghost" href="${p.links.code2}" target="_blank" rel="noopener">${esc(t.code2)}</a>`,
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
    .map(([n, l], i) => `<div class="stat reveal" style="--d:${i * 90}ms"><b>${n}</b><span>${esc(l)}</span></div>`).join("");
}

// skill groups: big gradient number, title, text, tools — rows line up across cards (subgrid)
function areasHTML(compact) {
  return PROFILE.skills.map((g, i) => `<div class="area reveal" style="--d:${i * 80}ms">
      <span class="area-num">${num(i)}</span>
      <h3>${esc(g.title[lang])}</h3>
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

/* ---------------- content blocks (project pages, custom home blocks) ---------------- */
// Markup follows the Emotions Club case (styles: case.css, cs-*). Any block may carry a section head —
// eyebrow / title / text, centred; a block without one sits tight under the block above.

// a localized field; an untranslated one falls back to the other language on the site (the editor shows it empty)
const L = (o) => (o && typeof o === "object" ? o[lang] || (EDITOR ? "" : o[lang === "ru" ? "en" : "ru"]) || "" : o ?? "");
const imgSrc = (s) => (EDITOR?.src ? EDITOR.src(s) : s); // the editor swaps not yet published uploads for data URLs
const getIn = (o, path) => path.split(".").reduce((x, k) => (x == null ? x : x[k]), o);

// an editable text: data-f = path inside the block, data-raw = not localized.
// Empty: hidden on the site; in the editor a placeholder, but only when the key exists in the block.
function fld(b, path, tag, ph, raw, cls) {
  const v = getIn(b, path);
  const val = raw ? (v ?? "") : L(v);
  if (!val && (!EDITOR || v === undefined)) return "";
  return `<${tag}${cls ? ` class="${cls}"` : ""} data-f="${path}"${raw ? " data-raw" : ""} data-ph="${ph}">${esc(val)}</${tag}>`;
}

const empty = (what) => (EDITOR ? `<div class="cb-empty">${what} — в панели справа</div>` : "");
const imgHTML = (s, alt = "") => (s ? `<img src="${esc(imgSrc(s))}" alt="${esc(alt)}" loading="lazy">` : empty("Загрузите картинку"));
// muted loops that play only while on screen (watchVideos)
const loopHTML = (it) => it.src
  ? `<video muted loop playsinline preload="none" data-play${it.poster ? ` poster="${esc(imgSrc(it.poster))}"` : ""} src="${esc(imgSrc(it.src))}"></video>`
  : empty("Укажите видео");
// code panels: plain text; <k>key</k>, <s>string</s>, <i>comment</i> are kept as highlighting
const codeHTML = (s) => esc(s).replace(/&lt;(\/?)([ksi])&gt;/g, "<$1$2>");
const ext = (href) => (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : "");
const each = (b, f) => (b.items || []).map((it, i) => f(it, i, `items.${i}`)).join("") || empty("Добавьте пункты");
const btns = (b, path = "items") => (getIn(b, path) || []).filter((it) => EDITOR || it.href).map((it, i) =>
  `<a class="btn${i ? " ghost" : ""}" href="${esc(it.href || "#")}"${ext(it.href || "")}>${fld(b, `${path}.${i}.label`, "span", "Кнопка") || esc(it.href)}</a>`).join("");

function videoHTML(src) {
  if (!src) return empty("Вставьте ссылку на видео");
  const yt = src.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  const vm = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  const embed = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : vm ? `https://player.vimeo.com/video/${vm[1]}` : "";
  return `<div class="pb-video">${embed
    ? `<iframe src="${embed}" title="Video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
    : `<video src="${esc(imgSrc(src))}" muted loop playsinline controls data-play></video>`}</div>`;
}

const BLOCK_HTML = {
  text: () => "",
  facts: (b) => `<dl class="cs-meta surface">${each(b, (it, i, p) =>
    `<div>${fld(b, `${p}.k`, "dt", "Поле")}${fld(b, `${p}.v`, "dd", "Значение")}</div>`)}</dl>`,
  stats: (b) => `<div class="stats">${each(b, (it, i, p) =>
    `<div class="stat reveal" style="--d:${i * 80}ms">${fld(b, `${p}.n`, "b", "42", true)}${fld(b, `${p}.label`, "span", "подпись")}</div>`)}</div>`,
  cards: (b) => `<div class="cs-cards">${each(b, (it, i, p) => `<article class="cs-card surface reveal" style="--d:${i * 80}ms">
    <span class="cs-num">${num(i)}</span>${fld(b, `${p}.t`, "h3", "Заголовок")}${fld(b, `${p}.d`, "p", "Текст")}</article>`)}</div>`,
  flow: (b) => `<ol class="cs-flow">${each(b, (it, i, p) =>
    `<li class="reveal" style="--d:${i * 60}ms">${fld(b, `${p}.t`, "b", "Шаг")}${fld(b, `${p}.d`, "span", "Описание")}</li>`)}</ol>`,
  code: (b) => `<div class="cs-code reveal">${each(b, (it, i, p) =>
    `<div class="surface">${fld(b, `${p}.label`, "p", "Подпись", false, "cs-label")}<pre>${codeHTML(it.code || "")}</pre></div>`)}</div>`,
  strip: (b) => `<div class="cs-strip reveal" tabindex="0">${each(b, (it, i, p) => `<figure>${imgHTML(it.src)}
    <figcaption>${fld(b, `${p}.t`, "b", "Подпись") || "<b>&nbsp;</b>"}${fld(b, `${p}.c`, "code", "файл", true)}</figcaption></figure>`)}</div>
    ${fld(b, "hint", "p", "Подсказка", false, "cs-hint")}`,
  cast: (b) => `<div class="cs-cast reveal">${each(b, (it, i, p) => `<figure>${imgHTML(it.src, L(it.t))}
    <figcaption>${fld(b, `${p}.t`, "b", "Имя")}${fld(b, `${p}.d`, "span", "Роль")}${fld(b, `${p}.c`, "code", "файл", true)}</figcaption></figure>`)}</div>`,
  pair: (b) => `<div class="cs-pair reveal">${each(b, (it, i, p) =>
    `<figure>${imgHTML(it.src)}${fld(b, `${p}.cap`, "figcaption", "Подпись")}</figure>`)}</div>`,
  lineups: (b) => `<div class="cs-casts">${each(b, (it, i, p) => `<article class="cs-lineup reveal">${fld(b, `${p}.t`, "h3", "Название")}
    <div>${(it.images || []).map((s) => imgHTML(s)).join("")}</div></article>`)}</div>`,
  covers: (b) => `<div class="cs-covers">${each(b, (it, i, p) =>
    `<figure class="reveal">${imgHTML(it.src, L(it.t))}${fld(b, `${p}.t`, "figcaption", "Название")}</figure>`)}</div>`,
  vcovers: (b) => `<div class="cs-vcovers">${each(b, (it, i, p) =>
    `<figure class="reveal">${loopHTML(it)}${fld(b, `${p}.t`, "figcaption", "Название")}</figure>`)}</div>`,
  phones: (b) => `<div class="cs-phones">${each(b, (it) => `<div class="cs-phone reveal">${loopHTML(it)}</div>`)}</div>`,
  results: (b) => `<ul class="cs-results">${each(b, (it, i, p) =>
    `<li class="surface reveal" style="--d:${i * 80}ms">${fld(b, `${p}.t`, "b", "Итог")}${fld(b, `${p}.d`, "span", "Описание")}</li>`)}</ul>`,
  image: (b) => `<figure class="pb-img reveal">${imgHTML(b.src)}${fld(b, "caption", "figcaption", "Подпись")}</figure>`,
  gallery: (b) => `<div class="pb-gal reveal" style="--cols:${+b.cols || 3}">${(b.images || []).map((s) => imgHTML(s)).join("") || empty("Добавьте картинки")}</div>
    ${fld(b, "caption", "p", "Подпись", false, "pb-cap")}`,
  video: (b) => videoHTML(b.src) + fld(b, "caption", "p", "Подпись", false, "pb-cap"),
  quote: (b) => `<blockquote class="pb-quote reveal">${fld(b, "quote", "p", "Цитата")}${fld(b, "who", "cite", "Автор")}</blockquote>`,
  links: (b) => `<div class="pb-links reveal">${btns(b)}</div>`,
};

const headHTML = (b) => {
  const h = fld(b, "eyebrow", "p", "Надзаголовок", false, "eyebrow") + fld(b, "title", "h2", "Заголовок") + fld(b, "text", "p", "Текст");
  return h ? `<div class="sec-head reveal">${h}</div>` : "";
};

// "next": the closing CTA (like the site's contact section) — full bleed on project pages
function nextHTML(b) {
  return `<div class="beams" aria-hidden="true"></div>${fld(b, "eyebrow", "p", "Надзаголовок", false, "eyebrow reveal")}
    ${fld(b, "title", "h2", "Заголовок", false, "reveal")}${fld(b, "text", "p", "Текст", false, "reveal")}
    <div class="contact-links reveal">${btns(b)}</div>`;
}

// home: a section like the built-in ones; project page: a cell of the two-column grid (w: "half")
function blockHTML(b, home) {
  const off = EDITOR && b.visible === false ? " block-off" : "";
  const attrs = `data-block="${esc(b.id)}"${b.anchor ? ` id="${esc(b.anchor)}"` : ""}`;
  if (b.type === "next") {
    return home ? `<section class="contact cb-home${off}" ${attrs}>${nextHTML(b)}</section>`
      : `<div class="pb pb-next-wrap${off}" ${attrs}><section class="contact pb-next">${nextHTML(b)}</section></div>`;
  }
  const head = headHTML(b);
  const body = (BLOCK_HTML[b.type] || (() => ""))(b);
  return home ? `<section class="block cb-home${off}" ${attrs}>${head}${body}</section>`
    : `<div class="pb pb-${b.type}${b.w === "half" ? " half" : ""}${head ? "" : " tight"}${off}" ${attrs}>${head}${body}</div>`;
}
const blocksHTML = (list, home) => (list || []).filter((b) => EDITOR || b.visible !== false).map((b) => blockHTML(b, home)).join("");

const vio = "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches
  ? new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause())), { threshold: 0.4 })
  : null;
const watchVideos = () => document.querySelectorAll("video[data-play]").forEach((v) => vio?.observe(v));

/* ---------------- pages ---------------- */

// order and visibility of the home sections come from site.json → blocks;
// custom blocks (the ones with a type) are rebuilt from it on every render
function arrangeBlocks() {
  const main = $("main");
  main.querySelectorAll(".cb-home").forEach((el) => el.remove());
  for (const b of SITE.blocks || []) {
    if (b.type) {
      if (EDITOR || b.visible !== false) main.insertAdjacentHTML("beforeend", blockHTML(b, true));
      continue;
    }
    const el = main.querySelector(`[data-block="${b.id}"]`);
    if (!el) continue;
    main.appendChild(el);
    if (EDITOR) el.classList.toggle("block-off", b.visible === false); // the editor shows hidden blocks dimmed
    else el.hidden = b.visible === false;
  }
}

function renderHome() {
  arrangeBlocks();
  $("#stats").innerHTML = statsHTML();
  $("#areas").innerHTML = areasHTML(false);

  let picks = PROJECTS.filter((p) => p.home);
  if (!picks.length) picks = PROJECTS.slice(0, 4);
  $("#showcase").innerHTML = picks.map((p, i) => {
    const links = linksHTML(p);
    return `<article class="show reveal">
      <div class="show-media">${coverHTML(p)}</div>
      <div class="show-body">
        <span class="show-num">${num(i)}</span>
        <div class="meta"><span>${catName(p.cat)} · ${p.year}</span>${badgeHTML(p)}</div>
        <h3>${esc(p.title[lang])}</h3>
        <p>${esc(p.desc[lang])}</p>
        ${tagsHTML(p.tags)}
        ${links ? `<div class="links">${links}</div>` : ""}
      </div>
    </article>`;
  }).join("");

  // stack ticker: the curated profile.stack rows (not raw project tags — those include libraries),
  // repeated 4× so a short row still covers wide screens; the -50% keyframe loops over two copies
  // profile.stackInfo.<lang>: lines "Name — short description" → tooltip on click
  const info = {};
  for (const l of PROFILE.stackInfo?.[lang] || []) {
    const [k, ...v] = l.split(" — ");
    if (v.length) info[k.trim().toLowerCase()] = v.join(" — ").trim();
  }
  const row = (list) => list.map((x) => {
    const tip = info[x.toLowerCase()];
    return tip ? `<span data-tip="${esc(tip)}" tabindex="0">${esc(x)}</span>` : `<span>${esc(x)}</span>`;
  }).join("").repeat(4);
  $("#stack").innerHTML = `<div class="marquee-row">${row(PROFILE.stack[0] || [])}</div>
    <div class="marquee-row rev">${row(PROFILE.stack[1] || [])}</div>`;

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

// project.html?id=<id>: a case page like Emotions Club — hero (project.head + the card's title / text / links),
// then project.page blocks. A "next" block replaces the default contact section at the bottom.
function renderProject() {
  const t = UI[lang];
  const id = new URLSearchParams(location.search).get("id");
  const p = EDITOR ? EDITOR.project() : PROJECTS.find((x) => x.id === id);
  const crumb = `<a class="cs-crumb" href="projects.html">${esc(t["proj.back"])}</a>`;
  if (!p) {
    $("#projHead").innerHTML = `${crumb}<h1>${lang === "ru" ? "Проект не найден" : "Project not found"}</h1>`;
    $("#projBlocks").innerHTML = "";
    return;
  }
  document.title = `${p.title[lang]} — Anton Egorov`;
  const h = p.head || {};
  if (EDITOR) p.head = { eyebrow: {}, lead: {}, ...h }; // a copy: show the placeholders

  // the "accent" part of the title gets the brand gradient (Emotions <Club>)
  let title = esc(L(p.title));
  if (h.accent && title.includes(esc(h.accent))) title = title.replace(esc(h.accent), `<span class="t-grad">${esc(h.accent)}</span>`);
  const lead = fld(p, L(h.lead) || (EDITOR && !L(p.desc)) ? "head.lead" : "desc", "p", "Лид", false, "lead");
  const ctas = btns(p, "head.ctas") + linksHTML(p, true);
  const cloud = (h.cloud || []).map((s) => `<img src="${esc(imgSrc(s))}" alt="">`).join("");
  $("#projHead").innerHTML = `<div class="aurora" aria-hidden="true"></div>${crumb}
    ${fld(p, "head.eyebrow", "p", "Надзаголовок", false, "eyebrow")}
    <h1 data-f="title" data-ph="Название">${title}</h1>
    ${lead}
    ${ctas ? `<div class="hero-cta">${ctas}</div>` : ""}
    ${cloud ? `<div class="cs-cloud" aria-hidden="true"><div class="cs-cloud-track">${cloud + cloud}</div></div>`
      : `<div class="show-media cs-hero-cover">${coverHTML(p)}</div>`}`;
  $("#projBlocks").innerHTML = blocksHTML(p.page, false);
  $("#projContact").hidden = (p.page || []).some((b) => b.type === "next" && (EDITOR || b.visible !== false));
}

let cvAvailable = {};
function renderContact() {
  const t = UI[lang];
  const cvBtn = (k, label) => cvAvailable[k]
    ? `<a class="btn${k === "en" ? " ghost" : ""}" href="${PROFILE.cv[k]}" download="Anton-Egorov-CV-${k.toUpperCase()}.pdf">${esc(label)} ↓</a>` : "";
  const btns = cvBtn("ru", t.cvRu) + cvBtn("en", t.cvEn);
  $("#cvLinks").innerHTML = btns || `<span class="btn quiet" aria-disabled="true">${esc(t["cv.soon"])}</span>`;
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
let firstRender = !EDITOR;
function watchReveal() {
  document.querySelectorAll(".reveal:not(.in)").forEach((el) => {
    // after a language switch (or in the editor) the content is rebuilt; don't replay the entrance
    if (!io || !firstRender) el.classList.add("in"); else io.observe(el);
  });
  firstRender = false;
}

function render() {
  const t = UI[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const v = t[el.dataset.i18n];
    if (v != null && el !== document.activeElement) el.textContent = v;
  });
  document.documentElement.classList.add("i18n-ready");
  $("#lang").textContent = lang === "ru" ? "EN" : "RU";
  const cvTop = $("#cvTop"); // header "CV ↓": the résumé in the current language
  if (cvTop && PROFILE.cv?.[lang]) {
    cvTop.href = PROFILE.cv[lang];
    cvTop.download = `Anton-Egorov-CV-${lang.toUpperCase()}.pdf`;
  }
  if (PAGE === "home") renderHome();
  if (PAGE === "projects") renderProjects();
  if (PAGE === "project") renderProject();
  if (PAGE === "contact") renderContact();
  watchReveal();
  watchVideos();
  if (EDITOR) decorateForEditor();
}

function setProjects(data) {
  CATEGORIES = [{ id: "all", ru: "Все", en: "All" }, ...data.categories];
  PROJECTS = data.projects.filter((p) => p.visible !== false);
  if (!CATEGORIES.some((c) => c.id === filter)) filter = "all";
}

/* ---------------- visual editor (inside admin.html) ---------------- */

const EDITABLE = (() => {
  const d = document.createElement("div");
  d.contentEditable = "plaintext-only";
  return d.contentEditable === "plaintext-only" ? "plaintext-only" : "true";
})();

function decorateForEditor() {
  document.querySelectorAll("[data-i18n], [data-f]").forEach((el) => {
    if (el.closest(".top")) return; // header tabs stay plain; nav labels are edited in the side panel
    el.contentEditable = EDITABLE;
    el.spellcheck = false;
  });
  // every block gets a bar (settings · move · hide or delete) and a "+ блок" under it that inserts a block after it
  document.querySelectorAll("[data-block]").forEach((el) => {
    el.querySelectorAll(":scope > .edit-bar, :scope > .edit-add").forEach((x) => x.remove());
    const id = el.dataset.block;
    const info = EDITOR.blockInfo(id);
    const btn = (act, label, title) => `<button type="button" data-act="${act}" title="${title}">${label}</button>`;
    el.insertAdjacentHTML("afterbegin", `<div class="edit-bar" data-for="${esc(id)}" contenteditable="false">${
      btn("open", `${esc(info.name)} · настроить`, "Настройки блока")}${
      info.movable ? btn("up", "↑", "Выше") + btn("down", "↓", "Ниже") : ""}${
      info.removable ? btn("del", "✕", "Удалить блок") : info.hideable ? btn("vis", info.hidden ? "показать" : "скрыть", "Показывать на сайте") : ""}</div>`);
    el.insertAdjacentHTML("beforeend",
      `<button type="button" class="edit-add" data-for="${esc(id)}" data-act="add" contenteditable="false" title="Добавить блок ниже">+ блок</button>`);
  });
}

function bootEditor() {
  document.documentElement.classList.add("editing");
  // ✕ over a text inside a block: delete that text, or the whole list item it sits in (a card, a step, a button)
  const del = document.createElement("div");
  del.className = "edit-del";
  del.contentEditable = "false";
  document.body.appendChild(del);
  let delFor = null, delTimer = 0;
  const hideDel = () => { del.classList.remove("on"); delFor = null; };
  document.addEventListener("mouseover", (e) => {
    clearTimeout(delTimer);
    if (e.target.closest(".edit-del")) return;
    const el = e.target.closest("[data-block] [data-f]");
    if (!el || !EDITOR.blockInfo(el.closest("[data-block]").dataset.block).removable) { delTimer = setTimeout(hideDel, 300); return; }
    if (el === delFor) return;
    delFor = el;
    del.innerHTML = `<button type="button" data-del="field" title="Удалить этот текст">✕ текст</button>${
      /\.\d+\.[^.]+$/.test(el.dataset.f) ? `<button type="button" data-del="item" title="Удалить весь пункт">✕ пункт</button>` : ""}`;
    const r = el.getBoundingClientRect();
    del.style.left = `${r.right + scrollX}px`;
    del.style.top = `${r.top + scrollY}px`;
    del.classList.add("on");
  });

  const sync = () => {
    hideDel();
    lang = EDITOR.lang;
    applySite(EDITOR.draft);
    setProjects(EDITOR.projects());
    render();
  };
  window.siteEdit = { refresh: sync };

  document.addEventListener("click", (e) => {
    const d = e.target.closest(".edit-del button");
    if (d && delFor) {
      e.preventDefault();
      const el = delFor;
      hideDel();
      EDITOR.removeField(el.closest("[data-block]").dataset.block, el.dataset.f, d.dataset.del === "item");
      return;
    }
    const b = e.target.closest(".edit-bar button, .edit-add");
    if (b) { e.preventDefault(); EDITOR.blockAction(b.closest("[data-for]").dataset.for, b.dataset.act); return; }
    if (e.target.closest("a, #lang, .chip")) e.preventDefault(); // no navigation while editing
  }, true);
  document.addEventListener("input", (e) => {
    const el = e.target.closest?.("[data-f], [data-i18n]");
    if (!el) return;
    const val = el.innerText.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, ""); // line breaks are kept (Shift+Enter)
    if (el.dataset.f) { // a block field: data-block = which block ("_head" = the project itself), data-f = path in it
      EDITOR.onField(el.closest("[data-block]").dataset.block, el.dataset.f, val, el.hasAttribute("data-raw"));
      return;
    }
    const key = el.dataset.i18n;
    // the same text can appear twice on the page (e.g. the CV button) — keep the copies in step
    document.querySelectorAll(`[data-i18n="${key}"]`).forEach((o) => { if (o !== el) o.textContent = val; });
    EDITOR.onText(key, val);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.closest?.("[data-i18n], [data-f]")) return;
    e.preventDefault();
    if (e.shiftKey) document.execCommand("insertLineBreak"); // Shift+Enter — new line, Enter — done
    else e.target.blur();
  });
  document.addEventListener("paste", (e) => {
    if (!e.target.closest?.("[data-i18n], [data-f]")) return;
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain") || "");
  });
  sync();
  EDITOR.ready();
}

// stack chips: click shows a short tooltip; the ticker stays paused while it is open
function setupStackTips() {
  const box = $("#stack");
  if (!box) return;
  const tip = document.createElement("div");
  tip.className = "stack-tip";
  tip.setAttribute("role", "tooltip");
  document.body.append(tip);
  let cur = null;
  const hide = () => { tip.classList.remove("on"); box.classList.remove("hold"); cur = null; };
  const show = (el) => {
    if (cur === el) return hide();
    cur = el;
    tip.innerHTML = `<b>${esc(el.textContent)}</b>${esc(el.dataset.tip)}`;
    const r = el.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(r.left + r.width / 2, 140), innerWidth - 140)}px`;
    tip.style.top = `${r.top}px`;
    tip.classList.add("on");
    box.classList.add("hold");
  };
  box.addEventListener("click", (e) => {
    const el = e.target.closest("span[data-tip]");
    if (el) { e.stopPropagation(); show(el); }
  });
  box.addEventListener("keydown", (e) => {
    const el = e.target.closest?.("span[data-tip]");
    if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); show(el); }
  });
  document.addEventListener("click", hide);
  addEventListener("scroll", () => cur && hide(), { passive: true });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && cur) hide(); });
}

if (PAGE) {
  document.documentElement.classList.add("js");
  $("#year").textContent = new Date().getFullYear();
  setupStackTips();

  if (EDITOR) {
    bootEditor();
  } else {
    $("#lang").addEventListener("click", () => {
      lang = lang === "ru" ? "en" : "ru";
      store.set("lang", lang);
      render();
    });
    if (PAGE === "projects") {
      $("#filters").addEventListener("click", (e) => {
        const b = e.target.closest(".chip");
        if (!b) return;
        filter = b.dataset.cat;
        history.replaceState(null, "", filter === "all" ? location.pathname : `#cat=${filter}`);
        render();
      });
    }

    const checkCv = () => Promise.all(Object.entries(PROFILE.cv).map(([k, url]) =>
      fetch(url, { method: "HEAD", cache: "no-cache" })
        .then((r) => { cvAvailable[k] = r.ok; })
        .catch(() => { cvAvailable[k] = false; })));

    Promise.all([loadSite(), fetch("projects.json", { cache: "no-cache" }).then((r) => r.json())])
      .then(async ([, data]) => {
        if (PAGE === "contact") await checkCv();
        setProjects(data);
        render();
        if (typeof startGuest === "function") startGuest();
      })
      .catch((err) => {
        console.error(err);
        document.documentElement.classList.add("i18n-ready");
        const box = $("#grid") || $("#showcase") || $("#channels") || $("#projHead");
        if (box) box.textContent = "Could not load the page content.";
      });
  }
}
