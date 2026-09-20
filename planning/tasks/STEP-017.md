# STEP-017 — Принять ADR о безопасной границе write-invocation headless agent CLI

**Статус:** Выполнено
**Type:** ADR
**Приоритет:** Критический
**Фаза:** MVP — architecture reconciliation
**Depends on:** STEP-001, STEP-005

## Requirements

- REQ-005 — Terminal Integration должна безопасно передавать контекст агенту, показывать понятные ошибки и отменять выполнение без порчи состояния проекта.

## ADR

- ADR-008 — новый Accepted contract, superseding automatic write-flow ADR-006 и дополняющий ADR-004/ADR-007; исторический текст этих ADR не переписывается.

## Risk flags

- security-sensitive
- architecture
- external-integration
- concurrency

## Goal

Принять устойчивый контракт безопасного запуска headless agent CLI в write-mode: честная read-boundary, informed consent либо manual fallback, а также platform-specific containment и отмена всего дерева процессов.

## Context

Финальный независимый review STEP-009 (`planning/reviews/STEP-009/REVIEW-2026-09-19T1614Z.md`) установил, что Accepted ADR-006 описывает только workspace-wide write consent, а ADR-007 — automatic read-only invocation. Ни один из них не определяет допустимую read-boundary write-mode executor'а и не гарантирует containment процессов, которые создают новую POSIX session. Выбор между OS-level containment, явно расширенным informed consent и manual fallback является устойчивым архитектурным решением, а не implementation detail.

## Scope

- Проанализировать границы возможностей Codex CLI и Claude Code CLI в write-mode на POSIX и Windows; не считать временный context bundle filesystem sandbox.
- Сравнить как минимум OS-level containment, честный informed consent с раскрытием host-wide read risk и manual fallback; зафиксировать допустимые executor/platform combinations и fail-closed поведение для неподтверждённых.
- Определить contract process containment/cancellation для POSIX и Windows, включая detached descendants, unsupported platform behavior и проверяемые guarantees.
- Определить безопасный минимальный environment contract для executor'ов: сохранение документированных auth/provider/proxy/certificate variables без передачи произвольных секретов.
- Зафиксировать required handoff для corrective implementation: Git pre-consent execution, executor environment allowlist, output sanitization и Windows cancel regression из review STEP-009.
- Синхронизировать ADR index, architecture baseline, REQ-005 traceability, roadmap и status projections после принятия решения.

## Mutation policy

### Allowed

- Новый `docs/adr/ADR-008-*.md`, `docs/adr/README.md`, `docs/architecture.md`.
- `docs/requirements/SPEC.md`, `docs/requirements/STATUS.md`, `planning/tasks/STEP-017.md`, `planning/PLAN.md`, `planning/STATUS.md` — только traceability, decision и handoff.
- `docs/OPEN_QUESTIONS.md`, если требуется зафиксировать неустранимое platform limitation.

### Forbidden

- Изменения `src/**`, `tests/**`, CLI settings, package dependencies и production behavior.
- Изменение исторического текста ADR-004, ADR-006 или ADR-007; новый ADR должен ссылаться на них и при необходимости явно supersede только изменяемый контракт.
- Исправление findings STEP-009 внутри этого STEP.

## Out of scope

- Реализация containment, cancellation, Git hardening, environment allowlist или output redaction.
- Закрытие STEP-009 и изменение его review verdict.
- Выбор нового agent transport вместо ADR-004.

## Acceptance criteria

- Новый ADR имеет статус `Accepted`, сравнивает альтернативы и однозначно определяет write-mode read-boundary, consent/manual fallback и fail-closed cases.
- ADR описывает проверяемую модель containment/cancellation на POSIX и Windows либо явно ограничивает поддерживаемые platform combinations без ложной гарантии Ctrl+C.
- ADR определяет минимальный environment contract и запрет на логирование secret values.
- ADR содержит traceable corrective handoff для F-001..F-007 из `REVIEW-2026-09-19T1614Z.md`.
- ADR index, architecture baseline, REQ-005 traceability и planning projections согласованы; production code не изменён.

## Verification

- `python3 tools/harness/validate.py --mode commit` — PASS.
- `git diff --check` — без пробельных ошибок.
- Ручная consistency-проверка: все ссылки REQ/ADR/STEP существуют; ADR-004/006/007 и новый ADR не оставляют противоречивых активных boundary contracts; diff не содержит `src/**` или `tests/**`.

## Deliverables

- Новый Accepted ADR о write-invocation boundary.
- Синхронизированные architecture/ADR/REQ/planning projections.
- Явный handoff для отдельного corrective STEP, устраняющего findings STEP-009.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 1
**Planned at:** 2026-09-19T16:27:15+00:00
**Plan basis:** sha256:1ff263232ac0dff05226a359fb15f7868eca70602a157291d76640a627d30af3

### Основание решения

- Подтвердить по действующим contracts и официальной документации, что
  `workspace-write`/`acceptEdits` ограничивают запись или approval, но сами не
  доказывают path-scoped чтение; `cwd` и context bundle также не являются
  filesystem containment. Поэтому не выдавать automatic headless write-mode
  ни Codex CLI, ни Claude Code CLI на POSIX или native Windows, пока отдельный
  executor не докажет оба свойства: ограниченное чтение и уничтожение всего
  дерева процессов.
