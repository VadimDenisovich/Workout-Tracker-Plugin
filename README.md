# Workout Tracker для Obsidian# Workout Tracker Plugin for Obsidian



Плагин помогает вести тренировочные записи прямо в Obsidian: создаёт логи по шаблонам, ведёт библиотеку упражнений, визуализирует прогресс и автоматизирует обслуживание структуры папок.Smart workout journaling for Obsidian: create structured training logs, maintain an exercise library with progress tracking, and manage templates without leaving your vault.



## 🗺️ Краткий обзор## ✨ Key features



- Лог тренировки в один клик с автоматическим выбором шаблона (понедельник, среда, пятница или домашняя тренировка).- **One-click workout logs** – Ribbon button and command palette entry create a daily log using the right template for Monday, Wednesday, or Friday. If a log for today already exists, the plugin opens it instead and shows a notice that you were redirected.

- Модальное окно со списком упражнений, поиском и кнопкой добавления в виде контрастного «+» в закруглённом квадратике.- **Home vs gym workflows** – Before creating a log you choose the training location (home or gym). Home workouts use a dedicated template and produce files like `2025-10-03-Home.md`.

- Автоматическое создание и поддержка структуры `Logs/`, `Exercises/`, `Templates/` в выбранной папке.- **Template auto-detection & overrides** – Default templates for Monday, Wednesday, Friday, and Home live in `Templates`. Editing any of those `.md` files instantly updates the in-code template used on the next log creation.

- Синхронизация шаблонов: изменения Markdown-файлов Monday/Wednesday/Friday/Home автоматически сохраняются в коде.- **Exercise library modal** – A floating modal lists all exercises from `Exercises/`. Clicking an exercise opens its note; the minus icon deletes the underlying file and removes it from the list.

- Dataview-шаблоны для карточек упражнений с графиками и таблицами (весовые и безвесовые варианты).- **Dataview-ready exercise notes** – New exercise files are scaffolded with a Dataview table and chart that aggregate data from `Logs/`.

- Настройки диапазона графиков повторений, кнопка «Обновить структуру» и автообновление карточек упражнений при открытии.- **Folder management & migration** – The plugin keeps track of the previous workout folder. When you change the folder in settings it moves the whole structure (`Exercises`, `Logs`, `Templates`) instead of recreating it.

- **Nested folder picker** – Settings show a read-only input. Clicking it opens a dialog where you navigate existing folders step-by-step, with an option to create a new one at any level.

## 🚀 Как развернуть плагин в своём хранилище

## 📁 Folder structure

### Вариант 1. Использовать готовую сборку

1. Скачайте архив релиза с GitHub (файлы `main.js`, `manifest.json`, `styles.css`).When the plugin runs for the first time (or when you choose a new location) it ensures this structure exists inside your selected workout folder:

2. Создайте папку `<ваше_хранилище>/.obsidian/plugins/workout-tracker/` (или переименуйте как нужно, но сохраните `id` в `manifest.json`).

3. Скопируйте файлы `main.js`, `manifest.json`, `styles.css` в созданную папку.- `Exercises/` – individual exercise notes with Dataview templates.

4. В Obsidian откройте **Settings → Community plugins**, отключите **Restricted mode** (если включён), включите **Workout Tracker**.- `Logs/` – daily workout logs (gym and home).

- `Templates/` – editable Markdown templates (`Monday.md`, `Wednesday.md`, `Friday.md`, `Home.md`).

### Вариант 2. Собрать из исходников

1. Склонируйте репозиторий в папку плагинов:If you move the workout folder in settings, the plugin migrates the whole structure—including existing files—to the new location.

   ```bash

   cd /path/to/your/vault/.obsidian/plugins## 🧭 Using the plugin

   git clone https://github.com/VadimDenisovich/Workout-Tracker-Plugin.git workout-tracker

   cd workout-tracker1. **Create a workout log**

   ```   - Click the calendar ribbon icon or run the `Создать лог тренировки` command.

