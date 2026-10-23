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
// site.links["блок:ключ"] — where a button leads ("top:ключ" — header and footer): "#якорь" of the home page, a page or a URL.
// site.pages.<page> = false — the page is switched off: links to it go to its home anchor, the page itself redirects there.
// site.navHidden — header tabs taken off (keys nav.*).
const PAGE_ANCHOR = { projects: "#work", contact: "#contact" };
const offPage = (href) => {
  const m = /^(projects|contact)\.html$/.exec(href || "");
  return m && SITE?.pages?.[m[1]] === false ? PAGE_ANCHOR[m[1]] : null;
};
const linkHref = (v) => (v.startsWith("#") && PAGE !== "home" ? "./" + v : v);
function applyLinks() {
  document.querySelectorAll("a[data-i18n]").forEach((a) => {
    if (a.dataset.href0 == null) a.dataset.href0 = a.getAttribute("href") || "";
    const blk = a.closest("[data-block]")?.dataset.block || "top";
    const set = SITE?.links?.[`${blk}:${a.dataset.i18n}`];
    a.setAttribute("href", linkHref(set || offPage(a.dataset.href0) || a.dataset.href0));
    if (set) { // an outside address opens in a new tab, an anchor / page of the site — in this one
      if (/^https?:/.test(set)) { a.target = "_blank"; a.rel = "noopener"; } else a.removeAttribute("target");
    }
    if (a.closest(".top nav")) a.hidden = (SITE?.navHidden || []).includes(a.dataset.i18n);
  });
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

// picture cover settings from the admin (cover.fit / pos / zoom / bg / pad) → CSS variables on .cover;
// unset = the page default (style.css: catalog fills the frame, home fits the whole picture)
const COVER_FITS = ["contain", "cover", "fill", "none", "scale-down"];
function coverStyle(c) {
  const v = [];
  if (COVER_FITS.includes(c.fit)) v.push(`--fit:${c.fit}`);
  if (/^\d{1,3}% \d{1,3}%$/.test(c.pos || "")) v.push(`--pos:${c.pos}`);
  if (+c.zoom > 0 && +c.zoom !== 1) v.push(`--z:${+c.zoom}`);
  if (/^#[0-9a-f]{6}$/i.test(c.bg || "")) v.push(`--cbg:${c.bg}`);
  if (+c.pad > 0) v.push(`--pad:${+c.pad}px`);
  return v.length ? ` style="${v.join(";")}"` : "";
}

function coverHTML(p) {
  const c = p.cover;
  if (c.gifts) {
    return `<div class="cover gifts">${c.gifts.map((k) =>
      `<img src="assets/gifts/${k}.webp" alt="" loading="lazy">`).join("")}</div>`;
  }
  if (c.shot) {
    return `<div class="cover"${coverStyle(c)}><img class="shot" src="${esc(c.shot)}" alt="${esc(p.title[lang])}" loading="lazy"></div>`;
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

// the whole card leads to the case page, not only its button (setupCardLinks)
const hrefAttr = (p) => (pageURL(p) && !EDITOR ? ` data-href="${esc(pageURL(p))}"` : "");
function setupCardLinks() {
  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-href]");
    if (!card || e.target.closest("a, button, input, [data-tip]") || getSelection().toString()) return;
    if (e.ctrlKey || e.metaKey || e.button === 1) open(card.dataset.href, "_blank");
    else location.href = card.dataset.href;
  });
}

const tagsHTML = (tags) => `<div class="tags">${tags.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>`;

function cardHTML(p, i) {
  const links = linksHTML(p);
  return `<article class="card${p.featured ? " featured" : ""}"${hrefAttr(p)} style="animation-delay:${i * 40}ms">
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
    `<div class="stat reveal" style="--d:${i * 80}ms">${statNum(b, `${p}.n`)}${fld(b, `${p}.label`, "span", "подпись")}</div>`)}</div>`,
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
  // playable visual novel (novel.js / novel.css): src — novel.json made by build_novel.py of the emotions-club repo
  novel: (b) => (b.src ? `<div class="nv reveal" data-src="${esc(imgSrc(b.src))}"></div>` : empty("Укажите путь к novel.json")),

  // ---- the Virtual Gifts case (styles: gifts.css, gc-*; the three interactive ones are run by gifts.js) ----
  points: (b) => `<div class="gc-cols">${each(b, (it, i, p) => `<article class="gc-point surface reveal" style="--d:${i * 80}ms">
    <span class="gc-num">${num(i)}</span>${fld(b, `${p}.t`, "h3", "Заголовок")}${fld(b, `${p}.d`, "p", "Текст")}</article>`)}</div>`,
  specs: (b) => `<div class="gc-cols">${each(b, (it, i, p) => `<article class="gc-tech surface reveal" style="--d:${i * 80}ms">
    ${fld(b, `${p}.k`, "p", "Где", false, "gc-tech-k")}${fld(b, `${p}.t`, "h3", "Формат")}${fld(b, `${p}.d`, "p", "Текст")}</article>`)}</div>`,
  split: (b) => `<div class="gc-split"><div class="gc-split-text reveal">
      ${fld(b, "eyebrow", "p", "Надзаголовок", false, "eyebrow")}${fld(b, "title", "h2", "Заголовок", false, "t-h2")}${fld(b, "text", "p", "Текст")}
      <ul class="gc-rules">${each(b, (it, i, p) => fld(b, `${p}.t`, "li", "Правило"))}</ul></div>
    <div class="gc-board surface-glow reveal" style="--d:120ms">${(b.images || []).map((s) => imgHTML(s)).join("") || empty("Добавьте картинки")}</div></div>`,
  rail: (b) => `<ol class="gc-pipe">${each(b, (it, i, p) => `<li class="reveal" style="--d:${i * 60}ms">
    <span class="gc-step">${num(i)}</span>${fld(b, `${p}.t`, "b", "Шаг")}${fld(b, `${p}.d`, "span", "Описание")}</li>`)}</ol>`,
  list2: (b) => `<ul class="gc-results">${each(b, (it, i, p) =>
    `<li class="reveal" style="--d:${i * 80}ms">${fld(b, `${p}.t`, "b", "Итог")}${fld(b, `${p}.d`, "span", "Описание")}</li>`)}</ul>`,
  lanes: (b) => `<div class="gc-alpha surface reveal"><div class="gc-alpha-head">
      ${fld(b, "eyebrow", "p", "Надзаголовок", false, "eyebrow")}${fld(b, "title", "h3", "Заголовок")}${fld(b, "text", "p", "Текст")}</div>
    <div class="gc-lanes">${each(b, (it, i, p) => {
      const st = ["bad", "fix"].includes(it.state) ? it.state : "ok";
      const icons = (it.icons || "").split(",").map((x) => x.trim()).filter(Boolean)
        .map((x) => `<svg><use href="#i-${esc(x)}"/></svg>`).join("");
      const codec = fld(b, `${p}.codec`, "b", "Формат");
      return `<div class="gc-lane${st === "ok" ? "" : " " + st}">
        <div class="gc-plat"><span class="gc-icons">${icons}</span><span>${fld(b, `${p}.plat`, "b", "Платформа")}${fld(b, `${p}.platSub`, "small", "браузеры")}</span></div>
        <span class="gc-to">→</span>
        <div class="gc-codec">${st === "bad" ? codec.replace(/^<b([^>]*)>([\s\S]*)<\/b>$/, "<b$1><s>$2</s></b>") : codec}${fld(b, `${p}.codecSub`, "small", "пояснение")}</div>
        <span class="gc-to">→</span>
        <div class="gc-out"><span class="${st === "bad" ? "gc-blk" : "gc-chk"}">${it.img ? `<img src="${esc(imgSrc(it.img))}" alt="">` : ""}</span><i class="${st === "bad" ? "no" : "ok"}">${st === "bad" ? "✕" : "✓"}</i></div>
      </div>`;
    })}</div></div>${PLATFORM_ICONS}`,
  "gifts-showcase": (b) => `<div class="gc-devices reveal" ${giftsData(b)} data-keys="${esc((b.keys || []).join(","))}" data-hires="${esc((b.hires || []).join(","))}">
      <div class="gc-laptop" aria-hidden="true"><div class="gc-lid"><div class="gc-screen gc-web">
        <div class="gc-bar"><i></i><i></i><i></i><span></span></div>
        <div class="gc-app">
          <aside class="gc-side">${fld(b, "matches", "p", "Пары", false, "gc-side-h")}
            <div class="gc-row on"><span class="gc-av a1">M</span><span><b>Mia</b>${fld(b, "prev", "small", "отправила подарок")}</span></div>
            <div class="gc-row"><span class="gc-av a2">L</span><span><b>Leo</b><small>See you Friday?</small></span></div>
            <div class="gc-row"><span class="gc-av a3">S</span><span><b>Sofia</b><small>Haha, same 😄</small></span></div>
            <div class="gc-row"><span class="gc-av a4">D</span><span><b>Daniel</b><small>New match</small></span></div>
          </aside>
          <div class="gc-thread">
            <div class="gc-thread-h"><span class="gc-av a1">M</span><span><b>Mia, 27</b><small>online</small></span><i class="gc-like">♥</i></div>
            <div class="gc-msgs">${giftChat(b)}</div>
            <div class="gc-input"><span>Message…</span><i></i></div>
          </div>
        </div>
        <div class="gc-fx"><video class="gc-fx-v gift-anim" muted playsinline preload="auto"></video></div>
      </div></div><div class="gc-base"></div></div>
      ${giftPhone(b)}
    </div><div class="gc-pick" role="tablist" aria-label="Gift"></div>`,
  "gifts-process": (b) => `<div class="gc-proc reveal" ${giftsData(b)} data-keys="${esc((b.keys || []).join(","))}"
      data-picked="${esc(L(b.picked))}" data-note="${esc(L(b.note))}">
      <div class="gc-pick gc-proc-tabs" role="tablist" aria-label="Gift"></div>
      <ol class="gc-steps">${each(b, (it, i, p) => `<li class="gc-st">
        <div class="gc-st-h"><span class="gc-step">${num(i)}</span><div>${fld(b, `${p}.t`, "b", "Шаг")}${fld(b, `${p}.d`, "small", "Описание")}</div></div>
        <div class="gc-st-c">${i === 4 ? `<div class="gc-devices gc-mini">${giftPhone(b)}</div>` : ""}</div></li>`)}</ol></div>`,
  "gifts-catalog": (b) => `<div class="gc-catalog" ${giftsData(b)} data-keys="${esc((b.keys || []).join(","))}" aria-busy="true"></div>`,
};

// gift widgets read their data from the gift-catalog repo (block.base, "/gift-catalog/" by default)
const giftsData = (b) => `data-gifts="${b.type.slice(6)}" data-base="${esc(b.base || "/gift-catalog/")}"`;
const giftChat = (b) => `${fld(b, "match", "p", "Надпись в чате", false, "gc-match")}
  <p class="gc-m in">Hi! Loved your photos from Lisbon 🌊</p><p class="gc-m out">Thanks! You've been there too?</p>
  <p class="gc-m in">Last summer. Best pastel de nata ever</p>
  <p class="gc-m in gc-gift-msg">🎁 <span>Mia sent you <b class="gc-gift-name">a gift</b></span></p>`;
const giftPhone = (b) => `<div class="gc-phone" aria-hidden="true"><div class="gc-screen gc-mob">
  <div class="gc-status"><span>9:41</span><i class="gc-notch"></i><span>●●●</span></div>
  <div class="gc-thread-h"><i class="gc-back"></i><span class="gc-av a1">M</span><span><b>Mia, 27</b><small>online</small></span><i class="gc-like">♥</i></div>
  <div class="gc-msgs">${giftChat(b)}</div>
  <div class="gc-input"><span>Message…</span><i></i></div>
  <div class="gc-fx"><video class="gc-fx-v gift-anim" muted playsinline preload="auto"></video></div></div></div>`;
// lanes block: icon names "win", "android", "apple"
const PLATFORM_ICONS = `<svg class="defs" aria-hidden="true" focusable="false">
  <symbol id="i-win" viewBox="0 0 24 24"><path fill="currentColor" d="M3 5.6 10.4 4.5v7.1H3zM11.4 4.4 21 3v8.6h-9.6zM3 12.6h7.4v7L3 18.4zM11.4 12.6H21V21l-9.6-1.4z"/></symbol>
  <symbol id="i-android" viewBox="0 0 24 24"><path fill="currentColor" d="M4.5 17.5a7.5 7.5 0 0 1 15 0z"/><path d="M7.6 10.2 6 7.6M16.4 10.2 18 7.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="14" r="1" fill="#050a18"/><circle cx="15" cy="14" r="1" fill="#050a18"/></symbol>
  <symbol id="i-apple" viewBox="0 0 24 24"><path fill="currentColor" d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.8-.8-3-.8C6.9 7.5 5 9 5 12.1c0 1.9.7 3.9 1.6 5.2.8 1.1 1.5 2.1 2.5 2.1s1.3-.6 2.6-.6 1.6.6 2.6.6c1.1 0 1.7-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.3-.9-2.4-3.4zM14.3 5.9c.6-.7.9-1.6.8-2.5-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.7-.4 2.3-1.1z"/></symbol>
</svg>`;
// a stats number; on the site a unit after a space is set small ("1540 px")
function statNum(b, path) {
  const v = String(getIn(b, path) ?? "");
  const m = !EDITOR && v.match(/^(.*\d)\s+([^\d\s]+)$/);
  return m ? `<b>${esc(m[1])}&nbsp;<small>${esc(m[2])}</small></b>` : fld(b, path, "b", "42", true);
}
// blocks that lay out their own heading (not the centred section head)
const OWN_HEAD = new Set(["split", "lanes"]);

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
  const own = OWN_HEAD.has(b.type);
  const head = own ? "" : headHTML(b);
  const body = (BLOCK_HTML[b.type] || (() => ""))(b);
  const tight = own ? b.type === "lanes" : !head; // the lanes callout continues the section above
  return home ? `<section class="block cb-home${off}" ${attrs}>${head}${body}</section>`
    : `<div class="pb pb-${b.type}${b.w === "half" ? " half" : ""}${tight ? " tight" : ""}${off}" ${attrs}>${head}${body}</div>`;
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
    return `<article class="show reveal"${hrefAttr(p)}>
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
  const crumb = `<a class="cs-crumb" href="${linkHref(offPage("projects.html") || "projects.html")}">${esc(t["proj.back"])}</a>`;
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
  // head.gifts (keys from gifts.json of the gift-catalog repo): the belt shows their stills, a click plays the gift (gifts.js)
  const giftKeys = h.gifts || [];
  const cloudImg = giftKeys.length
    ? (copy) => giftKeys.map((k) => `<img src="/gift-catalog/assets/thumbs/${esc(k)}.webp" alt="" data-k="${esc(k)}"${copy ? ` aria-hidden="true"` : ` role="button" tabindex="0"`}>`).join("")
    : () => (h.cloud || []).map((s) => `<img src="${esc(imgSrc(s))}" alt="">`).join("");
  const cloud = cloudImg(false);
  const zoom = +(h.zoom ?? 1.45) > 1 ? +(h.zoom ?? 1.45) : 0; // hover zoom of the cloud; 0 = off
  $("#projHead").innerHTML = `<div class="aurora" aria-hidden="true"></div>${crumb}
    ${fld(p, "head.eyebrow", "p", "Надзаголовок", false, "eyebrow")}
    <h1 data-f="title" data-ph="Название">${title}</h1>
    ${lead}
    ${ctas ? `<div class="hero-cta">${ctas}</div>` : ""}
    ${cloud ? `<div class="cs-cloud${zoom ? " zoom" : ""}${h.cloudStyle === "cutout" ? " cutout" : ""}"${zoom ? ` style="--zoom:${zoom}"` : ""}${giftKeys.length
      ? ` data-gifts="strip" data-base="/gift-catalog/"` : ` aria-hidden="true"`}><div class="cs-cloud-track">${cloud + cloudImg(true)}</div></div>`
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

/* ---------------- block style (site.json / project.page → block.style) ---------------- */
// { bg: card|band|glow|accent, space: 0|s|l, align: left|center, w: narrow|wide, h: s|l, accent: blue|teal|white, anim: false }
// set as data-s-* attributes on the [data-block] element (rules: end of style.css); built-in home sections stay
// in the DOM between renders, so every pass clears what the previous one set
const STYLE_KEYS = ["bg", "space", "align", "w", "h", "accent", "anim"];
function styleBlocks(list) {
  const by = new Map((list || []).map((b) => [b.id, b.style]));
  document.querySelectorAll("main [data-block]").forEach((el) => {
    const st = by.get(el.dataset.block) || {};
    for (const k of STYLE_KEYS) {
      const v = st[k];
      if (v === undefined || v === "") el.removeAttribute(`data-s-${k}`);
      else el.setAttribute(`data-s-${k}`, String(v));
    }
    if (st.anim === false) el.querySelectorAll(".reveal").forEach((r) => r.classList.add("in"));
  });
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
  const gone = new Set(SITE?.hiddenText || []); // home texts deleted in the editor: "block:key"
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const v = t[el.dataset.i18n];
    if (v != null && el !== document.activeElement) el.textContent = v;
    const blk = el.closest("[data-block]");
    el.hidden = !!blk && gone.has(`${blk.dataset.block}:${el.dataset.i18n}`);
  });
  document.documentElement.classList.add("i18n-ready");
  applyLinks();
  if (PAGE === "home") pickHeroGift();
  $("#lang").dataset.lang = lang; // ring around the active RUS / ENG
  const cvTop = $("#cvTop"); // header "CV ↓": the résumé in the current language
  if (cvTop && PROFILE.cv?.[lang]) {
    cvTop.href = PROFILE.cv[lang];
    cvTop.download = `Anton-Egorov-CV-${lang.toUpperCase()}.pdf`;
  }
  if (PAGE === "home") renderHome();
  if (PAGE === "projects") renderProjects();
  if (PAGE === "project") renderProject();
  if (PAGE === "contact") renderContact();
  if (PAGE === "home") styleBlocks(SITE.blocks);
  if (PAGE === "project") styleBlocks((EDITOR ? EDITOR.project() : PROJECTS.find((x) => x.id === new URLSearchParams(location.search).get("id")))?.page);
  watchReveal();
  watchVideos();
  window.Gifts?.mount(document, { lang, editor: !!EDITOR }); // gift widgets (project.html loads gifts.js)
  window.Novel?.mount(document, { lang, editor: !!EDITOR }); // novel players (project.html loads novel.js)
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
  // ✕ over a text inside a block: delete that text, or the whole list item it sits in (a card, a step, a button);
  // on the home page the built-in texts (data-i18n) are deleted too — they stay in site.json, just not shown
  const del = document.createElement("div");
  del.className = "edit-del";
  del.contentEditable = "false";
  document.body.appendChild(del);
  let delFor = null, delTimer = 0;
  const hideDel = () => { del.classList.remove("on"); delFor = null; };
  document.addEventListener("mouseover", (e) => {
    clearTimeout(delTimer);
    if (e.target.closest(".edit-del")) return;
    const tab = e.target.closest(".top nav a[data-i18n]"); // header tab: taken off the header (site.navHidden)
    const el = tab || e.target.closest("[data-block] [data-f], [data-block] [data-i18n]");
    const ok = el && (tab || (el.dataset.f ? EDITOR.blockInfo(el.closest("[data-block]").dataset.block).removable : PAGE === "home"));
    if (!ok) { delTimer = setTimeout(hideDel, 300); return; }
    if (el === delFor) return;
    delFor = el;
    del.innerHTML = tab ? `<button type="button" data-del="tab" title="Убрать вкладку из шапки (вернуть — «Общие настройки»)">✕ вкладка</button>`
      : `<button type="button" data-del="field" title="Удалить этот текст">✕ текст</button>${
      /\.\d+\.[^.]+$/.test(el.dataset.f || "") ? `<button type="button" data-del="item" title="Удалить весь пункт">✕ пункт</button>` : ""}`;
    const r = el.getBoundingClientRect();
    del.classList.toggle("below", !!tab);
    del.style.left = `${(tab ? r.left + r.width / 2 : r.right) + scrollX}px`;
    del.style.top = `${(tab ? r.bottom : r.top) + scrollY}px`;
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
      if (d.dataset.del === "tab") return EDITOR.removeTab(el.dataset.i18n);
      const id = el.closest("[data-block]").dataset.block;
      if (el.dataset.i18n) EDITOR.removeText(id, el.dataset.i18n);
      else EDITOR.removeField(id, el.dataset.f, d.dataset.del === "item");
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

// The gift in the hero box: a random one of site.blocks[hero].gifts (admin → «Первый экран»; empty — any gift with an
// animation from /gift-catalog/gifts.json), never the same as on the previous visit. Picked again only when the list changes.
let heroGiftList = null;
function pickHeroGift() {
  const img = $(".unbox-gift");
  const list = SITE?.blocks?.find((b) => b.id === "hero")?.gifts || [];
  if (!img || !SITE || heroGiftList === list.join()) return;
  heroGiftList = list.join();
  const keys = list.length ? Promise.resolve(list)
    : fetch("/gift-catalog/gifts.json").then((r) => r.json()).then((d) => d.items.filter((g) => g.preview_webm).map((g) => g.key)).catch(() => []);
  keys.then((ks) => {
    if (!ks.length) return;
    const last = store.get("heroGift"), pool = ks.length > 1 ? ks.filter((k) => k !== last) : ks;
    const k = pool[Math.floor(Math.random() * pool.length)];
    store.set("heroGift", k);
    img.src = `/gift-catalog/assets/thumbs/${k}.webp`;
  });
}

// Box above the hero title (layers in index.html, states in style.css). On every load it starts open and empty:
// the "Anton Egorov" cursor (as in guest.js) brings the gift, drops it in, the lid comes down from above.
// Hover — the lid floats up and to the right (amplitude eases in/out, no jump at start or end).
// Click — the lid flies off up-right, the gift rises out of the box, hangs half a second, grows and fades out, and then
// its animation opens in the overlay of gifts.js (as in the Virtual Gifts catalog); the overlay closes — the gift
// sinks back in, the lid lands. Every move starts where it is.
function setupUnbox() {
  const box = $(".unbox");
  if (!box) return;
  const [back, front] = box.querySelectorAll(".unbox-l:not(.unbox-lid)");
  const lid = box.querySelector(".unbox-lid"), gift = box.querySelector(".unbox-gift");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover)").matches;
  const label = () => {
    box.setAttribute("aria-label", document.documentElement.lang !== "en" ? "Открыть подарок" : "Open the gift");
  };
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  label();

  // hover peek: h — how much of it (0..1, eases toward the target), s — the up-right swing
  let h = 0, target = 0, phase = 0, last = 0, raf = 0, busy = false;
  const anims = new Map();
  const idle = () => !busy && !anims.has(lid) && !box.classList.contains("open");
  const stopPeek = () => { cancelAnimationFrame(raf); raf = 0; h = 0; phase = 0; last = 0; target = 0; lid.style.transform = ""; };
  const tick = (now) => {
    const dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;
    h += (target - h) * Math.min(1, dt * 5);
    phase += dt * Math.PI * 2 / 1.6;
    if (target === 0 && h < 0.002) return stopPeek();
    const s = (1 - Math.cos(phase)) / 2;
    lid.style.transform = `translate(${4 * s * h}%, ${-(6 + 8 * s) * h}%) rotate(${6 * s * h}deg)`;
    raf = requestAnimationFrame(tick);
  };
  const hover = (on) => {
    target = on && canHover && !reduce && idle() ? 1 : 0;
    if (target && !raf) raf = requestAnimationFrame(tick);
  };
  box.addEventListener("pointerenter", () => hover(true));
  box.addEventListener("pointerleave", () => hover(false));
  box.addEventListener("focus", () => box.matches(":focus-visible") && hover(true));
  box.addEventListener("blur", () => hover(false));

  // a layer's move: from where it is right now (mid-animation too) unless `from` is given
  const play = (el, frames, { duration, delay = 0, easing, from }) => {
    const cs = getComputedStyle(el);
    const now = { transform: cs.transform, opacity: cs.opacity };
    anims.get(el)?.cancel();
    if (el === lid) stopPeek();
    const a = el.animate(from ? [from, ...frames] : [now, ...frames],
      { duration: reduce ? 1 : duration, delay: reduce ? 0 : delay, easing, fill: "both" });
    anims.set(el, a);
    return a;
  };
  // closed again: hand the layers back to CSS (same pose, so nothing moves), hover peek can start
  const settle = (a) => a.finished.then(() => {
    if (anims.get(lid) !== a || box.classList.contains("open")) return;
    [back, front, lid].forEach((el) => { anims.get(el)?.cancel(); anims.delete(el); });
    if (box.matches(":hover")) hover(true);
  }).catch(() => {});
  const landLid = (delay) => settle(play(lid, [{ transform: "none", opacity: 1 }],
    { duration: 800, delay, easing: "cubic-bezier(.22, .61, .36, 1)", from: { transform: "translateY(-60%)", opacity: 0 } }));

  const ease = "cubic-bezier(.4, 0, .35, 1)";
  const RISE = 1000, HANG = 500, FADE = 600; // the gift comes out, hangs, grows and fades — then the overlay
  if (window.Gifts) Gifts.warmUp();
  box.addEventListener("click", () => {
    if (busy) return;
    const key = (gift.getAttribute("src").match(/thumbs\/([^/]+)\.webp/) || [])[1];
    if (!key || !window.Gifts) return;
    busy = true;
    hover(false);
    // guest.js: the CV doesn't arrive while the gift plays (window.giftPlaying, "giftdone"); one already on screen
    // turns into the background — blurred and dimmed under the gift (body.gift-bg, style.css)
    window.giftPlaying = true;
    document.body.classList.add("gift-bg");
    const restore = () => { // the overlay closes: the box rises back, the gift is inside again, the lid lands
      document.body.classList.remove("gift-bg");
      box.classList.remove("open");
      anims.get(gift)?.cancel();
      anims.delete(gift);
      [back, front].forEach((el) => play(el, [{ transform: "none", opacity: 1 }],
        { duration: 600, easing: "cubic-bezier(.22, .61, .36, 1)" }));
      gift.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduce ? 1 : 400, delay: reduce ? 0 : 200, fill: "backwards" });
      landLid(reduce ? 0 : 300);
      setTimeout(() => {
        busy = false;
        window.giftPlaying = false;
        dispatchEvent(new Event("giftdone"));
      }, reduce ? 0 : 1100);
    };
    Gifts.play(key, { delay: reduce ? 0 : RISE + HANG + FADE, returnFocus: box, onClose: restore });
    if (reduce) return;
    box.classList.add("open"); // the gift rises out of the box (CSS transition)
    // the box bottom sinks and fades right away, so it never covers the rising gift
    [back, front].forEach((el) => play(el, [{ transform: "translateY(40%)", opacity: 0 }],
      { duration: 400, easing: "cubic-bezier(.3, 0, .6, 1)" }));
    play(lid, [
      { transform: "translate(39%, -79%) rotate(24deg)", opacity: 1, offset: 0.55 },
      { transform: "translate(71%, -144%) rotate(44deg)", opacity: 0 },
    ], { duration: 1400, easing: ease });
    setTimeout(() => play(gift, [{ transform: "translateY(-8%) scale(3.4)", opacity: 0 }],
      { duration: FADE, easing: "cubic-bezier(.5, 0, .9, .6)" }), RISE + HANG);
  });

  // delivery: on every load, when the box is on screen and the tab is visible
  if (reduce) return;
  busy = true;
  box.classList.add("empty");
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || document.hidden) return;
    io.disconnect();
    setTimeout(deliver, 700);
  }, { threshold: 0.6 });
  io.observe(box);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && box.classList.contains("empty")) { io.disconnect(); io.observe(box); }
  });

  function deliver() {
    if (!box.classList.contains("empty")) return;
    box.classList.replace("empty", "deliver");
    const cur = document.createElement("div");
    cur.className = "guest-cursor";
    cur.setAttribute("aria-hidden", "true");
    cur.innerHTML = `<svg viewBox="0 0 20 22"><path d="M2 2l15 7.5-6.5 1.8L7.6 18z"/></svg><b>Anton Egorov</b>`;
    box.append(cur);

    // in the gift's own frame (its spot just above the opening = 0,0); the cursor holds its lower-right part
    const B = box.getBoundingClientRect(), gw = gift.offsetWidth, gh = gift.offsetHeight;
    const hx = gift.offsetLeft + gw * 0.78, hy = gift.offsetTop + gh * 0.14;
    const sx = -B.left - gw - 60, sy = -90, cx = sx * 0.35, cy = -190;
    const at = (x, y) => {
      gift.style.transform = `translate(${x}px, ${y}px) translateY(-48%) scale(1.08)`;
      cur.style.transform = `translate(${x + hx}px, ${y + hy}px)`;
    };
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const bez = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
    let t0 = null;
    const fly = (now) => {
      t0 ??= now;
      const t = Math.min((now - t0) / 2000, 1), e = easeOut(t);
      const w = Math.sin(t * Math.PI * 3) * 6 * (1 - t);
      at(bez(sx, cx, 0, e) + w, bez(sy, cy, 0, e) - w / 2);
      if (t < 1) requestAnimationFrame(fly); else setTimeout(release, 250);
    };
    const release = () => {
      box.classList.replace("deliver", "lidless"); // the gift falls in (its CSS transition), the lid stays hidden
      gift.style.transform = "";
      setTimeout(() => {
        landLid(0); // its first frame (above, transparent) holds from this very frame — no flash in place
        box.classList.remove("lidless");
        busy = false;
        label();
      }, 450);
      let l0 = null;
      const leave = (now) => {
        l0 ??= now;
        const t = Math.min((now - l0) / 1200, 1), e = t * t;
        cur.style.transform = `translate(${hx + sx * 0.8 * e}px, ${hy - 220 * e}px)`;
        if (t < 1) requestAnimationFrame(leave); else cur.remove();
      };
      requestAnimationFrame(leave);
    };
    requestAnimationFrame(fly);
  }
}

