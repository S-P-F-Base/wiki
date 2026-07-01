from pathlib import Path

from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse

from template_env import templates

from .utils.markdown_engine import WIKI_DIR, get_wiki_page

router = APIRouter()


@router.get("/wiki/{page:path}", response_class=HTMLResponse)
def wiki_page(request: Request, page: Path):
    md_path = WIKI_DIR / page
    if md_path.is_dir() or str(page).endswith("/"):
        md_path = md_path / "index.md"

    else:
        md_path = md_path.with_suffix(".md")

    if not md_path.resolve().is_relative_to(WIKI_DIR.resolve()):
        return Response(
            content="Invalid path",
            status_code=403,
            media_type="text/html",
        )

    try:
        content = md_path.read_text(encoding="utf-8")

    except FileNotFoundError:
        return Response(
            content="Page not found",
            status_code=404,
            media_type="text/html",
        )

    rendered_html, title, date, author, background_url = get_wiki_page(md_path, content)

    return templates.TemplateResponse(
        request,
        "wiki_template.html",
        {
            "content": rendered_html,
            "title": title,
            "date": date,
            "author": author,
            "background_url": background_url,
        },
    )
