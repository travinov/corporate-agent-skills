# drawio-skill для GigaCode

Корпоративная сборка `drawio-skill` на базе оригинального skill `Agents365-ai/drawio-skill`.

Skill помогает агенту создавать `.drawio` диаграммы и экспортировать их в PNG, SVG, PDF или JPG через установленный draw.io Desktop CLI.

## Что внутри

- `SKILL.md` — основная инструкция для агента.
- `scripts/` — генераторы, валидаторы и утилиты для `.drawio`.
- `references/` — справочные инструкции, которые агент читает по необходимости.
- `data/` — индекс фигур и иконок.
- `styles/` — встроенные визуальные пресеты.
- `config.example.json` — пример локальной настройки пути к draw.io.

## Установка skill

Распакуйте архив в каталог skills вашего агента.

Для GigaCode/Codex-совместимого окружения обычно:

```bash
mkdir -p ~/.agents/skills
unzip drawio-skill-corporate.zip -d ~/.agents/skills
```

После распаковки должен появиться каталог:

```text
~/.agents/skills/drawio-skill/
```

## Установка draw.io Desktop CLI

Сам skill не содержит приложение draw.io. На ноутбуке должен быть установлен draw.io Desktop.

### macOS

В корпоративной среде устанавливайте draw.io Desktop через внутренний маркетплейс приложений компании, так же как на Windows. Не используйте Homebrew и не скачивайте внешний installer, если корпоративные правила требуют установку через маркетплейс.

Прямая поисковая ссылка SberUserSoft:

```text
https://sberusersoft.sigma.sbrf.ru/#search/Draw.io
```

После установки проверьте CLI:

```bash
drawio --version
```

Если команда `drawio` не добавлена в `PATH`, проверьте полный путь:

```bash
"/Applications/draw.io.app/Contents/MacOS/draw.io" --version
```

### Windows

В корпоративной среде устанавливайте draw.io Desktop через внутренний маркетплейс приложений компании. Не скачивайте внешний installer, если корпоративные правила требуют установку через маркетплейс.

Прямая поисковая ссылка SberUserSoft:

```text
https://sberusersoft.sigma.sbrf.ru/#search/Draw.io
```

Обычно порядок такой:

1. Открыть ссылку SberUserSoft выше или внутренний маркетплейс приложений.
2. Найти `draw.io`, `diagrams.net` или `drawio`.
3. Установить draw.io Desktop.
4. Проверить, где оказался `draw.io.exe`.

Проверка стандартной установки:

```powershell
& "C:\Program Files\draw.io\draw.io.exe" --version
```

Если draw.io установлен только для текущего пользователя:

```powershell
& "$env:LOCALAPPDATA\Programs\draw.io\draw.io.exe" --version
```

### WSL2

В WSL2 обычно используется Windows-приложение draw.io через `/mnt/c`:

```bash
"/mnt/c/Program Files/draw.io/draw.io.exe" --version
```

Для установки в профиль пользователя Windows:

```bash
"/mnt/c/Users/<USERNAME>/AppData/Local/Programs/draw.io/draw.io.exe" --version
```

## Настройка нестандартного пути

Если draw.io установлен не в стандартном месте или не добавлен в `PATH`, укажите путь явно.

Приоритет поиска:

1. Переменная окружения `DRAWIO_BIN`.
2. Файл `~/.drawio-skill/config.json` на macOS/Linux/WSL или `%USERPROFILE%\.drawio-skill\config.json` на Windows.
3. Команды `drawio` и `draw.io` из `PATH`.
4. Стандартные пути macOS и Windows.

### Вариант 1: переменная окружения

macOS/Linux:

```bash
export DRAWIO_BIN="/Applications/draw.io.app/Contents/MacOS/draw.io"
```

Windows PowerShell:

```powershell
$env:DRAWIO_BIN = "C:\Program Files\draw.io\draw.io.exe"
```

### Вариант 2: config.json

Создайте файл.

macOS/Linux/WSL:

```text
~/.drawio-skill/config.json
```

Windows:

```text
%USERPROFILE%\.drawio-skill\config.json
```

Пример для Windows:

```json
{
  "drawio_bin": "C:\\Program Files\\draw.io\\draw.io.exe"
}
```

Пример для per-user установки Windows:

```json
{
  "drawio_bin": "C:\\Users\\<USERNAME>\\AppData\\Local\\Programs\\draw.io\\draw.io.exe"
}
```

Пример для macOS:

```json
{
  "drawio_bin": "/Applications/draw.io.app/Contents/MacOS/draw.io"
}
```

## Проверка после установки

Попросите агента использовать skill или проверьте CLI вручную:

```bash
drawio --version
```

Если используется нестандартный путь:

```bash
"$DRAWIO_BIN" --version
```

Минимальная проверка экспорта:

```bash
drawio -x -f png -o test.png test.drawio
```

## Частые проблемы

`draw.io` не найден на macOS

На macOS команда обычно называется `drawio`, без точки:

```bash
drawio --version
```

Если `drawio` не найден, проверьте, что draw.io Desktop установлен через SberUserSoft, затем попробуйте полный путь:

```bash
"/Applications/draw.io.app/Contents/MacOS/draw.io" --version
```

Windows path содержит пробелы

Всегда берите путь в кавычки:

```powershell
& "C:\Program Files\draw.io\draw.io.exe" --version
```

В корпоративной среде приложение установлено в нестандартном месте

Укажите путь через `DRAWIO_BIN` или config-файл `~/.drawio-skill/config.json` / `%USERPROFILE%\.drawio-skill\config.json`.

## Происхождение

База: `Agents365-ai/drawio-skill`.

Источник:

```text
https://github.com/Agents365-ai/drawio-skill
```

Исходный commit:

```text
4cb39bbeab09f1caa6959d3f60ef56e3cb685f08
```

Отличие этой сборки: добавлены корпоративные инструкции для Windows/macOS, установка draw.io через внутренний маркетплейс / SberUserSoft, явная настройка пути к `drawio` через `DRAWIO_BIN` и config-файл, а также этот README на русском.
