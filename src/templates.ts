import { WorkoutTrackerSettings, TemplateKey, TemplateOverrides } from './types';

export const DEFAULT_SETTINGS: WorkoutTrackerSettings = {
	workoutFolder: 'Workout',
	previousWorkoutFolder: undefined,
	templateOverrides: {}
};

export const TEMPLATE_KEYS: TemplateKey[] = ['MONDAY', 'WEDNESDAY', 'FRIDAY', 'HOME'];

export const TEMPLATE_FILES: Record<TemplateKey, string> = {
	MONDAY: 'Monday.md',
	WEDNESDAY: 'Wednesday.md',
	FRIDAY: 'Friday.md',
	HOME: 'Home.md'
};

export const WORKOUT_TEMPLATES: Record<TemplateKey, string> = {
	MONDAY: `# Тренировка - Понедельник

**Дата:** {{date}}
**Место:** {{location}}

## Упражнения

### Жим лежа
- Подходы: 
- Повторения: 
- Вес: 
- Заметки: 

### Приседания
- Подходы: 
- Повторения: 
- Вес: 
- Заметки: 

### Тяга штанги в наклоне
- Подходы: 
- Повторения: 
- Вес: 
- Заметки: 

## Заметки по тренировке

---
**Теги:** #тренировка #понедельник`,

	WEDNESDAY: `# Тренировка - Среда

**Дата:** {{date}}
**Место:** {{location}}

## Упражнения

### Жим штанги стоя
- Подходы: 
- Повторения: 
- Вес: 
- Заметки: 

### Подтягивания
- Подходы: 
- Повторения: 
- Вес: 
- Заметки: 

### Отжимания на брусьях
- Подходы: 
- Повторения: 
- Вес: 
- Заметки: 

## Заметки по тренировке

---
**Теги:** #тренировка #среда`,

	FRIDAY: `# Тренировка - Пятница

**Дата:** {{date}}
**Место:** {{location}}

## Упражнения

### Становая тяга
- Подходы: 
- Повторения: 
- Вес: 
- Заметки: 

### Жим лежа узким хватом
- Подходы: 
- Повторения: 
- Вес: 
- Заметки: 

### Подъем на бицепс
- Подходы: 
- Повторения: 
- Вес: 
- Заметки: 

## Заметки по тренировке

---
**Теги:** #тренировка #пятница`,

	HOME: `# Домашняя тренировка

**Дата:** {{date}}
**Место:** Дома

## Упражнения

### Отжимания
- Подходы: 
- Повторения: 
- Заметки: 

### Приседания без веса
- Подходы: 
- Повторения: 
- Заметки: 

### Планка
- Время: 
- Заметки: 

### Пресс
- Подходы: 
- Повторения: 
- Заметки: 

## Заметки по тренировке

---
**Теги:** #тренировка #дома`
};

export const EXERCISE_TEMPLATE = `# {{exerciseName}} - Прогрессия

## Статистика

\`\`\`dataview
TABLE date as "Дата", sets as "Подходы", reps as "Повторения", weight as "Вес", notes as "Заметки"
FROM "{{workoutFolder}}/Logs"
WHERE contains(file.content, "{{exerciseName}}")
SORT date DESC
\`\`\`

## График прогресса

\`\`\`dataview
CHART
FROM "{{workoutFolder}}/Logs"
WHERE contains(file.content, "{{exerciseName}}")
\`\`\`

## Заметки

---
**Теги:** #упражнение #{{exerciseTag}}`;