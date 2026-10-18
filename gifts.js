// Interactive parts of the Virtual Gifts case, moved from the gift-catalog repo:
// blocks gifts-showcase (laptop + phone), gifts-process (one gift in five steps) and gifts-catalog (send a gift).
// Data and media stay in that repo: <base>gifts.json, silhouettes.json, process.json, assets/…  (base = "/gift-catalog/").
// app.js renders the markup (texts are editable blocks) and calls Gifts.mount(root, { lang, editor }) after every
// render; widgets of the previous render stop themselves (gen), so a language switch or an editor refresh is safe.
window.Gifts = (() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const FADE_MS = 350;
  const STATIC_SHOW_MS = 2600;
  // Safari (and every iOS browser) plays VP9 but drops its alpha: WebKit gets HEVC-with-alpha .mov
  // (falling back to the 320px animated WebP) and the animated WebP for hover previews.
  const ua = navigator.userAgent;
  const isWebKit = /AppleWebKit/.test(ua) && !/(Chrome|Chromium|Edg)\//.test(ua);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const canHover = matchMedia("(hover: hover) and (pointer: fine)");
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const el = (tag, className) => { const n = document.createElement(tag); if (className) n.className = className; return n; };

  let gen = 0;        // bumps on every mount: widgets of an older render stop
  let lang = "ru";
  let editor = false; // inside admin.html: no sound, no sound button

  /* ---------------- data (one load per base) ---------------- */

  const cache = new Map();
  function load(base) {
    if (!cache.has(base)) {
      const get = (f, fallback) => fetch(base + f).then((r) => (r.ok ? r.json() : fallback)).catch(() => fallback);
      cache.set(base, Promise.all([get("gifts.json", { items: [] }), get("silhouettes.json", {}), get("process.json", { items: [] })])
        .then(([gifts, silhouettes, process]) => {
          const abs = (p) => (p ? base + p : p);
          const items = gifts.items.map((g) => ({
            ...g, still: abs(g.still), preview_webm: abs(g.preview_webm), preview_webp_safari: abs(g.preview_webp_safari),
            full_webm: abs(g.full_webm), full_mov_safari: abs(g.full_mov_safari), sound: abs(g.sound),
          }));
          return { items, silhouettes, process: process.items || [] };
        }));
    }
    return cache.get(base);
  }

  /* ---------------- page-level bits, added once ---------------- */

  function once() {
    if (document.getElementById("gcDefs")) return;
    // shimmer gradient for the skeleton silhouettes
    document.body.insertAdjacentHTML("afterbegin", `<svg class="defs" id="gcDefs" aria-hidden="true" focusable="false"><defs>
      <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0.35">
        <stop offset="0" stop-color="#0e1830"/><stop offset="0.42" stop-color="#0e1830"/><stop offset="0.5" stop-color="#24386a"/>
        <stop offset="0.58" stop-color="#0e1830"/><stop offset="1" stop-color="#0e1830"/>
        ${reducedMotion.matches ? "" : `<animateTransform attributeName="gradientTransform" type="translate" from="-1 0" to="1 0" dur="1.6s" repeatCount="indefinite"/>`}
      </linearGradient></defs></svg>`);
    // overlay of the catalog and the hero strip: the page dims and blurs, the gift plays over it; a click anywhere closes
    document.body.insertAdjacentHTML("beforeend", `<div class="overlay" id="gcOverlay" role="dialog" aria-modal="true" aria-label="Gift preview" hidden>
      <div class="stage" id="gcStage"><div class="spinner" id="gcSpinner" hidden></div></div>
      <button class="close" id="gcClose" aria-label="Close">×</button>
    </div>`);
    const $overlay = document.getElementById("gcOverlay");
    $overlay.addEventListener("click", closeOverlay);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlay(); });
  }

  /* ---------------- sound: one toggle for every gift animation on the page ---------------- */

  // Gift sounds always run (muted when the toggle is off), so switching on mid-animation stays in sync.
  const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/>';
  const sound = (() => {
    let on = store.get("gcSound") !== "off";
    const live = new Set();
    let btn = null;
    const muted = () => editor || !on;
    const paint = () => {
      if (!btn) return;
      btn.innerHTML = SPEAKER + (on
        ? '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
        : '<path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>');
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", lang === "ru" ? (on ? "Выключить звук" : "Включить звук") : (on ? "Mute" : "Unmute"));
    };
    const api = {
      button(show) { // only on pages with gift widgets, never in the editor
        if (show && !btn && !editor) {
          btn = el("button", "gc-sound");
          btn.type = "button";
          btn.addEventListener("click", () => {
            on = !on;
            store.set("gcSound", on ? "on" : "off");
            paint();
            for (const a of live) { a.muted = muted(); if (on) a.play().catch(() => {}); }
          });
          // in the header, next to RUS / ENG (one right-hand group, so the header grid keeps 3 columns)
          const $lang = document.getElementById("lang");
          if ($lang) {
            const end = el("div", "top-end");
            $lang.replaceWith(end);
            end.append(btn, $lang);
          } else document.body.append(btn);
        }
        if (btn) btn.hidden = !show;
        paint();
      },
      track(a) {
        a.muted = muted();
        live.add(a);
        a.addEventListener("ended", () => live.delete(a), { once: true });
        return a;
      },
      play(src) {
        if (!src) return null;
        const a = api.track(new Audio(src));
        a.play().catch(() => {});
        return a;
      },
      stop(a) { if (a) { a.pause(); live.delete(a); } return null; },
      stopAll() { for (const a of live) a.pause(); live.clear(); },
    };
    return api;
  })();

  /* ---------------- showcase: laptop + phone, the gift arriving over a dating chat ---------------- */

  function showcase($devices, data, cfg, alive) {
    const $pick = $devices.nextElementSibling?.classList.contains("gc-pick") ? $devices.nextElementSibling : null;
    const animated = data.items.filter((g) => g.full_webm);
    const byKey = new Map(animated.map((g) => [g.key, g]));
    const hires = new Set(cfg.hires);
    const srcFor = (g) => hires.has(g.key)
      ? `${cfg.base}assets/anim1080/${g.key}.${isWebKit ? "mov" : "webm"}`
      : (isWebKit && g.full_mov_safari ? g.full_mov_safari : g.full_webm);
    const videos = [...$devices.querySelectorAll(".gc-fx-v")];
    const names = [...$devices.querySelectorAll(".gc-gift-name")];
    let gifts = cfg.keys.map((k) => byKey.get(k)).filter(Boolean);
    if (!gifts.length) gifts = animated.slice(0, 6);
    if (!gifts.length || !videos.length) return;
    let index = 0, run = 0, visible = false, timers = [], audio = null;

    const chips = gifts.map((g, i) => {
      const b = el("button", "chip");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.textContent = g.name;
      b.addEventListener("click", () => { index = i; start(); });
      return b;
    });
    $pick?.replaceChildren(...chips);

    const later = (fn, ms) => timers.push(setTimeout(() => (alive() ? fn() : reset()), ms));
    const wait = (ms) => new Promise((res) => later(res, ms));
    function reset() {
      timers.forEach(clearTimeout);
      timers = [];
      $devices.classList.remove("playing", "arrived");
      audio = sound.stop(audio);
      for (const v of videos) { v.classList.remove("on"); v.pause(); }
    }
    function start() {
      if (!alive()) return reset();
      const id = ++run;
      reset();
      const gift = gifts[index];
      chips.forEach((c, i) => c.setAttribute("aria-selected", String(i === index)));
      names.forEach((n) => { n.textContent = gift.name; });
      if (reducedMotion.matches) {
        $devices.classList.add("arrived", "playing");
        for (const v of videos) { v.poster = gift.still; v.classList.add("on"); }
        return;
      }
      // buffer both screens before anything moves, so playback never stutters
      const ready = Promise.all(videos.map((v) => new Promise((res) => {
        v.addEventListener("canplaythrough", res, { once: true });
        v.addEventListener("error", res, { once: true });
        v.src = srcFor(gift);
        v.load();
      })));
      later(() => $devices.classList.add("arrived"), 700);
      Promise.all([Promise.race([ready, wait(8000)]), wait(1400)]).then(() => {
        if (id !== run || !alive()) return;
        $devices.classList.add("playing");
        Promise.all(videos.map((v) => { v.currentTime = 0; return v.play().catch(() => {}); })).then(() => {
          if (id !== run || !alive()) return;
          videos.forEach((v) => v.classList.add("on"));
          audio = sound.play(gift.sound);
        });
        const upcoming = gifts[(index + 1) % gifts.length];
        if (upcoming !== gift) fetch(srcFor(upcoming)).catch(() => {}); // warm the cache
        let done = false;
        const lead = videos[videos.length - 1]; // the phone leads; the laptop plays the same file
        const next = () => {
          if (id !== run || done) return;
          done = true;
          videos.forEach((x) => x.classList.remove("on"));
          later(() => $devices.classList.remove("playing"), 300);
          later(() => {
            if (id !== run) return;
            index = (index + 1) % gifts.length;
            if (visible) start(); else reset();
          }, 1800);
        };
        lead.onended = next;
        lead.onerror = next;
        later(next, ((lead.duration || 8) + 3) * 1000); // never get stuck
      });
    }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(([e]) => {
        if (!alive()) { io.disconnect(); reset(); return; }
        visible = e.isIntersecting;
        if (visible && !$devices.classList.contains("arrived")) start();
        if (!visible) { run++; reset(); }
      }, { threshold: 0.35 });
      io.observe($devices);
    } else { visible = true; start(); }
  }

  /* ---------------- process: one gift, five steps (working frames from Figma, process.json) ---------------- */

  function process($proc, data, cfg, alive) {
    const $tabs = $proc.querySelector(".gc-proc-tabs");
    const steps = [...$proc.querySelectorAll(".gc-st-c")];
    let list = data.process.map((p) => ({ ...p, gift: data.items.find((g) => g.key === p.key) })).filter((p) => p.gift);
    if (cfg.keys.length) list = cfg.keys.map((k) => list.find((p) => p.key === k)).filter(Boolean);
    if (!list.length || steps.length < 4) return;
    let current = 0;
    const tabs = list.map((p, i) => {
      const b = el("button", "chip");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.textContent = p.gift.name;
      b.addEventListener("click", () => {
        if (i === current) return;
        current = i;
        $proc.classList.add("switching");
        setTimeout(() => alive() && show(), 250);
      });
      return b;
    });
    $tabs?.replaceChildren(...tabs);
    const img = (src, cls) => { const n = el("img", cls); n.src = src; n.alt = ""; n.loading = "lazy"; n.decoding = "async"; return n; };
    const mini = steps[4] ? miniPhone(steps[4].querySelector(".gc-mini"), alive) : null;
    function show() {
      const p = list[current];
      const base = `${cfg.base}assets/process/${p.key}/`;
      tabs.forEach((b, i) => b.setAttribute("aria-selected", String(i === current)));
      steps[0].replaceChildren(img(base + "source.webp", "gc-tile big"));
      const brief = el("blockquote", "gc-brief");
      brief.textContent = `«${p.idea[lang] || p.idea.ru}»`;
      const note = el("p", "gc-brief-note");
      note.textContent = cfg.note;
      steps[1].replaceChildren(brief, note);
      const drafts = el("div", "gc-strip");
      for (const d of p.drafts) {
        const w = el("div", "gc-draft" + (d.picked ? " picked" : ""));
        if (d.picked) w.dataset.label = cfg.picked;
        w.append(img(base + d.src, "gc-tile"));
        drafts.append(w);
      }
      steps[2].replaceChildren(drafts);
      const frames = el("div", "gc-strip gc-frames");
      p.frames.forEach((f, i) => {
        if (i) { const a = el("span", "gc-arrow"); a.textContent = "→"; frames.append(a); }
        frames.append(img(base + f, "gc-tile"));
      });
      steps[3].replaceChildren(frames);
      mini?.play(p.gift); // the finished gift, arriving in the same phone + chat as the showcase
      $proc.classList.remove("switching");
    }
    show();
  }

  // the showcase phone on its own, looping one gift: chat → gift message → full-screen animation
  function miniPhone(node, alive) {
    if (!node) return null;
    const video = node.querySelector(".gc-fx-v");
    const names = [...node.querySelectorAll(".gc-gift-name")];
    let run = 0, visible = false, gift = null, timers = [], audio = null;
    const later = (fn, ms) => timers.push(setTimeout(() => alive() && fn(), ms));
    function loop() {
      const id = ++run;
      timers.forEach(clearTimeout);
      timers = [];
      audio = sound.stop(audio);
      node.classList.remove("playing", "arrived");
      video.classList.remove("on");
      video.pause();
      if (!gift || !visible || !alive()) return;
      names.forEach((n) => { n.textContent = gift.name; });
      if (reducedMotion.matches) { video.poster = gift.still; node.classList.add("arrived", "playing"); video.classList.add("on"); return; }
      const src = isWebKit && gift.full_mov_safari ? gift.full_mov_safari : gift.full_webm;
      if (!video.src.endsWith(src)) { video.src = src; video.load(); }
      later(() => node.classList.add("arrived"), 600);
      later(() => {
        node.classList.add("playing");
        video.currentTime = 0;
        video.play().then(() => {
          if (id !== run || !alive()) return;
          video.classList.add("on");
          audio = sound.play(gift.sound);
        }).catch(() => {});
      }, 1300);
      video.onended = () => {
        if (id !== run) return;
        video.classList.remove("on");
        later(() => node.classList.remove("playing"), 300);
        later(loop, 2200);
      };
    }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(([e]) => {
        if (!alive()) { io.disconnect(); loop(); return; }
        visible = e.isIntersecting;
        loop();
      }, { threshold: 0.3 });
      io.observe(node);
    } else visible = true;
    return { play(g) { gift = g; loop(); } };
  }

  /* ---------------- catalog: every gift, tap to send ---------------- */

  function catalog($catalog, data, cfg) {
    const byKey = new Map(data.items.map((g) => [g.key, g]));
    let list = cfg.keys.map((k) => byKey.get(k)).filter(Boolean);
    if (!list.length) list = data.items; // nothing picked in the admin: every gift
    const grid = el("div", "gc-grid");
    for (const gift of list) grid.append(card(gift, data.silhouettes[gift.key]));
    $catalog.replaceChildren(grid);
    $catalog.removeAttribute("aria-busy");
  }

  /* ---------------- hero strip (project.head.gifts): stills only; a click flies the gift to the centre and plays it ---------------- */

  function strip($cloud, data) {
    const byKey = new Map(data.items.map((g) => [g.key, g]));
    const open = (img) => {
      const gift = byKey.get(img?.dataset.k);
      if (gift) openOverlay(gift, img, img, true);
    };
    $cloud.addEventListener("click", (e) => open(e.target.closest("img[data-k]")));
    $cloud.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      open(e.target.closest("img[data-k]"));
    });
    for (const img of $cloud.querySelectorAll("img[data-k]")) {
      const gift = byKey.get(img.dataset.k);
      if (gift && img.getAttribute("role")) img.setAttribute("aria-label", gift.name);
    }
  }

  function card(gift, sil) {
    const btn = el("button", "gc-card");
    btn.type = "button";
    btn.setAttribute("aria-label", gift.full_webm ? `${gift.name} — play animation` : gift.name);
    const media = el("div", "media");
    if (sil) media.append(skeleton(sil));
    const img = el("img", "still");
    img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.src = gift.still;
    const done = () => media.classList.add("loaded");
    if (img.complete && img.naturalWidth) done(); else img.addEventListener("load", done, { once: true });
    media.append(img);
    const name = el("span", "gc-name");
    name.textContent = gift.name;
    btn.append(media, name);
    const stopPreview = gift.preview_webm ? hoverPreview(btn, gift) : () => {};
    btn.addEventListener("click", () => { stopPreview(); openOverlay(gift, btn); });
    return btn;
  }

  function skeleton({ w, h, d }) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "sk");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "url(#shine)");
    path.setAttribute("fill-rule", "evenodd");
    svg.append(path);
    return svg;
  }

  // hover: the animation grows to the card's full height, the still and the name fade out; returns stop()
  function hoverPreview(btn, gift) {
    let preview = null, audio = null;
    btn.addEventListener("mouseenter", () => {
      if (!canHover.matches || reducedMotion.matches || preview) return;
      if (isWebKit) {
        preview = el("img", "preview");
        preview.alt = "";
        preview.addEventListener("load", () => show(preview), { once: true });
        preview.src = gift.preview_webp_safari;
      } else {
        preview = el("video", "preview");
        Object.assign(preview, { muted: true, loop: true, playsInline: true, autoplay: true });
        preview.addEventListener("playing", () => show(preview), { once: true });
        preview.src = gift.preview_webm;
      }
      btn.append(preview);
    });
    function stop() {
      if (!preview) return;
      const node = preview;
      preview = null;
      audio = sound.stop(audio);
      btn.classList.remove("previewing");
      node.classList.remove("on");
      setTimeout(() => { if (node.pause) node.pause(); node.remove(); }, FADE_MS);
    }
    btn.addEventListener("mouseleave", stop);
    function show(node) {
      if (node !== preview) return;
      requestAnimationFrame(() => node === preview && node.classList.add("on"));
      audio = sound.play(gift.sound);
      btn.classList.add("previewing");
    }
    return stop;
  }

  /* ---------------- overlay ---------------- */

  const FLY_MS = 550;
  let session = 0; // bumps on every open/close so stale callbacks do nothing
  let current = null; // { audio, timer, returnFocus, from, fly }
  const $ = (id) => document.getElementById(id);

  // from: a still of the hero strip — it flies to the centre of the screen and the animation takes over from it
  // wide: the animation fills the screen width (hero strip)
  function openOverlay(gift, returnFocus, from, wide = false) {
    const $overlay = $("gcOverlay"), $stage = $("gcStage"), $spinner = $("gcSpinner");
    const id = ++session;
    cleanupMedia();
    current = { audio: null, timer: 0, returnFocus, from: null, fly: null };
    $stage.replaceChildren($spinner);
    $overlay.classList.toggle("wide", wide);
    $overlay.hidden = false;
    document.body.classList.add("locked");
    requestAnimationFrame(() => $overlay.classList.add("open"));
    $("gcClose").focus({ preventScroll: true });
    if (from) flyIn(from);
    const go = (fn) => (from ? (current.timer = setTimeout(() => id === session && fn(), FLY_MS)) : fn());
    if (!gift.full_webm) return go(() => playStatic(gift, id));
    // start the sound inside the click so browsers allow it; muted until the animation is ready
    const audio = new Audio(gift.sound);
    audio.preload = "auto";
    audio.muted = true;
    audio.play().catch(() => {});
    current.audio = audio;
    const startAudio = () => {
      if (id !== session) return;
      audio.currentTime = 0;
      audio.volume = 1;
      sound.track(audio);
      audio.play().catch(() => {});
    };
    go(() => {
      $spinner.hidden = !!from; // the flown still is the loading state
      if (!isWebKit) playVideo(gift.full_webm, id, startAudio, () => playStatic(gift, id));
      else if (gift.full_mov_safari) playVideo(gift.full_mov_safari, id, startAudio, () => playWebP(gift, id, startAudio));
      else playWebP(gift, id, startAudio);
    });
  }

  // a copy of the strip still moves from its place in the belt to the centre, the original hides meanwhile
  function flyIn(from) {
    const r = from.getBoundingClientRect(), s = $("gcStage").getBoundingClientRect();
    const size = Math.min(s.width, innerHeight) * 0.62;
    const fly = el("img", "gc-fly");
    fly.alt = "";
    fly.src = from.currentSrc || from.src;
    Object.assign(fly.style, { left: `${s.left + (s.width - size) / 2}px`, top: `${s.top + (s.height - size) / 2}px`, width: `${size}px`, height: `${size}px` });
    document.body.append(fly);
    if (!reducedMotion.matches && fly.animate) {
      const dx = r.left + r.width / 2 - (s.left + s.width / 2), dy = r.top + r.height / 2 - (s.top + s.height / 2);
      fly.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${r.width / size})` }, { transform: "none" }],
        { duration: FLY_MS, easing: "cubic-bezier(.2, .8, .2, 1)" });
    }
    from.style.visibility = "hidden";
    Object.assign(current, { from, fly });
  }

  // the animation (or the still of a symbol) appears; the flown still gives way to it
  function reveal(node) {
    node.classList.add("on");
    current?.fly?.classList.add("gone");
  }

  function playVideo(src, id, startAudio, onFail) {
    const video = el("video");
    Object.assign(video, { muted: true, playsInline: true, preload: "auto" });
    video.setAttribute("playsinline", "");
    video.addEventListener("playing", () => {
      if (id !== session) return;
      $("gcSpinner").hidden = true;
      reveal(video);
      startAudio();
    }, { once: true });
    video.addEventListener("ended", () => id === session && closeOverlay());
    let failed = false;
    const fail = () => {
      if (failed || id !== session) return;
      failed = true;
      video.remove();
      onFail();
    };
    video.addEventListener("error", fail, { once: true });
    video.src = src;
    $("gcStage").append(video);
    video.play().catch((err) => { if (err.name !== "AbortError") fail(); });
  }

  function playWebP(gift, id, startAudio) {
    fetch(gift.preview_webp_safari)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((buf) => {
        if (id !== session) return;
        const duration = webpDuration(buf);
        const img = el("img");
        img.alt = "";
        img.addEventListener("load", () => {
          if (id !== session) return;
          $("gcSpinner").hidden = true;
          reveal(img);
          startAudio();
          // animated WebP loops forever, so close after one cycle ourselves
          const ms = duration || (current.audio.duration * 1000) || 4000;
          current.timer = setTimeout(() => id === session && closeOverlay(), ms);
        }, { once: true });
        img.src = URL.createObjectURL(new Blob([buf], { type: "image/webp" }));
        $("gcStage").append(img);
      })
      .catch(() => playStatic(gift, id));
  }

  function playStatic(gift, id) {
    if (id !== session) return;
    if (current.audio) { current.audio.pause(); current.audio = null; }
    const $stage = $("gcStage"), $spinner = $("gcSpinner");
    $stage.replaceChildren($spinner);
    $spinner.hidden = true;
    const img = el("img", "static");
    img.alt = "";
    img.addEventListener("load", () => {
      if (id !== session) return;
      requestAnimationFrame(() => reveal(img));
      current.timer = setTimeout(() => id === session && closeOverlay(), STATIC_SHOW_MS);
    }, { once: true });
    img.src = gift.still;
    $stage.append(img);
  }

  function closeOverlay() {
    const $overlay = $("gcOverlay");
    if (!$overlay || $overlay.hidden || !current) return;
    const id = ++session;
    const { audio, returnFocus, from, fly } = current;
    clearTimeout(current.timer);
    if (audio) fadeOut(audio);
    $overlay.classList.remove("open");
    if (fly) {
      fly.classList.add("gone");
      setTimeout(() => fly.remove(), FADE_MS);
    }
    if (from) from.style.visibility = "";
    setTimeout(() => {
      if (id !== session) return; // reopened meanwhile
      $overlay.hidden = true;
      $("gcSpinner").hidden = true;
      cleanupMedia();
      document.body.classList.remove("locked");
      returnFocus?.isConnected && returnFocus.focus({ preventScroll: true });
      current = null;
    }, FADE_MS);
  }

  function cleanupMedia() {
    const $stage = $("gcStage");
    if (!$stage) return;
    for (const node of $stage.children) {
      if (node.pause) { node.pause(); node.removeAttribute("src"); node.load(); }
      if (node.src?.startsWith("blob:")) URL.revokeObjectURL(node.src);
    }
    $stage.replaceChildren($("gcSpinner"));
    if (current?.audio) current.audio.pause();
    if (current) clearTimeout(current.timer);
  }

  function fadeOut(audio) {
    const step = audio.volume / (FADE_MS / 30);
    const t = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - step);
      if (audio.volume <= 0) { clearInterval(t); audio.pause(); }
    }, 30);
  }

  // sum of ANMF frame durations in an animated WebP, in ms (0 if not animated)
  function webpDuration(buf) {
    const v = new DataView(buf);
    if (v.byteLength < 12 || v.getUint32(0) !== 0x52494646 || v.getUint32(8) !== 0x57454250) return 0;
    let total = 0;
    for (let p = 12; p + 8 <= v.byteLength;) {
      const fourcc = v.getUint32(p);
      const size = v.getUint32(p + 4, true);
      if (fourcc === 0x414e4d46 && p + 8 + 16 <= v.byteLength) { // "ANMF"
        const o = p + 8 + 12;
        total += v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getUint8(o + 2) << 16);
      }
      p += 8 + size + (size & 1);
    }
    return total;
  }

  /* ---------------- mount ---------------- */

  const csv = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

  function mount(root, opts = {}) {
    const my = ++gen;
    lang = opts.lang || "ru";
    editor = !!opts.editor;
    sound.stopAll();
    const nodes = [...root.querySelectorAll("[data-gifts]")];
    sound.button(nodes.length > 0);
    if (!nodes.length) return;
    once();
    for (const node of nodes) {
      const cfg = {
        base: node.dataset.base || "/gift-catalog/", keys: csv(node.dataset.keys), hires: csv(node.dataset.hires),
        picked: node.dataset.picked || "", note: node.dataset.note || "",
      };
      const alive = () => my === gen && node.isConnected;
      load(cfg.base).then((data) => {
        if (!alive()) return;
        const kind = node.dataset.gifts;
        if (kind === "showcase") showcase(node, data, cfg, alive);
        else if (kind === "process") process(node, data, cfg, alive);
        else if (kind === "catalog") catalog(node, data, cfg);
        else if (kind === "strip") strip(node, data);
      }).catch((err) => { console.error(err); node.textContent = "Could not load the gifts."; });
    }
  }

  return { mount };
})();
