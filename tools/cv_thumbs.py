"""Мини-превью CV для «гостя с CV» (guest.js): первая страница каждого PDF из
site.json profile.cv → assets/cv-<lang>.png. Перезапускать после замены CV:
    pip install pymupdf && python tools/cv_thumbs.py
"""
import json
import pathlib

import pymupdf as fitz

root = pathlib.Path(__file__).resolve().parent.parent
cv = json.loads((root / "site.json").read_text(encoding="utf-8"))["profile"]["cv"]
for lang, rel in cv.items():
    page = fitz.open(root / rel)[0]
    zoom = 160 / page.rect.width  # 160px wide — 2x for the 80px tile
    out = root / pathlib.Path(rel).with_suffix(".png")
    page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False).save(out)
    print(out.relative_to(root), out.stat().st_size // 1024, "KB")

    # popup preview (openCvPreview): all pages stacked into one 1200px-wide JPG, 16px gap
    doc = fitz.open(root / rel)
    W, GAP = 1200, 16
    pix = [p.get_pixmap(matrix=fitz.Matrix(W / p.rect.width, W / p.rect.width), alpha=False) for p in doc]
    sheet = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, W, sum(p.height for p in pix) + GAP * (len(pix) - 1)), False)
    sheet.set_rect(sheet.irect, (14, 24, 48))  # --ink-2, shows as the gap between pages
    y = 0
    for p in pix:
        p.set_origin(0, y)
        sheet.copy(p, p.irect)
        y += p.height + GAP
    full = root / pathlib.Path(rel).with_name(pathlib.Path(rel).stem + "-full.jpg")
    sheet.save(full, jpg_quality=82)
    print(full.relative_to(root), full.stat().st_size // 1024, "KB")
