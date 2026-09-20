import commandTransitions from '../../.project/command-transitions.json';
import type { StepData } from '../parser/types';

type InputKind = 'none' | 'optional' | 'required';
type Effect = 'read-only' | 'filesystem-write' | 'remote-mutation';

interface TransitionCommand {
  readonly chainAllowed: boolean;
  readonly target: 'none' | 'step' | 'release-optional';
  readonly input: InputKind;
}

interface TransitionDomain {
  readonly chainEnabled: boolean;
  readonly continuationAliases?: Readonly<Record<string, string>>;
  readonly commands: Readonly<Record<string, TransitionCommand>>;
  readonly transitions: readonly { readonly from: string; readonly to: string }[];
}

export interface CanonicalCommandMetadata {
  readonly command: string;
  readonly family: string;
  readonly input: InputKind;
  readonly hasFreeText: boolean;
  readonly target?: string;
}

export interface WriteInvocationPolicy {
  readonly command: string;
  readonly effect: Effect;
  readonly requiresWrite: boolean;
  readonly allowedPaths: readonly string[];
}

const effects: Readonly<Record<string, Effect>> = {
  'PROJECT:INIT': 'filesystem-write',
  'PROJECT:STATUS': 'read-only',
  'PROJECT:RECONCILE': 'filesystem-write',
  'PROJECT:QUICK FIX': 'filesystem-write',
  'STEP:ADD': 'filesystem-write',
  'STEP:NEXT': 'read-only',
  'STEP:PLAN': 'filesystem-write',
  'STEP:IMPLEMENT': 'filesystem-write',
  'STEP:REVIEW': 'filesystem-write',
  'STEP:FIX': 'filesystem-write',
  'STEP:RUN': 'filesystem-write',
  'STEP:AUDIT': 'filesystem-write',
  'SKILL:FIND': 'filesystem-write',
  'SKILL:INSTALL': 'filesystem-write',
  'SKILL:CREATE': 'filesystem-write',
  'GITHUB:GENERATE TEMPLATES': 'filesystem-write',
  'RELEASE:CHECK': 'read-only',
  'HARNESS:UPDATE CHECK': 'read-only',
  'HARNESS:UPDATE APPLY': 'filesystem-write',
  'GIT:CHECK': 'read-only',
  'GIT:COMMIT': 'filesystem-write',
  'GIT:PUSH': 'remote-mutation',
  'GIT:PR': 'remote-mutation',
  'GIT:SYNC': 'remote-mutation',
};

const table = commandTransitions as {
  readonly chainSeparator: string;
  readonly domains: Readonly<Record<string, TransitionDomain>>;
};

