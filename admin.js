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
    if (c.cover.pos === "") delete c.cover.pos;
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
        await putFile(DATA, utf8ToB64(serialize()), "Admin: update projects");
        savedJSON = serialize();
      }
      pending.clear(); replaced.clear();
      if (siteDirty()) {
        setStatus("Сохраняю главную страницу…");
        await putFile(SITE_FILE, utf8ToB64(serializeSite()), "Admin: update home page");
        siteSaved = serializeSite();
      }
      renderAll();
      setStatus("Опубликовано. Сайт обновится примерно через минуту.", "ok");
    } catch (e) {
      setStatus(`Ошибка публикации: ${e.message}`, "err");
    } finally {
      btn.disabled = false;
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
          <p class="sub" style="margin:0">Любой размер — уменьшится до ${MAX_W}px по ширине и сохранится в JPEG. На карточке обложка обрезается до 16:10.</p>
          <label class="f">Какую часть картинки показывать<select data-k="cover.pos">
            ${[["", "Верх (по умолчанию)"], ["center center", "Центр"], ["center bottom", "Низ"]].map(([v, l]) =>
              `<option value="${v}" ${(p.cover.pos || "") === v ? "selected" : ""}>${l}</option>`).join("")}
          </select></label>` : ""}
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
      </div>
    </div>`;
    renderPreview();
  }

  function setPath(obj, path, val) {
    const keys = path.split(".");
    let o = obj;
    for (const k of keys.slice(0, -1)) o = o[k] ||= {};
    o[keys.at(-1)] = val;
  }

  q("#edit").addEventListener("input", (e) => {
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
        const { b64, dataURL } = await shrink(e.target.files[0]);
        const path = `${SHOTS}${p.id}-${Date.now().toString(36)}.jpg`; // new name each time, so caches never show the old one
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

  // Downscale to MAX_W and re-encode as JPEG in the browser.
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, MAX_W / img.naturalWidth);
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.naturalWidth * s);
        cv.height = Math.round(img.naturalHeight * s);
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#0b0b0b"; // flatten transparency onto the card colour
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        const dataURL = cv.toDataURL("image/jpeg", 0.86);
        resolve({ dataURL, b64: dataURL.split(",")[1] });
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
    ready() { frameLoaded = true; },
  };

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
  function loadFrame() {
    const fr = q("#seFrame");
    const kind = seTarget === "home" ? "home" : "project";
    if (fr.dataset.kind !== kind) {
      fr.dataset.kind = kind;
      frameLoaded = false;
      fr.src = kind === "home" ? "index.html?edit=1" : "project.html?edit=1";
    } else {
      refreshFrame();
    }
    const p = seProject();
    q("#seOpen").href = p ? `project.html?id=${encodeURIComponent(p.id)}` : "./";
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

  function renderTargets() {
    q("#seTarget").innerHTML = `<option value="home">Главная страница</option>
      <optgroup label="Страницы проектов">${data.projects.map((p) =>
        `<option value="${h(p.id)}" ${p.id === seTarget ? "selected" : ""}>${h(p.title.ru || p.id)}${p.page?.length ? ` · ${p.page.length}` : ""}${p.visible ? "" : " (скрыт)"}</option>`).join("")}</optgroup>`;
    q("#seTarget").value = seTarget;
  }

  function renderSeBlocks() {
    if (seTarget !== "home" && !seProject()) { seTarget = "home"; seBlock = "hero"; } // the project was deleted
    renderTargets();
    const home = seTarget === "home";
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

  function textFields(keys) {
    return keys.map((k) => {
      // textareas everywhere: Enter adds a line break, which the site shows (white-space: pre-line)
      const long = Math.max((site.text.ru[k] || "").length, (site.text.en[k] || "").length) > 60;
      const inp = (l) => `<textarea class="${long ? "" : "short"}" data-text="${h(k)}" data-l="${l}" placeholder="${l.toUpperCase()}">${h(site.text[l][k])}</textarea>`;
      return `<div class="tx"><span>${h(KEY_LABEL[k] || k)}</span><i>RU</i>${inp("ru")}<i>EN</i>${inp("en")}</div>`;
    }).join("");
  }

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

  function renderSePanel() {
    if (!site) return;
    const home = seTarget === "home";
    const undo = seUndo && seUndo.target === seTarget
      ? `<div class="undo"><span>${seUndo.b ? `Блок «${h(blockLabel(seUndo.b))}» удалён` : seUndo.item ? "Пункт удалён" : "Текст удалён"}</span><button class="btn ghost small" type="button" data-undo>Вернуть</button></div>` : "";

    if (seBlock === "_add") {
      const arr = curBlocks();
      const after = seAddAt === 0 ? (home ? "в начало" : "сразу после шапки") : `после «${blockLabel(arr[seAddAt - 1])}»`;
      q("#sePanel").innerHTML = `${undo}<h2>Новый блок</h2><p class="hint">Встанет ${h(after)}. Потом его можно передвинуть стрелками.</p>
        <div class="types">${Object.entries(TYPES).map(([k, T]) =>
          `<button type="button" class="type-btn" data-newtype="${k}"><b>${T.name}</b><span>${T.hint}</span></button>`).join("")}</div>`;
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
      general: `<h2 class="sec">Контакты</h2><p class="hint">Показываются на странице «Контакты».</p>${repeater("profile.channels")}
        <label class="check"><input type="checkbox" data-path="profile.showCode" data-type="bool" ${site.profile.showCode ? "checked" : ""}> Показывать кнопки «Код» у проектов</label>
        <h2 class="sec">Гость с CV</h2>${field("profile.guestDelay", "Через сколько секунд появляется курсор «Anton Egorov» с CV (0 — выключить)", "number")}
        <p class="hint">Один раз на посетителя (больше не повторяется), только на компьютере. Проверить заново — окно инкогнито. После замены CV обновить превью: python tools/cv_thumbs.py.</p>`,
    }[seBlock] || "";
    q("#sePanel").innerHTML = `${undo}
      <h2>${h(B.name)}</h2>
      ${blk ? `<label class="check"><input type="checkbox" data-blockvis ${blk.visible === false ? "" : "checked"}> Показывать блок на сайте</label>
        <p class="hint">Встроенный блок: его можно скрыть, но не удалить.</p>` : ""}
      <h2 class="sec">Тексты</h2>
      ${textFields(B.keys)}
      ${extra}`;
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
      else if (path === "w" && !el.value) delete obj.w;
      else setPath(obj, path, el.value);
      renderSeBlocks();
      if (seBlock === "_head") renderList();
    } else if (el.dataset.text) {
      site.text[el.dataset.l][el.dataset.text] = el.value;
    } else if (el.dataset.path) {
      setPath(site, el.dataset.path, el.dataset.type === "bool" ? el.checked : fromField(el.dataset.type, el.value));
    } else if (el.hasAttribute("data-blockvis")) {
      site.blocks.find((b) => b.id === seBlock).visible = el.checked;
      renderSeBlocks();
    } else return;
    refreshFrame(); updateStatus();
  });

  // GIFs are kept as they are (animation); everything else goes through shrink() → JPEG
  const readRaw = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ dataURL: r.result, b64: r.result.split(",")[1] });
    r.onerror = () => reject(new Error("не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
  async function upload(file, owner) {
    const gif = file.type === "image/gif";
    const img = gif ? await readRaw(file) : await shrink(file);
    const path = `${SHOTS}${owner}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.${gif ? "gif" : "jpg"}`;
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

  function setMode(mode) {
    q("#modes").querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-selected", x.dataset.mode === mode));
    q("#projectsMode").hidden = mode !== "projects";
    q("#siteMode").hidden = mode !== "site";
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
