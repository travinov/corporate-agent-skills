# BPMN Intake

Ask only questions that materially affect the process semantics.

## Human Input Rule

If a question is material enough to ask, stop and wait for the user's answer. Do not answer your own question in the same turn.

Do not:

- ask "which process/participants/type?" and then immediately choose a default;
- provide multiple-choice options and immediately select one;
- write `process.yaml`, create directories, or run `corp-bpmn` after asking a material question;
- say "if no clarifications, I will..." and continue without a reply.

Allowed:

- If the missing detail is not material, do not ask. Make a conservative assumption and record it in `documentation.assumptions`.
- If the missing detail is material, ask one concise question with 2-4 concrete options plus "other/free-form", then end the turn.

Bad pattern:

```text
Есть ли уточнения по процессу? Кто будет пить? Какой тип кофе? Если без уточнений,
сделаю классический процесс "кофе в турке".
Пишу process.yaml.
```

Good pattern:

```text
Нужно уточнить тип процесса, потому что он меняет BPMN-шаги.
Варианты: 1) турка, 2) фильтр, 3) эспрессо, 4) другое.
Какой вариант выбрать?
```

Then stop.

Extract:

- process goal and boundary;
- start trigger and end states;
- participants, roles, responsibility partitions, and systems;
- process variants such as methods, outcomes, product options, and scenarios;
- happy path;
- decisions and branch labels;
- exceptions, rework, rejection, timeout, error paths;
- messages between independent participants;
- data/documents used or produced;
- target engine, if execution matters.

Before choosing lanes, classify each proposed grouping:

- If it answers **who or what is responsible?**, it may be a lane: actor, role, system, department, tool, or another stable responsibility partition.
- If it answers **which method, option, outcome, or scenario applies?**, it is normally a gateway branch, subprocess, or documented variant rather than a lane.

For example, V60, French press, and espresso are preparation variants and normally become labeled outgoing branches of one exclusive gateway. Barista and coffee machine are responsibility partitions and may justify lanes when their work must be separated.

If the request uses ambiguous wording such as "split by type", ask only when the distinction changes the process semantics: "Are these alternatives within one responsibility, or is each performed by a different role/system?" Then stop and wait under the Human Input Rule.

Before choosing schema v2, establish ownership explicitly: which participant owns each internal process, and which messages cross between them. If multiple pools are requested but activities cannot be assigned to distinct processes, ask one ownership question and stop. Do not put several pools around one v1 process.

If enough information is present, proceed with conservative assumptions and record them in `process.md`. Do this instead of asking low-value questions.

Default to a simple model: events, tasks, exclusive gateways, lanes, and sequence flows. Escalate only for semantic reasons: true inter-process messages, timer/error behavior bound to a task, reusable subprocesses, compensation, transactions, or explicit user request.
