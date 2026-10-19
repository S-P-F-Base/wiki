"""Form values for wiki blocks; unchanged blocks keep their original source."""

import html
from typing import Any

from ..extensions.blocks import parse_attributes, parse_options
from ..extensions.dialog_extension import DialogPreprocessor
from ..extensions.registry_extension import RegistryPreprocessor

NAMES = {
    "dialog_start": "dialog",
    "registry": "registry",
    "restricted": "restricted",
    "folder": "folder",
    "button": "button",
}


def read_directive(source):
    lines = source.splitlines()
    name = lines[0].strip().split("[", 1)[0].lstrip("!")
    kind = NAMES[name]
    end = next(
        (
            index
            for index, line in enumerate(lines[1:], 1)
            if line.strip() in {"]", r"\]"}
        ),
        len(lines),
    )
    arguments = [line.strip() for line in lines[1:end] if line.strip()]
    body = lines[end + 1 :] if end < len(lines) else []
    if body and body[-1].strip().startswith(
        ("!dialog_end", "!registry_end", "!restricted_end")
    ):
        body = body[:-1]
    props: dict[str, Any]
    if kind == "button":
        props = {
            "href": arguments[0] if arguments else "",
            "title": arguments[1] if len(arguments) > 1 else "",
            "desc": "",
            "image": "",
        }
        if len(arguments) > 2:
            key = (
                "image"
                if arguments[2]
                .lower()
                .endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"))
                else "desc"
            )
            props[key] = arguments[2]
        if len(arguments) > 3:
            props["image"] = arguments[3]
    elif kind == "folder":
        props = {"paths": arguments}
    elif kind == "restricted":
        props = {
            "title": "",
            "tag": "RESTRICTED",
            "state": "BLOCKED",
            **parse_options("\n".join(arguments)),
        }
        props["text"] = "\n".join(body)
    elif kind == "registry":
        props = parse_attributes(arguments)
        props["sections"] = RegistryPreprocessor(None).parse_body(body)
    else:
        parser = DialogPreprocessor(None)
        participants = parser.parse_participants("\n".join(arguments))
        props = {
            "participants": [
                dict(key=key, **value) for key, value in participants.items()
            ],
            "lines": parser.parse_lines(body),
        }

    def decode(value):
        if isinstance(value, str):
            return html.unescape(value)
        if isinstance(value, list):
            return [decode(item) for item in value]
        if isinstance(value, dict):
            return {key: decode(item) for key, item in value.items()}
        return value

    return kind, (
        decode(props)
        if kind
        in {
            "dialog",
            "registry",
            "restricted",
            "folder",
        }
        else props
    )


def plain(value):
    return html.escape(str(value), quote=False).replace("!", "&#33;")


def single(value):
    value = str(value)
    if any(char in value for char in "\r\n\x00"):
        raise ValueError("Значение должно занимать одну строку")
    return value


def option(value):
    return '"' + html.escape(single(value), quote=True) + '"'


def write_directive(kind, props):
    if kind == "caption":
        text = props.get("markdown")
        if text is None:
            text = plain(single(props.get("text", "")))
        return "\n\n-# " + single(text) + "\n\n"
    if kind == "auto_buttons":
        return (
            "\n\n!auto_buttons["
            + ("time" if props.get("sort") == "time" else "abc")
            + "]\n\n"
        )
    if kind == "float_break":
        return "\n\n!image_float_break\n\n"
    if kind == "button":
        args = [
            single(props.get("href", "/wiki/")),
            single(props.get("title", "Кнопка")),
        ]
        for key in ("desc", "image"):
            if props.get(key):
                args.append(single(props[key]))
        return "\n\n!button[\n    " + "\n    ".join(args) + "\n]\n\n"
    if kind == "folder":
        return (
            "\n\n!folder[\n"
            + "\n".join(plain(single(path)) for path in props.get("paths", []))
            + "\n]\n\n"
        )
    if kind == "restricted":
        header = "\n".join(
            key + "=" + option(props.get(key, default))
            for key, default in [
                ("title", ""),
                ("tag", "RESTRICTED"),
                ("state", "BLOCKED"),
            ]
        )
        return (
            "\n\n!restricted[\n"
            + header
            + "\n]\n"
            + plain(props.get("text", ""))
            + "\n!restricted_end\n\n"
        )
    if kind == "registry":
        header = "\n".join(
            key + "=" + plain(single(props.get(key, ""))) for key in ("name", "desc")
        )
        body = []
        for section in props.get("sections", []):
            body.append(plain(single(section.get("title", "Раздел"))) + ":")
            body.extend(plain(line) for line in section.get("text", []))
            for variant in section.get("variants", []):
                body.append(
                    "- "
                    + plain(single(variant.get("key", "")))
                    + ": "
                    + plain(single(variant.get("value", "")))
                )
        return (
            "\n\n!registry[\n"
            + header
            + "\n]\n"
            + "\n".join(body)
            + "\n!registry_end\n\n"
        )
    if kind == "dialog":
        header = []
        for participant in props.get("participants", []):
            key = single(participant.get("key", "")).strip()
            if not key or ":" in key:
                raise ValueError(
                    "У участника должен быть уникальный короткий код без двоеточия"
                )
            side = participant.get("side", "left")
            if side not in {"left", "right", "center"}:
                raise ValueError("Неизвестная сторона диалога")
            row = key + ": " + side
            for field in ("name", "avatar"):
                if participant.get(field):
                    row += " " + field + "=" + option(participant[field])
            header.append(row)
        body = []
        for line in props.get("lines", []):
            if line.get("type") == "update":
                body.append(
                    "@"
                    + single(line.get("key", ""))
                    + " "
                    + " ".join(
                        key + "=" + option(value)
                        for key, value in line.get("opts", {}).items()
                    )
                )
            elif line.get("type") == "line":
                body.append(
                    single(line.get("key", ""))
                    + ": "
                    + single(plain(line.get("text", "")))
                )
            else:
                body.append(single(plain(line.get("text", ""))))
        return (
            "\n\n!dialog_start[\n"
            + "\n".join(header)
            + "\n]\n"
            + "\n".join(body)
            + "\n!dialog_end\n\n"
        )
    raise ValueError("Неизвестный тип блока")