// "back to top": appears after scrolling down one screen, smooth scroll up (instant with reduced motion)
// ---- mini chat: the feedback-chat component (repo feedback-chat, loaded from its Pages) ----
// CV, channels and the Worker address come from site.json (profile.cv / channels / chat.endpoint);
// the chat follows <html lang>, which render() sets. Not in ?edit.
function startChat() {
  if (startChat.on || EDITOR) return;
  startChat.on = true;
  window.FEEDBACK_CHAT = {
    endpoint: PROFILE.chat?.endpoint || "",
    name: { ru: "Антон Егоров", en: "Anton Egorov" },
    initials: "AE",
    button: { ru: "Написать Антону", en: "Message Anton" },
    cv: PROFILE.cv,
    channels: PROFILE.channels,
    texts: {
      ru: {
        hello: "Привет! Я мини-ассистент Антона. Чем помочь?",
        askFeedback: "Что понравилось, что нет? Пишите как есть — Антон прочитает в Telegram.",
        askQuestion: "Какой вопрос? Про проект, сотрудничество, стек — что угодно.",
        sent: "Готово, Антон уже получил сообщение.",
      },
      en: {
        hello: "Hi! I'm Anton's mini assistant. How can I help?",
        askFeedback: "What worked, what didn't? Be honest — Anton reads it in Telegram.",
        askQuestion: "What would you like to ask? A project, collaboration, the stack — anything.",
        askContact: "How can Anton reach you back? Telegram, email — or skip.",
        sent: "Done — Anton already has your message.",
      },
    },
  };
  const s = document.createElement("script");
  s.src = "https://eyeanton.github.io/feedback-chat/chat.js";
  document.body.append(s);
}

