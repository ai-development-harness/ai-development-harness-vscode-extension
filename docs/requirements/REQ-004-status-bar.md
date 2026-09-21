# REQ-004 — Status Bar с состоянием проекта

**Приоритет:** Средний
**Источник:** brief

## Requirement

Status bar показывает: статус инициализации проекта, процент завершения roadmap,
рекомендуемую следующую команду и количество health-warnings. В MVP warnings —
это Error/Warning diagnostics внутри manifest-resolved task directory; Info/Hint и
diagnostics вне него не учитываются. Клик по элементам открывает manifest,
manifest-resolved STATUS.md или VS Code Problems panel соответственно, либо
выполняет предложенную команду. Обновления файлов, manifest и diagnostics
батчатся и не выполняются на каждое нажатие клавиши.

Health Dashboard не является действием этого MVP: он остаётся отдельным
отложенным REQ-008.

## Rationale

Пользователю нужен постоянно видимый индикатор состояния проекта без необходимости открывать STATUS.md вручную.

## Acceptance

- Элементы видны и корректно отражают текущее состояние манифеста/roadmap.
- Warnings-count корректно фильтрует diagnostics по severity и
  manifest-resolved task directory.
- Обновление происходит не чаще раза в секунду и не блокирует редактор.
- Клик по каждому элементу выполняет заявленное MVP-действие.

## Traceability

- STEP: STEP-008
- ADR: не требуется
