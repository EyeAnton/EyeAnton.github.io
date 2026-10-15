// Portfolio admin: edits projects.json and cover images straight in the GitHub repo.
// Sign-in = Google via Firebase Auth (owner's account only). The GitHub fine-grained token
// (Contents: read & write on this repo only) lives in Firebase Realtime Database at
// portfolioAdmin/githubToken, readable only by the owner (see firebase-rules.json).
// Reuses cardHTML / CATEGORIES / lang from app.js for an exact card preview.
(() => {
  "use strict";

  const REPO = "EyeAnton/EyeAnton.github.io";
  const BRANCH = "main";
  const DATA = "projects.json";
  const SITE_FILE = "site.json"; // home page texts, blocks and profile (visual editor)
  const SHOTS = "assets/shots/";
  const MAX_W = 1600;
  const OWNER = "leritosha@gmail.com";
  // Firebase web config (Project settings → Your apps → Web app). These values are public by design;
  // access is enforced by firebase-rules.json.
  const FIREBASE = {
    apiKey: "AIzaSyALQyaigLZg1guCs4Cm4rrlNZd9wdgsRZ0",
    authDomain: "eyeanton-portfolio.firebaseapp.com",
    databaseURL: "https://eyeanton-portfolio-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "eyeanton-portfolio",
    appId: "1:29377075544:web:2fd6ac9b84b374d891ed2d",
  };
  const FB = "https://www.gstatic.com/firebasejs/10.12.0/";
  const TOKEN_PATH = "portfolioAdmin/githubToken";

  const q = (s) => document.querySelector(s);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let token = "";
  let data = null;          // { categories, projects }
  let savedJSON = "";       // last published state, for the dirty check
  let site = null;          // site.json draft
  let siteSaved = "";
  let sel = 0;              // selected project index
  let pvLang = "ru";
  const pending = new Map(); // repo path -> { b64, dataURL } images waiting for publish
  const replaced = new Set(); // old shot paths to delete on publish

  /* ---------- GitHub API ---------- */

  async function gh(path, opts = {}) {
    const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
      ...opts,
      cache: "no-store", // GitHub API GETs are cacheable for 60 s; a stale sha makes the next PUT fail with 409
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (r.status === 404 && opts.allow404) return null;
    if (!r.ok) {
      let msg = `${r.status}`;
      try { msg += " " + (await r.json()).message; } catch {}
      throw Object.assign(new Error(msg), { status: r.status });
    }
    return r.status === 204 ? null : r.json();
  }
  const getFile = (p) => gh(`/contents/${encodeURI(p)}?ref=${BRANCH}`, { allow404: true });
  // The admin is the only editor, so on a sha conflict (file changed since we looked) it re-reads and writes again.
  async function putFile(p, b64, message) {
    for (let attempt = 0; ; attempt++) {
      const cur = await getFile(p);
      try {
        return await gh(`/contents/${encodeURI(p)}`, {
          method: "PUT",
          body: JSON.stringify({ message, content: b64, branch: BRANCH, ...(cur ? { sha: cur.sha } : {}) }),
        });
      } catch (e) {
        if ((e.status !== 409 && e.status !== 422) || attempt >= 2) throw e;
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  async function deleteFile(p, message) {
    const cur = await getFile(p);
    if (!cur) return;
    await gh(`/contents/${encodeURI(p)}`, { method: "DELETE", body: JSON.stringify({ message, sha: cur.sha, branch: BRANCH }) });
  }

  const utf8ToB64 = (s) => {
    let bin = "";
    for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
    return btoa(bin);
  };
  const b64ToUtf8 = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

  /* ---------- Login: Google → GitHub token from Firebase ---------- */

  let fb = null; // { auth, db, A: firebase-auth module, D: firebase-database module }

  async function initFirebase() {
    if (!FIREBASE.apiKey) {
      q("#googleBtn").disabled = true;
      loginStatus("Firebase ещё не настроен: впишите конфиг в admin.js (см. README).", "err");
      return;
    }
    const [{ initializeApp }, A, D] = await Promise.all([
      import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-database.js"),
    ]);
    const app = initializeApp(FIREBASE);
    fb = { auth: A.getAuth(app), db: D.getDatabase(app), A, D };
    q("#googleBtn").addEventListener("click", () => {
      loginStatus("Открываю окно входа Google…");
      A.signInWithPopup(fb.auth, new A.GoogleAuthProvider())
        .catch((e) => loginStatus(`Не получилось войти: ${e.code || e.message}`, "err"));
    });
    A.onAuthStateChanged(fb.auth, onUser);
  }

  function loginStatus(text, kind = "") {
    const st = q("#loginStatus");
    st.textContent = text;
    st.className = `status ${kind}`;
  }

  async function onUser(user) {
    if (!user) return;
    // UI check only; the real gate is firebase-rules.json (other accounts can't read the token).
    if (user.email !== OWNER || !user.emailVerified) {
      await fb.A.signOut(fb.auth);
      loginStatus(`У аккаунта ${user.email} нет доступа.`, "err");
      return;
    }
    q("#googleBtn").hidden = true;
    loginStatus(`Вы вошли как ${user.email}. Загружаю…`);
    try {
      const snap = await fb.D.get(fb.D.ref(fb.db, TOKEN_PATH));
      if (!snap.exists()) return askToken("");
      await useToken(snap.val());
    } catch (e) {
      loginStatus(`Нет доступа к хранилищу токена: ${e.message}. Проверьте правила Firebase (firebase-rules.json).`, "err");
    }
  }

  function askToken(why) {
    if (why) q("#tokenWhy").textContent = why;
    q("#tokenSetup").hidden = false;
    loginStatus("");
  }

  async function useToken(t) {
    token = String(t).trim();
    try {
      const repo = await gh("");
      if (repo.permissions && !repo.permissions.push) throw new Error("у токена нет права записи (Contents: Read and write)");
    } catch (e) {
      token = "";
      return askToken(`Сохранённый GitHub-токен не работает (${e.message}) — скорее всего, истёк срок. Создайте новый и вставьте сюда.`);
    }
    await load();
    q("#login").hidden = true;
    q("#app").hidden = false; q("#bar").hidden = false; q("#logout").hidden = false;
  }

  q("#tokenBtn").addEventListener("click", async () => {
    const t = q("#token").value.trim();
    if (!t || !fb) return;
    try {
      await fb.D.set(fb.D.ref(fb.db, TOKEN_PATH), t);
      q("#tokenSetup").hidden = true;
      q("#token").value = "";
      await useToken(t);
    } catch (e) {
      loginStatus(`Не удалось сохранить токен: ${e.message}`, "err");
    }
  });
  q("#token").addEventListener("keydown", (e) => { if (e.key === "Enter") q("#tokenBtn").click(); });
  q("#logout").addEventListener("click", async (e) => {
    e.preventDefault();
    if (isDirty() && !confirm("Есть неопубликованные изменения. Выйти без сохранения?")) return;
    if (fb) await fb.A.signOut(fb.auth);
    location.reload();
  });

  /* ---------- Load / save ---------- */

  // Local preview: http://localhost…/admin.html?local reads the files next to it, no sign-in, publishing off.
  const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("local");

  async function readJSON(path) {
    if (LOCAL) return fetch(path, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null));
    const f = await getFile(path);
    return f ? JSON.parse(b64ToUtf8(f.content)) : null;
  }

  async function load() {
    data = await readJSON(DATA);
    if (!data) throw new Error(`в репозитории нет ${DATA}`);
    data.projects.forEach(normalize);
    savedJSON = serialize();
    pending.clear(); replaced.clear();
    restoredFrom = "";
    if (history) renderHistory();
    sel = Math.min(sel, data.projects.length - 1);

    site = (await readJSON(SITE_FILE)) || await fetch(SITE_FILE, { cache: "no-cache" }).then((r) => r.json());
    siteSaved = serializeSite();
    applySite(site); // app.js: card labels for the project preview

    renderAll();
    renderSite();
  }

  function normalize(p) {
    p.visible = p.visible !== false;
    p.title ||= { ru: "", en: "" };
    p.desc ||= { ru: "", en: "" };
    p.tags ||= [];
    p.links ||= {};
    p.cover ||= { glyph: "New", tint: "#3a2c1e" };
    return p;
  }

  // Drop empty optional fields so projects.json stays tidy.
  function clean(p) {
    const c = structuredClone(p);
    for (const k of Object.keys(c.links)) if (!c.links[k]) delete c.links[k];
    if (c.note && !c.note.ru && !c.note.en) delete c.note;
    if (!c.featured) delete c.featured;
    if (!c.home) delete c.home;
    if (!c.private) delete c.private;
    if (c.cover.sub && !c.cover.sub.ru && !c.cover.sub.en) delete c.cover.sub;
    // picture cover settings: drop the ones left at their defaults
    if (!c.cover.fit) delete c.cover.fit;
    if (!c.cover.pos || c.cover.pos === "50% 50%") delete c.cover.pos;
    if (!+c.cover.zoom || +c.cover.zoom === 1) delete c.cover.zoom;
    if (!c.cover.bg) delete c.cover.bg;
    if (!+c.cover.pad) delete c.cover.pad;
    c.tags = c.tags.map((t) => t.trim()).filter(Boolean);
    if (c.page && !c.page.length) delete c.page;
    return c;
  }
  // every uploaded file the content refers to (covers, hero clouds, blocks and their items): any string under assets/shots/
  function imagesOf(projects, siteObj) {
    const out = new Set();
    const walk = (v) => {
      if (typeof v === "string") { if (v.startsWith(SHOTS)) out.add(v); }
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(projects); walk(siteObj?.blocks);
    return out;
  }
  const serialize = () => JSON.stringify({ categories: data.categories, projects: data.projects.map(clean) }, null, 2) + "\n";
  const serializeSite = () => JSON.stringify(site, null, 2) + "\n";
  const projectsDirty = () => data && (serialize() !== savedJSON || pending.size > 0);
  const siteDirty = () => site && serializeSite() !== siteSaved;
  const isDirty = () => projectsDirty() || siteDirty();

  async function publish() {
    if (LOCAL) { setStatus("Локальный режим: публикация отключена — откройте админку на сайте.", "err"); return; }
    const btn = q("#saveBtn");
    btn.disabled = true;
    try {
      // upload only what the content still uses; delete uploads it no longer refers to
      const inUse = imagesOf(data.projects, site);
      for (const [p, img] of pending) {
        if (!inUse.has(p)) continue;
        setStatus(`Загружаю ${p.replace(SHOTS, "")}…`);
        await putFile(p, img.b64, `Admin: upload ${p}`);
      }
      const before = imagesOf(JSON.parse(savedJSON).projects, JSON.parse(siteSaved));
      for (const p of new Set([...replaced, ...before])) {
        if (!inUse.has(p) && p.startsWith(SHOTS)) await deleteFile(p, `Admin: remove ${p}`);
      }
      if (serialize() !== savedJSON) {
        setStatus("Сохраняю проекты…");
        await putFile(DATA, utf8ToB64(serialize()), restoredFrom ? `Admin: restore ${restoredFrom.slice(0, 7)}` : "Admin: update projects");
        savedJSON = serialize();
      }
      pending.clear(); replaced.clear();
      if (siteDirty()) {
        setStatus("Сохраняю главную страницу…");
        await putFile(SITE_FILE, utf8ToB64(serializeSite()), restoredFrom ? `Admin: restore ${restoredFrom.slice(0, 7)}` : "Admin: update home page");
        siteSaved = serializeSite();
        await bakePages();
      }
      restoredFrom = "";
      history = null; // the new version is on top now
      if (!q("#historyMode").hidden) loadHistory();
      renderAll();
      setStatus("Опубликовано. Сайт обновится примерно через минуту.", "ok");
    } catch (e) {
      setStatus(`Ошибка публикации: ${e.message}`, "err");
    } finally {
      btn.disabled = false;
    }
  }

  // The pages take their texts from site.json ([data-i18n] = key); the text inside the tag is only a fallback that
  // GitHub, search engines and link previews see. On publish it is rewritten to the current RU texts —
  // the same as tools/bake.py (keep the two in step). Elements with markup inside are left alone.
  const PAGES = ["index.html", "projects.html", "contact.html", "project.html", "design-system.html"];
  const I18N_EL = /(<([a-z][a-z0-9]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g;
  // What site.json hides (texts, header tabs, built-in home blocks) is hidden from the first frame too: a <style> in
  // <head> that holds until app.js renders (html.i18n-ready) — without it they flash before site.json loads.
  const hiddenCSS = (s) => {
    const sel = [
      ...(s.hiddenText || []).map((k) => { const [b, key] = k.split(":"); return `[data-block="${b}"] [data-i18n="${key}"]`; }),
      ...(s.navHidden || []).map((k) => `.top nav a[data-i18n="${k}"]`),
      ...(s.blocks || []).filter((b) => !b.type && b.visible === false).map((b) => `[data-block="${b.id}"]`),
    ];
    return sel.length ? `html:not(.i18n-ready) :is(${sel.join(", ")}) { display: none !important; }` : "";
  };
  const bakeHTML = (src, s) => src.replace(I18N_EL, (m, open, tag, key, text, close) => {
    const v = s.text.ru[key];
    if (v == null) return m;
    const clean = v.split("\n").map((l) => l.trimEnd()).join("\n").trim();
    return open + clean.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) + close;
  }).replace(/  <style id="baked-hidden">[^<]*<\/style>\r?\n/, "")
    .replace(/(\r?\n)<\/head>/, (m, nl) => `${nl}  <style id="baked-hidden">${hiddenCSS(s)}</style>${nl}</head>`);
  async function bakePages() {
    for (const p of PAGES) {
      const f = await getFile(p);
      if (!f) continue;
      const old = b64ToUtf8(f.content);
      const baked = bakeHTML(old, site);
      if (baked === old) continue;
      setStatus(`Обновляю тексты и скрытое в ${p}…`);
      await putFile(p, utf8ToB64(baked), `Admin: texts in ${p} from site.json`);
    }
  }

  q("#saveBtn").addEventListener("click", publish);
  q("#reloadBtn").addEventListener("click", async () => {
    if (isDirty() && !confirm("Отменить все неопубликованные изменения?")) return;
    try { await load(); setStatus("Загружено с GitHub."); } catch (e) { setStatus(`Ошибка: ${e.message}`, "err"); }
  });
  window.addEventListener("beforeunload", (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ""; } });

  function setStatus(text, kind = "") {
    const s = q("#status");
    s.textContent = text;
    s.className = `status ${kind}`;
  }
  function updateStatus() {
    if (isDirty()) setStatus("Есть неопубликованные изменения", "dirty");
    else setStatus("Всё опубликовано");
  }

  /* ---------- List ---------- */

  function catName(id) { return (data.categories.find((c) => c.id === id) || { ru: id }).ru; }

  function renderList() {
    q("#items").innerHTML = data.projects.map((p, i) => `
      <div class="item${i === sel ? " on" : ""}${p.visible ? "" : " hidden-p"}" data-i="${i}">
        <label class="sw" title="${p.visible ? "Показывается на сайте" : "Скрыт"}">
          <input type="checkbox" data-act="vis" ${p.visible ? "checked" : ""}><span></span>
        </label>
        <div style="min-width:0"><span class="c">${h(catName(p.cat))}${p.home ? " · главная" : ""}${p.featured ? " · большая" : ""}</span><span class="t">${h(p.title.ru || p.title.en || p.id)}</span></div>
        <div class="mv">
          <button type="button" data-act="up" aria-label="Выше">↑</button>
          <button type="button" data-act="down" aria-label="Ниже">↓</button>
        </div>
      </div>`).join("");
    const shown = data.projects.filter((p) => p.visible).length;
    q("#items").insertAdjacentHTML("afterbegin",
      `<p class="sub" style="margin:0 0 6px">На сайте ${shown} из ${data.projects.length}. Переключатель — показывать/скрыть, стрелки — порядок.</p>`);
  }

  q("#items").addEventListener("click", (e) => {
    const item = e.target.closest(".item");
    if (!item) return;
    const i = +item.dataset.i;
    const act = e.target.dataset.act;
    if (!act && e.target.closest(".sw")) return; // the label forwards the click to its checkbox
    if (act === "vis") {
      data.projects[i].visible = e.target.checked;
    } else if (act === "up" || act === "down") {
      const j = act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= data.projects.length) return;
      [data.projects[i], data.projects[j]] = [data.projects[j], data.projects[i]];
      if (sel === i) sel = j; else if (sel === j) sel = i;
    } else {
      sel = i;
      renderAll();
      return;
    }
    renderList(); renderPreview(); updateStatus();
  });

  q("#addBtn").addEventListener("click", () => {
    let n = 1;
    while (data.projects.some((p) => p.id === `project-${n}`)) n++;
    data.projects.push(normalize({
      id: `project-${n}`, visible: false, cat: data.categories[0].id, year: new Date().getFullYear(),
      cover: { glyph: "New", tint: "#3a2c1e" },
      title: { ru: "Новый проект", en: "New project" }, desc: { ru: "", en: "" }, tags: [], links: {},
    }));
    sel = data.projects.length - 1;
    renderAll();
  });

  /* ---------- Editor ---------- */

  const coverType = (c) => (c.shot !== undefined ? "shot" : c.gifts ? "gifts" : "glyph");

  function renderEditor() {
    const p = data.projects[sel];
    if (!p) { q("#edit").innerHTML = ""; return; }
    const t = coverType(p.cover);
    const shotSrc = p.cover.shot ? (pending.get(p.cover.shot)?.dataURL || p.cover.shot) : "";
    q("#edit").innerHTML = `
    <div class="editor">
      <div class="panel stack">
        <div class="row">
          <label class="check"><input type="checkbox" data-k="visible" ${p.visible ? "checked" : ""}> Показывать на сайте</label>
          <label class="check"><input type="checkbox" data-k="featured" ${p.featured ? "checked" : ""}> Большая карточка на всю ширину</label>
          <label class="check"><input type="checkbox" data-k="home" ${p.home ? "checked" : ""}> На главной (избранное)</label>
        </div>
        <div class="page-link">
          <button class="btn small" type="button" data-page-edit>Страница проекта →</button>
          <span class="hint">${p.page?.length ? `${p.page.length} ${plural(p.page.length, "блок", "блока", "блоков")}` : "Пока пустая. Кнопка «" + h(site?.text.ru.page || "Смотреть кейс") + "» появится на карточке, когда добавите первый блок"}${
            p.links.page ? ". Сейчас карточка ведёт в «Раздел этого сайта» — очистите поле, чтобы вела на страницу" : ""}</span>
        </div>

        <h2 class="sec">Текст</h2>
        <div class="row">
          <label class="f">Название (RU)<input type="text" data-k="title.ru" value="${h(p.title.ru)}"></label>
          <label class="f">Название (EN)<input type="text" data-k="title.en" value="${h(p.title.en)}"></label>
        </div>
        <label class="f">Описание (RU)<textarea data-k="desc.ru">${h(p.desc.ru)}</textarea></label>
        <label class="f">Описание (EN)<textarea data-k="desc.en">${h(p.desc.en)}</textarea></label>
        <div class="row3">
          <label class="f">Категория<select data-k="cat">${data.categories.map((c) =>
            `<option value="${h(c.id)}" ${c.id === p.cat ? "selected" : ""}>${h(c.ru)}</option>`).join("")}</select></label>
          <label class="f">Год<input type="number" data-k="year" value="${h(p.year)}"></label>
          <label class="f">ID (для адреса картинки)<input type="text" data-k="id" value="${h(p.id)}"></label>
        </div>
        <label class="f">Теги через запятую<input type="text" data-k="tags" value="${h(p.tags.join(", "))}"></label>
        <div class="row">
          <label class="f">Пометка внизу (RU)<input type="text" data-k="note.ru" value="${h(p.note?.ru)}"></label>
          <label class="f">Пометка внизу (EN)<input type="text" data-k="note.en" value="${h(p.note?.en)}"></label>
        </div>

        <h2 class="sec">Ссылки</h2>
        <div class="row">
          <label class="f">Живой сайт<input type="url" data-k="links.live" value="${h(p.links.live)}" placeholder="https://…"></label>
          <label class="f">Код (GitHub)<input type="url" data-k="links.code" value="${h(p.links.code)}" placeholder="https://github.com/…"></label>
          <label class="f">Раздел этого сайта<input type="text" data-k="links.page" value="${h(p.links.page)}" placeholder="/gift-catalog/"></label>
          <label class="f">Второй репозиторий<input type="url" data-k="links.code2" value="${h(p.links.code2)}"></label>
        </div>
        <label class="check"><input type="checkbox" data-k="private" ${p.private ? "checked" : ""}> Бейдж «Приватный» (если кода нет в открытом доступе)</label>

        <h2 class="sec">Обложка</h2>
        <label class="f">Тип<select id="coverType">
          <option value="shot" ${t === "shot" ? "selected" : ""}>Картинка / скриншот</option>
          <option value="glyph" ${t === "glyph" ? "selected" : ""}>Надпись на цветном фоне</option>
          <option value="gifts" ${t === "gifts" ? "selected" : ""}>Подарки из каталога</option>
        </select></label>
        ${t === "shot" ? `
          <div class="shot-box">
            ${shotSrc ? `<img src="${h(shotSrc)}" alt="">` : ""}
            <label class="btn ghost small" style="cursor:pointer">Загрузить картинку…<input type="file" id="shotFile" accept="image/*" hidden></label>
          </div>
          <p class="sub" style="margin:0">Любой размер — уменьшится до ${MAX_W}px по ширине. PNG сохраняется с прозрачностью, остальное — в JPEG.</p>
          ${coverFitHTML(p.cover)}` : ""}
        ${t === "glyph" ? `
          <div class="row">
            <label class="f">Надпись<input type="text" data-k="cover.glyph" value="${h(p.cover.glyph)}"></label>
            <label class="f">Цвет фона<input type="color" data-k="cover.tint" value="${h(p.cover.tint || "#3a2c1e")}" style="height:44px;padding:4px"></label>
            <label class="f">Подпись (RU)<input type="text" data-k="cover.sub.ru" value="${h(p.cover.sub?.ru)}"></label>
            <label class="f">Подпись (EN)<input type="text" data-k="cover.sub.en" value="${h(p.cover.sub?.en)}"></label>
          </div>` : ""}
        ${t === "gifts" ? `
          <label class="f">Ключи подарков через запятую (картинки из assets/gifts/)<input type="text" data-k="cover.gifts" value="${h(p.cover.gifts.join(", "))}"></label>` : ""}

        <div style="margin-top:12px"><button class="btn danger small" id="delBtn" type="button">Удалить проект</button></div>
      </div>

      <div class="preview">
        <div class="pv-tabs">
          <button class="chip" type="button" data-pv="ru" aria-selected="${pvLang === "ru"}">RU</button>
          <button class="chip" type="button" data-pv="en" aria-selected="${pvLang === "en"}">EN</button>
        </div>
        <div id="pv"></div>
        <p class="sub" style="margin:0">Так карточка выглядит на сайте${p.visible ? "" : " (сейчас скрыта)"}.</p>
        <div id="pvHome"></div>
      </div>
    </div>`;
    renderPreview();
  }

  /* ---------- Picture cover: fit, anchor, zoom, margin colour, padding (cover.* → coverStyle in app.js) ---------- */

  const FIT_OPTS = [
    ["", "По умолчанию (главная — целиком, каталог — заполнить)"],
    ["contain", "Вписать целиком — с полями"],
    ["cover", "Заполнить рамку — края обрежутся"],
    ["fill", "Растянуть по рамке — пропорции ломаются"],
    ["none", "Исходный размер — без масштаба"],
    ["scale-down", "Уменьшить, если не влезает"],
  ];
  const coverPos = (c) => (/^(\d+)% (\d+)%$/.exec(c.pos || "") || [0, 50, 50]).slice(1, 3).map(Number);

  function coverFitHTML(c) {
    const [x, y] = coverPos(c);
    const zoom = Math.round((+c.zoom || 1) * 100), pad = +c.pad || 0;
    const cells = [0, 50, 100].flatMap((cy) => [0, 50, 100].map((cx) =>
      `<button type="button" data-pos="${cx} ${cy}" aria-pressed="${cx === x && cy === y}" aria-label="${cx}% ${cy}%"></button>`)).join("");
    return `
      <div class="fit-box">
        <label class="f">Как картинка ложится в рамку<select data-k="cover.fit">${FIT_OPTS.map(([v, t]) =>
          `<option value="${v}" ${(c.fit || "") === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <div class="f">Точка привязки — какая часть остаётся при обрезке
          <div class="pos-row">
            <div class="pos-grid">${cells}</div>
            <div class="pos-sliders">
              <label>X <input type="range" id="posX" min="0" max="100" value="${x}"><output>${x}%</output></label>
              <label>Y <input type="range" id="posY" min="0" max="100" value="${y}"><output>${y}%</output></label>
            </div>
          </div>
        </div>
        <div class="row">
          <label class="f">Масштаб <output>${zoom}%</output><input type="range" id="coverZoom" min="100" max="150" value="${zoom}"></label>
          <label class="f">Отступ (паспарту) <output>${pad} px</output><input type="range" id="coverPad" min="0" max="48" value="${pad}"></label>
        </div>
        <div class="row" style="align-items:end">
          <label class="f">Цвет полей<input type="color" id="coverBg" value="${h(c.bg || "#142140")}" style="height:44px;padding:4px"></label>
          <button class="btn ghost small" type="button" id="coverBgReset" ${c.bg ? "" : "disabled"}>Цвет как у карточки</button>
        </div>
        <button class="btn ghost small" type="button" id="coverReset">Сбросить настройки картинки</button>
      </div>`;
  }

  function coverInput(el) { // ranges and colour: write cover.*, refresh the numbers next to them and the preview
    const c = data.projects[sel].cover;
    const out = el.parentElement.querySelector("output");
    if (el.id === "posX" || el.id === "posY") {
      const x = +q("#posX").value, y = +q("#posY").value;
      c.pos = `${x}% ${y}%`;
      out.textContent = `${el.value}%`;
      q("#edit").querySelectorAll("[data-pos]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.pos === `${x} ${y}`));
    }
    if (el.id === "coverZoom") { c.zoom = +el.value / 100; out.textContent = `${el.value}%`; }
    if (el.id === "coverPad") { c.pad = +el.value; out.textContent = `${el.value} px`; }
    if (el.id === "coverBg") { c.bg = el.value; q("#coverBgReset").disabled = false; }
    renderPreview(); updateStatus();
  }

  function setPath(obj, path, val) {
    const keys = path.split(".");
    let o = obj;
    for (const k of keys.slice(0, -1)) o = o[k] ||= {};
    o[keys.at(-1)] = val;
  }

  q("#edit").addEventListener("input", (e) => {
    if (["posX", "posY", "coverZoom", "coverPad", "coverBg"].includes(e.target.id)) { coverInput(e.target); return; }
    const k = e.target.dataset.k;
    if (!k) return;
    const p = data.projects[sel];
    let v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (k === "year") v = +v || "";
    if (k === "tags") v = v.split(",");
    if (k === "cover.gifts") v = v.split(",").map((s) => s.trim()).filter(Boolean);
    if (k === "id") {
      v = v.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      if (seTarget === p.id) seTarget = v; // the page editor follows the renamed project
    }
    setPath(p, k, v);
    renderList(); renderPreview(); updateStatus();
  });

  q("#edit").addEventListener("change", async (e) => {
    const p = data.projects[sel];
    if (e.target.id === "coverType") {
      const v = e.target.value;
      if (p.cover.shot && v !== "shot") replaced.add(p.cover.shot);
      p.cover = v === "shot" ? { shot: "" }
        : v === "gifts" ? { gifts: ["wed__wedding_rings", "sep__glass_heart_3d", "sep__crown_ai_3d", "wed__wedding_cake"] }
        : { glyph: p.title.en.slice(0, 4) || "New", tint: "#3a2c1e" };
      renderEditor(); renderList(); updateStatus();
    } else if (e.target.id === "shotFile" && e.target.files[0]) {
      try {
        setStatus("Обрабатываю картинку…");
        const { b64, dataURL, ext } = await shrink(e.target.files[0]);
        const path = `${SHOTS}${p.id}-${Date.now().toString(36)}.${ext}`; // new name each time, so caches never show the old one
        if (p.cover.shot) { pending.delete(p.cover.shot); replaced.add(p.cover.shot); }
        pending.set(path, { b64, dataURL });
        p.cover.shot = path;
        renderEditor(); renderList(); updateStatus();
      } catch (err) {
        setStatus(`Не удалось прочитать картинку: ${err.message}`, "err");
      }
    }
  });

  q("#edit").addEventListener("click", (e) => {
    if (e.target.dataset.pv) { pvLang = e.target.dataset.pv; renderEditor(); return; }
    const cover = data.projects[sel]?.cover;
    if (e.target.dataset.pos) { // 3×3 anchor grid → the X/Y sliders
      const [x, y] = e.target.dataset.pos.split(" ");
      q("#posX").value = x; q("#posY").value = y;
      coverInput(q("#posX")); coverInput(q("#posY"));
      return;
    }
    if (e.target.id === "coverBgReset") { delete cover.bg; renderEditor(); updateStatus(); return; }
    if (e.target.id === "coverReset") {
      for (const k of ["fit", "pos", "zoom", "bg", "pad"]) delete cover[k];
      renderEditor(); updateStatus(); return;
    }
    if (e.target.closest("[data-page-edit]")) { openPage(data.projects[sel].id); return; }
    if (e.target.id === "delBtn") {
      const p = data.projects[sel];
      if (!confirm(`Удалить «${p.title.ru || p.id}»? Чтобы просто убрать с сайта, достаточно выключить «Показывать».`)) return;
      if (p.cover.shot) { pending.delete(p.cover.shot); replaced.add(p.cover.shot); }
      data.projects.splice(sel, 1);
      sel = Math.max(0, sel - 1);
      renderAll();
    }
  });

  // Downscale to MAX_W and re-encode in the browser: PNG/WebP stay PNG (transparency kept), the rest → JPEG.
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, MAX_W / img.naturalWidth);
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.naturalWidth * s);
        cv.height = Math.round(img.naturalHeight * s);
        const ctx = cv.getContext("2d");
        const alpha = /^image\/(png|webp)$/.test(file.type);
        if (!alpha) {
          ctx.fillStyle = "#0b0b0b"; // JPEG has no transparency: flatten onto the card colour
          ctx.fillRect(0, 0, cv.width, cv.height);
        }
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        const dataURL = alpha ? cv.toDataURL("image/png") : cv.toDataURL("image/jpeg", 0.86);
        resolve({ dataURL, b64: dataURL.split(",")[1], ext: alpha ? "png" : "jpg" });
      };
      img.onerror = () => reject(new Error("формат не поддерживается"));
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- Preview (same markup as the site) ---------- */

  function renderPreview() {
    const pv = q("#pv");
    const p = data.projects[sel];
    if (!pv || !p) return;
    const c = clean(p);
    if (c.cover.shot && pending.has(c.cover.shot)) c.cover.shot = pending.get(c.cover.shot).dataURL;
    CATEGORIES = data.categories;  // globals from app.js
    lang = pvLang;
    c.featured = false;            // the preview column is narrow; show the regular card
    pv.innerHTML = cardHTML(c, 0);
    const home = q("#pvHome"); // the same cover in the home "Selected work" frame (16:11, fits the whole picture by default)
    if (home) home.innerHTML = c.home && c.cover.shot !== undefined
      ? `<p class="sub" style="margin:12px 0 6px">На главной:</p><div class="show-media">${coverHTML(c)}</div>` : "";
  }

  function renderAll() { renderList(); renderEditor(); updateStatus(); }

  /* ---------- Home page visual editor (site.json) ---------- */
  // The real index.html runs in an iframe with ?edit: texts are edited in place (app.js → siteEditor.onText),
  // blocks are reordered / hidden here, lists (skills, experience, stack, contacts) live in the side panel.

  const BLOCKS = {
    hero: { name: "Первый экран", keys: ["hero.eyebrow", "hero.title", "hero.lead", "hero.where", "hero.cta", "hero.cv"] },
    stats: { name: "Цифры", keys: ["sYears", "sProjects", "sLive"] },
    areas: { name: "Что я делаю", keys: ["areas.eyebrow", "areas.title", "areas.text", "soft.title"] },
    showcase: { name: "Избранные проекты", keys: ["show.eyebrow", "show.title", "show.all"] },
    stack: { name: "Стек и инструменты", keys: ["stack.title"] },
    exp: { name: "Опыт", keys: ["exp.eyebrow", "exp.title"] },
    contact: { name: "Давайте поговорим", keys: ["contact.title", "contact.text", "hero.cv", "contact.behance"] },
    general: { name: "Общие настройки", keys: ["brand", "nav.home", "nav.work", "nav.contact", "foot.note", "foot.ds", "page", "live", "online", "private", "proj.back"] },
  };
  const KEY_LABEL = {
    "hero.eyebrow": "Надзаголовок", "hero.title": "Заголовок", "hero.lead": "Текст", "hero.where": "Город и формат работы",
    "hero.cta": "Кнопка «Проекты»", "hero.cv": "Кнопка «Контакты и CV»",
    sYears: "Подпись «лет опыта»", sProjects: "Подпись «проектов»", sLive: "Подпись «живых сайтов»",
    "areas.eyebrow": "Надзаголовок", "areas.title": "Заголовок", "areas.text": "Текст", "soft.title": "Подпись soft skills",
    "show.eyebrow": "Надзаголовок", "show.title": "Заголовок", "show.all": "Кнопка «Все проекты»",
    "stack.title": "Заголовок", "exp.eyebrow": "Надзаголовок", "exp.title": "Заголовок",
    "contact.title": "Заголовок", "contact.text": "Текст", "contact.behance": "Кнопка Behance",
    brand: "Логотип в шапке", "nav.home": "Вкладка «Главная»", "nav.work": "Вкладка «Проекты»", "nav.contact": "Вкладка «Контакты»",
    "foot.note": "Подпись в футере", "foot.ds": "Ссылка «Дизайн-система»",
    page: "Кнопка «Смотреть кейс»", "proj.back": "Ссылка «Все проекты» на странице проекта", live: "Кнопка «Открыть сайт»", online: "Бейдж «Онлайн»", private: "Бейдж «Приватный»",
  };
  // fields of list items; types: text | area | lines (one per line) | csv (comma-separated)
  const LISTS = {
    "profile.skills": {
      title: (it, i) => `${String(i + 1).padStart(2, "0")} · ${it.title?.ru || "Навык"}`,
      blank: () => ({ title: { ru: "Новый навык", en: "New skill" }, d: { ru: "", en: "" }, tools: [] }),
      fields: [["title.ru", "Название RU", "text"], ["title.en", "Название EN", "text"], ["d.ru", "Текст RU", "area"], ["d.en", "Текст EN", "area"], ["tools", "Инструменты через запятую", "csv"]],
    },
    "profile.experience": {
      title: (it) => `${it.role || "Должность"}${it.org ? " · " + it.org : ""}`,
      blank: () => ({ role: "Должность", org: "", when: { ru: "", en: "" }, points: { ru: [], en: [] } }),
      fields: [["role", "Должность", "text"], ["org", "Компания", "text"], ["when.ru", "Период RU", "text"], ["when.en", "Период EN", "text"],
        ["points.ru", "Что делал RU — по пункту на строку", "lines"], ["points.en", "Что делал EN — по пункту на строку", "lines"]],
    },
    "profile.channels": {
      title: (it) => it.name || "Канал",
      blank: () => ({ name: "", handle: "", href: "" }),
      fields: [["name", "Название", "text"], ["handle", "Что показать", "text"], ["href", "Ссылка (пусто = скрыть)", "text"]],
    },
  };

  // Content blocks (project pages + custom home blocks); app.js renders them (BLOCK_HTML), styles — case.css.
  // fields: [path, label, type]; types: loc | loc-area ({ru,en}) · text · area (plain) · img · imgs · num:a,b,c · list:<SUBS key>
  // Every block may also have a section head (eyebrow / title / text) — the "Заголовок секции" switch.
  const loc = (ru = "", en = "") => ({ ru, en });
  const head = (title = "Заголовок", en = "Heading") => ({ eyebrow: loc(), title: loc(title, en), text: loc() });
  const hasHead = (b) => ["eyebrow", "title", "text"].some((k) => k in b);
  const items = (kind, n) => () => ({ items: Array.from({ length: n }, () => SUBS[kind].blank()) });
  const TYPES = {
    text: { name: "Заголовок и текст", hint: "Надзаголовок, заголовок, абзац", blank: () => head(), fields: [] },
    facts: { name: "Факты", hint: "Роль · формат · период · инструменты", blank: items("facts", 4), fields: [["items", "Поля", "list:facts"]] },
    stats: { name: "Цифры", hint: "Крупные числа с подписями", blank: items("stats", 3), fields: [["items", "Цифры", "list:stats"]] },
    cards: { name: "Карточки 01 · 02 · 03", hint: "Задачи или принципы", blank: () => ({ ...head("Задача", "The task"), ...items("cards", 3)() }), fields: [["items", "Карточки", "list:cards"]] },
    flow: { name: "Шаги", hint: "Пайплайн со стрелками", blank: () => ({ ...head("Пайплайн", "Pipeline"), ...items("flow", 4)() }), fields: [["items", "Шаги", "list:flow"]] },
    code: { name: "Код / файлы", hint: "Панели с моноширинным текстом", blank: items("code", 2), fields: [["items", "Панели", "list:code"]] },
    strip: { name: "Лента вбок", hint: "Кадры подряд, листаются", blank: () => ({ ...head(), items: [], hint: loc("Листайте вбок →", "Scroll sideways →") }),
      fields: [["items", "Кадры", "list:strip"], ["hint", "Подсказка на телефоне", "loc"]] },
    cast: { name: "Персонажи", hint: "Карточки с портретом и ролью", blank: () => ({ items: [] }), fields: [["items", "Персонажи", "list:cast"]] },
    pair: { name: "Пара картинок", hint: "Две картинки рядом с подписями", blank: items("pair", 2), fields: [["items", "Картинки", "list:pair"]] },
    lineups: { name: "Составы", hint: "Название + ряд картинок", blank: () => ({ ...head(), items: [] }), fields: [["items", "Ряды", "list:lineups"]] },
    covers: { name: "Сетка обложек", hint: "Много квадратных картинок с подписями", blank: () => ({ ...head(), items: [] }), fields: [["items", "Обложки", "list:covers"]] },
    vcovers: { name: "Видеообложки", hint: "Широкие видео, играют на экране", blank: () => ({ ...head(), items: [] }), fields: [["items", "Видео", "list:vcovers"]] },
    phones: { name: "Телефоны", hint: "Вертикальные ролики 9:16", blank: () => ({ items: [] }), fields: [["items", "Ролики", "list:phones"]] },
    results: { name: "Результаты", hint: "Итоги в три колонки", blank: () => ({ ...head("Результат", "Result"), ...items("results", 3)() }), fields: [["items", "Итоги", "list:results"]] },
    image: { name: "Картинка", hint: "Одна картинка с подписью", blank: () => ({ src: "", caption: loc() }),
      fields: [["src", "Картинка", "img"], ["caption", "Подпись", "loc"]] },
    gallery: { name: "Галерея", hint: "Сетка из нескольких картинок", blank: () => ({ images: [], cols: 3, caption: loc() }),
      fields: [["images", "Картинки", "imgs"], ["cols", "Колонок", "num:2,3,4"], ["caption", "Подпись", "loc"]] },
    video: { name: "Видео", hint: "YouTube, Vimeo или файл .mp4", blank: () => ({ src: "", caption: loc() }),
      fields: [["src", "Ссылка на YouTube / Vimeo или путь к .mp4", "text"], ["caption", "Подпись", "loc"]] },
    quote: { name: "Цитата", hint: "Крупная цитата с автором", blank: () => ({ quote: loc(), who: loc() }),
      fields: [["quote", "Цитата", "loc-area"], ["who", "Автор", "loc"]] },
    links: { name: "Кнопки", hint: "Ссылки на сайт, Behance, видео", blank: items("links", 1), fields: [["items", "Кнопки", "list:links"]] },
    // the Virtual Gifts case (gifts.css; the three "Подарки" blocks are interactive, data from the gift-catalog repo)
    points: { name: "Карточки с крупными номерами", hint: "01 · 02 · 03 градиентом", group: "Как в Virtual Gifts",
      blank: () => ({ ...head("Задача", "The task"), ...items("cards", 3)() }), fields: [["items", "Карточки", "list:cards"]] },
    specs: { name: "Характеристики", hint: "Подпись · формат · текст", group: "Как в Virtual Gifts",
      blank: () => ({ ...head(), ...items("specs", 3)() }), fields: [["items", "Карточки", "list:specs"]] },
    split: { name: "Текст + доска картинок", hint: "Слева правила списком, справа картинки", group: "Как в Virtual Gifts", noHead: true,
      blank: () => ({ ...head(), items: [SUBS.rules.blank()], images: [] }),
      fields: [["eyebrow", "Надзаголовок", "loc"], ["title", "Заголовок", "loc"], ["text", "Текст", "loc-area"],
        ["items", "Правила", "list:rules"], ["images", "Картинки справа", "imgs"]] },
    rail: { name: "Шаги на линии", hint: "Пайплайн с номерами в кружках", group: "Как в Virtual Gifts",
      blank: () => ({ ...head("Пайплайн", "Pipeline"), ...items("flow", 4)() }), fields: [["items", "Шаги", "list:flow"]] },
    list2: { name: "Итоги в две колонки", hint: "Крупный пункт + пояснение", group: "Как в Virtual Gifts",
      blank: () => ({ ...head("Результат", "Result"), ...items("results", 4)() }), fields: [["items", "Итоги", "list:results"]] },
    lanes: { name: "Платформы", hint: "Платформа → формат → результат", group: "Как в Virtual Gifts", noHead: true,
      blank: () => ({ eyebrow: loc(), title: loc("Заголовок", "Heading"), text: loc(), ...items("lanes", 2)() }),
      fields: [["eyebrow", "Надзаголовок", "loc"], ["title", "Заголовок", "loc"], ["text", "Текст", "loc-area"], ["items", "Строки", "list:lanes"]] },
    "gifts-showcase": { name: "Подарки: ноутбук и телефон", hint: "Подарок приходит в чат и играет на весь экран", group: "Подарки",
      blank: () => ({ ...head(), keys: [], matches: loc("Пары", "Matches"), prev: loc("отправила подарок", "sent you a gift"),
        match: loc("Вы понравились друг другу · сегодня", "You liked each other · today") }),
      fields: [["keys", "Какие подарки играют (по порядку)", "gifts:all"],
        ["hires", "Подарки с файлами 1080px (assets/anim1080, tools/encode_showcase.sh) — ключи через запятую", "csv"],
        ["matches", "Заголовок списка в ноутбуке", "loc"], ["prev", "Подпись у Mia", "loc"], ["match", "Надпись в чате", "loc"],
        ["base", "Откуда данные (по умолчанию /gift-catalog/)", "text"]] },
    "gifts-process": { name: "Подарки: пять шагов", hint: "Вкладки по подаркам, кадры из Figma", group: "Подарки",
      blank: () => ({ ...head("Процесс", "Process"), keys: [], ...items("flow", 5)(), picked: loc("в работу", "picked"),
        note: loc("Бриф из рабочего файла Figma", "Brief from the working Figma file"), match: loc("Вы понравились друг другу · сегодня", "You liked each other · today") }),
      fields: [["items", "Шаги (их пять: исходник, бриф, черновики, кадры, результат)", "list:flow"],
        ["keys", "Какие подарки во вкладках шагов (по порядку; в списке — те, у кого есть кадры из Figma)", "gifts:process"],
        ["picked", "Метка выбранного черновика", "loc"], ["note", "Подпись под брифом", "loc"], ["match", "Надпись в чате телефона", "loc"],
        ["base", "Откуда данные (по умолчанию /gift-catalog/)", "text"]] },
    "gifts-catalog": { name: "Подарки: каталог", hint: "Все подарки, нажать — придёт в чат", group: "Подарки",
      blank: () => ({ ...head("Отправьте подарок", "Send a gift") }), fields: [["base", "Откуда данные (по умолчанию /gift-catalog/)", "text"]] },
    next: { name: "Следующий проект", hint: "Финальный призыв со ссылками", noHead: true,
      blank: () => ({ eyebrow: loc("Следующий проект", "Next project"), title: loc("Название", "Title"), text: loc(), items: [SUBS.links.blank()] }),
      fields: [["eyebrow", "Надзаголовок", "loc"], ["title", "Заголовок", "loc"], ["text", "Текст", "loc-area"], ["items", "Кнопки", "list:links"]] },
  };
  const tl = (it) => it.t?.ru || it.t?.en || "";
  const SUBS = {
    facts: { title: (it) => it.k?.ru || "Поле", blank: () => ({ k: loc(), v: loc() }), fields: [["k", "Название", "loc"], ["v", "Значение", "loc"]] },
    stats: { title: (it) => it.n || "Цифра", blank: () => ({ n: "", label: loc() }), fields: [["n", "Число", "text"], ["label", "Подпись", "loc"]] },
    cards: { title: (it) => tl(it) || "Карточка", blank: () => ({ t: loc(), d: loc() }), fields: [["t", "Заголовок", "loc"], ["d", "Текст", "loc-area"]] },
    flow: { title: (it) => tl(it) || "Шаг", blank: () => ({ t: loc(), d: loc() }), fields: [["t", "Шаг", "loc"], ["d", "Описание", "loc"]] },
    results: { title: (it) => tl(it) || "Итог", blank: () => ({ t: loc(), d: loc() }), fields: [["t", "Итог", "loc"], ["d", "Описание", "loc-area"]] },
    code: { title: (it) => it.label?.ru || "Панель", blank: () => ({ label: loc(), code: "" }),
      fields: [["label", "Подпись", "loc"], ["code", "Текст (подсветка: <k>ключ</k>, <s>строка</s>, <i>комментарий</i>)", "area"]] },
    strip: { title: (it) => tl(it) || it.c || "Кадр", blank: () => ({ src: "", t: loc(), c: "" }),
      fields: [["src", "Картинка", "img"], ["t", "Подпись", "loc"], ["c", "Имя файла (мелко)", "text"]] },
    cast: { title: (it) => tl(it) || "Персонаж", blank: () => ({ src: "", t: loc(), d: loc(), c: "" }),
      fields: [["src", "Портрет", "img"], ["t", "Имя", "loc"], ["d", "Роль", "loc"], ["c", "Имя файла (мелко)", "text"]] },
    pair: { title: (it) => it.cap?.ru || "Картинка", blank: () => ({ src: "", cap: loc() }), fields: [["src", "Картинка", "img"], ["cap", "Подпись", "loc"]] },
    lineups: { title: (it) => tl(it) || "Ряд", blank: () => ({ t: loc(), images: [] }), fields: [["t", "Название", "loc"], ["images", "Картинки", "imgs"]] },
    covers: { title: (it) => tl(it) || "Обложка", blank: () => ({ src: "", t: loc() }), fields: [["src", "Картинка", "img"], ["t", "Название", "loc"]] },
    vcovers: { title: (it) => tl(it) || "Видео", blank: () => ({ src: "", poster: "", t: loc() }),
      fields: [["src", "Видео .mp4 (путь или ссылка)", "text"], ["poster", "Кадр-заставка", "img"], ["t", "Название", "loc"]] },
    phones: { title: (it, i) => `Ролик ${i + 1}`, blank: () => ({ src: "", poster: "" }),
      fields: [["src", "Видео .mp4 (путь или ссылка)", "text"], ["poster", "Кадр-заставка", "img"]] },
    specs: { title: (it) => tl(it) || "Карточка", blank: () => ({ k: loc(), t: loc(), d: loc() }),
      fields: [["k", "Подпись (мелко, красным)", "loc"], ["t", "Заголовок", "loc"], ["d", "Текст", "loc-area"]] },
    rules: { title: (it) => tl(it).slice(0, 40) || "Правило", blank: () => ({ t: loc() }), fields: [["t", "Правило", "loc-area"]] },
    lanes: { title: (it) => `${it.plat?.ru || "Строка"}${it.state === "bad" ? " ✕" : ""}`,
      blank: () => ({ icons: "", plat: loc(), platSub: loc(), codec: loc(), codecSub: loc(), state: "ok", img: "" }),
      fields: [["icons", "Иконки: win, android, apple — через запятую", "text"], ["plat", "Платформа", "loc"], ["platSub", "Браузеры", "loc"],
        ["codec", "Формат", "loc"], ["codecSub", "Пояснение", "loc"],
        ["state", "Итог", "sel:ok=работает (галочка),bad=не работает (зачёркнуто и крестик),fix=решение (подсветка)"], ["img", "Картинка в квадрате", "img"]] },
    links: { title: (it) => it.label?.ru || "Кнопка", blank: () => ({ label: loc("Кнопка", "Button"), href: "" }),
      fields: [["label", "Текст", "loc"], ["href", "Ссылка (https://… или #якорь)", "text"]] },
  };
  let seLang = "ru";
  let seTarget = "home"; // which page the visual editor shows: "home" or a project id
  let seBlock = "hero";  // selected block id; "_head" = project header, "_add" = picking a new block, "general"
  let seAddAt = 0;       // where "_add" inserts
  let seUndo = null;     // the last deletion: a block { target, i, b } or a text / list item inside one { target, id, path, v, item }
  const seFold = {};     // list items opened / closed by hand in the panel: key → open
  let frameLoaded = false;

  const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  const fromField = (type, v) => type === "lines" ? v.split("\n").map((s) => s.trim()).filter(Boolean)
    : type === "csv" ? v.split(",").map((s) => s.trim()).filter(Boolean)
    : type === "number" ? (+v || 0) : v;
  const toField = (type, v) => type === "lines" ? (v || []).join("\n") : type === "csv" ? (v || []).join(", ") : (v ?? "");
  const srcOf = (s) => pending.get(s)?.dataURL || s;

  const seProject = () => (seTarget === "home" ? null : data.projects.find((p) => p.id === seTarget));
  const curBlocks = () => (seTarget === "home" ? site.blocks : (seProject().page ||= []));
  const findBlock = (id) => curBlocks().find((b) => b.id === id);
  const panelObj = () => (seBlock === "_head" ? seProject() : findBlock(seBlock));
  const newId = () => "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function blockLabel(b) {
    if (!b.type) return BLOCKS[b.id]?.name || b.id;
    const s = (b.title?.ru || b.text?.ru || b.caption?.ru || b.quote?.ru || "").replace(/\s+/g, " ").trim();
    return s ? `${TYPES[b.type].name}: ${s.length > 26 ? s.slice(0, 26) + "…" : s}` : TYPES[b.type].name;
  }

  // what the iframe reads (window.parent.siteEditor in app.js)
  window.siteEditor = {
    get draft() { return site; },
    get lang() { return seLang; },
    projects() {
      return {
        categories: data.categories,
        projects: data.projects.map((p) => {
          const c = clean(p);
          if (c.cover.shot && pending.has(c.cover.shot)) c.cover.shot = pending.get(c.cover.shot).dataURL;
          return c;
        }),
      };
    },
    project() { // the project page being edited
      const p = seProject();
      if (!p) return null;
      const c = clean(p);
      if (c.cover.shot) c.cover.shot = srcOf(c.cover.shot);
      c.page = p.page || [];
      return c;
    },
    src: srcOf,
    blockInfo(id) {
      if (id === "_head") return { name: "Шапка проекта" };
      const b = findBlock(id);
      if (!b) return { name: id };
      return b.type ? { name: TYPES[b.type].name, movable: true, removable: true }
        : { name: BLOCKS[id]?.name || id, movable: true, hideable: true, hidden: b.visible === false };
    },
    blockAction,
    onText(key, val) {
      site.text[seLang][key] = val;
      const inp = document.querySelector(`#sePanel [data-text="${CSS.escape(key)}"][data-l="${seLang}"]`);
      if (inp && inp !== document.activeElement) inp.value = val;
      updateStatus();
    },
    onField(id, path, val, raw) { // a text edited in place inside a block
      const obj = id === "_head" ? seProject() : findBlock(id);
      if (!obj) return;
      if (raw) setPath(obj, path, val);
      else {
        let o = getPath(obj, path);
        if (!o || typeof o !== "object") setPath(obj, path, o = loc());
        o[seLang] = val;
      }
      if (seBlock === id) {
        const inp = document.querySelector(`#sePanel [data-bp="${CSS.escape(path)}"]${raw ? "" : `[data-l="${seLang}"]`}`);
        if (inp && inp !== document.activeElement) inp.value = val;
      }
      renderSeBlocks();
      if (id === "_head") renderList();
      updateStatus();
    },
    // ✕ on a text inside a block (app.js): drop that text, or with item — the whole list item it sits in (a card, a step, a button)
    removeField(id, path, item) {
      const obj = findBlock(id);
      if (!obj?.type) return;
      if (item) path = path.replace(/\.[^.]+$/, ""); // items.2.t → items.2
      const keys = path.split(".");
      const parent = keys.length > 1 ? getPath(obj, keys.slice(0, -1).join(".")) : obj;
      const k = keys.at(-1);
      if (!parent || !(k in parent)) return;
      const v = Array.isArray(parent) ? parent.splice(+k, 1)[0] : parent[k];
      if (!Array.isArray(parent)) delete parent[k];
      seUndo = { target: seTarget, id, path, v, item };
      if (seBlock !== id) seBlock = id;
      renderSeBlocks(); renderSePanel(); refreshFrame(); updateStatus();
    },
    // ✕ on a built-in home text (app.js): it stays in site.text, the site just doesn't show it in this block
    removeText(id, key) { hideText(id, key, true); },
    removeTab(key) { hideTab(key, true); },
    ready() { frameLoaded = true; },
  };
  function hideText(id, key, on) {
    const k = `${id}:${key}`, list = (site.hiddenText || []).filter((x) => x !== k);
    if (on) list.push(k);
    if (list.length) site.hiddenText = list; else delete site.hiddenText;
    seUndo = on ? { target: seTarget, id, text: key } : null;
    seBlock = id;
    renderSeBlocks(); renderSePanel(); refreshFrame(); updateStatus();
  }

  // header tab on / off (site.navHidden); the «Общие настройки» panel opens, where it can be brought back
  function hideTab(key, on) {
    const list = (site.navHidden || []).filter((x) => x !== key);
    if (on) list.push(key);
    if (list.length) site.navHidden = list; else delete site.navHidden;
    seBlock = "general";
    renderSeBlocks(); renderSePanel(); refreshFrame(); updateStatus();
  }

  // coalesce bursts of edits into one re-render (a timer, not rAF: rAF stalls in background tabs)
  let refreshTimer = 0;
  function refreshFrame() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      try { q("#seFrame").contentWindow.siteEdit?.refresh(); } catch {}
    }, 30);
  }
  function scrollFrameTo(id) {
    setTimeout(() => { // after refreshFrame has rebuilt the blocks
      try {
        q("#seFrame").contentDocument.querySelector(`[data-block="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {}
    }, 90);
  }
  // home and project pages are different documents; switching between projects only re-renders
  // a project whose page is a separate hand-made site (links.page, e.g. /stasik-page/) and has no blocks:
  // the editor only shows that page as it is on the site
  const externalPage = (p) => (p && p.links.page && !p.page?.length ? p.links.page : "");
  function loadFrame() {
    const fr = q("#seFrame");
    const p = seProject();
    const ext = externalPage(p);
    const kind = ext ? `ext:${ext}` : seTarget === "home" ? "home" : "project";
    if (fr.dataset.kind !== kind) {
      fr.dataset.kind = kind;
      frameLoaded = false;
      fr.src = ext || (kind === "home" ? "index.html?edit=1" : "project.html?edit=1");
    } else {
      refreshFrame();
    }
    q("#seOpen").href = ext || (p ? `project.html?id=${encodeURIComponent(p.id)}` : "./");
  }

  function selectBlock(id) {
    seBlock = id;
    renderSeBlocks(); renderSePanel();
    scrollFrameTo(id);
  }

  function blockAction(id, act) {
    const arr = curBlocks();
    const i = arr.findIndex((b) => b.id === id);
    if (act === "open") { selectBlock(id); return; }
    if (act === "add") { // "+ блок" under a block: insert after it (the header: at the top)
      seAddAt = id === "_head" ? 0 : i + 1;
      seBlock = "_add";
      renderSeBlocks(); renderSePanel();
      return;
    }
    if (i < 0) return;
    if (act === "up" || act === "down") {
      const j = act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    } else if (act === "vis") {
      arr[i].visible = arr[i].visible === false;
    } else if (act === "del") {
      if (!arr[i].type) return; // built-in home blocks are only hidden, never deleted
      seUndo = { target: seTarget, i, b: arr.splice(i, 1)[0] };
      if (seBlock === id) seBlock = seTarget === "home" ? "hero" : "_head";
    }
    renderSeBlocks(); renderSePanel(); refreshFrame(); updateStatus();
  }

  function addBlock(type) {
    const b = { id: newId(), type, visible: true, ...TYPES[type].blank() };
    curBlocks().splice(Math.min(seAddAt, curBlocks().length), 0, b);
    refreshFrame(); updateStatus();
    selectBlock(b.id);
  }

  // only pages that exist: block pages, separate sites, and the one being started right now
  // (a new page is started from the project card: «Страница проекта →»)
  function renderTargets() {
    const pages = data.projects.filter((p) => p.page?.length || p.links.page || p.id === seTarget);
    q("#seTarget").innerHTML = `<option value="home">Главная страница</option>
      <optgroup label="Страницы проектов">${pages.map((p) =>
        `<option value="${h(p.id)}">${h(p.title.ru || p.id)}${externalPage(p) ? " · отдельная страница" : p.page?.length ? ` · ${p.page.length}` : " · новая"}${p.visible ? "" : " (скрыт)"}</option>`).join("")}</optgroup>`;
    q("#seTarget").value = seTarget;
  }

  function renderSeBlocks() {
    if (seTarget !== "home" && !seProject()) { seTarget = "home"; seBlock = "hero"; } // the project was deleted
    renderTargets();
    const home = seTarget === "home";
    if (externalPage(seProject())) {
      q("#seBlocks").innerHTML = `<div class="item on"><span></span><div style="min-width:0"><span class="c">только просмотр</span>
        <span class="t">Отдельная страница</span></div><span></span></div>`;
      return;
    }
    const row = (b, i) => `
      <div class="item${seBlock === b.id ? " on" : ""}${b.visible === false ? " hidden-p" : ""}" data-id="${h(b.id)}">
        <label class="sw" title="${b.visible === false ? "Скрыт" : "Показывается"}">
          <input type="checkbox" data-act="vis" ${b.visible === false ? "" : "checked"}><span></span>
        </label>
        <div style="min-width:0">${b.type && home ? `<span class="c">свой блок</span>` : ""}<span class="t">${h(blockLabel(b))}</span></div>
        <div class="mv">
          <button type="button" data-act="up" aria-label="Выше" ${i ? "" : "disabled"}>↑</button>
          <button type="button" data-act="down" aria-label="Ниже">↓</button>
          ${b.type ? `<button type="button" data-act="del" aria-label="Удалить" title="Удалить блок">✕</button>` : ""}
        </div>
      </div>`;
    const fixed = (id, title, sub) => `
      <div class="item${seBlock === id ? " on" : ""}" data-id="${id}">
        <span></span><div style="min-width:0"><span class="c">${sub}</span><span class="t">${title}</span></div><span></span>
      </div>`;
    q("#seBlocks").innerHTML = (home ? "" : fixed("_head", "Шапка проекта", "название, текст, обложка"))
      + curBlocks().map(row).join("")
      + `<button class="btn ghost small${seBlock === "_add" && seAddAt === curBlocks().length ? " on" : ""}" type="button" data-act="add-end" style="margin-top:4px">+ Добавить блок</button>`
      + (home ? `<div style="margin-top:10px">${fixed("general", "Общие настройки", "меню, футер, контакты")}</div>` : "");
  }

  q("#seBlocks").addEventListener("click", (e) => {
    if (e.target.closest("[data-act='add-end']")) {
      seAddAt = curBlocks().length; seBlock = "_add";
      renderSeBlocks(); renderSePanel();
      return;
    }
    const item = e.target.closest(".item");
    if (!item) return;
    const id = item.dataset.id;
    const act = e.target.dataset.act;
    if (!act && e.target.closest(".sw")) return; // the label forwards the click to its checkbox
    if (act === "vis") {
      findBlock(id).visible = e.target.checked;
      renderSeBlocks(); renderSePanel(); refreshFrame(); updateStatus();
    } else if (act) blockAction(id, act);
    else selectBlock(id);
  });

  q("#seTarget").addEventListener("change", (e) => {
    seTarget = e.target.value;
    seBlock = seTarget === "home" ? "hero" : "_head";
    renderSeBlocks(); renderSePanel(); loadFrame();
    try { q("#seFrame").contentWindow.scrollTo(0, 0); } catch {}
  });

  function openPage(id) {
    seTarget = id;
    seBlock = "_head";
    setMode("site");
  }

  function textFields(keys, id) {
    return keys.map((k) => {
      // ✕ / «Вернуть»: a built-in text can be taken off the page (header and footer texts in «Общие настройки» stay)
      if (id !== "general" && site.hiddenText?.includes(`${id}:${k}`))
        return `<div class="tx"><span>${h(KEY_LABEL[k] || k)} — удалён со страницы <button class="btn ghost small" type="button" data-unhide="${h(k)}">Вернуть</button></span></div>`;
      // header tabs (nav.*): ✕ takes the tab off the header (site.navHidden), «Вернуть» brings it back
      const tab = id === "general" && k.startsWith("nav.");
      if (tab && site.navHidden?.includes(k))
        return `<div class="tx"><span>${h(KEY_LABEL[k] || k)} — вкладка убрана из шапки <button class="btn ghost small" type="button" data-untab="${h(k)}">Вернуть</button></span></div>`;
      const ctl = tab ? ` <button class="btn ghost small" type="button" data-tab="${h(k)}" title="Убрать вкладку из шапки">✕</button>`
        : id === "general" ? "" : ` <button class="btn ghost small" type="button" data-hide="${h(k)}" title="Убрать этот текст со страницы">✕</button>`;
      // textareas everywhere: Enter adds a line break, which the site shows (white-space: pre-line)
      const long = Math.max((site.text.ru[k] || "").length, (site.text.en[k] || "").length) > 60;
      const inp = (l) => `<textarea class="${long ? "" : "short"}" data-text="${h(k)}" data-l="${l}" placeholder="${l.toUpperCase()}">${h(site.text[l][k])}</textarea>`;
      return `<div class="tx"><span>${h(KEY_LABEL[k] || k)}${ctl}</span><i>RU</i>${inp("ru")}<i>EN</i>${inp("en")}</div>${linkField(id, k)}`;
    }).join("");
  }

  // where a button leads: site.links["блок:ключ"] (header and footer — "top:ключ"); empty = as in the page html
  const LINK_DEFAULT = {
    brand: "./", "nav.home": "./", "nav.work": "projects.html", "nav.contact": "contact.html", "foot.ds": "design-system.html",
    "hero.cta": "projects.html", "hero.cv": "contact.html", "show.all": "projects.html", "contact.behance": "https://www.behance.net/EyeAnton",
  };
  const ANCHORS = [["#home", "Первый экран"], ["#about", "Что я делаю"], ["#work", "Избранные проекты"], ["#tools", "Стек"],
    ["#experience", "Опыт"], ["#contact", "Контакты (блок «Давайте поговорим»)"], ["./", "Главная страница"],
    ["projects.html", "Страница «Проекты»"], ["contact.html", "Страница «Контакты»"], ["design-system.html", "Дизайн-система"]];
  function linkField(id, k) {
    if (!(k in LINK_DEFAULT)) return "";
    const key = `${id === "general" ? "top" : id}:${k}`;
    return `<label class="f link-f">Куда ведёт — якорь главной, страница или адрес
      <input type="text" list="seAnchors" data-link="${h(key)}" value="${h(site.links?.[key] || "")}" placeholder="как сейчас: ${h(LINK_DEFAULT[k])}"></label>`;
  }
  const anchorList = () => `<datalist id="seAnchors">${ANCHORS.map(([v, l]) => `<option value="${h(v)}">${h(l)}</option>`).join("")}${
    (site.blocks || []).filter((b) => b.anchor).map((b) => `<option value="#${h(b.anchor)}">${h(blockLabel(b))}</option>`).join("")}</datalist>`;

  function field(path, label, type) {
    const v = toField(type, getPath(site, path));
    const attrs = `data-path="${h(path)}" data-type="${type}"`;
    if (type === "area" || type === "lines") return `<label class="f">${h(label)}<textarea ${attrs}>${h(v)}</textarea></label>`;
    if (type === "number") return `<label class="f">${h(label)}<input type="number" ${attrs} value="${h(v)}"></label>`;
    return `<label class="f">${h(label)}<input type="text" ${attrs} value="${h(v)}"></label>`;
  }

  function repeater(listPath) {
    const L = LISTS[listPath];
    const arr = getPath(site, listPath) || [];
    return `<div class="rep">${arr.map((it, i) => `
      <div class="rep-item">
        <div class="rep-head"><b>${h(L.title(it, i))}</b>
          <span class="mv">
            <button type="button" data-rep="${listPath}" data-i="${i}" data-act="up" aria-label="Выше">↑</button>
            <button type="button" data-rep="${listPath}" data-i="${i}" data-act="down" aria-label="Ниже">↓</button>
            <button type="button" data-rep="${listPath}" data-i="${i}" data-act="del" aria-label="Удалить">✕</button>
          </span>
        </div>
        ${L.fields.map(([k, label, type]) => field(`${listPath}.${i}.${k}`, label, type)).join("")}
      </div>`).join("")}
      <div><button class="btn ghost small" type="button" data-rep="${listPath}" data-act="add">+ Добавить</button></div>
    </div>`;
  }

  // gifts from the gift-catalog repo for the "Подарки" blocks: field type "gifts:all" (any gift) or "gifts:process"
  // (only gifts with Figma steps in process.json). Selected ones in order (↑ ↓ ✕), the rest below — a click adds.
  const giftsBase = (obj) => new URL(obj.base || "/gift-catalog/",
    location.hostname.endsWith("github.io") ? location.origin : "https://eyeanton.github.io").href;
  const giftsCache = {};
  function giftsFor(base) {
    if (!giftsCache[base]) {
      giftsCache[base] = { ready: false };
      const get = (f) => fetch(base + f, { cache: "no-cache" }).then((r) => r.json()).catch(() => ({ items: [] }));
      Promise.all([get("gifts.json"), get("process.json")]).then(([g, p]) => {
        Object.assign(giftsCache[base], { ready: true, items: g.items || [], process: new Set((p.items || []).map((x) => x.key)) });
        renderSePanel();
      });
    }
    return giftsCache[base];
  }
  function giftPicker(obj, path, label, src) {
    const base = giftsBase(obj), data = giftsFor(base);
    if (!data.ready) return `<div class="f gpick"><span>${h(label)}</span><p class="hint">Загружаю подарки…</p></div>`;
    const pool = data.items.filter((g) => (src !== "process" || data.process.has(g.key)) && (src !== "anim" || g.preview_webm));
    const byKey = new Map(pool.map((g) => [g.key, g]));
    const sel = (getPath(obj, path) || []).filter((k) => byKey.has(k));
    const chip = (g, inner) => `<span class="gp-chip" title="${h(g.key)}"><img src="${h(base + g.still)}" alt="" loading="lazy">${h(g.name)}${inner}</span>`;
    return `<div class="f gpick"><span>${h(label)}</span>
      <div class="gp-sel">${sel.length ? sel.map((k, i) => chip(byKey.get(k), `<span class="gp-mv">
        <button type="button" data-gp="${h(path)}" data-k="${h(k)}" data-act="up" aria-label="Раньше" ${i ? "" : "disabled"}>↑</button>
        <button type="button" data-gp="${h(path)}" data-k="${h(k)}" data-act="down" aria-label="Позже" ${i < sel.length - 1 ? "" : "disabled"}>↓</button>
        <button type="button" data-gp="${h(path)}" data-k="${h(k)}" data-act="del" aria-label="Убрать">✕</button></span>`)).join("")
        : `<p class="hint">Ничего не выбрано — ${src === "process" ? "показываются все" : src === "anim" ? "каждый раз любой из анимированных" : "играют первые шесть"}.</p>`}</div>
      <p class="hint">Добавить — нажать на подарок:</p>
      <div class="gp-pool">${pool.filter((g) => !sel.includes(g.key)).map((g) =>
        `<button type="button" class="gp-chip" data-gp="${h(path)}" data-k="${h(g.key)}" data-act="add" title="${h(g.key)}"><img src="${h(base + g.still)}" alt="" loading="lazy">${h(g.name)}</button>`).join("")}</div>
    </div>`;
  }
  function giftPick(path, key, act) {
    const obj = panelObj();
    const list = [...(getPath(obj, path) || [])].filter((k) => k !== key || act !== "del");
    const i = list.indexOf(key);
    if (act === "add" && i < 0) list.push(key);
    if ((act === "up" && i > 0) || (act === "down" && i >= 0 && i < list.length - 1)) {
      const j = act === "up" ? i - 1 : i + 1;
      [list[i], list[j]] = [list[j], list[i]];
    }
    setPath(obj, path, list);
    renderSeBlocks(); renderSePanel(); refreshFrame(); updateStatus();
  }

  // a field of the selected block (or of the project for "_head"); data-bp = path inside it
  const arrBtns = (path, i) => `<span class="mv">
      <button type="button" data-arr="${h(path)}" data-i="${i}" data-act="up" aria-label="Выше">↑</button>
      <button type="button" data-arr="${h(path)}" data-i="${i}" data-act="down" aria-label="Ниже">↓</button>
      <button type="button" data-arr="${h(path)}" data-i="${i}" data-act="del" aria-label="Удалить">✕</button>
    </span>`;
  function bField(obj, path, label, type) {
    const v = getPath(obj, path);
    const bp = `data-bp="${h(path)}"`;
    if (type === "loc" || type === "loc-area") {
      const inp = (l) => `<textarea class="${type === "loc" ? "short" : ""}" ${bp} data-l="${l}" placeholder="${l.toUpperCase()}">${h(v?.[l])}</textarea>`;
      return `<div class="tx"><span>${h(label)}</span><i>RU</i>${inp("ru")}<i>EN</i>${inp("en")}</div>`;
    }
    if (type === "text") return `<label class="f">${h(label)}<input type="text" ${bp} value="${h(v)}"></label>`;
    if (type === "area") return `<label class="f">${h(label)}<textarea class="mono" ${bp}>${h(v)}</textarea></label>`;
    if (type === "csv") return `<label class="f">${h(label)}<input type="text" ${bp} data-type="csv" value="${h((v || []).join(", "))}"></label>`;
    if (type.startsWith("gifts:")) return giftPicker(obj, path, label, type.slice(6));
    if (type.startsWith("sel:")) return `<label class="f">${h(label)}<select ${bp}>${type.slice(4).split(",").map((o) => {
      const [val, l] = o.split("=");
      return `<option value="${h(val)}" ${val === (v ?? "") ? "selected" : ""}>${h(l)}</option>`;
    }).join("")}</select></label>`;
    if (type === "zoom") { // project.head.zoom; not set = 1.45 (as in the Virtual Gifts hero)
      const cur = +(v ?? 1.45);
      return `<label class="f">${h(label)}<select ${bp} data-type="number">${[[0, "Выключено"], [1.2, "1.2×"], [1.45, "1.45× — как в подарках"], [1.7, "1.7×"]]
        .map(([n, l]) => `<option value="${n}" ${n === cur ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
    }
    if (type.startsWith("num:")) return `<label class="f">${h(label)}<select ${bp} data-type="number">${type.slice(4).split(",").map((n) =>
      `<option ${+n === +v ? "selected" : ""}>${n}</option>`).join("")}</select></label>`;
    if (type === "img") return `<div class="f img-f"><span>${h(label)}</span>
        <div class="shot-box">${v ? `<img src="${h(srcOf(v))}" alt="">` : ""}
          <label class="btn ghost small" style="cursor:pointer">Загрузить картинку…<input type="file" data-up="${h(path)}" accept="image/*" hidden></label></div>
        <input type="text" ${bp} value="${h(v)}" placeholder="или путь / ссылка: assets/… или https://…"></div>`;
    if (type === "imgs") return `<div class="f img-f"><span>${h(label)}</span>
        <div class="rep">${(v || []).map((s, i) => `<div class="img-row"><img src="${h(srcOf(s))}" alt="">
          <input type="text" data-bp="${h(path)}.${i}" value="${h(s)}">${arrBtns(path, i)}</div>`).join("")}</div>
        <div><label class="btn ghost small" style="cursor:pointer">+ Добавить картинки…<input type="file" data-upadd="${h(path)}" accept="image/*" multiple hidden></label></div></div>`;
    if (type.startsWith("list:")) {
      // items fold up (long lists like 26 covers); opened / closed ones are remembered across re-renders
      const S = SUBS[type.slice(5)];
      const list = v || [];
      return `<h2 class="sec">${h(label)} <small>${list.length}</small></h2><div class="rep">${list.map((it, i) => {
        const key = `${seTarget}/${seBlock}/${path}.${i}`;
        const open = seFold[key] ?? list.length <= 3;
        return `<details class="rep-item" data-key="${h(key)}" ${open ? "open" : ""}>
          <summary class="rep-head"><b>${h(S.title(it, i)) || "—"}</b>${arrBtns(path, i)}</summary>
          ${S.fields.map(([k, l, t]) => bField(obj, `${path}.${i}.${k}`, l, t)).join("")}
        </details>`;
      }).join("")}
        <div><button class="btn ghost small" type="button" data-arradd="${h(path)}" data-sub="${type.slice(5)}">+ Добавить</button></div></div>`;
    }
    return "";
  }

  // «Оформление»: block.style (app.js styleBlocks → data-s-*, rules at the end of style.css); "" = as designed
  const STYLE_OPTS = [
    ["bg", "Фон", [["", "Нет"], ["card", "Карточка"], ["band", "Полоса"], ["deep", "Глубокая полоса"], ["line", "Линия сверху"]]],
    ["space", "Отступ сверху", [["0", "Нет"], ["s", "Меньше"], ["", "Обычный"], ["l", "Больше"]]],
    ["align", "Выравнивание", [["", "Как задумано"], ["left", "Слева"], ["center", "По центру"]]],
    ["w", "Ширина", [["narrow", "Узкая"], ["", "Обычная"], ["wide", "Широкая"]]],
    ["h", "Заголовки", [["s", "Меньше"], ["", "Обычные"], ["l", "Крупнее"]]],
    ["accent", "Акцентный цвет", [["", "Красный"], ["blue", "Синий"], ["teal", "Бирюзовый"], ["white", "Белый"]]],
    ["anim", "Появление при прокрутке", [["", "С анимацией"], ["false", "Сразу"]]],
  ];
  let styleClip = null; // «Скопировать оформление» → «Вставить» on another block
  function styleSection(obj) {
    const st = obj.style || {};
    const key = `${seTarget}/${seBlock}/style`;
    const set = STYLE_OPTS.filter(([k]) => k in st).map(([k, , opts]) => opts.find(([v]) => v === String(st[k]))?.[1]).filter(Boolean);
    return `<details class="rep-item" data-key="${h(key)}" ${seFold[key] ?? !!obj.style ? "open" : ""}>
      <summary class="rep-head"><b>Оформление</b><span class="hint">${h(set.join(" · ") || "как задумано")}</span></summary>
      ${STYLE_OPTS.map(([k, label, opts]) => `<div class="st-row"><span>${label}</span><div class="pv-tabs">${opts.map(([v, l]) =>
        `<button class="chip" type="button" data-st="${k}" data-v="${v}" aria-selected="${String(st[k] ?? "") === v}">${l}</button>`).join("")}</div></div>`).join("")}
      <div class="se-acts">
        <button class="btn ghost small" type="button" data-stcopy ${obj.style ? "" : "disabled"}>Скопировать оформление</button>
        ${styleClip ? `<button class="btn ghost small" type="button" data-stpaste>Вставить оформление</button>` : ""}
        ${obj.style ? `<button class="btn ghost small" type="button" data-streset>Сбросить</button>` : ""}
      </div></details>`;
  }
  function setStyle(obj, k, v) {
    const st = { ...obj.style };
    if (v === "") delete st[k]; else st[k] = k === "anim" ? false : v;
    if (Object.keys(st).length) obj.style = st; else delete obj.style;
  }

  function renderSePanel() {
    if (!site) return;
    const home = seTarget === "home";
    const undo = seUndo && seUndo.target === seTarget
      ? `<div class="undo"><span>${seUndo.b ? `Блок «${h(blockLabel(seUndo.b))}» удалён` : seUndo.item ? "Пункт удалён" : "Текст удалён"}</span><button class="btn ghost small" type="button" data-undo>Вернуть</button></div>` : "";

    const ext = externalPage(seProject());
    if (ext) {
      q("#sePanel").innerHTML = `<h2>Отдельная страница</h2>
        <p class="hint">Страница этого проекта — отдельный сайт <b>${h(ext)}</b>, собранный вручную (например, 3D-модель с живой прошивкой).
          Слева — как она выглядит на сайте сейчас. Её код лежит в своём репозитории и правится там, не в админке.</p>
        <div><a class="btn ghost small" href="${h(ext)}" target="_blank" rel="noopener">Открыть на сайте ↗</a></div>
        <p class="hint">Чтобы собрать страницу из блоков здесь, очистите у проекта поле «Раздел этого сайта» и добавьте блоки — карточка поведёт на новую страницу.</p>
        <div><button class="btn ghost small" type="button" data-goto="projects">Открыть карточку проекта</button></div>`;
      return;
    }

    if (seBlock === "_add") {
      const arr = curBlocks();
      const after = seAddAt === 0 ? (home ? "в начало" : "сразу после шапки") : `после «${blockLabel(arr[seAddAt - 1])}»`;
      q("#sePanel").innerHTML = `${undo}<h2>Новый блок</h2><p class="hint">Встанет ${h(after)}. Потом его можно передвинуть стрелками.</p>
        ${[...new Set(Object.values(TYPES).map((T) => T.group || ""))].map((g) => `${g ? `<h2 class="sec">${h(g)}</h2>` : ""}
          <div class="types">${Object.entries(TYPES).filter(([, T]) => (T.group || "") === g).map(([k, T]) =>
            `<button type="button" class="type-btn" data-newtype="${k}"><b>${T.name}</b><span>${T.hint}</span></button>`).join("")}</div>`).join("")}`;
      return;
    }

    if (seBlock === "_head") {
      const p = seProject();
      q("#sePanel").innerHTML = `${undo}<h2>Шапка проекта</h2>
        <p class="hint">Название и описание — те же, что на карточке проекта. Обложка, теги, ссылки и категория — во вкладке «Проекты».</p>
        ${bField(p, "title", "Название", "loc")}
        ${bField(p, "head.accent", "Часть названия в градиенте (например, Club)", "text")}
        ${bField(p, "head.eyebrow", "Надзаголовок (например, Кейс · AI-пайплайн)", "loc")}
        ${bField(p, "head.lead", "Лид — текст под названием (пусто — описание с карточки)", "loc-area")}
        ${bField(p, "head.ctas", "Кнопки под лидом (#якорь — на блок этой страницы)", "list:links")}
        ${bField(p, "head.cloud", "Бегущая лента картинок (пусто — обложка проекта)", "imgs")}
        ${bField(p, "head.cloudStyle", "Вид ленты", "sel:=обложки (квадратные плитки),cutout=вырезанные объекты (как подарки)")}
        ${bField(p, "head.zoom", "Ленту при наведении: остановить и увеличить картинку", "zoom")}
        <div><button class="btn ghost small" type="button" data-goto="projects">Открыть карточку проекта</button></div>
        <p class="hint">Блоки ниже шапки: «+ блок» под любым блоком на странице или «+ Добавить блок» слева. Половинные блоки встают по два в ряд; удалите блок — остальные сдвинутся.</p>`;
      return;
    }

    const cb = findBlock(seBlock);
    if (cb?.type) {
      const T = TYPES[cb.type];
      q("#sePanel").innerHTML = `${undo}<h2>${T.name}</h2>
        <label class="check"><input type="checkbox" data-bp="visible" data-type="bool" ${cb.visible === false ? "" : "checked"}> Показывать на сайте</label>
        ${home ? "" : `<label class="f">Ширина<select data-bp="w">
          <option value="">На всю ширину</option><option value="half" ${cb.w === "half" ? "selected" : ""}>Половина — два блока в ряд</option></select></label>`}
        ${styleSection(cb)}
        ${T.noHead ? "" : `<label class="check"><input type="checkbox" data-head ${hasHead(cb) ? "checked" : ""}> Заголовок секции (надзаголовок, заголовок, текст)</label>
          ${hasHead(cb) ? bField(cb, "eyebrow", "Надзаголовок", "loc") + bField(cb, "title", "Заголовок", "loc") + bField(cb, "text", "Текст", "loc-area") : ""}`}
        ${T.fields.map(([k, l, t]) => bField(cb, k, l, t)).join("")}
        ${bField(cb, "anchor", "Якорь — для кнопок вида #story (латиницей, можно пусто)", "text")}
        <p class="hint">Тексты можно править и прямо на странице.</p>
        <div class="se-acts">
          <button class="btn ghost small" type="button" data-bact="up">↑ Выше</button>
          <button class="btn ghost small" type="button" data-bact="down">↓ Ниже</button>
          <button class="btn danger small" type="button" data-bact="del">Удалить блок</button>
        </div>`;
      return;
    }

    const B = BLOCKS[seBlock];
    if (!B) { q("#sePanel").innerHTML = `${undo}<p class="hint">Выберите блок слева или на странице.</p>`; return; }
    const blk = site.blocks.find((b) => b.id === seBlock);
    const extra = {
      hero: `<h2 class="sec">Подарок в коробке</h2>
        <p class="hint">При каждом заходе в коробке случайный подарок из выбранных (не тот же, что в прошлый раз). В списке — только подарки с анимацией из каталога Virtual Gifts.</p>
        ${giftPicker(blk, "gifts", "Какие подарки могут попасть в коробку", "anim")}`,
      stats: `<h2 class="sec">Данные</h2>${field("profile.since", "Год начала работы в 3D (для «N+ лет»)", "number")}
        <p class="hint">Число проектов и живых сайтов считается само по вкладке «Проекты».</p>`,
      areas: `<h2 class="sec">Навыки</h2>${repeater("profile.skills")}
        <h2 class="sec">Soft skills</h2>${field("profile.soft.ru", "RU — по одному на строку", "lines")}${field("profile.soft.en", "EN — по одному на строку", "lines")}`,
      showcase: `<p class="hint">Какие проекты здесь показывать — галочка «На главной (избранное)» во вкладке «Проекты»; порядок — как в списке проектов.</p>
        <div><button class="btn ghost small" type="button" data-goto="projects">Открыть «Проекты»</button></div>`,
      stack: `<h2 class="sec">Бегущая строка</h2>${field("profile.stack.0", "Первый ряд — по одному на строку", "lines")}${field("profile.stack.1", "Второй ряд — по одному на строку", "lines")}
        <h2 class="sec">Подсказки по клику</h2><p class="hint">По строке: «Название — коротко что это». Название — как в бегущей строке.</p>
        ${field("profile.stackInfo.ru", "RU", "lines")}${field("profile.stackInfo.en", "EN", "lines")}`,
      exp: `<h2 class="sec">Места работы</h2>${repeater("profile.experience")}`,
      general: `<h2 class="sec">Структура сайта</h2>
        <p class="hint">Выключенная страница больше не открывается: её адрес и все ссылки на неё ведут на блок главной (Проекты → #work, Контакты → #contact).</p>
        ${[["projects", "Отдельная страница «Проекты»"], ["contact", "Отдельная страница «Контакты»"]].map(([pg, l]) =>
          `<label class="check"><input type="checkbox" data-page="${pg}" ${site.pages?.[pg] === false ? "" : "checked"}> ${l}</label>`).join("")}
        <p class="hint">Вкладки в шапке:</p>
        ${[["nav.home", "Главная"], ["nav.work", "Проекты"], ["nav.contact", "Контакты"]].map(([k, l]) =>
          `<label class="check"><input type="checkbox" data-nav="${k}" ${(site.navHidden || []).includes(k) ? "" : "checked"}> ${l}</label>`).join("")}
        <p class="hint">Куда ведут вкладки — поле «Куда ведёт» под их текстами выше.</p>
        <h2 class="sec">Контакты</h2><p class="hint">Показываются на странице «Контакты».</p>${repeater("profile.channels")}
        <label class="check"><input type="checkbox" data-path="profile.showCode" data-type="bool" ${site.profile.showCode ? "checked" : ""}> Показывать кнопки «Код» у проектов</label>
        <h2 class="sec">Гость с CV</h2>${field("profile.guestDelay", "Через сколько секунд появляется курсор «Anton Egorov» с CV (0 — выключить)", "number")}
        <p class="hint">Один раз за визит (в новой вкладке — снова); на телефоне иконка ложится в правый нижний угол. На страницах проектов — не по таймеру, а после 3 секунд на последних экранах. После замены CV обновить превью: python tools/cv_thumbs.py.</p>`,
    }[seBlock] || "";
    q("#sePanel").innerHTML = `${undo}
      <h2>${h(B.name)}</h2>
      ${blk ? `<label class="check"><input type="checkbox" data-blockvis ${blk.visible === false ? "" : "checked"}> Показывать блок на сайте</label>
        <p class="hint">Встроенный блок: его можно скрыть, но не удалить. Ненужный текст в нём убирается ✕ — здесь или на странице («✕ текст» по наведению), место он больше не занимает.</p>${styleSection(blk)}` : ""}
      <h2 class="sec">Тексты</h2>
      ${textFields(B.keys, seBlock)}
      ${extra}${anchorList()}`;
  }

  q("#sePanel").addEventListener("input", (e) => {
    const el = e.target;
    if (el.hasAttribute("data-head")) { // section head on / off
      const cb = findBlock(seBlock);
      if (el.checked) Object.assign(cb, head(), { eyebrow: cb.eyebrow || loc() });
      else for (const k of ["eyebrow", "title", "text"]) delete cb[k];
      renderSeBlocks(); renderSePanel(); refreshFrame(); updateStatus();
      return;
    }
    if (el.dataset.bp) {
      const obj = panelObj();
      const path = el.dataset.bp;
      if (el.dataset.l) {
        let o = getPath(obj, path);
        if (!o || typeof o !== "object") setPath(obj, path, o = loc());
        o[el.dataset.l] = el.value;
      } else if (el.dataset.type === "bool") setPath(obj, path, el.checked);
      else if (el.dataset.type === "number") setPath(obj, path, +el.value);
      else if (el.dataset.type === "csv") setPath(obj, path, el.value.split(",").map((s) => s.trim()).filter(Boolean));
      else if (path === "w" && !el.value) delete obj.w;
      else setPath(obj, path, el.value);
      renderSeBlocks();
      if (seBlock === "_head") renderList();
    } else if (el.dataset.text) {
      site.text[el.dataset.l][el.dataset.text] = el.value;
    } else if (el.dataset.link) {
      const v = el.value.trim();
      site.links ||= {};
      if (v) site.links[el.dataset.link] = v; else delete site.links[el.dataset.link];
    } else if (el.dataset.page) {
      site.pages ||= {};
      if (el.checked) delete site.pages[el.dataset.page]; else site.pages[el.dataset.page] = false;
    } else if (el.dataset.nav) {
      return hideTab(el.dataset.nav, !el.checked); // the tab's text field above switches to ✕ / «Вернуть» too
    } else if (el.dataset.path) {
      setPath(site, el.dataset.path, el.dataset.type === "bool" ? el.checked : fromField(el.dataset.type, el.value));
    } else if (el.hasAttribute("data-blockvis")) {
      site.blocks.find((b) => b.id === seBlock).visible = el.checked;
      renderSeBlocks();
    } else return;
    refreshFrame(); updateStatus();
  });

  // GIFs are kept as they are (animation); everything else goes through shrink() → PNG or JPEG
  const readRaw = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ dataURL: r.result, b64: r.result.split(",")[1] });
    r.onerror = () => reject(new Error("не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
  async function upload(file, owner) {
    const gif = file.type === "image/gif";
    const img = gif ? { ...(await readRaw(file)), ext: "gif" } : await shrink(file);
    const path = `${SHOTS}${owner}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.${img.ext}`;
    pending.set(path, img);
    return path;
  }

  q("#sePanel").addEventListener("change", async (e) => {
    const el = e.target;
    if (el.dataset.bp && el.closest(".img-f")) { renderSePanel(); return; } // a typed path: refresh the thumbnail
    if (el.type !== "file" || !el.files.length) return;
    const obj = panelObj();
    try {
      setStatus("Обрабатываю картинки…");
      const paths = [];
      for (const f of el.files) paths.push(await upload(f, seTarget === "home" ? "home" : seTarget));
      if (el.dataset.up) setPath(obj, el.dataset.up, paths[0]);
      else setPath(obj, el.dataset.upadd, [...(getPath(obj, el.dataset.upadd) || []), ...paths]);
      renderSePanel(); refreshFrame(); updateStatus();
    } catch (err) {
      setStatus(`Не удалось прочитать картинку: ${err.message}`, "err");
    }
  });

  q("#sePanel").addEventListener("click", (e) => {
    const sum = e.target.closest("summary");
    if (sum && !e.target.closest("button")) { seFold[sum.parentElement.dataset.key] = !sum.parentElement.open; return; }
    const b = e.target.closest("button");
    if (!b) return;
    if (sum) e.preventDefault(); // ↑ ↓ ✕ in a folded item's title don't fold it
    if (b.dataset.goto) {
      const p = seProject();
      if (p) { sel = data.projects.indexOf(p); renderAll(); }
      setMode(b.dataset.goto);
      return;
    }
    if (b.dataset.newtype) { addBlock(b.dataset.newtype); return; }
    if (b.dataset.gp) { giftPick(b.dataset.gp, b.dataset.k, b.dataset.act); return; }
    if (b.dataset.tab || b.dataset.untab) { hideTab(b.dataset.tab || b.dataset.untab, !!b.dataset.tab); return; }
    if (b.dataset.hide || b.dataset.unhide) { hideText(seBlock, b.dataset.hide || b.dataset.unhide, !!b.dataset.hide); return; }
    if (b.hasAttribute("data-undo") && seUndo.text) { hideText(seUndo.id, seUndo.text, false); return; }
    if (b.hasAttribute("data-undo") && !seUndo.b) { // a text / list item back into its block
      const { id, path, v } = seUndo;
      const obj = findBlock(id);
      seUndo = null;
      if (obj) {
        const keys = path.split(".");
        const parent = keys.length > 1 ? getPath(obj, keys.slice(0, -1).join(".")) : obj;
        if (Array.isArray(parent)) parent.splice(Math.min(+keys.at(-1), parent.length), 0, v);
        else setPath(obj, path, v);
      }
      refreshFrame(); updateStatus();
      selectBlock(id);
      return;
    }
    if (b.hasAttribute("data-undo")) {
      const arr = curBlocks();
      arr.splice(Math.min(seUndo.i, arr.length), 0, seUndo.b);
      const id = seUndo.b.id;
      seUndo = null;
      refreshFrame(); updateStatus();
      selectBlock(id);
      return;
    }
    if (b.dataset.st || b.hasAttribute("data-stpaste") || b.hasAttribute("data-streset")) {
      const obj = panelObj();
      if (b.dataset.st) setStyle(obj, b.dataset.st, b.dataset.v);
      else if (b.hasAttribute("data-streset")) delete obj.style;
      else obj.style = structuredClone(styleClip);
      renderSePanel(); refreshFrame(); updateStatus();
      return;
    }
    if (b.hasAttribute("data-stcopy")) {
      styleClip = structuredClone(panelObj().style);
      renderSePanel();
      setStatus("Оформление скопировано — откройте другой блок и нажмите «Вставить оформление»");
      return;
    }
    if (b.dataset.bact) { blockAction(seBlock, b.dataset.bact); return; }
    if (b.dataset.arradd) {
      const obj = panelObj();
      setPath(obj, b.dataset.arradd, [...(getPath(obj, b.dataset.arradd) || []), SUBS[b.dataset.sub].blank()]);
      renderSePanel(); refreshFrame(); updateStatus();
      return;
    }
    const arr = b.dataset.arr ? getPath(panelObj(), b.dataset.arr) : b.dataset.rep ? getPath(site, b.dataset.rep) : null;
    if (!arr) return;
    const i = +b.dataset.i;
    if (b.dataset.act === "add") arr.push(LISTS[b.dataset.rep].blank());
    else if (b.dataset.act === "del") {
      if (b.dataset.rep && !confirm("Удалить этот пункт?")) return;
      arr.splice(i, 1);
    } else {
      const j = b.dataset.act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    renderSePanel(); refreshFrame(); updateStatus();
  });

  // RU/EN and desktop/phone switches above the page
  q(".se-toolbar").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.sl) {
      seLang = b.dataset.sl;
      q(".se-toolbar").querySelectorAll("[data-sl]").forEach((x) => x.setAttribute("aria-selected", x === b));
      refreshFrame();
    }
    if (b.dataset.dev) {
      q(".se-toolbar").querySelectorAll("[data-dev]").forEach((x) => x.setAttribute("aria-selected", x === b));
      q("#seFrameWrap").classList.toggle("mobile", b.dataset.dev === "mobile");
    }
  });

  /* ---------- History: published versions of the content ---------- */
  // A version = the repo at a commit that touched projects.json or site.json (admin publishes, merged PRs).
  // «Вернуть» loads both files as they were there into the draft; uploads deleted since then come back
  // from the same commit (git blobs) as pending images, so «Опубликовать» re-uploads them.

  let history = null;     // [{ sha, date, msg, files }] newest first
  let restoredFrom = "";  // sha of the version loaded as the draft (for the publish message and the ✓ in the list)

  async function loadHistory() {
    if (LOCAL) { q("#hist").innerHTML = `<p class="hint">В локальном режиме истории нет — откройте админку на сайте.</p>`; return; }
    q("#hist").innerHTML = `<p class="hint">Загружаю историю…</p>`;
    try {
      const lists = await Promise.all([DATA, SITE_FILE].map((f) => gh(`/commits?sha=${BRANCH}&path=${f}&per_page=50`)));
      const by = new Map();
      lists.forEach((list, i) => list.forEach((c) => {
        const v = by.get(c.sha) || { sha: c.sha, date: new Date(c.commit.committer.date), msg: c.commit.message.split("\n")[0], files: [] };
        v.files.push(i ? "главная" : "проекты");
        by.set(c.sha, v);
      }));
      history = [...by.values()].sort((a, b) => b.date - a.date);
      renderHistory();
    } catch (e) {
      q("#hist").innerHTML = `<p class="status err">Не удалось загрузить историю: ${h(e.message)}</p>`;
    }
  }

  const ADMIN_MSG = { "Admin: update projects": "Админка: проекты", "Admin: update home page": "Админка: страницы", "Admin: restore": "Админка: возврат версии" };
  function renderHistory() {
    if (!history) return;
    const fmt = (d) => d.toLocaleString("ru", { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric", hour: "2-digit", minute: "2-digit" });
    q("#hist").innerHTML = history.map((v, i) => {
      const msg = Object.entries(ADMIN_MSG).find(([k]) => v.msg.startsWith(k))?.[1] || v.msg;
      return `<div class="hist-item${v.sha === restoredFrom ? " on" : ""}">
        <time datetime="${v.date.toISOString()}">${fmt(v.date)}</time>
        <span class="m" title="${h(v.msg)}">${h(msg)}<small>${v.files.join(", ")}</small></span>
        ${i === 0 && !restoredFrom ? `<span class="hint">сейчас на сайте</span>`
          : v.sha === restoredFrom ? `<span class="hint">в черновике</span>`
          : `<button class="btn ghost small" type="button" data-restore="${v.sha}">Вернуть</button>`}
      </div>`;
    }).join("") || `<p class="hint">Публикаций пока нет.</p>`;
  }

  async function restoreVersion(sha) {
    if (isDirty() && !confirm("Неопубликованные изменения пропадут — вместо них загрузится эта версия. Продолжить?")) return;
    const v = history.find((x) => x.sha === sha);
    try {
      setStatus("Загружаю версию…");
      const read = async (f) => { const r = await gh(`/contents/${f}?ref=${sha}`, { allow404: true }); return r && JSON.parse(b64ToUtf8(r.content)); };
      const [oldData, oldSite] = await Promise.all([read(DATA), read(SITE_FILE)]);
      if (!oldData || !oldSite) throw new Error("в этой версии нет файлов контента");
      // uploads the version uses that are gone now: take them from that commit
      const now = new Set(((await gh(`/contents/${SHOTS.slice(0, -1)}?ref=${BRANCH}`, { allow404: true })) || []).map((f) => f.path));
      const missing = [...imagesOf(oldData.projects, oldSite)].filter((p) => !now.has(p));
      pending.clear(); replaced.clear();
      for (const [i, p] of missing.entries()) {
        setStatus(`Возвращаю картинки из истории… ${i + 1} из ${missing.length}`);
        const f = await gh(`/contents/${encodeURI(p)}?ref=${sha}`, { allow404: true });
        if (!f) continue;
        const b64 = (await gh(`/git/blobs/${f.sha}`)).content.replace(/\s/g, "");
        const ext = p.split(".").pop().toLowerCase();
        pending.set(p, { b64, dataURL: `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${b64}` });
      }
      data = oldData; data.projects.forEach(normalize);
      site = oldSite; applySite(site);
      sel = Math.min(sel, data.projects.length - 1);
      if (seTarget !== "home" && !seProject()) { seTarget = "home"; seBlock = "hero"; }
      restoredFrom = sha;
      renderAll(); renderSite(); renderHistory();
      setStatus(`Версия от ${v.date.toLocaleString("ru")} в черновике — посмотрите во «Страницах» и нажмите «Опубликовать»`, "dirty");
    } catch (e) {
      setStatus(`Не удалось вернуть версию: ${e.message}`, "err");
    }
  }

  q("#hist").addEventListener("click", (e) => {
    const b = e.target.closest("[data-restore]");
    if (b) restoreVersion(b.dataset.restore);
  });

  function setMode(mode) {
    q("#modes").querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-selected", x.dataset.mode === mode));
    q("#projectsMode").hidden = mode !== "projects";
    q("#siteMode").hidden = mode !== "site";
    q("#historyMode").hidden = mode !== "history";
    if (mode === "history" && !history) loadHistory();
    q(".adm").classList.toggle("wide", mode === "site");
    if (mode === "site") { // also picks up unsaved project edits (featured projects, covers)
      renderSeBlocks(); renderSePanel(); loadFrame();
    }
  }
  q("#modes").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });

  function renderSite() {
    if (!site) return;
    renderSeBlocks(); renderSePanel();
    if (frameLoaded) refreshFrame();
  }

  /* ---------- Boot ---------- */

  try { localStorage.removeItem("adminToken"); } catch {} // token from the pre-Google version of this page
  if (LOCAL) {
    load().then(() => {
      q("#login").hidden = true;
      q("#app").hidden = false; q("#bar").hidden = false;
      setStatus("Локальный режим без входа: правки видны, публикация отключена");
    }).catch((e) => loginStatus(`Локальный режим: ${e.message}`, "err"));
  } else {
    initFirebase().catch((e) => loginStatus(`Не удалось загрузить Firebase: ${e.message}`, "err"));
  }
})();
