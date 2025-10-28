# Исправление отображения статистики упражнений

**Дата:** 28 октября 2025  
**Статус:** ✅ Завершено

## Проблема

После изменения дефолтного значения `hasWeight` на `false`, упражнения с весом начали показывать неправильную статистику:

```
### [[Французский жим с нижнего блока]]
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз
Максималка: 15 раз
```

Вместо ожидаемого:
```
Последний актуальный подход на 12-15: 25 кг x 15 раз
Максимальный вес: 25 кг x 15 раз
```

## Причина

Метод `getExerciseInfoByName()` в `FileManager` не проверял `exercise-metadata.json`, а искал только в:
1. `settings.exerciseRegistry`
2. `DEFAULT_EXERCISES`

Это приводило к тому, что для многих упражнений `hasWeight` возвращался как `undefined`, и fallback к `false` приводил к неправильному отображению.

## Решение

### 1. Добавлен доступ к ExerciseMetadataManager в FileManager

**src/utils/fileManager.ts:**
```typescript
import { ExerciseMetadataManager } from './exerciseMetadata';

export class FileManager {
	constructor(
		private app: App, 
		private pluginDir: string,
		private getSettings: () => WorkoutTrackerSettings,
		private getExerciseCache?: () => ExerciseCache | null,
		private getExerciseMetadata?: () => ExerciseMetadataManager | null  // ← НОВОЕ
	) {}
```

### 2. Изменен порядок поиска в getExerciseInfoByName()

Теперь поиск идет в следующем порядке:
1. **exercise-metadata.json** (первый приоритет)
2. settings.exerciseRegistry
3. DEFAULT_EXERCISES

```typescript
private getExerciseInfoByName(exerciseName: string): ExerciseInfo | undefined {
	const settings = this.getSettings();
	
	// 1. Сначала проверяем в метаданных (exercise-metadata.json)
	const metadata = this.getExerciseMetadata?.();
	if (metadata) {
		const hasWeight = metadata.hasWeight(exerciseName);
		if (hasWeight !== null) {
			return {
				name: exerciseName,
				hasWeight: hasWeight
			};
		}
	}
	
	// 2. Затем проверяем в настройках (exerciseRegistry)
	const fromSettings = settings.exerciseRegistry?.find((exercise) => exercise.name === exerciseName);
	if (fromSettings) {
		return fromSettings;
	}
	
	// 3. Наконец, проверяем в дефолтных упражнениях
	return DEFAULT_EXERCISES.find((exercise) => exercise.name === exerciseName);
}
```

### 3. Обновлено создание FileManager в main.ts

Теперь `exerciseMetadata` инициализируется **ПЕРЕД** `FileManager` и передается в конструктор:

```typescript
// Инициализируем менеджер метаданных упражнений ПЕРЕД FileManager
this.exerciseMetadata = new ExerciseMetadataManager(this.app, pluginDir);
await this.exerciseMetadata.load();

// Передаем exerciseMetadata в FileManager
this.fileManager = new FileManager(
	this.app, 
	pluginDir, 
	() => this.settings, 
	() => this.exerciseCache, 
	() => this.exerciseMetadata  // ← НОВОЕ
);
```

### 4. Добавлено логирование

В `getExerciseStats()` добавлено логирование для отладки:
```typescript
console.log(`[FileManager] 📊 Получение статистики для "${exerciseName}":`, { hasWeight, exerciseInfo });
```

## Результат

✅ Упражнения с весом теперь корректно определяются из `exercise-metadata.json`  
✅ Статистика отображается правильно:
- Для упражнений с весом: "Последний актуальный подход на 12-15" и "Максимальный вес"
- Для упражнений без веса: "Максималка"

✅ Приоритет источников данных о `hasWeight`:
1. exercise-metadata.json (самый актуальный)
2. exerciseRegistry (настройки)
3. DEFAULT_EXERCISES (встроенные)

## Сборка

```bash
npm run build
# ✅ Успешно: main.js (142K)
```

## Совместимость

- ✅ macOS
- ✅ iPhone/iOS (использует только Obsidian Vault API)

## Тестирование

1. Открыть файл упражнения с весом (например, "Французский жим с нижнего блока")
2. Проверить, что отображается:
   - "Последний актуальный подход на 12-15: X кг x Y раз"
   - "Максимальный вес: X кг x Y раз"
3. Открыть файл упражнения без веса (например, "Велосипед на пресс")
4. Проверить, что отображается:
   - "Максималка: X раз"
