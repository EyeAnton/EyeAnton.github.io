// Portfolio rendering.
// Content: site.json (texts RU/EN, home blocks order/visibility, profile: skills, stack, experience, contacts)
// and projects.json (projects). Both are edited in admin.html; the home page also has a visual editor there.
// project.cover: { shot: "path", pos: "center top" } | { gifts: [...] } | { glyph: "Text", tint: "#hex", sub: {ru, en} }
// project.links: page = section of this site, live = working site, code = public repo. visible: false hides it.
// project.home: true puts it into "Selected work" on the main page.
// Pages: <body data-page="home|projects|contact">. admin.html and design-system.html have no data-page
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

// Visual editor: the home page inside admin.html's iframe (?edit), driven by window.parent.siteEditor.
const EDITOR = (() => {
  if (PAGE !== "home" || !new URLSearchParams(location.search).has("edit") || window.parent === window) return null;
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

function linksHTML(p) {
  const t = UI[lang];
  return [
    p.links.page && `<a class="btn" href="${p.links.page}">${esc(t.page)} →</a>`,
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

/* ---------------- pages ---------------- */

// order and visibility of the home sections come from site.json → blocks
function arrangeBlocks() {
  const main = $("main");
  for (const b of SITE.blocks || []) {
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
  const row = (list) => list.map((x) => `<span>${esc(x)}</span>`).join("").repeat(4);
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
  $("#lang").textContent = lang === "ru" ? "EN" : "RU";
  const cvTop = $("#cvTop"); // header "CV ↓": the résumé in the current language
  if (cvTop && PROFILE.cv?.[lang]) {
    cvTop.href = PROFILE.cv[lang];
    cvTop.download = `Anton-Egorov-CV-${lang.toUpperCase()}.pdf`;
  }
  if (PAGE === "home") renderHome();
  if (PAGE === "projects") renderProjects();
  if (PAGE === "contact") renderContact();
  watchReveal();
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
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (el.closest(".top")) return; // header tabs stay plain; nav labels are edited in the side panel
    el.contentEditable = EDITABLE;
    el.spellcheck = false;
  });
  document.querySelectorAll("[data-block]").forEach((el) => {
    if (el.querySelector(":scope > .edit-handle")) return;
    el.insertAdjacentHTML("afterbegin",
      `<button type="button" class="edit-handle" data-for="${el.dataset.block}" contenteditable="false">${esc(EDITOR.blockName(el.dataset.block))} · настроить</button>`);
  });
}

function bootEditor() {
  document.documentElement.classList.add("editing");
  const sync = () => {
    lang = EDITOR.lang;
    applySite(EDITOR.draft);
    setProjects(EDITOR.projects());
    render();
  };
  window.siteEdit = { refresh: sync };

  document.addEventListener("click", (e) => {
    const handle = e.target.closest(".edit-handle");
    if (handle) { e.preventDefault(); EDITOR.openBlock(handle.dataset.for); return; }
    if (e.target.closest("a, #lang, .chip")) e.preventDefault(); // no navigation while editing
  }, true);
  document.addEventListener("input", (e) => {
    const el = e.target.closest?.("[data-i18n]");
    if (!el) return;
    const key = el.dataset.i18n;
    const val = el.textContent.replace(/\s*\n\s*/g, " ");
    // the same text can appear twice on the page (e.g. the CV button) — keep the copies in step
    document.querySelectorAll(`[data-i18n="${key}"]`).forEach((o) => { if (o !== el) o.textContent = val; });
    EDITOR.onText(key, val);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.closest?.("[data-i18n]")) { e.preventDefault(); e.target.blur(); }
  });
  document.addEventListener("paste", (e) => {
    if (!e.target.closest?.("[data-i18n]")) return;
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData.getData("text/plain") || "").replace(/\s*\n\s*/g, " "));
  });
  sync();
  EDITOR.ready();
}

if (PAGE) {
  document.documentElement.classList.add("js");
  $("#year").textContent = new Date().getFullYear();

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
      })
      .catch((err) => {
        console.error(err);
        const box = $("#grid") || $("#showcase") || $("#channels");
        if (box) box.textContent = "Could not load the page content.";
      });
  }
}
