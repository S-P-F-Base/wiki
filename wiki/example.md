Title: Тестовая страница вики
Author: Cain
Date: 666 Адтября 666 г.
Background: images/wallpaper.jpeg
<!-- Выше это блок мета. Старайтесь не срать на него. Он чувствительный -->
<!-- Title: - наименование страницы вики -->
<!-- Author: - авторы. Перечисляются через запятую -->
<!-- Date: - Добавить и не трогать. При залитии в репозиторий оно само поставит себя -->
<!-- Background указывает на фон. Как и все блоки юзающие ссылку на изображение cwd = /static/ -->

[TOC] <!-- Вставляется в самом начале файла под метой чтобы заставить работать левый блок страницы -->

# Добро пожаловать
Это тестовая страница вики.

Она призвана для просмотра что все расширения работаю корректно, и что вики не поплыла.
Так же можете в принципе брать эту страницу за пример оформления.

<!-- 
Все комментарии в md автоматически удаляются до обработки 
-->

---

<!-- Проверка блоков сворачивания TOC -->
# Проверка вложенности до 6-й глубины
## Уровень 2
### Уровень 3
#### Уровень 4
##### Уровень 5
###### Уровень 6

---

# Папки фолдеры
Призвано сделать указание папок более удобным и простым

!folder[
    /docs/index.md
    /docs/install.md
    /docs/configuration.md
    /docs/faq.md
]

!folder[
    /src/main.py
    /src/utils/helpers.py
    /src/config/defaults.yaml
    /README.md
]

!folder[
    /wiki/index.md
    /wiki/lore/factions.md
    /wiki/lore/artifacts.md
    /wiki/please_read_this_first.md
]

!folder[
    /core/init.lua
    /core/overengineered_system.lua
    /core/old/do_not_touch.lua
    /notes/why_it_works.md
]

!folder[
    /root/v3.py
    /root/final_v3.py
    /root/final_v3_REAL.py
    /root/final_v3_REAL_fixed.py
    /root/final_v3_REAL_fixed2.py
    /root/README_please.md
]

---

# Использование темплейтов
В связи с тем, что писать одно и тоже между блоками утомляет, а когда захочешь поменять оформление можно и вскрыться, было представлено новое средство! Темплейты (в прошлом варны)

!template[test]

---

# Использование диалоговых окон
Теперь можно красиво оформлять диалоги, а не сосать пенисы!

<!-- Структура такая
!dialog_start[
    ключ: left|right|center name="t" avatar=<base_img_url>
]

ключ: бла бла бла <- Будет бабл с именем "t"
@ключ name="???"
@ключ avatar=<base_img_url>
ключ: бла бла бла <- Будет бабл с именем "???"

!dialog_end
-->
!dialog_start[
    cain_0: left
    cain: left name=Каин avatar=images/avatar/cain_a.png
    cain_2: right name="Проверка пробела" avatar=images/avatar/cain_d.png
    cain_3: center
]
cain_0: Ни имени, ни стыда

cain: Тееест
cain_2: Я будто знаю что писать
cain_3: Бубубу

@cain name="можно даже менять имя на лету"
@cain avatar=images/avatar/cain_e.png
cain: Как и аватарку

!dialog_end

---

# Данные удалены
Можно не нарушая читаемости md файла цензурить некоторый текст

К примеру !redact[У грома маленькая пиписька и импотенция]

---
# TODO
Кнопки
Авто кнопочки
Кратинки
Таблички
Чё-то придумать с ten code
Добавить карточки для хронологии. Так читаться должно поудобнее
Индексация вики. Боже блять спаси меня