function setupToTop() {
  const btn = document.createElement("button");
  btn.className = "to-top";
  btn.type = "button";
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const label = () => { btn.ariaLabel = btn.title = lang === "ru" ? "Наверх" : "Back to top"; };
  label();
  btn.addEventListener("click", () => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  });
  document.body.append(btn);
  const update = () => btn.classList.toggle("on", scrollY > innerHeight * 0.8);
  addEventListener("scroll", update, { passive: true });
  update();
  return label;
}

if (PAGE) {
  document.documentElement.classList.add("js");
  // a reload starts at the top: no restored scroll, no jump to a #якорь left in the address by a header tab
  if (performance.getEntriesByType?.("navigation")[0]?.type === "reload") {
    history.scrollRestoration = "manual";
    if (location.hash.length > 1 && !location.hash.startsWith("#cat=")) history.replaceState(null, "", location.pathname + location.search);
    scrollTo({ top: 0, behavior: "instant" });
  }
  $("#year").textContent = new Date().getFullYear();
  setupStackTips();
  setupUnbox();
  setupCardLinks();

  if (EDITOR) {
    bootEditor();
  } else {
    const toTopLabel = setupToTop();
    $("#lang").addEventListener("click", () => {
      lang = lang === "ru" ? "en" : "ru";
      store.set("lang", lang);
      render();
      toTopLabel();
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
        const off = offPage(`${PAGE}.html`);
        if (off) { location.replace("./" + off); return; }
        if (PAGE === "contact") await checkCv();
        setProjects(data);
        render();
        // the home page is built after load: jump to #якорь (from another page) once the blocks are in place
        if (location.hash.length > 1 && PAGE === "home") {
          try { document.querySelector(location.hash)?.scrollIntoView({ behavior: "instant" }); } catch {}
        }
        if (typeof startGuest === "function") startGuest();
        if (typeof startChat === "function") startChat();
      })
      .catch((err) => {
        console.error(err);
        document.documentElement.classList.add("i18n-ready");
        const box = $("#grid") || $("#showcase") || $("#channels") || $("#projHead");
        if (box) box.textContent = "Could not load the page content.";
      });
  }
}