2. Установите зависимости:   - Choose the location (home or gym). Gym sessions on non-training days prompt you to pick a template manually.

   ```bash   - The plugin writes the log to `Logs/` using the appropriate template and opens the note. You’ll see a notice if you are redirected to an existing file.

   npm install

   ```2. **Browse exercises**

3. Выполните production-сборку:   - Click the dumbbell ribbon icon or run the `Открыть упражнения` command.

   ```bash   - A modal pops up listing exercises. Select one to open its note. Hit the minus icon to delete it from disk and the list.

   npm run build   - When you create a new exercise note (e.g., from within the modal) it includes embedded Dataview queries and charts pointing to your workout logs.

   ```

4. Убедитесь, что в папке плагина находятся `main.js`, `manifest.json`, `styles.css`, затем включите плагин в настройках Obsidian.3. **Edit templates**

   - Open any file in `Templates/` and modify it directly. The plugin captures the new content and uses it for future logs.

### Режим разработки (watch)   - Resetting a template back to its default removes the override automatically.

```bash

npm run dev## ⚙️ Settings

```

Команда запускает esbuild в режиме наблюдения. Перезагружайте Obsidian (Cmd/Ctrl + R), чтобы увидеть изменения.- **Workout folder selector** – Click the input to navigate through existing folders. Each level shows subfolders plus a `+ создать свою` option. Choosing a folder updates the plugin immediately.

- The plugin silently stores the previous folder path to support migrations and ensures the target folder has the expected substructure.

## 🧰 Требования

- Obsidian v0.15.0 или выше.## 🚀 Installation

- Установленный плагин **Dataview** (используется во всех шаблонах статистики).

- Node.js LTS (18+) и npm — только для разработки.### From source



## 🗂️ Автоматическая структура```bash

При первом запуске или смене рабочей папки плагин автоматически создаёт/переносит структуру:git clone https://github.com/VadimDenisovich/Workout-Tracker-Plugin.git

- `Logs/` — логи тренировок (зал и дом). Домашние логи именуются по шаблону `YYYY-MM-DD-Home.md`.cd Workout-Tracker-Plugin

- `Exercises/` — карточки упражнений с dataviewjs-статистикой.npm install

- `Templates/` — шаблоны `Monday.md`, `Wednesday.md`, `Friday.md`, `Home.md`.npm run build

```

Путь к папке можно изменить в настройках. Плагин сохраняет прошлое расположение и переносит всю структуру в новую папку, не создавая дубликаты. Кнопка «Обновить структуру» принудительно повторяет миграцию.

Copy `main.js`, `manifest.json`, and (optionally) `styles.css` into your vault folder: `Vault/.obsidian/plugins/workout-tracker/`.

## 📝 Рабочие процессы

### Development mode

### Создание логов

1. Нажмите на иконку в боковой панели или выполните команду «Создать лог тренировки».```bash

