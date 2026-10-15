"""Bake the current texts from site.json into the HTML pages.

The site renders every [data-i18n] element from site.json (app.js), so the text inside the HTML is only
a fallback — but it is what GitHub, search engines and link previews see. This keeps it equal to the
Russian texts in site.json. Run by .github/workflows/bake.yml after every change of site.json;
by hand: python tools/bake.py (stdlib only). Elements with markup inside are left as they are.
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


def main():
    site = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
    changed = []
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
