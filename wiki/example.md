Title: Пример страницы
Author: Cain
Date: 1 Октября 2025 г.
Background: secrets/hehe.jpg

# Добро пожаловать
Это пример страницы для **вики**. Ниже - демонстрация подключённых расширений.

!!! red "ВНИМАНИЕ"
    Все `.md` файлы динамически подгружаются. Так что сервер для этого постоянно перезапускать не нужно

---

[TOC]

---

## Таблицы

| Имя     | Класс       | Ранг |
|:-------:|------------:|:----:|
| !tblimg[/static/secrets/hehe.jpg|64px,auto,hard] | AR Team | A |
| UMP45   | 404 Squad   | B    |
| G11     | Experimental| S    |

| Имя   | Класс                                          | Ранг |
|:------|-----------------------------------------------:|:----:|
| M4A1  | AR Team                                        | A    |
| UMP45 | !tblimg[/static/secrets/hehe.jpg|30%,auto,max] | B |
| G11   | Experimental                                   | S    |

Крайне не советую юзать картинки без выравнивания по центру и не с указанными размерами пикселей. Сверху причина этого

---

## Картинки через !img

!img[/static/secrets/base_grom.png]

!img[/static/secrets/hehe.jpg|left|30%]

!img[/static/secrets/hehe.jpg|right|200px,auto,hard]

---

## Блоки изображений

!imgblock[/static/secrets/hehe.jpg|left|70%,auto]
Текст рядом с картинкой с `max` режимом
!endimgblock

!imgblock[/static/secrets/hehe.jpg|right|300px,200px,hard]
А это `hard`, фиксированная ширина и высота
!endimgblock

!imgblock[/static/secrets/hehe.jpg|middle|100%,auto,hard]
Большая картинка по центру, высота автоматом
!endimgblock

---

## WikiLink
Можно сослаться так [[/wiki|Глав. стр]].

---

## Блок кода

```
Очень длинный текст внутри кода Очень-очень-очень-очень-очень-очень-очень-очень-очень-очень длинный текст
```

---

## Блоки цветные

!!! orange
    Цвет

!!! red
    Цвет

!!! green "Цветной с кастомным заголовком"
    Цвет

!!! blue ""
    Цветной без заголовка

---

## Сноски

Вот текст со сноской.[^1]

[^1]: Текст сноски.

---

## Разделители

`---`

---

## Кнопочка

!btn[https://youtu.be/E4WlUXrJgy4?si=5kLpaTltJ7F2-Eqh|OwO]

---

## Константы

!const[site_domain]

!btn[!const[site_domain]|Тык]

---

## Фолдеры

!folder[
    /root/kill_all.py
    /example.md
    /wiki/ten_codes.md
]

!folder[
    /god/root/kill_all.py
    /god/example.md
    /god/wiki/ten_codes.md
]

---

## Мелкий текст

Текст маленький
-# Очень маленький

---

## Оформление заблокированных блоков
<!-- Можно и не указывать style при base -->
!lob[
style: base
msg: Первая линия
    Вторая линия
    Последующие
arr: 1,2,3,4,5
]

---

!lob[
style: subtle
msg: Первая линия
    Вторая линия
    Последующие
arr: 1,2,3,4,5
]

---

!lob[
style: neon
msg: Первая линия
    Вторая линия
    Последующие
arr: 1,2,3,4,5
]
