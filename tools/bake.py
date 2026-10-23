"""Bake the current texts from site.json into the HTML pages.

The site renders every [data-i18n] element from site.json (app.js), so the text inside the HTML is only
a fallback — but it is what GitHub, search engines and link previews see. This keeps it equal to the
Russian texts in site.json. Elements with markup inside are left as they are.
It also writes llms.txt — the site as Markdown for AI agents (English); the AGENT switch in the header shows that file.
Run by .github/workflows/bake.yml after every change of site.json / projects.json;
by hand: python3 tools/bake.py (stdlib only).
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ["index.html", "projects.html", "contact.html", "project.html", "design-system.html"]
# <tag ... data-i18n="key" ...>plain text</tag>
EL = re.compile(r'(<(?P<tag>[a-z][a-z0-9]*)\b[^>]*\bdata-i18n="(?P<key>[^"]+)"[^>]*>)(?P<text>[^<]*)(</(?P=tag)>)')


STYLE = re.compile(r'  <style id="baked-hidden">[^<]*</style>\r?\n')
HEAD = re.compile(r'(\r?\n)</head>')


def hidden_css(site):
    """What site.json hides (texts, header tabs, built-in home blocks), hidden from the first frame: holds until
    app.js renders (html.i18n-ready) — without it they flash before site.json loads. Same as hiddenCSS in admin.js."""
    sel = [f'[data-block="{k.split(":")[0]}"] [data-i18n="{k.split(":")[1]}"]' for k in site.get("hiddenText", [])]
    sel += [f'.top nav a[data-i18n="{k}"]' for k in site.get("navHidden", [])]
    sel += [f'[data-block="{b["id"]}"]' for b in site.get("blocks", []) if not b.get("type") and b.get("visible") is False]
    return f'html:not(.i18n-ready) :is({", ".join(sel)}) {{ display: none !important; }}' if sel else ""


def bake(text, site):
    strings = site["text"]["ru"]

    def put(m):
        v = strings.get(m["key"])
        if v is None:
            return m[0]
        v = "\n".join(line.rstrip() for line in v.split("\n")).strip()  # no stray spaces before line breaks
        return m[1] + html.escape(v, quote=False) + m[5]
    text = STYLE.sub("", EL.sub(put, text), count=1)
    css = hidden_css(site)
    return HEAD.sub(lambda m: f'{m[1]}  <style id="baked-hidden">{css}</style>{m[1]}</head>', text, count=1)


BASE = "https://eyeanton.github.io/"


def llms(site, data):
    """llms.txt: who, what, projects, stack, experience, contacts — in English (Russian where English is empty).
    Follows what the site shows: switched-off blocks and deleted texts are left out."""
    t = dict(site["text"]["ru"])
    t.update({k: v for k, v in site["text"]["en"].items() if v})
    gone = set(site.get("hiddenText", []))
    on = {b["id"]: b.get("visible") is not False for b in site.get("blocks", []) if not b.get("type")}
    prof = site["profile"]

    def tx(blk, key):
        return "" if f"{blk}:{key}" in gone else " ".join((t.get(key) or "").split())

    def L(o):  # localized field → one line of English
        if isinstance(o, dict):
            o = o.get("en") or o.get("ru") or ""
        return " ".join(str(o or "").split())

    def url(u):
        return u if u.startswith(("http:", "https:", "mailto:")) else BASE + u.lstrip("./")

    def dot(s):
        return s if s.endswith((".", "!", "?")) else s + "."

    out = [f"# {(tx('hero', 'hero.eyebrow') or 'Anton Egorov').replace(' · ', ' — ')}", ""]
    summary = " ".join(dot(x) for x in (tx("hero", "hero.title"), tx("hero", "hero.lead")) if x)
    if summary:
        out += [f"> {summary}", ""]
    facts = [x for x in (tx("hero", "hero.where"),) if x] + [f"Portfolio: {BASE}"]
    if prof.get("cv", {}).get("en"):
        facts.append(f"CV (PDF): {url(prof['cv']['en'])}")
    out += [f"- {x}" for x in facts] + [""]

    if on.get("areas", True):
        out += [f"## {tx('areas', 'areas.title') or 'What I do'}", ""]
        if tx("areas", "areas.text"):
            out += [tx("areas", "areas.text"), ""]
        for g in prof.get("skills", []):
            tools = f" Tools: {', '.join(g['tools'])}." if g.get("tools") else ""
            out.append(f"- **{L(g['title'])}** — {dot(L(g['d']))}{tools}")
        soft = prof.get("soft", {}).get("en") or prof.get("soft", {}).get("ru") or []
        if soft:
            out += ["", f"{tx('areas', 'soft.title') or 'Soft skills'}: {', '.join(soft)}."]
        out.append("")

    if on.get("showcase", True):
        projects = [p for p in data["projects"] if p.get("visible") is not False]
        cats = {c["id"]: L(c) for c in data["categories"]}

        def item(p):  # the card's link: its own page here, else links.page
            links = p.get("links", {})
            main = BASE + f"project.html?id={p['id']}" if p.get("page") else url(links["page"]) if links.get("page") else ""
            line = f"- [{L(p['title'])}]({main})" if main else f"- **{L(p['title'])}**"
            meta = ", ".join(str(x) for x in (p.get("year"), cats.get(p.get("cat"))) if x)
            line += (f" ({meta})" if meta else "") + f" — {dot(L(p['desc']))}"
            if p.get("tags"):
                line += f" Tags: {', '.join(p['tags'])}."
            extra = [f"[{name}]({url(links[k])})" for k, name in (("live", "live site"), ("code", "code"), ("code2", "code 2")) if links.get(k)]
            return line + (f" Links: {', '.join(extra)}." if extra else "")
        home = [p for p in projects if p.get("home")]
        rest = [p for p in projects if not p.get("home")]
        out += [f"## {tx('showcase', 'show.title') or 'Projects'}", ""] + [item(p) for p in home] + [""]
        if rest:
            out += ["## More projects", ""] + [item(p) for p in rest] + [""]

    stack = [x for row in prof.get("stack", []) for x in row]
    if on.get("stack", True) and stack:
        out += [f"## {tx('stack', 'stack.title') or 'Stack & tools'}", "", ", ".join(stack) + ".", ""]

    if on.get("exp", True) and prof.get("experience"):
        out += [f"## {tx('exp', 'exp.title') or 'Experience'}", ""]
        for e in prof["experience"]:
            out.append(f"### {' — '.join(x for x in (e['role'], e.get('org')) if x)} ({L(e['when'])})")
            pts = e.get("points", {})
            out += [f"- {' '.join(x.split())}" for x in (pts.get("en") or pts.get("ru") or [])] + [""]

    out += [f"## {tx('contact', 'contact.title') or 'Contact'}", ""]
    lead = tx("contact", "contact.lead") or tx("contact", "contact.text")
    if lead:
        out += [lead, ""]
    out += [f"- {c['name']}: [{c['handle']}]({c['href']})" for c in prof.get("channels", [])] + [""]
    out += ["## Data", "", f"- [site.json]({BASE}site.json): texts and profile (RU/EN)",
            f"- [projects.json]({BASE}projects.json): all projects with links", ""]
    return "\n".join(out)


def main():
    site = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
    changed = []
    data = json.loads((ROOT / "projects.json").read_text(encoding="utf-8"))
    txt, new = ROOT / "llms.txt", llms(site, data)
    if not txt.exists() or txt.read_text(encoding="utf-8") != new:
        with open(txt, "w", encoding="utf-8", newline="\n") as f:
            f.write(new)
        changed.append("llms.txt")
    for name in PAGES:
        p = ROOT / name
        if not p.exists():
            continue
        with open(p, encoding="utf-8", newline="") as f:  # newline="": line endings stay as they are
            old = f.read()
        new = bake(old, site)
        if new != old:
            with open(p, "w", encoding="utf-8", newline="") as f:
                f.write(new)
            changed.append(name)
    print("baked: " + (", ".join(changed) if changed else "nothing to change"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
