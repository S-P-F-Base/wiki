"""Markdown list and table fields used by the local editor."""

import re

from ..extensions.strip_comments_extension import strip_html_comments

LIST_RE = re.compile(r"^( {0,3}(?: {4})*)([-+*]|\d+[.)])[ \t]+(.*?)(?:\r?\n)?$")
TABLE_RULE_RE = re.compile(r"^:?-+:?$")


def table_cells(line):
    return [
        value.strip().replace(r"\|", "|")
        for value in re.split(
            r"(?<!\\)\|", strip_html_comments(line).strip().strip("|")
        )
    ]


def read_table(lines, start):
    if start + 1 >= len(lines) or "|" not in lines[start]:
        return None
    rules = table_cells(lines[start + 1])
    headers = table_cells(lines[start])
    if len(headers) != len(rules) or not all(
        TABLE_RULE_RE.fullmatch(rule) for rule in rules
    ):
        return None
    end = start + 2
    rows = []
    while end < len(lines) and lines[end].strip() and "|" in lines[end]:
        cells = table_cells(lines[end])
        rows.append((cells + [""] * len(headers))[: len(headers)])
        end += 1
    align = []
    for rule in rules:
        align.append(
            "center"
            if rule.startswith(":") and rule.endswith(":")
            else (
                "left"
                if rule.startswith(":")
                else "right"
                if rule.endswith(":")
                else ""
            )
        )
    comment = " ".join(re.findall(r"<!--.*?-->", lines[start + 1]))
    return end, {
        "headers": headers,
        "rows": rows,
        "align": align,
        "rule_comment": comment,
    }


def read_list(lines, start):
    first = LIST_RE.match(lines[start])
    if not first or len(first[1]) > 3:
        return None
    ordered = first[2][0].isdigit()
    items = []
    end = start
    unsupported = False
    while end < len(lines):
        match = LIST_RE.match(lines[end])
        if not match:
            if not lines[end].strip():
                following = end + 1
                while following < len(lines) and not lines[following].strip():
                    following += 1
                if following == len(lines):
                    break
                next_item = LIST_RE.match(lines[following])
                continues = lines[following].startswith((" ", "\t")) or (
                    next_item and next_item[2][0].isdigit() == ordered
                )
                if not continues:
                    break
                unsupported = True
                end = following
                continue
            if re.match(r"^\s{0,3}(?:!|#{1,6}\s|>|`{3,}|~{3,}|-{3,}\s*$)", lines[end]):
                break
            # Markdown permits both indented and lazy paragraph continuations.
            unsupported = True
            end += 1
            continue
        indent = len(match[1]) // 4
        is_ordered = match[2][0].isdigit()
        if indent == 0 and is_ordered != ordered:
            break
        items.append({"text": match[3], "indent": indent, "ordered": is_ordered})
        end += 1
    return end, {
        "unsupported": unsupported,
        "ordered": ordered,
        "items": items,
        "start": int(first[2][:-1]) if ordered else 1,
    }


def write_text_block(kind, props):
    if kind == "table":
        headers = props.get("headers", [])
        if not headers or len(headers) > 50:
            raise ValueError("В таблице должно быть от 1 до 50 колонок")

        def row(values):
            cells = [
                str(value)
                .replace("\r\n", "\n")
                .replace("\n", "<br>")
                .replace("|", r"\|")
                for value in values
            ]
            return "| " + " | ".join(cells) + " |"

        align = props.get("align", [])
        rules = [
            {"left": ":---", "right": "---:", "center": ":---:"}.get(
                align[index] if index < len(align) else "", "---"
            )
            for index in range(len(headers))
        ]
        rows = [row(headers), row(rules)]
        if props.get("rule_comment"):
            rows[1] += " " + props["rule_comment"]
        for values in props.get("rows", []):
            rows.append(row((values + [""] * len(headers))[: len(headers)]))
        return "\n\n" + "\n".join(rows) + "\n\n"
    lines = []
    for index, item in enumerate(props.get("items", [])):
        if isinstance(item, str):
            item = {"text": item, "indent": 0}
        indent = max(0, min(8, int(item.get("indent", 0))))
        ordered = (
            props.get("ordered", False) if not indent else item.get("ordered", False)
        )
        marker = str(props.get("start", 1) + index) + ". " if ordered else "- "
        lines.append(
            "    " * indent + marker + str(item.get("text", "")).replace("\n", "<br>")
        )
    return "\n\n" + "\n".join(lines) + "\n\n"
