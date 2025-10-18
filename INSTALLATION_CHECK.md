# Проверка автономности установки плагина

## ✅ Что уже в репозитории (будет при установке с GitHub):

### Обязательные файлы для работы:
- ✅ `main.ts` - основной код плагина
- ✅ `manifest.json` - манифест плагина
- ✅ `styles.css` - стили
- ✅ `src/templates.ts` - **ШАБЛОНЫ ТРЕНИРОВОК** (все дни недели)
- ✅ `src/types.ts` - типы TypeScript
- ✅ `src/utils/fileManager.ts` - менеджер файлов
- ✅ `src/utils/templateUpdater.ts` - обновление шаблонов
- ✅ `src/utils/exerciseCache.ts` - кэш упражнений
- ✅ `src/utils/exerciseMetadata.ts` - метаданные упражнений
- ✅ `src/modals/*.ts` - модальные окна
- ✅ `package.json` - зависимости для разработки

### Конфигурационные файлы:
- ✅ `tsconfig.json` - настройки TypeScript
- ✅ `esbuild.config.mjs` - конфигурация сборки

## ❌ Что НЕ в репозитории (создаётся автоматически):

### При первом запуске плагина:
1. ❌ `data.json` - настройки пользователя (создаётся Obsidian API)
2. ❌ `exercise-cache.json` - кэш данных упражнений
3. ❌ `exercise-metadata.json` - метаданные упражнений
4. ❌ `main.js` - скомпилированный код (создаётся при сборке)

### В хранилище Obsidian:
1. ❌ Папка `Workout/` - структура тренировок
2. ❌ Файлы шаблонов в `Workout/Templates/`
3. ❌ Файлы упражнений в `Workout/Exercises/`
4. ❌ Логи тренировок в `Workout/Logs/`

## 🔄 Процесс первого запуска:

### 1. Пользователь клонирует репозиторий:
```bash
git clone https://github.com/VadimDenisovich/Workout-Tracker-Plugin.git
cd Workout-Tracker-Plugin
npm install
npm run build
```

### 2. Obsidian при загрузке плагина:
- ✅ Читает `manifest.json`
- ✅ Загружает `main.js`
- ✅ Вызывает `onload()`

### 3. В методе `onload()`:

#### a) Загрузка настроек:
```typescript
await this.loadSettings();
// Если data.json не существует:
// - Obsidian создаёт пустой data.json
// - Используются DEFAULT_SETTINGS из src/templates.ts
```

#### b) Инициализация метаданных:
```typescript
this.exerciseMetadata = new ExerciseMetadataManager(this.app, pluginDir);
await this.exerciseMetadata.load();
// Если exercise-metadata.json не существует - создаётся пустой
```

#### c) Инициализация кэша:
```typescript
this.exerciseCache = new ExerciseCache(this.app, pluginDir, this.exerciseMetadata);
await this.exerciseCache.load();
// Если exercise-cache.json не существует - создаётся пустой
```

#### d) Создание структуры папок (при первом запуске):
```typescript
if (!this.settings.previousWorkoutFolder || 
    this.settings.previousWorkoutFolder !== this.settings.workoutFolder) {
    await this.fileManager.createWorkoutStructure(
        this.settings.workoutFolder,
        this.settings.previousWorkoutFolder,
        this.settings.exerciseRegistry
    );
}
```

Метод `createWorkoutStructure()` создаёт:
- ✅ Папку `Workout/`
- ✅ Подпапки: `Templates/`, `Exercises/`, `Logs/`
- ✅ Файлы шаблонов для всех дней (из `src/templates.ts`):
  - Monday.md, Tuesday.md, Wednesday.md, Thursday.md, Friday.md, Saturday.md, Sunday.md, Home.md
- ✅ Файлы упражнений (из `DEFAULT_EXERCISES` в `src/templates.ts`)

## ✅ ВЫВОД: Плагин полностью автономен!

### При установке с GitHub пользователю нужно:
1. ✅ Клонировать репозиторий в `.obsidian/plugins/workout-tracker/`
2. ✅ Запустить `npm install && npm run build`
3. ✅ Включить плагин в Obsidian

### Всё остальное создаётся автоматически:
- ✅ `data.json` с настройками по умолчанию
- ✅ Структура папок `Workout/`
- ✅ Все шаблоны тренировок
- ✅ Все файлы упражнений
- ✅ Кэш и метаданные

### Дефолтные настройки (из `src/templates.ts`):
```typescript
export const DEFAULT_SETTINGS: WorkoutTrackerSettings = {
    workoutFolder: 'Workout',
    previousWorkoutFolder: undefined,
    exerciseRegistry: [...DEFAULT_EXERCISES], // 26 упражнений
    customTemplates: [],
    chartRepsMin: 0,
    chartRepsMax: 15,
    trainingDays: [WorkoutDay.MONDAY, WorkoutDay.WEDNESDAY, WorkoutDay.FRIDAY]
};
```

## 🎯 Рекомендации:

### Всё работает автономно! Но для релиза на GitHub:
1. ✅ Убедиться, что `src/templates.ts` в репозитории (уже есть)
2. ✅ Убрать `templates.ts` из `.gitignore` (уже сделано)
3. ✅ `main.js` должен быть собран перед релизом
4. ✅ Для релизов нужно приложить:
   - `main.js`
   - `manifest.json`
   - `styles.css`

## 📝 Для пользователей (Community Plugin):
При установке через Obsidian Community Plugins:
- ✅ Загружаются только `main.js`, `manifest.json`, `styles.css`
- ✅ При первом запуске автоматически создаётся вся структура
- ✅ Не нужно ничего настраивать вручную!
