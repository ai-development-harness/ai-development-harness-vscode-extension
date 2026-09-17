import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readHarnessConfig, resolveLanguage, translate, writeHarnessConfig } from '../../../src/locales/i18n';
import ruDictionary from '../../../src/locales/ru.json';
import enDictionary from '../../../src/locales/en.json';

describe('resolveLanguage', () => {
  it('предпочитает сохранённый язык автоопределению', () => {
    expect(resolveLanguage('ru-RU', 'en')).toBe('en');
  });

  it.each(['en', 'en-US'])('автоопределяет %s как en без сохранённого языка', (envLanguage) => {
    expect(resolveLanguage(envLanguage, undefined)).toBe('en');
  });

  it.each(['ru', 'de', 'fr', ''])('автоопределяет %p как ru (default) без сохранённого языка', (envLanguage) => {
    expect(resolveLanguage(envLanguage, undefined)).toBe('ru');
  });
});

describe('translate', () => {
  const dictionaries = {
    ru: { onlyRu: 'только RU', shared: 'общий (ru)' },
    en: { shared: 'shared (en)' },
  };

  it('возвращает точное совпадение для запрошенного языка', () => {
    expect(translate(dictionaries, 'en', 'shared')).toBe('shared (en)');
  });

  it('отсутствующий ключ на EN возвращает RU без исключения', () => {
    expect(translate(dictionaries, 'en', 'onlyRu')).toBe('только RU');
  });

  it('отсутствующий ключ на RU (и везде) возвращает сам ключ без исключения', () => {
    expect(translate(dictionaries, 'ru', 'missingEverywhere')).toBe('missingEverywhere');
  });

  it('отсутствующий ключ на EN и на RU возвращает сам ключ без исключения', () => {
    expect(translate(dictionaries, 'en', 'missingEverywhere')).toBe('missingEverywhere');
  });

  it('FIX STEP-004 (F-001): подставляет params в шаблон с {placeholder}', () => {
    const withPlaceholders = {
      ru: { greeting: 'Привет, {name}! Файл: {path}' },
      en: {},
    };
    expect(translate(withPlaceholders, 'ru', 'greeting', { name: 'Мир', path: 'a.json' })).toBe(
      'Привет, Мир! Файл: a.json'
    );
  });

  it('FIX STEP-004 (F-001): недостающий параметр оставляет плейсхолдер как есть, без исключения', () => {
    const withPlaceholders = { ru: { greeting: 'Привет, {name}!' }, en: {} };
    expect(translate(withPlaceholders, 'ru', 'greeting', {})).toBe('Привет, {name}!');
  });
});

describe('readHarnessConfig / writeHarnessConfig', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'harness-config-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('отсутствующий файл — не ошибка, ok({})', async () => {
    const result = await readHarnessConfig(join(dir, 'missing.json'));
    expect(result).toEqual({ ok: true, value: {} });
  });

  it('round-trip: записанное значение читается обратно', async () => {
    const configPath = join(dir, '.project', 'harness-config.json');
    const written = await writeHarnessConfig(configPath, { language: 'en' });
    expect(written.ok).toBe(true);

    const read = await readHarnessConfig(configPath);
    expect(read).toEqual({ ok: true, value: { language: 'en' } });
  });

  it('повреждённый JSON — явная ошибка значением, не исключение', async () => {
    const configPath = join(dir, 'broken.json');
    await writeFile(configPath, '{ не json', 'utf8');

    const result = await readHarnessConfig(configPath);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-json');
    }
  });

  it.each([
    ['массив', '[1,2,3]'],
    ['строка', '"just a string"'],
    ['число', '42'],
    ['null', 'null'],
  ])('валидный JSON, но не объект (%s) — деградация до ok({}), без исключения', async (_label, raw) => {
    const configPath = join(dir, 'not-object.json');
    await writeFile(configPath, raw, 'utf8');

    const result = await readHarnessConfig(configPath);
    expect(result).toEqual({ ok: true, value: {} });
  });

  it('объект без language (или с невалидным значением) сохраняет остальные поля', async () => {
    const configPath = join(dir, 'no-language.json');
    await writeFile(configPath, JSON.stringify({ futureField: 'keepme', language: 'fr' }), 'utf8');

    const result = await readHarnessConfig(configPath);
    expect(result).toEqual({ ok: true, value: { futureField: 'keepme' } });
  });

  it('FIX STEP-004 (F-001 обоих ревьюеров): неизвестные поля переживают цикл read→merge→write', async () => {
    const configPath = join(dir, '.project', 'harness-config.json');
    await mkdir(join(dir, '.project'), { recursive: true });
    await writeFile(configPath, JSON.stringify({ language: 'ru', futureField: 'keepme' }), 'utf8');

    // Ровно та же последовательность, что `activation.ts → setLanguage` использует
    // при `harness.changeLanguage`.
    const existing = await readHarnessConfig(configPath);
    expect(existing.ok).toBe(true);
    const base = existing.ok ? existing.value : {};
    await writeHarnessConfig(configPath, { ...base, language: 'en' });

    const after = await readHarnessConfig(configPath);
    expect(after).toEqual({ ok: true, value: { language: 'en', futureField: 'keepme' } });
  });

  it('ошибка записи (директория назначения — на самом деле файл) — явная ошибка значением, не исключение', async () => {
    const blockingFile = join(dir, 'blocked');
    await writeFile(blockingFile, 'не директория', 'utf8');
    const configPath = join(blockingFile, 'harness-config.json');

    const result = await writeHarnessConfig(configPath, { language: 'en' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('write-failed');
    }
  });
});

describe('реальные словари src/locales/{ru,en}.json', () => {
  it('содержат все demonstration-ключи и совпадают по набору ключей', () => {
    const expectedKeys = [
      'harness.language.ru.label',
      'harness.language.en.label',
      'harness.command.changeLanguage.prompt',
      'harness.config.readError',
      'harness.config.writeError',
    ];

    for (const key of expectedKeys) {
      expect(Object.prototype.hasOwnProperty.call(ruDictionary, key)).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(enDictionary, key)).toBe(true);
    }

    expect(Object.keys(ruDictionary).sort()).toEqual(Object.keys(enDictionary).sort());
  });
});
