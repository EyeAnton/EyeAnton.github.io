/* Visual novel player — the "novel" block of a project page (Emotions Club).
   Plays assets/novels/<id>/novel.json of the emotions-club repo (tools/build_novel.py there): one line per screen,
   laid out like the novels on Stasik — background, characters waist-up (first player left, second right and
   mirrored, NPC on a free side), text over a dark gradient at the bottom, options with a genre accent stripe.
   Click / Space / Enter / → — next, ← — back, 1–3 — pick an option. app.js calls Novel.mount after every render;
   the state of each novel survives re-renders (language switch). Styles: novel.css (nv-*). */
(() => {
  const UI = {
    ru: { play: "Играть", back: "Назад", restart: "Сначала", decides: "выбирает", end: "Конец", again: "Сыграть ещё",
      choice: "К последнему выбору", hint: "Клик, пробел или → — дальше", load: "Не удалось загрузить новеллу" },
    en: { play: "Play", back: "Back", restart: "Restart", decides: "decides", end: "The End", again: "Play again",
      choice: "Back to the last choice", hint: "Click, Space or → to continue", load: "Could not load the novel" },
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CPS = 70; // typewriter speed, characters per second
  const states = new Map(); // src → { id, hist, stage } — survives re-renders
  const novels = new Map(); // src → Promise<novel>
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function load(src) {
    if (!novels.has(src)) {
      novels.set(src, fetch(src).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).catch((e) => {
        novels.delete(src);
        throw e;
      }));
    }
    return novels.get(src);
  }

  // who stands where after screen s: a new speaker takes his side (players) or the side of the one who spoke
  // earlier (NPC); a new background or a cutscene clears the stage
  function nextStage(nv, prev, prevBg, s) {
    let st = s.bg !== prevBg || s.t === "cutscene" || s.t === "scene" ? { left: null, right: null, last: null } : { ...prev };
    if (s.t === "cutscene") return st;
    if (s.t === "dialog" && s.who && nv.chars[s.who]) {
      if (st.left !== s.who && st.right !== s.who) {
        const pref = nv.chars[s.who].side;
        const side = pref || (!st.right ? "right" : !st.left ? "left" : st.last === "left" ? "right" : "left");
        st[side] = s.who;
      }
      st.last = st.left === s.who ? "left" : "right";
    }
    return st;
  }

  function build(el, nv, src) {
    const t = UI[el.dataset.lang] || UI.en;
    const base = src.replace(/[^/]*$/, "");
    const url = (f) => (f ? base + f : "");
    el.style.setProperty("--nv-accent", nv.accent || "#962836");
    el.innerHTML = `
      <div class="nv-bg"><img alt=""><img alt=""></div>
      <div class="nv-ch left"><img alt=""></div><div class="nv-ch right"><img alt=""></div>
      <div class="nv-shade"></div>
      <div class="nv-scene" hidden><span></span><b></b></div>
      <div class="nv-box" aria-live="polite"><b class="nv-name"></b><p class="nv-text"></p><span class="nv-more" aria-hidden="true"></span></div>
      <div class="nv-opts" hidden><p class="nv-q"></p><div></div></div>
      <div class="nv-start">
        <img class="nv-cover" alt="" src="${esc(url(nv.cover))}">
        <div>${nv.genre ? `<span class="nv-genre">${esc(nv.genre)}</span>` : ""}<h3>${esc(nv.title)}</h3>
          <button class="nv-btn" data-act="play">${t.play}</button><small>${t.hint}</small></div>
      </div>
      <div class="nv-end" hidden><h3>${t.end}</h3>
        <div><button class="nv-btn" data-act="restart">${t.again}</button><button class="nv-btn ghost" data-act="choice">${t.choice}</button></div></div>
      <div class="nv-bar"><i></i></div>
      <div class="nv-tools">
        <button data-act="back" aria-label="${t.back}" title="${t.back}">←</button>
        <button data-act="restart" aria-label="${t.restart}" title="${t.restart}">↺</button>
      </div>`;
    el.tabIndex = 0;
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", nv.title);
    const q = (s) => el.querySelector(s);
    const bgs = [...el.querySelectorAll(".nv-bg img")];
    const box = q(".nv-box"), name = q(".nv-name"), text = q(".nv-text"), opts = q(".nv-opts");
    const st = states.get(src) || { id: null, hist: [], stage: { left: null, right: null, last: null } };
    states.set(src, st);
    let typing = null, front = 0;

    const setBg = (f) => {
      const u = url(f);
      if (bgs[front].getAttribute("src") === u) return;
      front ^= 1;
      bgs[front].src = u;
      bgs[front].classList.add("on");
      bgs[front ^ 1].classList.remove("on");
    };
    const setChar = (side, id, s) => {
      const box = q(`.nv-ch.${side}`), img = box.firstElementChild, c = nv.chars[id];
      if (!c) return box.classList.remove("on");
      const f = (s?.who === id && s.emo && c.emo?.[s.emo]) || c.img;
      if (img.getAttribute("src") !== url(f)) img.src = url(f);
      box.classList.add("on");
      box.classList.toggle("talk", s?.t === "dialog" && s.who === id);
    };
    // a stage direction "(mutters) Finally." → small italics before the line
    const lineHTML = (s) => esc(s).replace(/^\(([^)]*)\)\s*/, (m, d) => `<i class="nv-dir">${d}</i> `);

    function type(html) {
      clearInterval(typing);
      text.innerHTML = html;
      const full = text.textContent.length;
      box.classList.remove("done");
      if (reduce || !full) return box.classList.add("done");
      // reveal letters by clipping the text nodes; markup (the stage direction) stays intact
      const nodes = [];
      const walk = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) nodes.push([walk.currentNode, walk.currentNode.data]);
      nodes.forEach(([n]) => (n.data = ""));
      let shown = 0;
      const t0 = performance.now();
      typing = setInterval(() => {
        shown = Math.min(full, Math.round(((performance.now() - t0) / 1000) * CPS));
        let left = shown;
        for (const [n, d] of nodes) { n.data = d.slice(0, Math.max(0, left)); left -= d.length; }
        if (shown >= full) finish();
      }, 30);
    }
    function finish() {
      if (!typing) return false;
      clearInterval(typing);
      typing = null;
      text.innerHTML = lineHTML(nv.screens[st.id].text);
      box.classList.add("done");
      return true;
    }

    function show() {
      const s = nv.screens[st.id];
      clearInterval(typing);
      typing = null;
      el.classList.remove("start", "ended");
      q(".nv-start").hidden = true;
      q(".nv-end").hidden = true;
      setBg(s.bg);
      setChar("left", st.stage.left, s);
      setChar("right", st.stage.right, s);
      el.dataset.t = s.t;
      q(".nv-bar i").style.width = `${Math.min(100, (100 * s.p) / (nv.length || 1))}%`;
      const scene = q(".nv-scene");
      scene.hidden = s.t !== "scene";
      if (s.t === "scene") {
        scene.firstElementChild.textContent = s.title;
        scene.lastElementChild.textContent = s.text;
      }
      opts.hidden = s.t !== "choice";
      box.hidden = s.t === "scene" || s.t === "cutscene";
      name.textContent = s.t === "dialog" ? nv.chars[s.who]?.name || "" : "";
      name.hidden = !name.textContent;
      if (s.t === "choice") {
        const by = nv.chars[s.by]?.name;
        opts.querySelector(".nv-q").innerHTML = esc(s.text) + (by ? ` <small>${esc(by)} ${t.decides}</small>` : "");
        opts.lastElementChild.innerHTML = s.opts.map((o, i) =>
          `<button data-to="${esc(o.to)}"><span>${i + 1}</span>${esc(o.text)}</button>`).join("");
      } else if (!box.hidden) type(lineHTML(s.text));
      if (s.t === "final") box.classList.add("final");
      else box.classList.remove("final");
    }

    function go(id, push = true) {
      const s = nv.screens[id];
      if (!s) return;
      const prev = nv.screens[st.id];
      if (push && st.id) st.hist.push({ id: st.id, stage: st.stage });
      st.stage = nextStage(nv, st.stage, prev?.bg, s);
      st.id = id;
      show();
    }
    function next() {
      if (!st.id) return go(nv.start);
      if (finish()) return;
      const s = nv.screens[st.id];
      if (s.t === "choice") return;
      if (s.next) return go(s.next);
      el.classList.add("ended"); // the final screen
      q(".nv-end").hidden = false;
    }
    function back() {
      if (el.classList.contains("ended")) {
        el.classList.remove("ended");
        q(".nv-end").hidden = true;
        return;
      }
      const h = st.hist.pop();
      if (!h) return;
      st.id = h.id;
      st.stage = h.stage;
      show();
    }
    function restart() {
      st.hist = [];
      st.id = null;
      st.stage = { left: null, right: null, last: null };
      go(nv.start);
    }
    function lastChoice() {
      let i = st.hist.length;
      while (i-- > 0 && nv.screens[st.hist[i].id].t !== "choice");
      if (i < 0) return restart();
      const h = st.hist[i];
      st.hist.length = i;
      st.id = h.id;
      st.stage = h.stage;
      show();
    }
    function pick(i) {
      const s = nv.screens[st.id];
      if (s?.t === "choice" && s.opts[i]) go(s.opts[i].to);
    }

    el.addEventListener("click", (e) => {
      if (EDITING()) return;
      const b = e.target.closest("button");
      if (b?.dataset.to) return go(b.dataset.to);
      const act = b?.dataset.act;
      if (act === "play") return st.id ? show() : go(nv.start);
      if (act === "back") return back();
      if (act === "restart") return restart();
      if (act === "choice") return lastChoice();
      if (!b && !el.classList.contains("start") && !el.classList.contains("ended")) next();
    });
    el.addEventListener("keydown", (e) => {
      if (e.target !== el || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key;
      if (k === " " || k === "Enter" || k === "ArrowRight") {
        if (el.classList.contains("start")) st.id ? show() : go(nv.start);
        else if (!el.classList.contains("ended")) next();
      } else if (k === "ArrowLeft") back();
      else if (/^[1-9]$/.test(k)) pick(+k - 1);
      else return;
      e.preventDefault();
    });

    // the backgrounds and the cast are small (≈1 MB) — warm them up once the player is near the screen
    const warm = () => [...new Set(Object.values(nv.screens).map((s) => s.bg).concat(Object.values(nv.chars).map((c) => c.img)))]
      .filter(Boolean).forEach((f) => { new Image().src = url(f); });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); warm(); } }, { rootMargin: "400px" });
      io.observe(el);
    } else warm();

    if (st.id) show();
    else {
      el.classList.add("start");
      setBg(nv.screens[nv.start]?.bg);
    }
  }

  // in the admin's page editor the block is selected by a click, not played
  const EDITING = () => document.documentElement.classList.contains("nv-editing");

  function mount(root = document, { lang = "en", editor = false } = {}) {
    document.documentElement.classList.toggle("nv-editing", !!editor);
    root.querySelectorAll(".nv[data-src]").forEach((el) => {
      if (el.dataset.ready === lang) return;
      el.dataset.ready = lang;
      el.dataset.lang = lang;
      const src = el.dataset.src;
      load(src).then((nv) => build(el, nv, src), () => {
        el.innerHTML = `<p class="nv-err">${(UI[lang] || UI.en).load}</p>`;
        el.dataset.ready = "";
      });
    });
  }

  window.Novel = { mount };
})();
