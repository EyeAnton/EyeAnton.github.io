/* Visual novel player — the "novel" block of a project page (Emotions Club).
   Plays assets/novels/<id>/novel.json of the emotions-club repo (tools/build_novel.py there): one screen per line,
   as in the app — a phone screen with the background, the characters of the scene (the one who speaks is lit),
   the line in a bubble with the name, options as buttons. Next to the phone — the record of the story JSON
   the current screen was made from. Click / Space / Enter / → — next, ← — back, 1–3 — pick an option.
   app.js calls Novel.mount after every render; the state of each novel survives re-renders (language switch).
   Styles: novel.css (nv-*). */
(() => {
  const UI = {
    ru: { play: "Играть", back: "Назад", restart: "Сначала", decides: "выбирает", end: "Конец", again: "Сыграть ещё",
      choice: "К последнему выбору", hint: "Клик, пробел или → — дальше · ← — назад", load: "Не удалось загрузить новеллу",
      json: "Экран из JSON", scene: "Сцена" },
    en: { play: "Play", back: "Back", restart: "Restart", decides: "decides", end: "The End", again: "Play again",
      choice: "Back to the last choice", hint: "Click, Space or → to continue · ← back", load: "Could not load the novel",
      json: "The screen in the JSON", scene: "Scene" },
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CPS = 60; // typewriter speed, characters per second
  const states = new Map(); // src → { id, hist, stage } — survives re-renders
  const novels = new Map(); // src → Promise<novel>
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const EMPTY = { left: null, right: null, last: null };

  function load(src) {
    if (!novels.has(src)) {
      novels.set(src, fetch(src).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).catch((e) => {
        novels.delete(src);
        throw e;
      }));
    }
    return novels.get(src);
  }

  // who stands where after screen s: a new speaker takes their side (players) or replaces the one who spoke
  // earlier (NPC); a new background, a scene title or a cutscene clears the stage
  function nextStage(nv, prev, prevBg, s) {
    const st = s.bg !== prevBg || s.t === "cutscene" || s.t === "scene" ? { ...EMPTY } : { ...prev };
    if (s.t === "dialog" && nv.chars[s.who]) {
      if (st.left !== s.who && st.right !== s.who) {
        const side = nv.chars[s.who].side || (!st.right ? "right" : !st.left ? "left" : st.last === "left" ? "right" : "left");
        st[side] = s.who;
      }
      st.last = st.left === s.who ? "left" : "right";
    }
    return st;
  }

  // the screen as it is written in the story JSON (the source format of the agent)
  function jsonHTML(nv, id) {
    const s = nv.screens[id];
    const str = (v) => `<s>"${esc(v)}"</s>`;
    const row = (k, v, last) => `  <k>"${k}"</k>: ${v}${last ? "" : ","}\n`;
    const rows = [["id", str(id)], ["type", str(s.t)], ["image", str(s.bg || "")]];
    if (s.t === "scene") rows.push(["title", str(s.title)]);
    if (s.who) rows.push(["actor", `{ <k>"${s.who.startsWith("npc") ? "npcId" : "playerId"}"</k>: ${str(s.who)} }`]);
    if (s.by) rows.push(["availableFor", str(s.by)]);
    if (s.t !== "cutscene") rows.push(["content", str(s.text)]);
    if (s.opts) rows.push(["options", "[\n" + s.opts.map((o, i) => `    { <k>"text"</k>: ${str(o.text)} }${i < s.opts.length - 1 ? "," : ""}`).join("\n") + "\n  ]"]);
    if (s.next) rows.push(["next", str(s.next)]);
    return "{\n" + rows.map(([k, v], i) => row(k, v, i === rows.length - 1)).join("") + "}";
  }

  function build(el, nv, src) {
    const t = UI[el.dataset.lang] || UI.en;
    const base = src.replace(/[^/]*$/, "");
    const url = (f) => (f ? base + f : "");
    el.innerHTML = `
      <div class="nv-phone" tabindex="0" role="region" aria-label="${esc(nv.title)}">
        <div class="nv-bg"><img alt=""><img alt=""></div>
        <div class="nv-ch left"><img alt=""></div><div class="nv-ch right"><img alt=""></div>
        <div class="nv-shade"></div>
        <div class="nv-top"><div class="nv-bar"><i></i></div>
          <button data-act="back" aria-label="${t.back}" title="${t.back}">←</button>
          <span class="nv-title">${esc(nv.title)}</span>
          <button data-act="restart" aria-label="${t.restart}" title="${t.restart}">↺</button></div>
        <div class="nv-scene" hidden><span></span><b></b></div>
        <div class="nv-box" aria-live="polite"><b class="nv-name"></b><p class="nv-text"></p></div>
        <div class="nv-opts" hidden><p class="nv-q"></p><div></div></div>
        <div class="nv-start" style="--cover:url('${esc(url(nv.cover))}')">
          <div>${nv.genre ? `<span class="nv-genre">${esc(nv.genre)}</span>` : ""}<h3>${esc(nv.title)}</h3>
            <button class="nv-btn" data-act="play">${t.play}</button></div>
        </div>
        <div class="nv-end" hidden><h3>${t.end}</h3>
          <button class="nv-btn" data-act="restart">${t.again}</button><button class="nv-btn ghost" data-act="choice">${t.choice}</button></div>
      </div>
      <div class="nv-side">
        <p class="nv-label">${t.json}</p>
        <pre class="nv-json"></pre>
        <p class="nv-hint">${t.hint}</p>
      </div>`;
    const q = (s) => el.querySelector(s);
    const phone = q(".nv-phone");
    const bgs = [...el.querySelectorAll(".nv-bg img")];
    const box = q(".nv-box"), name = q(".nv-name"), text = q(".nv-text"), opts = q(".nv-opts");
    const st = states.get(src) || { id: null, hist: [], stage: { ...EMPTY } };
    states.set(src, st);
    let typing = null, front = 0;

    const setBg = (f) => {
      const u = url(f);
      if (!u || bgs[front].getAttribute("src") === u) return;
      front ^= 1;
      bgs[front].src = u;
      bgs[front].classList.add("on");
      bgs[front ^ 1].classList.remove("on");
    };
    const setChar = (side, id, s) => {
      const wrap = q(`.nv-ch.${side}`), img = wrap.firstElementChild, c = nv.chars[id];
      wrap.classList.toggle("on", !!c);
      if (!c) return;
      const f = (s.who === id && s.emo && c.emo?.[s.emo]) || c.img;
      if (img.getAttribute("src") !== url(f)) img.src = url(f);
      wrap.classList.toggle("talk", s.t === "dialog" && s.who === id);
    };
    // a stage direction "(mutters) Finally." → a small tag before the line
    const lineHTML = (s) => esc(s).replace(/^\(([^)]*)\)\s*/, (m, d) => `<i class="nv-dir">${d}</i>`);

    function type(html) {
      text.innerHTML = html;
      const full = text.textContent.length;
      box.classList.remove("typing");
      if (reduce || !full) return;
      // reveal the letters by clipping the text nodes; the markup (the stage direction) stays intact
      const nodes = [];
      const walk = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) nodes.push([walk.currentNode, walk.currentNode.data]);
      box.classList.add("typing");
      const t0 = performance.now();
      const tick = () => {
        let left = Math.round(((performance.now() - t0) / 1000) * CPS);
        for (const [n, d] of nodes) { n.data = d.slice(0, Math.max(0, left)); left -= d.length; }
        if (left >= 0) finish();
      };
      tick();
      typing = setInterval(tick, 30);
    }
    function finish() {
      if (!typing) return false;
      clearInterval(typing);
      typing = null;
      box.classList.remove("typing");
      text.innerHTML = lineHTML(nv.screens[st.id].text);
      return true;
    }

    function show() {
      const s = nv.screens[st.id];
      clearInterval(typing);
      typing = null;
      phone.classList.remove("start", "ended");
      q(".nv-start").hidden = true;
      q(".nv-end").hidden = true;
      setBg(s.bg);
      setChar("left", st.stage.left, s);
      setChar("right", st.stage.right, s);
      phone.classList.toggle("solo", !st.stage.left !== !st.stage.right);
      phone.dataset.t = s.t;
      q(".nv-bar i").style.width = `${Math.min(100, (100 * s.p) / (nv.length || 1))}%`;
      const scene = q(".nv-scene");
      scene.hidden = s.t !== "scene";
      scene.firstElementChild.textContent = s.title || "";
      scene.lastElementChild.textContent = s.t === "scene" ? s.text : "";
      opts.hidden = s.t !== "choice";
      box.hidden = s.t === "scene" || s.t === "cutscene" || s.t === "choice";
      box.dataset.t = s.t;
      name.textContent = s.t === "dialog" ? nv.chars[s.who]?.name || "" : "";
      name.hidden = !name.textContent;
      box.classList.toggle("right", s.t === "dialog" && st.stage.right === s.who && !!st.stage.left);
      if (s.t === "choice") {
        const by = nv.chars[s.by]?.name;
        opts.querySelector(".nv-q").innerHTML = esc(s.text) + (by ? `<small>${esc(by)} ${t.decides}</small>` : "");
        opts.lastElementChild.innerHTML = s.opts.map((o, i) =>
          `<button data-to="${esc(o.to)}"><span>${i + 1}</span>${esc(o.text)}</button>`).join("");
      } else if (!box.hidden) type(lineHTML(s.text));
      q(".nv-json").innerHTML = jsonHTML(nv, st.id);
    }

    function go(id) {
      const s = nv.screens[id];
      if (!s) return;
      if (st.id) st.hist.push({ id: st.id, stage: st.stage });
      st.stage = nextStage(nv, st.stage, nv.screens[st.id]?.bg, s);
      st.id = id;
      show();
    }
    function restore(h) {
      st.id = h.id;
      st.stage = h.stage;
      show();
    }
    function next() {
      if (finish()) return;
      const s = nv.screens[st.id];
      if (s.t === "choice") return;
      if (s.next) return go(s.next);
      phone.classList.add("ended"); // after the final screen
      q(".nv-end").hidden = false;
    }
    function back() {
      if (phone.classList.contains("ended")) {
        phone.classList.remove("ended");
        q(".nv-end").hidden = true;
      } else if (st.hist.length) restore(st.hist.pop());
    }
    function restart() {
      st.hist = [];
      st.id = null;
      st.stage = { ...EMPTY };
      go(nv.start);
    }
    function lastChoice() {
      let i = st.hist.length;
      while (i-- > 0 && nv.screens[st.hist[i].id].t !== "choice");
      if (i < 0) return restart();
      const h = st.hist[i];
      st.hist.length = i;
      restore(h);
    }
    const play = () => (st.id ? show() : go(nv.start));
    const idle = () => phone.classList.contains("start") || phone.classList.contains("ended");

    phone.addEventListener("click", (e) => {
      if (EDITING()) return;
      const b = e.target.closest("button");
      if (b?.dataset.to) return go(b.dataset.to);
      const act = b?.dataset.act;
      if (act === "play") return play();
      if (act === "back") return back();
      if (act === "restart") return restart();
      if (act === "choice") return lastChoice();
      if (!b && !idle()) next();
    });
    phone.addEventListener("keydown", (e) => {
      if (e.target.closest("button") && (e.key === " " || e.key === "Enter")) return; // a focused button clicks itself
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key;
      if (k === " " || k === "Enter" || k === "ArrowRight") {
        if (phone.classList.contains("start")) play();
        else if (!idle()) next();
      } else if (k === "ArrowLeft") back();
      else if (/^[1-9]$/.test(k) && nv.screens[st.id]?.t === "choice") nv.screens[st.id].opts[+k - 1] && go(nv.screens[st.id].opts[+k - 1].to);
      else return;
      e.preventDefault();
    });

    // the backgrounds and the cast are ≈1 MB — warm them up once the player is near the screen
    const warm = () => [...new Set([...Object.values(nv.screens).map((s) => s.bg), ...Object.values(nv.chars).map((c) => c.img)])]
      .filter(Boolean).forEach((f) => { new Image().src = url(f); });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); warm(); } }, { rootMargin: "400px" });
      io.observe(el);
    } else warm();

    if (st.id) return show();
    phone.classList.add("start");
    setBg(nv.screens[nv.start]?.bg);
    q(".nv-json").innerHTML = jsonHTML(nv, nv.start);
  }

  // in the admin's page editor a click selects the block — the player does not react
  const EDITING = () => document.documentElement.classList.contains("nv-editing");

  function mount(root = document, { lang = "en", editor = false } = {}) {
    document.documentElement.classList.toggle("nv-editing", !!editor);
    root.querySelectorAll(".nv[data-src]").forEach((el) => {
      if (el.dataset.ready === lang) return;
      el.dataset.ready = el.dataset.lang = lang;
      const src = el.dataset.src;
      load(src).then((nv) => build(el, nv, src), () => {
        el.innerHTML = `<p class="nv-err">${(UI[lang] || UI.en).load}</p>`;
        el.dataset.ready = "";
      });
    });
  }

  window.Novel = { mount };
})();
