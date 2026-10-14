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


def bake(text, strings):
    def put(m):
        v = strings.get(m["key"])
        if v is None:
            return m[0]
        v = "\n".join(line.rstrip() for line in v.split("\n")).strip()  # no stray spaces before line breaks
        return m[1] + html.escape(v, quote=False) + m[5]
    return EL.sub(put, text)


def main():
    strings = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))["text"]["ru"]
    changed = []
    for name in PAGES:
        p = ROOT / name
        if not p.exists():
            continue
        with open(p, encoding="utf-8", newline="") as f:  # newline="": line endings stay as they are
            old = f.read()
        new = bake(old, strings)
        if new != old:
            with open(p, "w", encoding="utf-8", newline="") as f:
                f.write(new)
            changed.append(name)
    print("baked: " + (", ".join(changed) if changed else "nothing to change"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