- Принять manual fallback как единственный допустимый путь write-invocation
  для текущих executor/platform combinations. Он показывает пользователю
  canonical command и инструкцию запуска, не порождает дочерний write-процесс
  Extension Host и не подменяет informed consent технической изоляцией.

### Порядок работы

1. Создать `ADR-008` со статусом `Accepted`: отделить неизменяемый transport
   ADR-004 от заменяемой write-boundary, явно supersede write-часть ADR-006 и
   дополнить ADR-007. Сравнить OS-level containment, informed consent и manual
   fallback; зафиксировать разрешённые комбинации executor/platform и
   fail-closed ответ при отсутствии подтверждённого containment.
2. В ADR описать contract cancellation: process-group kill и `taskkill` не
   являются гарантией для detached descendants; automatic write возможен в
   будущем лишь с supervisor/OS primitive, доказательно уничтожающим дерево
   (POSIX и Windows отдельно). Для нынешнего manual fallback расширение не
   заявляет Ctrl+C-гарантию над процессом, которым не владеет.
3. Зафиксировать минимальный environment contract для будущих executor'ов:
   per-executor allowlist имён документированных auth/provider/proxy/CA и
   platform home variables, с очисткой прочих inherited secrets; значения не
   попадают в prompt, Output Channel, notifications, ошибки или evidence.
4. Перенести F-001..F-007 последнего review STEP-009 в traceable corrective
   handoff: Git pre-consent safe config, write boundary/manual fallback,
   закрытие F-003 отсутствием automatic write-spawn, environment allowlist,
   единая sanitization, Windows manual-fallback regression и удаление
   out-of-scope runtime config mutation. Containment detached descendants и
   platform regressions принадлежат только будущему ADR, который вернёт
   automatic write. Не менять implementation STEP-009 этим ADR.
5. Синхронизировать index ADR, architecture boundary, REQ-005 traceability и
   planning projections. В STEP-017 записать только фактические verification
   results и не переводить REQ-005 в выполненное состояние.

### Проверка и риски

- Проверить, что historical text ADR-004/ADR-006/ADR-007 не редактируется и
  новый ADR явно снимает противоречие между их активными write contracts.
- Выполнить `python3 tools/harness/validate.py --mode commit`,
  `git diff --check` и проверить diff: только разрешённые documentation/planning
  файлы STEP-017, без `src/**`, `tests/**`, dependencies и settings.
- Риск совместимости: автоматический write flow перестаёт быть доступным до
  отдельного будущего ADR с подтверждённым containment. Это intentional
  fail-closed ограничение; текущий `STEP FIX STEP-009` реализует только
  manual fallback и не возвращает automatic write.

## Evidence

- Создан `docs/adr/ADR-008-headless-agent-write-boundary.md`: current Codex/Claude
  write-mode на POSIX/native Windows fail-closed переводится в manual fallback,
  пока отдельный executor не докажет scoped read и process-tree containment.
- Official documentation checked 2026-09-19: Codex `workspace-write` описывает
  workspace-limited write, а не path-scoped read; Claude Code прямо указывает,
  что native Windows sandboxing не поддерживается. Источники: OpenAI Codex
  agent approvals/security и Claude Code Advanced setup.
- Handoff F-001..F-007 из `REVIEW-2026-09-19T1614Z.md` зафиксирован в ADR-008;
  production code, tests, dependencies и CLI settings этим STEP не изменялись.
- `python3 tools/harness/validate.py --mode commit` — exit code 0, `HARNESS
  VALIDATION: PASS` (309 tracked files; предупреждение только об отсутствии
  staged files).
- `git diff --check` — exit code 0, пробельных ошибок нет. Ручная
  consistency-проверка подтвердила существование REQ-005, ADR-004/006/007/008,
  STEP-009/017 и отсутствие изменений `src/**`/`tests/**` от STEP-017.
- Первый независимый review `planning/reviews/STEP-017/REVIEW-2026-09-19T1633Z.md`
  дал FAIL (F-001..F-003): исправлены индекс active contract, однозначный
  manual-fallback handoff F-003 и architecture/status projections; старый
  report не изменялся.
- Повторный независимый review `planning/reviews/STEP-017/REVIEW-2026-09-19T1638Z.md`
  дал FAIL: уточнено, что current `STEP FIX STEP-009` закрывает F-003 только
  отсутствием automatic write-spawn; containment принадлежит будущему ADR.
- Третий независимый review `planning/reviews/STEP-017/REVIEW-2026-09-19T1641Z.md`
  — PASS: все findings закрыты, новых findings нет.

## Review status

PASS — `planning/reviews/STEP-017/REVIEW-2026-09-19T1641Z.md` после двух
документальных FIX-проходов. Предыдущие immutable reports сохранены:
`REVIEW-2026-09-19T1633Z.md` и `REVIEW-2026-09-19T1638Z.md`.
