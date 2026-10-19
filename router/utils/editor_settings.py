"""Visual forms for dictionaries stored in wiki/_tech."""

import re
from pathlib import Path

from pydantic import BaseModel, Field

from ..extensions.blocks import parse_attributes
from ..extensions.strip_comments_extension import strip_html_comments


class DictionaryUpdate(BaseModel):
    revision: str
    autolinks: list[dict[str, str]] = Field(default_factory=list)
    previews: list[dict[str, str]] = Field(default_factory=list)
    example: str = "Пример текста"


def settings_paths(wiki_dir: Path):
    directory = wiki_dir / "_tech"
    return directory / "autolinks.md", directory / "link_previews.md"


def read_entries(source, directive, end_directive=None):
    lines = strip_html_comments(source).splitlines()
    result = []
    index = 0
    while index < len(lines):
        if lines[index].strip() != "!" + directive + "[":
            index += 1
            continue
        start = index + 1
        index = start
        while index < len(lines) and lines[index].strip() not in {"]", r"\]"}:
            index += 1
        attrs = parse_attributes(lines[start:index])
        index += 1
        if end_directive:
            start = index
            while index < len(lines) and lines[index].strip() != "!" + end_directive:
                index += 1
            attrs["synopsis"] = "\n".join(lines[start:index]).strip()
            index += 1
        result.append(attrs)
    return result


def read_settings(wiki_dir):
    auto, preview = settings_paths(wiki_dir)
    first = auto.read_bytes() if auto.exists() else b""
    second = preview.read_bytes() if preview.exists() else b""
    return (
        first,
        second,
        read_entries(first.decode(), "autolink"),
        read_entries(second.decode(), "link_preview", "link_preview_end"),
    )


def header_value(value):
    if any(char in value for char in "\r\n\x00"):
        raise ValueError("Значение поля должно занимать одну строку")
    return value.strip()


def validate_href(href):
    if re.match(
        r"^[a-z][a-z\d+.-]*:", href, re.IGNORECASE
    ) and not href.lower().startswith(("https:", "http:", "mailto:")):
        raise ValueError(
            "Ссылка должна вести на страницу вики или использовать http, https, mailto"
        )


def serialize_settings(document: DictionaryUpdate):
    autolinks, previews = [], []
    seen = set()
    for item in document.autolinks:
        attrs = {key: header_value(value) for key, value in item.items()}
        if not attrs.get("term") or not attrs.get("href"):
            raise ValueError("У автолинка должны быть слово и адрес")
        validate_href(attrs["href"])
        terms = [attrs["term"], *attrs.get("aliases", "").split("|")]
        local = set()
        for term in terms:
            normalized = " ".join(term.split()).casefold()
            if not normalized or normalized in local:
                continue
            if normalized in seen:
                raise ValueError("Термин используется несколько раз: " + term)
            local.add(normalized)
        seen.update(local)
        autolinks.append(
            "!autolink[\n"
            + "\n".join(
                "    " + key + "=" + value for key, value in attrs.items() if value
            )
            + "\n]"
        )
    for item in document.previews:
        attrs = {
            key: header_value(value) for key, value in item.items() if key != "synopsis"
        }
        if not (attrs.get("href") or attrs.get("term") or attrs.get("terms")):
            raise ValueError(
                "У превью должен быть адрес ссылки или слово для сопоставления"
            )
        if not (attrs.get("image") or item.get("synopsis", "").strip()):
            raise ValueError("Добавь изображение или описание превью")
        validate_href(attrs.get("href", ""))
        previews.append(
            "!link_preview[\n"
            + "\n".join(
                "    " + key + "=" + value for key, value in attrs.items() if value
            )
            + "\n]\n"
            + item.get("synopsis", "").strip()
            + "\n!link_preview_end"
        )
    return ("\n\n".join(autolinks) + "\n").encode(), (
        "\n\n".join(previews) + "\n"
    ).encode()