2. Выберите место тренировки: **Зал** или **Дом**.npm run dev

   - Для зала шаблон определяется автоматически по дате (Пн/Ср/Пт). Если день нестандартный, появится модальное окно выбора шаблона.```

   - Для дома используется шаблон Home (3 круга с отжиманиями, приседаниями и прессом, тайминг через TabataTimer).

3. Если лог на текущую дату уже существует, плагин откроет его и покажет уведомление «Переношу вас в созданный файл».The command runs esbuild in watch mode. Point Obsidian to this folder (or symlink it) and reload the app after changes.



### Управление упражнениями## 🧪 Tips & troubleshooting

- Модальное окно открывается через иконку или команду «Открыть упражнения».

- Вверху — строка поиска полной ширины с отступом; она фильтрует упражнения по названию.- If templates do not update after edits, ensure you are editing the files inside the configured `Templates/` folder. The plugin listens for modifications there.

- Кнопка добавления — чёрный «+» внутри прозрачного квадрата с закруглёнными углами и тенью.- Logs are keyed by the current date; if you wish to create multiple gym sessions on the same day, rename or archive the existing log first.

- Нажатие на упражнение открывает карточку с датами, подходами и графиками; минус удаляет файл и запись из реестра.- Exercise deletion only removes the Markdown file—linked references elsewhere in your vault remain.

- Для новых упражнений генерируются файлы в `Exercises/` и запись сохраняется в реестре настроек. Удаление синхронизирует обе стороны.

## 📄 License

### Карточки упражнений

- **С весом**: Dataview собирает подходы из логов, строит график зависимости повторений от веса (ось Y настраивается в настройках) и таблицу последних записей. Номер подхода для домашних тренировок вычисляется по номеру круга.This project is released under the MIT License. See `LICENSE` for details.

- **Без веса**: отображаются графики общего объёма и максимума повторений по дням, а также таблица последних записей с кнопкой показать скрытые записи.
- Dataview-скрипты не используют шаблонные строки, чтобы избежать SyntaxError, и автоматически обновляются при открытии карточки.

## 📄 Шаблоны

### Зал (Monday / Wednesday / Friday)
Каждый файл содержит список упражнений с изображениями (Obsidian-вставки) и пронумерованными подходами:
```
![[Pasted image 20240523211013.png|300]]
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз
```
Списки формируются на основе плана, указанного в требованиях: жимы, тяги, разгибания, упражнения на дельты и т.д. Разминка в шаблоны не включается.

### Домашняя тренировка (Home)
Шаблон содержит 3 круга по 3 упражнения (отжимания, приседания, пресс) и пояснения по таймингу. Каждое поле заполнения повторений оставлено пустым (`_ раз`).

Изменения шаблонов в Obsidian автоматически переносятся в код. При пересоздании структуры или смене папки настройки учитывают кастомные версии, чтобы изменения не терялись.

## ⚙️ Настройки плагина
- **Рабочая папка** — поле без прямого ввода. При клике появляется диалог выбора существующих папок с возможностью углубляться во вложенные и пунктом «+ создать свою» на каждом уровне. Новая папка создаётся по подтверждению и сразу применяется.
- **Диапазон графиков** — два числовых поля (минимум и максимум повторений). После изменения показывается уведомление и автоматически обновляются все файлы упражнений с весом.
- **Обновить структуру** — кнопка для ручного пересоздания/переноса `Exercises`, `Logs`, `Templates`. Сохраняет кастомные шаблоны и правки.

## 📊 Статистика и визуализация
- Используются графики Mermaid (`xychart-beta` с яркой линией цвета `#FF6B00`).
- Таблицы выводятся через DataviewJS; по умолчанию отображаются последние 10 записей с возможностью показать все.
- Карточки упражнений учитывают круги домашних тренировок при нумерации подходов.

## 🔁 Автоматизации
- Автообновление карточек упражнений происходит при их открытии.
- При изменении диапазона графиков обновляются все тренировочные файлы с весом (с уведомлениями о прогрессе).
- Шаблоны и структура папок синхронизируются как при изменении настроек, так и через кнопку «Обновить структуру».

## 🧪 Советы и устранение неполадок
- **Графики пустые**: убедитесь, что в логах заполнены веса/повторения и установлен Dataview.
- **Шаблон не обновился**: проверьте, что редактируете файл в `Templates/` выбранной рабочей папки, затем нажмите «Обновить структуру».
- **Структура не перенеслась**: смените папку в настройках и верните назад — плагин мигрирует файлы с учётом сохранённого прошлого пути.
- **Dataview ошибки SyntaxError**: убедитесь, что используете поставляемые шаблоны без добавления шаблонных строк; плагин поддерживает только конкатенацию строк.

## 🤝 Участие и разработка
- PR и issue приветствуются.
- Перед отправкой изменений запустите `npm run build` для проверки сборки.
- Лицензия проекта — MIT (см. `LICENSE`).

---
**Автор**: Vadim Denisovich  
**Репозиторий**: [VadimDenisovich/Workout-Tracker-Plugin](https://github.com/VadimDenisovich/Workout-Tracker-Plugin)
