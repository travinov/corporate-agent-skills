# Draw.io Agent Extension: установка и проверка в GigaCode

Версия: `1.23.0-corporate.13`

Эта инструкция уже включена в `drawio-skill-agent-extension.zip` и после
распаковки находится в
`drawio-skill/docs/drawio-agent-extension-corporate-test-commands.md`.

Контрольная сумма самого ZIP публикуется отдельно в
`drawio-skill-agent-extension.zip.sha256` или в сообщении о релизе. Её
нельзя зашить внутрь проверяемого ZIP: это изменило бы его
содержимое и саму контрольную сумму.

Каждый блок ниже содержит одну строку для целиком копирования.
Команды с `!` выполняются внутри GigaCode; остальные shell-команды —
в обычном Terminal.

## 1. Terminal: проверить SHA-256

```bash
cd "$HOME/Downloads" && shasum -a 256 drawio-skill-agent-extension.zip
```

Сравните вывод с внешней контрольной суммой из
`drawio-skill-agent-extension.zip.sha256` или сообщения о релизе.

## 2. Terminal: распаковать, установить и проверить

Перед запуском остановите текущую сессию GigaCode через `Ctrl+C`.

```bash
cd "$HOME/Downloads" || exit 1; if [ -d drawio-skill ]; then mv drawio-skill "drawio-skill-old-$(date +%Y%m%d-%H%M%S)"; fi; /usr/bin/ditto -x -k drawio-skill-agent-extension.zip . && bash "$HOME/Downloads/drawio-skill/install/install_drawio_agent_extension.sh" && bash "$HOME/Downloads/drawio-skill/install/verify_drawio_agent_extension.sh"
```

## 3. Terminal: проверить активную версию

```bash
sed -n '1,20p' "$HOME/.gigacode/extensions/publish-drawio-skill/gemini-extension.json"
```

Ожидаемо: `"version": "1.23.0-corporate.13"`.

## 4. Terminal: запустить GigaCode из каталога проекта

```bash
cd "/Users/travinov-sv/Documents/DrawioTest" && "$HOME/.gigacode/bin/gigacode"
```

В GigaCode выберите через `/model` базовую модель `vllm/MiniMax-M3-113k`.

## 5. GigaCode: проверить cwd

```text
!pwd; ls -la
```

Ожидаемо: `/Users/travinov-sv/Documents/DrawioTest`.

## 6. GigaCode: проверить версию extension

```text
!sed -n '1,20p' "$HOME/.gigacode/extensions/publish-drawio-skill/gemini-extension.json"
```

## 7. GigaCode: проверить флаги headless CLI

```text
!"$HOME/.gigacode/bin/gigacode" --help | grep -E -- '--model|--extensions|--system-prompt|--max-session-turns|--core-tools|--allowed-mcp-server-names|--exclude-tools|--output-format|stream-json|--approval-mode'
```

Нужно увидеть `--model`, `--extensions`, `--system-prompt`,
`--max-session-turns`, `--core-tools`, `--allowed-mcp-server-names`,
`--exclude-tools`, `--output-format`, `stream-json` и `--approval-mode`. Если
`--allowed-mcp-server-names` отсутствует, verifier должен остановить
установку: запускать роли без этого барьера нельзя.

Проверить установленную команду изоляции:

```text
!grep -n -- 'allowed-mcp-server-names\|allowed_mcp_servers' "$HOME/.gigacode/extensions/publish-drawio-skill/scripts/agent_runtime.py"
```

В коде должны присутствовать `"--allowed-mcp-server-names", ""` и evidence
`"allowed_mcp_servers": []`.

## 8. GigaCode: очистить каталог изолированной пробы

```text
!rm -rf "$PWD/.gigacode-probe"; mkdir -p "$PWD/.gigacode-probe"
```

## 9. GigaCode: найти существующий вход Reviewer

```text
!find "$PWD/.diagram-runs" -type f -name 'reviewer-audit-input.json' | tail -5
```

Если файлы не найдены, сначала выполните команду из раздела 10.

## 10. GigaCode: создать вход Reviewer, если его нет

```text
/drawio:review "/Users/travinov-sv/Documents/DrawioTest/microservices-istio-kafka.drawio"
```

## 11. GigaCode: запустить изолированного Reviewer на DeepSeek

```text
!EXT="$HOME/.gigacode/extensions/publish-drawio-skill"; PROBE="$PWD/.gigacode-probe"; IN="$(find "$PWD/.diagram-runs" -type f -name 'reviewer-audit-input.json' | tail -1)"; echo "INPUT=$IN"; if [ -z "$IN" ]; then echo 'ОШИБКА: reviewer-audit-input.json не найден'; else python3 "$EXT/scripts/agent_runtime.py" reviewer "$IN" --output "$PROBE/reviewer-output.json" --cli "$HOME/.gigacode/bin/gigacode" --cwd "$PWD" --timeout 600 > "$PROBE/invocation-result.json" 2> "$PROBE/invocation-error.txt"; RC=$?; echo "exit=$RC"; fi
```

