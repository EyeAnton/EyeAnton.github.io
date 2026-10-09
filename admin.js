// Portfolio admin: edits projects.json and cover images straight in the GitHub repo.
// Auth = a fine-grained token (Contents: read & write on this repo only), kept in this browser.
// Reuses cardHTML / CATEGORIES / lang from app.js for an exact card preview.
(() => {
  "use strict";

  const REPO = "EyeAnton/EyeAnton.github.io";
  const BRANCH = "main";
  const DATA = "projects.json";
  const SHOTS = "assets/shots/";
  const MAX_W = 1600;
  const TOKEN_KEY = "adminToken";

  const q = (s) => document.querySelector(s);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let token = "";
  let data = null;          // { categories, projects }
  let savedJSON = "";       // last published state, for the dirty check
  let sel = 0;              // selected project index
  let pvLang = "ru";
  const pending = new Map(); // repo path -> { b64, dataURL } images waiting for publish
  const replaced = new Set(); // old shot paths to delete on publish

  /* ---------- GitHub API ---------- */

  async function gh(path, opts = {}) {
    const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
      ...opts,
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
      throw new Error(msg);
    }
    return r.status === 204 ? null : r.json();
  }
  const getFile = (p) => gh(`/contents/${encodeURI(p)}?ref=${BRANCH}`, { allow404: true });
  async function putFile(p, b64, message) {
    const cur = await getFile(p);
    return gh(`/contents/${encodeURI(p)}`, {
      method: "PUT",
      body: JSON.stringify({ message, content: b64, branch: BRANCH, ...(cur ? { sha: cur.sha } : {}) }),
    });
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

  /* ---------- Login ---------- */

  function readToken() { try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } }
  function writeToken(t, remember) {
    try {
      localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
      if (t) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
    } catch {}
  }

  async function login(t, remember) {
    token = t.trim();
    const st = q("#loginStatus");
    st.className = "status"; st.textContent = "Проверяю токен…";
    try {
      const repo = await gh("");
      if (repo.permissions && !repo.permissions.push) throw new Error("у токена нет права записи (Contents: Read and write)");
      writeToken(token, remember);
      await load();
      q("#login").hidden = true;
      q("#app").hidden = false; q("#bar").hidden = false; q("#logout").hidden = false;
    } catch (e) {
      token = "";
      st.className = "status err";
      st.textContent = `Не получилось войти: ${e.message}`;
    }
  }

  q("#loginBtn").addEventListener("click", () => login(q("#token").value, q("#remember").checked));
  q("#token").addEventListener("keydown", (e) => { if (e.key === "Enter") q("#loginBtn").click(); });
  q("#logout").addEventListener("click", (e) => {
    e.preventDefault();
    if (isDirty() && !confirm("Есть неопубликованные изменения. Выйти без сохранения?")) return;
    writeToken("", false);
    location.reload();
  });

  /* ---------- Load / save ---------- */

  async function load() {
    const f = await getFile(DATA);
    if (!f) throw new Error(`в репозитории нет ${DATA}`);
    data = JSON.parse(b64ToUtf8(f.content));
    data.projects.forEach(normalize);
    savedJSON = serialize();
    pending.clear(); replaced.clear();
    sel = Math.min(sel, data.projects.length - 1);
    renderAll();
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
    if (!c.private) delete c.private;
    if (c.cover.sub && !c.cover.sub.ru && !c.cover.sub.en) delete c.cover.sub;
    if (c.cover.pos === "") delete c.cover.pos;
    c.tags = c.tags.map((t) => t.trim()).filter(Boolean);
    return c;
  }
  const serialize = () => JSON.stringify({ categories: data.categories, projects: data.projects.map(clean) }, null, 2) + "\n";
  const isDirty = () => data && (serialize() !== savedJSON || pending.size > 0);

  async function publish() {
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
      setStatus("Сохраняю проекты…");
      await putFile(DATA, utf8ToB64(serialize()), "Admin: update projects");
      savedJSON = serialize();
      pending.clear(); replaced.clear();
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
        <div style="min-width:0"><span class="c">${h(catName(p.cat))}${p.featured ? " · большая" : ""}</span><span class="t">${h(p.title.ru || p.title.en || p.id)}</span></div>
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
        ctx.fillStyle = "#1b1613"; // flatten transparency onto the card colour
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

  /* ---------- Boot ---------- */

  const saved = readToken();
  let remembered = false;
  try { remembered = !!localStorage.getItem(TOKEN_KEY); } catch {}
  if (saved) login(saved, remembered);
})();
