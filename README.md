# Corporate Agent Skills for GigaCode CLI

Репозиторий содержит два независимых skill-based extension для GigaCode CLI:

| Extension | Версия | Назначение |
|---|---:|---|
| [`drawio-skill`](publish-drawio-skill/) | `1.22.0-corporate.1` | Редактируемые draw.io-диаграммы с Supervisor/Reviewer/Repair/Semantic Analyst, roadmap, git-flow и архитектурными схемами |
| [`bpmn-architect`](publish-bpmn-skill/) | `0.3.0` | Семантические BPMN 2.0 модели с многоуровневой раскладкой collaboration, spatial validation и round-trip проверкой |

Extension не вложены друг в друга и могут устанавливаться отдельно.

## Готовые архивы

- [`dist/drawio-skill-agent-extension.zip`](dist/drawio-skill-agent-extension.zip)
- [`dist/bpmn-architect-skill.zip`](dist/bpmn-architect-skill.zip)
- [`dist/SHA256SUMS.txt`](dist/SHA256SUMS.txt)

Предыдущая версия draw.io skill без агентного контура остаётся в ветке
[`main`](https://github.com/travinov/corporate-agent-skills/tree/main) и доступна
как [`drawio-skill-corporate.zip`](https://raw.githubusercontent.com/travinov/corporate-agent-skills/main/dist/drawio-skill-corporate.zip).

Проверка архивов:

```bash
cd dist
shasum -a 256 -c SHA256SUMS.txt
```

## Установка в GigaCode CLI

Агентная версия Draw.io устанавливается как **extension**, а не копируется в
`~/.gigacode/skills`. Установщик использует корпоративный CLI
`/Users/travinov-sv/.gigacode/bin/gigacode`, проверяет SHA-256 и manifest,
переносит прежний `~/.gigacode/skills/drawio-skill` в backup вне активных
каталогов и вызывает native `extensions validate/install`.

На корпоративном ноутбуке из клона репозитория:

```bash
chmod +x scripts/gigacode/*.sh
scripts/gigacode/install_drawio_agent_extension.sh \
  --archive dist/drawio-skill-agent-extension.zip \
  --checksum dist/drawio-skill-agent-extension.zip.sha256
```

Если GitHub доступен, достаточно перенести только каталог `scripts/gigacode` и
запустить установщик без `--archive`: он загрузит ZIP и checksum из этой ветки.
Для полностью офлайн-установки перенесите на корпоративный ноутбук три скрипта,
ZIP и соседний `.zip.sha256`.

Проверка и откат:

```bash
scripts/gigacode/verify_drawio_agent_extension.sh
scripts/gigacode/rollback_drawio_agent_extension.sh --latest
```

После перезапуска GigaCode команда `/agents list` должна показать четыре
`diagram-*` агента. Реальный запуск выполняется только на ноутбуке, где
установлен GigaCode CLI; локальные тесты репозитория используют fake CLI и не
изменяют `~/.gigacode`.

BPMN-пакет остается отдельным skill и устанавливается независимо:

```bash
mkdir -p ~/.gigacode/skills
unzip dist/bpmn-architect-skill.zip -d ~/.gigacode/skills
```

Зависимости BPMN extension:

```bash
cd ~/.gigacode/skills/bpmn-architect/scripts/corp-bpmn
npm ci
npm run self-check
```

## Схемы и валидация

Draw.io extension поставляет Draft 2020-12 schemas для roadmap и git-flow, source-aware проверку `.drawio`, детерминированную генерацию и real-export smoke check.

BPMN extension поставляет отдельные JSON Schema 2020-12 для v1 single-process и v2 collaboration, capability matrix, fail-closed validation и semantic round-trip через `bpmn-moddle`.

## Воспроизводимая сборка

```bash
python3 scripts/release_skills.py all --registry
```

Команда проверяет зависимости, собирает два детерминированных ZIP, создаёт manifests и checksums, распаковывает архивы в чистые временные каталоги и запускает тесты уже из распакованной поставки.

Подробности: [`release/README.md`](release/README.md).
