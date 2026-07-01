# router/wiki_editor.py
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from template_env import templates

from .utils.markdown_engine import WIKI_DIR, get_wiki_page

router = APIRouter()


class SaveRequest(BaseModel):
    page: str  # путь относительно корня вики, например "lore/factions"
    content: str  # markdown


class PreviewRequest(BaseModel):
    content: str


class RenderRequest(BaseModel):
    content: str


# ── Полноценный рендер страницы (для превью) ──────────────────────────
@router.post("/wiki/render")
def render_page(req: RenderRequest):
    """
    Возвращает полноценную HTML-страницу вики с переданным markdown-контентом.
    Использует тот же шаблон, что и обычные страницы.
    """
    # Рендерим контент через все расширения
    rendered_html, title, date, author, background_url = get_wiki_page(
        Path("preview.md"), req.content
    )

    # Рендерим полный шаблон в строку
    template = templates.get_template("wiki_template.html")
    full_html = template.render(
        request={},  # пустой словарь, если не нужен request в шаблоне
        title=title,
        content=rendered_html,
        date=date,
        author=author,
        background_url=background_url,
    )
    return JSONResponse({"html": full_html})


# ── Страница редактора ──────────────────────────────────────────────
@router.get("/wiki/edit/{page:path}", response_class=HTMLResponse)
def editor_page(request: Request, page: str):
    """Отдаёт HTML визуального редактора для указанной страницы."""
    return templates.TemplateResponse(request, "wiki_editor.html", {"page": page})


# ── Получить сырой markdown для редактирования ───────────────────────
@router.get("/wiki/raw/{page:path}")
def raw_content(page: str):
    """Возвращает текущий markdown страницы."""
    md_path = _resolve_md_path(page)

    if not md_path.resolve().is_relative_to(WIKI_DIR.resolve()):
        raise HTTPException(status_code=403, detail="Forbidden")

    if not md_path.exists():
        # Для новой страницы – базовая заготовка
        content = (
            "Title: Новая страница\nAuthor: \nDate: \nBackground: \n\n# Заголовок\n"
        )
    else:
        content = md_path.read_text(encoding="utf-8")

    return JSONResponse(
        {"content": content, "path": str(md_path.relative_to(WIKI_DIR))}
    )


# ── Превью (рендер markdown → HTML) ──────────────────────────────────
@router.post("/wiki/preview")
def preview(req: PreviewRequest):
    """Рендерит переданный markdown в HTML (использует все расширения)."""
    html, _, _, _, _ = get_wiki_page(Path("preview.md"), req.content)
    return {"html": html}


# ── Сохранение страницы ──────────────────────────────────────────────
@router.post("/wiki/save")
def save(req: SaveRequest):
    """Сохраняет markdown в файл."""
    page = req.page.strip("/")
    if not page:
        raise HTTPException(status_code=400, detail="Empty page path")

    md_path = _resolve_md_path(page)

    if not md_path.resolve().is_relative_to(WIKI_DIR.resolve()):
        raise HTTPException(status_code=403, detail="Forbidden")

    md_path.parent.mkdir(parents=True, exist_ok=True)

    md_path.write_text(req.content, encoding="utf-8")

    url_path = str(md_path.relative_to(WIKI_DIR)).replace("\\", "/")
    if md_path.stem == "index":
        url_path = url_path.rsplit("/", 1)[0]
    else:
        url_path = url_path.replace(".md", "")

    return JSONResponse({"ok": True, "url": f"/wiki/{url_path}"})


def _resolve_md_path(page: str) -> Path:
    """Преобразует относительный путь страницы в абсолютный путь к .md файлу."""
    page = page.strip("/")
    md_path = WIKI_DIR / page

    if md_path.is_dir() or page.endswith("/"):
        md_path = md_path / "index.md"
    else:
        md_path = md_path.with_suffix(".md")

    return md_path
