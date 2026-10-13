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
    return c;
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
      for (const [p, img] of pending) {
        setStatus(`Загружаю ${p.replace(SHOTS, "")}…`);
        await putFile(p, img.b64, `Admin: upload ${p}`);
      }
      const inUse = new Set(data.projects.map((p) => p.cover.shot).filter(Boolean));
      for (const p of replaced) {
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
    if (k === "id") v = v.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
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
    general: { name: "Общие настройки", keys: ["brand", "nav.home", "nav.work", "nav.contact", "foot.note", "foot.ds", "page", "live", "online", "private"] },
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
    page: "Кнопка раздела сайта", live: "Кнопка «Открыть сайт»", online: "Бейдж «Онлайн»", private: "Бейдж «Приватный»",
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

  let seLang = "ru";
  let seBlock = "hero";
  let frameLoaded = false;

  const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  const fromField = (type, v) => type === "lines" ? v.split("\n").map((s) => s.trim()).filter(Boolean)
    : type === "csv" ? v.split(",").map((s) => s.trim()).filter(Boolean)
    : type === "number" ? (+v || 0) : v;
  const toField = (type, v) => type === "lines" ? (v || []).join("\n") : type === "csv" ? (v || []).join(", ") : (v ?? "");

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
    blockName: (id) => BLOCKS[id]?.name || id,
    onText(key, val) {
      site.text[seLang][key] = val;
      const inp = document.querySelector(`#sePanel [data-text="${CSS.escape(key)}"][data-l="${seLang}"]`);
      if (inp && inp !== document.activeElement) inp.value = val;
      updateStatus();
    },
    openBlock(id) { seBlock = id; renderSeBlocks(); renderSePanel(); },
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
    try {
      q("#seFrame").contentDocument.querySelector(`[data-block="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
  }

  function renderSeBlocks() {
    const rows = site.blocks.map((b, i) => `
      <div class="item${seBlock === b.id ? " on" : ""}${b.visible === false ? " hidden-p" : ""}" data-b="${i}">
        <label class="sw" title="${b.visible === false ? "Скрыт" : "Показывается"}">
          <input type="checkbox" data-act="vis" ${b.visible === false ? "" : "checked"}><span></span>
        </label>
        <div style="min-width:0"><span class="t">${h(BLOCKS[b.id]?.name || b.id)}</span></div>
        <div class="mv">
          <button type="button" data-act="up" aria-label="Выше">↑</button>
          <button type="button" data-act="down" aria-label="Ниже">↓</button>
        </div>
      </div>`).join("");
    q("#seBlocks").innerHTML = rows + `
      <div class="item${seBlock === "general" ? " on" : ""}" data-b="general" style="margin-top:10px">
        <span></span>
        <div style="min-width:0"><span class="c">меню, футер, контакты</span><span class="t">Общие настройки</span></div>
        <span></span>
      </div>`;
  }

  q("#seBlocks").addEventListener("click", (e) => {
    const item = e.target.closest(".item");
    if (!item) return;
    if (item.dataset.b === "general") { seBlock = "general"; renderSeBlocks(); renderSePanel(); return; }
    const i = +item.dataset.b;
    const act = e.target.dataset.act;
    if (!act && e.target.closest(".sw")) return; // the label forwards the click to its checkbox
    if (act === "vis") {
      site.blocks[i].visible = e.target.checked;
    } else if (act === "up" || act === "down") {
      const j = act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= site.blocks.length) return;
      [site.blocks[i], site.blocks[j]] = [site.blocks[j], site.blocks[i]];
    } else {
      seBlock = site.blocks[i].id;
      renderSeBlocks(); renderSePanel();
      scrollFrameTo(seBlock);
      return;
    }
    renderSeBlocks(); renderSePanel(); refreshFrame(); updateStatus();
  });

  function textFields(keys) {
    return keys.map((k) => {
      const long = Math.max((site.text.ru[k] || "").length, (site.text.en[k] || "").length) > 60;
      const inp = (l) => long
        ? `<textarea data-text="${h(k)}" data-l="${l}" placeholder="${l.toUpperCase()}">${h(site.text[l][k])}</textarea>`
        : `<input type="text" data-text="${h(k)}" data-l="${l}" placeholder="${l.toUpperCase()}" value="${h(site.text[l][k])}">`;
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

  function renderSePanel() {
    if (!site) return;
    const B = BLOCKS[seBlock];
    const blk = site.blocks.find((b) => b.id === seBlock);
    const extra = {
      stats: `<h2 class="sec">Данные</h2>${field("profile.since", "Год начала работы в 3D (для «N+ лет»)", "number")}
        <p class="hint">Число проектов и живых сайтов считается само по вкладке «Проекты».</p>`,
      areas: `<h2 class="sec">Навыки</h2>${repeater("profile.skills")}
        <h2 class="sec">Soft skills</h2>${field("profile.soft.ru", "RU — по одному на строку", "lines")}${field("profile.soft.en", "EN — по одному на строку", "lines")}`,
      showcase: `<p class="hint">Какие проекты здесь показывать — галочка «На главной (избранное)» во вкладке «Проекты»; порядок — как в списке проектов.</p>
        <div><button class="btn ghost small" type="button" data-goto="projects">Открыть «Проекты»</button></div>`,
      stack: `<h2 class="sec">Бегущая строка</h2>${field("profile.stack.0", "Первый ряд — по одному на строку", "lines")}${field("profile.stack.1", "Второй ряд — по одному на строку", "lines")}`,
      exp: `<h2 class="sec">Места работы</h2>${repeater("profile.experience")}`,
      general: `<h2 class="sec">Контакты</h2><p class="hint">Показываются на странице «Контакты».</p>${repeater("profile.channels")}
        <label class="check"><input type="checkbox" data-path="profile.showCode" data-type="bool" ${site.profile.showCode ? "checked" : ""}> Показывать кнопки «Код» у проектов</label>`,
    }[seBlock] || "";
    q("#sePanel").innerHTML = `
      <h2>${h(B.name)}</h2>
      ${blk ? `<label class="check"><input type="checkbox" data-blockvis ${blk.visible === false ? "" : "checked"}> Показывать блок на сайте</label>` : ""}
      <h2 class="sec">Тексты</h2>
      ${textFields(B.keys)}
      ${extra}`;
  }

  q("#sePanel").addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.text) {
      site.text[el.dataset.l][el.dataset.text] = el.value;
    } else if (el.dataset.path) {
      setPath(site, el.dataset.path, el.dataset.type === "bool" ? el.checked : fromField(el.dataset.type, el.value));
    } else if (el.hasAttribute("data-blockvis")) {
      site.blocks.find((b) => b.id === seBlock).visible = el.checked;
      renderSeBlocks();
    } else return;
    refreshFrame(); updateStatus();
  });

  q("#sePanel").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.goto) { setMode(b.dataset.goto); return; }
    if (!b.dataset.rep) return;
    const arr = getPath(site, b.dataset.rep);
    const i = +b.dataset.i;
    if (b.dataset.act === "add") arr.push(LISTS[b.dataset.rep].blank());
    else if (b.dataset.act === "del") {
      if (!confirm("Удалить этот пункт?")) return;
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
    if (mode === "site") {
      const fr = q("#seFrame");
      if (!fr.getAttribute("src")) fr.src = "index.html?edit=1";
      else refreshFrame(); // pick up unsaved project edits (featured projects, covers)
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
