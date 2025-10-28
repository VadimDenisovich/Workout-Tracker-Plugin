# Исправление дефолтного значения hasWeight

**Дата:** 28 октября 2025  
**Статус:** ✅ Завершено

## Проблема

Система создания файлов упражнений использовала `hasWeight = true` по умолчанию, что приводило к созданию неправильных шаблонов для упражнений без веса (отжимания, подтягивания, пресс и т.д.).

## Решение

Изменено дефолтное значение `hasWeight` с `true` на `false` во всех функциях и методах:

### Измененные файлы

1. **src/utils/fileManager.ts**
   - `getExerciseTemplate(hasWeight: boolean = false)` ← было `true`
   - `getExerciseStats()`: `hasWeight ?? false` ← было `true`
   - `updateExerciseFile(... hasWeight: boolean = false)` ← было `true`
   - `createSingleExerciseFile(... hasWeight: boolean = false)` ← было `true`

2. **main.ts**
   - При открытии файла упражнения: `hasWeight ?? false` ← было `true`
   - При обновлении упражнения: `hasWeight ?? false` ← было `true`
   - `registerExercise(... hasWeight: boolean = false)` ← было `true`

3. **src/utils/exerciseMetadata.ts**
   - В `syncWithFileSystem()`: `hasWeight ?? false` ← было `true`

4. **exercise-metadata.json**
   - Исправлено "Подъемы ног на пресс на скамье": `hasWeight: false` ← было `true`

## Логика работы

### Теперь по умолчанию:
- **hasWeight = false** (упражнение БЕЗ веса)
- Используется шаблон `exercise-stats-no-weight-cached.dataviewjs`
- Отображается только количество повторений

### Если в модальном окне поставлена галочка "Упражнение с весом":
- **hasWeight = true**
- Используется шаблон `exercise-stats-with-weight-cached.dataviewjs`
- Отображается вес и количество повторений

## Результат

✅ Упражнения без веса (отжимания, пресс, подтягивания) теперь корректно создаются с шаблоном для упражнений без веса
✅ Упражнения с весом создаются с соответствующим шаблоном только при явном указании
✅ Система автоматически определяет тип упражнения из метаданных при обновлении файлов

## Сборка

```bash
npm run build
# ✅ Успешно: main.js (141K)
```

## Совместимость

- ✅ macOS
- ✅ iPhone/iOS (использует только Obsidian Vault API)
