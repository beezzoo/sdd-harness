# sdd-harness

Обвязка для Claude Code вокруг **spec-driven development**: источник правды —
[OpenSpec](https://github.com/Fission-AI/OpenSpec), а вокруг него собраны
лучшие куски [ECC](https://github.com/affaan-m/ECC) — ревьюеры, TDD,
verification loop, оценка размера задачи и «ворота» для человека.

Принцип: **OpenSpec-change — это и есть план.** Никаких параллельных PRD и
`.claude/plans/`. Обвязка не заменяет `/opsx:*`, а выстраивает вокруг них
процесс и проверки.

## Процесс

```
запрос
  │
  ▼
sdd-workflow: оценка размера ──► trivial ──► правка → быстрые проверки
  │                          └─► small   ──► падающий тест → фикс → code-reviewer
  ▼ standard / large
(/opsx:explore)  ← только для large
/opsx:propose  → openspec validate --strict
  │
  ▼  GATE 1: человек одобряет proposal + delta-specs + tasks
/opsx:apply    → tdd-from-scenarios: каждый #### Scenario → красный тест → код
  │
  ▼
code-reviewer (+ security-reviewer)
  │
  ▼
/sdd-verify    → verification-loop + spec-verifier → READY TO ARCHIVE?
  │
  ▼  GATE 2: человек подтверждает
/opsx:archive  → коммит
```

## Что внутри

| Компонент | Откуда | Что делает |
|---|---|---|
| `skills/sdd-workflow` | новое (идеи из ECC `orch-pipeline`) | Классификация trivial/small/standard/large, маршрут, два гейта, правила дрейфа спек |
| `skills/tdd-from-scenarios` | новое (по мотивам ECC `tdd-workflow`) | Scenario → тест с trace-комментарием `spec: cap/Req/Scenario` → код |
| `skills/verification-loop` | ECC, переписан под любой стек | build / types / lint / tests / secrets / diff / `openspec validate` |
| `agents/spec-verifier` | новое | Сверяет change с кодом: каждый сценарий покрыт запущенным тестом, REMOVED удалено, tasks честные |
| `agents/code-reviewer` | ECC, сокращён + учитывает активный change | Только находки с цитатой строки и сценарием отказа; ноль находок — норм |
| `agents/security-reviewer` | ECC, без привязки к npm | OWASP-чеклист по диффу |
| `agents/spec-miner` | ECC, формат исправлен под `openspec validate --strict` | Достаёт baseline-спеки из существующего кода, по одной capability |
| `commands/sdd-init` | новое | Ставит/инициализирует OpenSpec, кладёт конфиг, предлагает spec-miner |
| `commands/sdd-verify` | новое | Gate 2: verification-loop + spec-verifier + ревью → вердикт |
| `hooks` SessionStart | новое | В начале/после compact сообщает активные changes и прогресс задач |
| `hooks` PreToolUse guard | паттерн GateGuard из ECC | Нет активного change → первая правка кода блокируется, чтобы модель оценила размер задачи |
| `templates/openspec/config.yaml` | новое | `context`, `rules` по артефактам, `operations.apply/archive.guidance` |

Из ECC сознательно **не** взято: сотни скиллов и языковых правил, PRD/PRP/epic-команды
(дублируют OpenSpec), continuous-learning/instincts, тяжёлый hook-runtime.

## Установка

Нужны Node.js ≥ 20 и Claude Code.

```bash
# 1. OpenSpec CLI
npm install -g @fission-ai/openspec@latest

# 2. Плагин (внутри Claude Code)
/plugin marketplace add beezzoo/sdd-harness
/plugin install sdd-harness@sdd-harness

# 3. В проекте
/sdd-init                 # или /sdd-init <capability> чтобы сразу смайнить спеку
```

Локально из клона: `/plugin marketplace add /path/to/sdd-harness`.

## Настройка guard-хука

Переменная окружения `SDD_GUARD` (например в `settings.json` → `env`):

| Значение | Поведение |
|---|---|
| `nudge` (по умолчанию) | Без активного change первая правка исходника за сессию отклоняется с объяснением; повтор разрешён |
| `strict` | Правки исходников запрещены, пока нет активного change |
| `off` | Хук выключен |

Не трогает: проекты без `openspec/`, файлы в `openspec/`, `.claude/`, `.git/`,
Markdown/текст и всё вне проекта. Любая ошибка внутри хука → правка разрешается.

## Ежедневное использование

| Хочу | Делаю |
|---|---|
| Подумать над идеей | `/opsx:explore` |
| Новая фича / изменение поведения | `/opsx:propose <name>` → одобрить → `/opsx:apply` |
| Проверить, готово ли | `/sdd-verify` |
| Закрыть | `/opsx:archive` (после подтверждения) |
| Подключить старый проект | `/sdd-init`, затем `spec-miner` по одной области |
| Мелкий фикс | просто попросить — `sdd-workflow` оценит как trivial/small |

## Разработка

```bash
npm test                       # тесты хуков (node:test, без зависимостей)
claude plugin validate .       # проверка манифестов
```

## Лицензия

MIT. Адаптированные части ECC и OpenSpec — MIT, см. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