Основная сессия остаётся на MiniMax; дочерний Reviewer должен запуститься
на `vllm/DeepSeek-V4-Flash-262k`.

## Проверка review, trace и перехода к improve без параметров

Сразу после `/drawio:review` из раздела 10 выполните:

```text
/drawio:trace
```

Read-only review записывает `workflow.json`, поэтому trace без `--run`
должен выбрать именно тот же свежий review. В `roles.reviewer` должно
быть `binding_proof.verified: true`. Если модель неверно переписала
`receipt_sha256`, Host привязывает итоговый verdict к проверенным входным
SHA и отражает ошибку модели в `binding_proof.declared_mismatches`, а не обрывает
review.

Затем выполните:

```text
/drawio:improve
```

Указывать `--diagram` и `--request` не нужно. В результате ожидаются
`command_resolution.diagram_selection: latest_completed_review`, ссылка на
`command_resolution.review_handoff` и
`command_resolution.request_source: default_review_findings_request`. Если файл был
изменён после review, старый handoff использоваться не должен.

Host отдельно записывает `supervisor_declared_roles`, `host_mandatory_roles` и
их эффективное объединение. Для initial improve в `role_policy.host_mandatory_roles`
ожидаются `repair`, `reviewer`, `semantic_analyst`, `supervisor`. Поэтому ответы
вида `required_roles: [repair, reviewer]` продолжаются через Semantic Analyst и не
завершаются ошибкой `omitted mandatory initial roles`.

## 12. GigaCode: показать фактические модели дочернего процесса

```text
!grep -oE '"model"[[:space:]]*:[[:space:]]*"[^"]+"' "$PWD/.gigacode-probe/runtime-output.jsonl" | sort -u
```

Ожидаемо: `"model": "vllm/DeepSeek-V4-Flash-262k"`.

## 13. GigaCode: показать результат, ошибку и runtime stderr

```text
!echo '=== RESULT ==='; sed -n '1,260p' "$PWD/.gigacode-probe/invocation-result.json"; echo '=== INVOCATION ERROR ==='; sed -n '1,200p' "$PWD/.gigacode-probe/invocation-error.txt"; echo '=== RUNTIME STDERR ==='; sed -n '1,200p' "$PWD/.gigacode-probe/runtime-stderr.txt"
```

При успехе нужны: `resolved_model` и `reported_model` с DeepSeek,
`model_proof.verified: true`, `isolation_proof.verified: true`, `tool_calls: 0` и
`binding_proof.verified: true`.

## 14. GigaCode: запустить новую полную мультиагентную цепочку

```text
/drawio:create "Создай тестовую диаграмму обработки заказа с проверкой оплаты, возвратом на исправление при ошибке, комплектацией, доставкой и завершением. Подпиши условия переходов и используй ортогональные соединения с waypoint."
```

Не возобновляйте старый run, у которого `checkpoint: null`.

## 15. GigaCode: проверить трассировку

```text
/drawio:trace
```

Корректны два исхода: Supervisor завершился на `GigaChat-3-Ultra`; или после
подтверждённого `FatalTurnLimitedError` был ровно один fallback на
`vllm/DeepSeek-V4-Flash-262k`.

Дополнительно проверить MCP-изоляцию последнего запуска:

```text
!RUN="$(ls -td "$PWD"/.diagram-runs/* 2>/dev/null | head -1)"; echo "RUN=$RUN"; grep -n '"allowed_mcp_servers": \[\]' "$RUN/run-manifest.jsonl"; if grep -R -n 'mcp__AtlassianBitbucket\|jira_get_issue' "$RUN"/roles/*/attempts/*/runtime-output.json* 2>/dev/null; then echo 'ОШИБКА: MCP попал в isolated runtime'; else echo 'OK: MCP tool calls отсутствуют'; fi
```

Нужны хотя бы события `role_started`/`role_finished` с `allowed_mcp_servers: []` и
строка `OK: MCP tool calls отсутствуюют`. Старый run без checkpoint после ошибки
Supervisor не возобновлять — запускать свежую `/drawio:review` или `/drawio:improve`.

## 16. GigaCode: найти последние артефакты

```text
!find "$PWD/.diagram-runs" -type f \( -name 'host-result.json' -o -name 'run-manifest.jsonl' -o -name 'runtime-output.jsonl' -o -name 'runtime-stderr.txt' \) -print | tail -30
```

## 17. Файлы для передачи на анализ

Из `.gigacode-probe`:

- `invocation-result.json`;
- `invocation-error.txt`;
- `runtime-output.jsonl`;
- `runtime-stderr.txt`.

Из нового `.diagram-runs/<run-id>`:

- `host-result.json`;
- `run-manifest.jsonl`;
- `workflow.json`;
- `roles/supervisor-initial/attempts/primary/runtime-output.jsonl`;
- `roles/supervisor-initial/attempts/fallback-1/runtime-output.jsonl`, если fallback был вызван.

`/stats model` показывает модель основной сессии и не является доказательством
модели дочернего процесса. Доказательство — поля `system.model` и
`assistant.message.model` в `runtime-output.jsonl`.