// Release target попадает в exact manual handoff, поэтому допускаем только
// переносимый безопасный идентификатор release tag. Это не shell-escaping:
// control/format bytes и пробелы отклоняются до любого UI sink (F-001 review
// STEP-009), а literal `TO` восстанавливается из структурированных tokens.
const safeReleaseTarget = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function hasMeaningfulText(value: string): boolean {
  return Boolean(value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').trim());
}

/**
 * Разбирает bundled CTS для handoff без второй таблицы syntax в Extension Host.
 * Metadata остаётся внутренней: raw text нужен только для валидации и не должен
 * передаваться в Output Channel или notification (ADR-011).
 */
export function canonicalCommandMetadata(value: string): CanonicalCommandMetadata | undefined {
  const segments = value.trim().split(table.chainSeparator).map((item) => item.trim());
  if (!segments.length || segments.some((item) => !item)) return undefined;
  let domainName: string | undefined;
  let inheritedTarget: string | undefined;
  let containsFreeText = false;
  const canonicalSegments: string[] = [];
  const parsed: Array<{ operation: string; family: string; input: InputKind; chainAllowed: boolean; target?: string }> = [];

  for (const [index, raw] of segments.entries()) {
    const explicitDomain = Object.keys(table.domains).find((name) => raw === name || raw.startsWith(`${name} `));
    if (index === 0 && !explicitDomain) return undefined;
    if (explicitDomain && domainName && explicitDomain !== domainName) return undefined;
    domainName ??= explicitDomain;
    if (!domainName) return undefined;
    const domain = table.domains[domainName];
    const remainder = explicitDomain ? raw.slice(explicitDomain.length).trim() : raw;
    // Continuation aliases (например, `APPLY`) допустимы только после первого
    // segment. Иначе Extension Host расходится с authoritative CTS validator.
    const operationNames = index === 0
      ? Object.keys(domain.commands)
      : [...Object.keys(domain.commands), ...Object.keys(domain.continuationAliases ?? {})];
    const operationName = operationNames
      .sort((left, right) => right.length - left.length)
      .find((operation) => remainder === operation || remainder.startsWith(`${operation} `) || remainder.startsWith(`${operation}:`));
    if (!operationName) return undefined;
    const operation = domain.commands[operationName] ? operationName : domain.continuationAliases?.[operationName];
    if (!operation) return undefined;
    const spec = domain.commands[operation];
    let rest = remainder.slice(operationName.length).trim();
    let target: string | undefined;
    if (spec.target === 'step') {
      const match = rest.match(/^(STEP-\d{3,})(?:\s+(.*))?$/);
      if (match) {
        target = match[1];
        rest = match[2] ?? '';
      } else target = inheritedTarget;
      if (!target) return undefined;
    } else if (spec.target === 'release-optional') {
      if (rest) {
        const match = rest.match(/^TO\s+(\S+)$/);
        if (!match || !safeReleaseTarget.test(match[1])) return undefined;
        target = match[1];
        rest = '';
      } else target = inheritedTarget;
    }
    if (inheritedTarget && target && inheritedTarget !== target) return undefined;
    if (target) {
      if (index > 0 && !inheritedTarget) return undefined;
      inheritedTarget ??= target;
    }
    const inputText = rest.startsWith(':') ? rest.slice(1) : '';
    if (spec.input === 'none' && rest) return undefined;
    if (spec.input === 'required' && (!rest.startsWith(':') || !hasMeaningfulText(inputText))) return undefined;
    if (spec.input === 'optional' && rest && (!rest.startsWith(':') || !hasMeaningfulText(inputText))) return undefined;
    const hasFreeText = rest.startsWith(':');
    containsFreeText ||= hasFreeText;
    // Exact label строится только из normalized CTS tokens. Raw input остаётся
    // локальным для parsing и никогда не возвращается в handoff metadata.
    const normalizedTarget = target
      ? spec.target === 'release-optional' ? ` TO ${target}` : ` ${target}`
      : '';
    canonicalSegments.push(`${domainName} ${operation}${normalizedTarget}`);
    parsed.push({ operation, family: `${domainName} ${operation}`, input: spec.input, chainAllowed: spec.chainAllowed, target });
  }
  if (parsed.length > 1) {
    const domain = table.domains[domainName!];
    if (!domain.chainEnabled || !parsed.every((item) => item.chainAllowed)
      || !parsed.slice(1).every((item, index) => domain.transitions.some((edge) => edge.from === parsed[index].operation && edge.to === item.operation))) return undefined;
  }
  const first = parsed[0];
  return {
    command: canonicalSegments.join(table.chainSeparator),
    family: parsed.map((item) => item.family).join(table.chainSeparator),
    // Для label важен aggregate signal. `input` остаётся совместимым с
    // одиночными командами и не участвует в разрешении raw free text.
    input: parsed.length === 1 ? first.input : containsFreeText ? 'required' : 'none',
    hasFreeText: containsFreeText,
    target: first.target,
  };
}

export function isCanonicalCommand(command: string): boolean {
  return canonicalCommandMetadata(command) !== undefined;
}

/** CTS operation без effect contract не получает даже read-only classification. */
export function writeInvocationPolicy(command: string, targetStep?: StepData): WriteInvocationPolicy | undefined {
  const metadata = canonicalCommandMetadata(command);
  if (!metadata) return undefined;
  const families = metadata.family.split(table.chainSeparator);
  const policyEffects = families.map((family) => effects[family.replace(' ', ':')]);
  // Новые CTS operation не должны неявно превращаться в read-only handoff.
  if (policyEffects.some((effect) => !effect)) return undefined;
  const effect = policyEffects.reduce<Effect>((strongest, candidate) => {
    if (candidate === 'remote-mutation' || (candidate === 'filesystem-write' && strongest === 'read-only')) return candidate;
    return strongest;
  }, 'read-only');
  if (metadata.target && families.some((family) => family.startsWith('STEP '))) {
    const allowedPaths = targetStep?.mutationPolicy?.allowed;
    if (effect !== 'read-only' && (!targetStep || !Array.isArray(allowedPaths) || allowedPaths.length === 0)) return undefined;
    return { command, effect, requiresWrite: effect !== 'read-only', allowedPaths: allowedPaths ?? [] };
  }
  return {
    command,
    effect,
    requiresWrite: effect !== 'read-only',
    allowedPaths: effect === 'filesystem-write' ? ['project-managed artifacts'] : [],
  };
}

export function requiresWriteAccess(command: string, targetStep?: StepData): boolean | undefined {
  return writeInvocationPolicy(command, targetStep)?.requiresWrite;
}
