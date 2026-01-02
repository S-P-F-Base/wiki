#!/usr/bin/env python3
import json
import sys
from io import BytesIO
from pathlib import Path

from lxml import etree
from PIL import Image
from reportlab.graphics import renderPM
from svglib.svglib import svg2rlg


def load_svg_tree(svg_path: Path, regions: dict[str, str]) -> bytes:
    root = etree.fromstring(svg_path.read_bytes())
    for el in root.iter():
        el_id = el.get("id")
        if el_id and el_id in regions:
            el.set("fill", regions[el_id])

    return etree.tostring(root)


def export_map(
    svg_path: Path,
    json_path: Path,
    out_path: Path,
    width: int = 4096,
    height: int = 2048,
    quality: int = 95,
    keep_alpha: bool = True,
) -> None:
    print("start export map")
    regions = json.loads(json_path.read_text(encoding="utf-8")).get("regions", {})
    svg_bytes = load_svg_tree(svg_path, regions)
    print("svg patched")

    drawing = svg2rlg(BytesIO(svg_bytes))
    print("svg parsed")

    png_buffer = BytesIO()
    renderPM.drawToFile(drawing, png_buffer, fmt="PNG", dpi=width / drawing.width * 72)
    png_buffer.seek(0)
    print("rendered")

    img = Image.open(png_buffer)
    if not keep_alpha:
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
        img.save(out_path, "JPEG", quality=quality, optimize=True)
    else:
        img.save(out_path, "PNG", optimize=False)

    print(f"Done: {out_path}")


def main() -> None:
    svg, jsn = (
        Path("static/map/world.svg"),
        Path("static/map/world.json"),
    )
    width, height = 4096, 2048

    args = sys.argv[3:]
    for i, a in enumerate(args):
        if a == "--width" and i + 1 < len(args):
            width = int(args[i + 1])
        elif a == "--height" and i + 1 < len(args):
            height = int(args[i + 1])

    export_map(svg, jsn, Path("static/map/world.png"), width, height, 100, True)
    export_map(svg, jsn, Path("static/map/world.jpeg"), width, height, 90, False)


if __name__ == "__main__":
    main()
