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
