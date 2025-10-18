# ✅ Чек-лист автономности плагина

## При установке с GitHub (чистая установка):

### ✅ Что ЕСТЬ в репозитории:
- [x] `src/templates.ts` - ВСЕ шаблоны тренировок (7 дней + HOME)
- [x] `src/types.ts` - интерфейс `WorkoutTrackerSettings`
- [x] `DEFAULT_SETTINGS` с дефолтными значениями:
  - Папка: `Workout`
  - Дни: Понедельник, Среда, Пятница
  - График: 0-15 повторений
  - Упражнения: 26 упражнений
- [x] `main.ts` - логика автоматического создания структуры
- [x] Все утилиты и модули

### ✅ Что создаётся АВТОМАТИЧЕСКИ при первом запуске:

#### 1. Файлы настроек (в папке плагина):
- [x] `data.json` - создаётся Obsidian API с `DEFAULT_SETTINGS`
- [x] `exercise-cache.json` - создаётся пустой
- [x] `exercise-metadata.json` - создаётся пустой

#### 2. Структура в хранилище (в папке Workout):
- [x] `Workout/Templates/` - папка с шаблонами
- [x] `Workout/Templates/Monday.md` - автоматически из `src/templates.ts`
- [x] `Workout/Templates/Tuesday.md` - автоматически из `src/templates.ts`
- [x] `Workout/Templates/Wednesday.md` - автоматически из `src/templates.ts`
- [x] `Workout/Templates/Thursday.md` - автоматически из `src/templates.ts`
- [x] `Workout/Templates/Friday.md` - автоматически из `src/templates.ts`
- [x] `Workout/Templates/Saturday.md` - автоматически из `src/templates.ts`
- [x] `Workout/Templates/Sunday.md` - автоматически из `src/templates.ts`
- [x] `Workout/Templates/Home.md` - автоматически из `src/templates.ts`
- [x] `Workout/Exercises/` - папка с упражнениями
- [x] `Workout/Exercises/*.md` - 26 файлов упражнений из `DEFAULT_EXERCISES`
- [x] `Workout/Logs/` - пустая папка для логов

## 🎯 РЕЗУЛЬТАТ: ДА, ВСЁ АВТОНОМНО!

Пользователь может:
1. Клонировать репозиторий
2. Собрать плагин (`npm install && npm run build`)
3. Включить в Obsidian

И получить **полностью рабочий плагин** без дополнительной настройки!

## 📦 Для релиза через GitHub Releases:

Приложить к релизу:
- `main.js` (собранный)
- `manifest.json`
- `styles.css`

Пользователи скачают эти файлы, и при первом запуске всё создастся автоматически!
