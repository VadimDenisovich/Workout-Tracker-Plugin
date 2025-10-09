# Обновление системы кэширования

## ✅ Что изменилось:

### 1. **Отдельный файл метаданных упражнений**
Создан `exercise-metadata.json` для хранения информации о типе упражнения:

```json
{
  "version": "1.0.0",
  "exercises": {
    "Жим ног": { "name": "Жим ног", "hasWeight": true },
    "Отжимания": { "name": "Отжимания", "hasWeight": false }
  }
}
```

### 2. **Упрощённая структура кэша**

#### Для упражнений **с весом**:
```json
{
  "name": "Жим ног",
  "hasWeight": true,
  "lastWorkout": {
    "date": "2025-10-09",
    "sets": [
      { "weight": 50, "reps": 12 },
      { "weight": 55, "reps": 10 }
    ],
    "maxActualWeight": { "weight": 55, "reps": 10 },
    "maxActualWorkingSet": { "weight": 50, "reps": 12 }
  },
  "allTimeMaxReps": {
    "weight": 50,
    "reps": 15,
    "date": "2025-10-08"
  }
}
```

#### Для упражнений **без веса**:
```json
{
  "name": "Отжимания",
  "hasWeight": false,
  "lastWorkout": {
    "date": "2025-10-09",
    "sets": [
      { "reps": 20 },
      { "reps": 18 },
      { "reps": 15 }
    ]
  },
  "allTimeMaxReps": {
    "reps": 25,
    "date": "2025-10-08"
  }
}
```

### 3. **Что убрано:**
- ❌ `allTimeMax` (максимальный вес за все время)
- ❌ `weight: 0` для упражнений без веса
- ❌ `maxActualWeight` и `maxActualWorkingSet` из истории (только в `lastWorkout`)

### 4. **Автоматическая синхронизация**
- При добавлении упражнения → автоматически добавляется в `exercise-metadata.json`
- При удалении упражнения → автоматически удаляется из `exercise-metadata.json`
- При запуске плагина → метаданные синхронизируются с реестром упражнений

## 📂 Файлы:

1. **`.obsidian/plugins/workout-tracker/exercise-metadata.json`**
   - Типы упражнений (с весом / без веса)
   
2. **`.obsidian/plugins/workout-tracker/exercise-cache.json`**
   - Кэшированные данные тренировок

## 🚀 Инструкция:

1. **Перезагрузите плагин** в Obsidian
2. **Очистите кэш**: Settings → Workout Tracker → Очистить кэш
3. **Обновите кэш**: Settings → Workout Tracker → Обновить кэш
4. Проверьте файлы:
   - `exercise-metadata.json` — должны быть все упражнения
   - `exercise-cache.json` — новая структура без лишних полей

## 🎯 Преимущества:

- ✅ Чистая структура данных
- ✅ Упражнения без веса не содержат `weight`
- ✅ Метаданные хранятся отдельно
- ✅ Автоматическая синхронизация через список упражнений
- ✅ Меньше размер кэша (убраны дублирующиеся поля)
