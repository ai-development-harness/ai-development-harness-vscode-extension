# ADR-001 — Архитектура editor fixture

**Status:** Accepted
**Date:** 2026-09-20
**Deciders:** tests
**Supersedes:** —
**Superseded by:** —

## Context

Fixture для проверки CompletionItem в реальном Extension Development Host.

## Problem

Нужно отделить вставляемый ADR ID от отображаемого описания.

## Decision

CompletionItem вставляет только ID, а описание хранит в documentation.

## Alternatives considered

—

## Consequences

Проверка использует публичный VSCode completion API.

## Security implications

Не применимо.

## Data / migration implications

Не применимо.

## Compatibility / operational implications

Не применимо.

## Traceability

- REQ: —
- STEP: STEP-007
