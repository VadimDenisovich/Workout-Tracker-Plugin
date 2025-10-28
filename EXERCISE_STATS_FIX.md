# Исправление проблемы с нулевыми значениями в статистике упражнений

## Проблема

При создании нового лога тренировки для некоторых упражнений отображались нулевые значения:
```
Последний актуальный подход на 12-15: 0 кг x 0 раз
Максимальный вес: 0 кг x 0 раз
```

Хотя упражнение уже выполнялось ранее и в истории были данные.

## Причины проблемы

### 1. FileManager не использовал кэш упражнений
Метод `getExerciseStats()` в `FileManager` каждый раз парсил все файлы логов заново вместо использования уже готового кэша упражнений. Это:
- Неэффективно (медленно работает)
- Может приводить к ошибкам парсинга
- Не гарантирует согласованность данных

### 2. Неправильная логика вычисления `maxActualWorkingSet`
В методе `addExerciseData()` класса `ExerciseCache` была неправильная логика:
```typescript
// НЕПРАВИЛЬНО: искал подход с максимальными повторениями
const mostRepsSet = session.sets.reduce((max, set) => 
    set.reps > max.reps ? set : max
);
```

Должна была искать максимальный вес в диапазоне 12-15 повторений (рабочий подход).

## Решение

### 1. Добавлен доступ к кэшу в FileManager

**src/utils/fileManager.ts:**
```typescript
import { ExerciseCache } from './exerciseCache';

export class FileManager {
    constructor(
        private app: App, 
        private pluginDir: string,
        private getSettings: () => WorkoutTrackerSettings,
        private getExerciseCache?: () => ExerciseCache | null  // ← Добавлено
    ) {}
}
```

**main.ts:**
```typescript
this.fileManager = new FileManager(
    this.app, 
    pluginDir, 
    () => this.settings, 
    () => this.exerciseCache  // ← Передаем кэш
);
```

### 2. Обновлен метод getExerciseStats()

Теперь метод сначала пытается получить данные из кэша:

```typescript
private async getExerciseStats(exerciseName: string, workoutFolder: string): Promise<string> {
    const cache = this.getExerciseCache?.();
    if (cache) {
        const cachedData = cache.getExerciseData(exerciseName);
        
        if (cachedData && cachedData.history && cachedData.history.length > 0) {
            // Используем данные из кэша
            // Находим последний рабочий подход (12-15 повторений)
            // Берем максимальный вес за всё время
            return result;
        }
    }
    
    // Fallback: парсим файлы если кэш недоступен или пуст
    // ... старая логика парсинга
}
```

### 3. Исправлена логика вычисления maxActualWorkingSet

**src/utils/exerciseCache.ts:**
```typescript
// maxActualWorkingSet - максимальный вес в диапазоне 12-15 повторений
const workingSets = session.sets.filter(set => 
    set.reps >= 12 && set.reps <= 15 && set.weight !== undefined
);

if (workingSets.length > 0) {
    const bestWorkingSet = workingSets.reduce((max, set) => 
        (set.weight ?? 0) > (max.weight ?? 0) ? set : max
    );
    if (bestWorkingSet.weight !== undefined) {
        session.maxActualWorkingSet = { weight: bestWorkingSet.weight, reps: bestWorkingSet.reps };
    }
} else {
    // Если нет подходов в диапазоне 12-15, не устанавливаем значение
    session.maxActualWorkingSet = undefined;
}
```

## Преимущества исправлений

1. ✅ **Работает на всех платформах** - использует Obsidian API для работы с файлами
2. ✅ **Быстрее** - использует кэш вместо повторного парсинга файлов
3. ✅ **Надежнее** - единый источник истины (кэш)
4. ✅ **Правильная статистика** - корректно вычисляет рабочие подходы
5. ✅ **Fallback механизм** - если кэш недоступен, парсит файлы (обратная совместимость)

## Что делать после обновления

1. Перезагрузите Obsidian
2. Откройте настройки плагина → "Пересоздать кэш упражнений"
3. Попробуйте создать новый лог тренировки - статистика должна отображаться корректно

## Тестирование

Проверьте на упражнениях, которые:
- Выполнялись ранее несколько раз
- Имеют разные диапазоны повторений
- Есть подходы в диапазоне 12-15 повторений

Должна отображаться корректная статистика вместо нулей.
