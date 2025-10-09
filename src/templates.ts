import { WorkoutTrackerSettings, TemplateKey, TemplateOverrides, ExerciseInfo } from './types';

export const DEFAULT_EXERCISES: ExerciseInfo[] = [
	{ name: 'Жим гантелей лежа', hasWeight: true },
	{ name: 'Румынская тяга с гантелями', hasWeight: true },
	{ name: 'Двойная верхняя тяга блока в груди', hasWeight: true },
	{ name: 'Подъемы с гантелями', hasWeight: true },
	{ name: 'Французский жим с нижнего блока', hasWeight: true },
	{ name: 'Подъем гантелей на дельты', hasWeight: true },
	{ name: 'Жим ногами на носки', hasWeight: true },
	{ name: 'Жим ног', hasWeight: true },
	{ name: 'Жим от груди в Смите', hasWeight: true },
	{ name: 'Подъём гантелей на дельты лежа', hasWeight: true },
	{ name: 'Разгибание ног в тренажере', hasWeight: true },
	{ name: 'Подъем EZ-штанги на бицепс стоя', hasWeight: true },
	{ name: 'Скручивание на пресс на скамье', hasWeight: false },
	{ name: 'Жим штанги лёжа узким хватом', hasWeight: true },
	{ name: 'Становая тяга классика (средний вес)', hasWeight: true },
	{ name: 'Тяга горизонтального блока к поясу', hasWeight: true },
	{ name: 'Жим гантелей на наклонной скамье (45°)', hasWeight: true },
	{ name: 'Разгибания рук с гантелью из-за головы (французский жим сидя)', hasWeight: true },
	{ name: 'Подъёмы ног в висе', hasWeight: false },
	{ name: 'Гиперэкстензия (икры)', hasWeight: true },
	{ name: 'Отжимания', hasWeight: false },
	{ name: 'Приседания', hasWeight: false },
	{ name: 'Пресс', hasWeight: false }
];

export const DEFAULT_SETTINGS: WorkoutTrackerSettings = {
	workoutFolder: 'Workout',
	previousWorkoutFolder: undefined,
	exerciseRegistry: [...DEFAULT_EXERCISES],
	chartRepsMin: 0,
	chartRepsMax: 15
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

![[Pasted image 20240523211013.png|300]]
![[Pasted image 20240523211121.png|300]]
![[Pasted image 20240523211124.png|300]]
### Жим гантелей лежа
{{exercise:Жим гантелей лежа}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20240523211504.png|300]]
![[Pasted image 20240523211651.png|300]]
![[Pasted image 20240523211654.png|300]]
### Румынская тяга с гантелями
{{exercise:Румынская тяга с гантелями}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20240523212306.png|300]]
![[Pasted image 20240523212935.png|300]]
![[Pasted image 20240523212914.png|300]]
### Двойная верхняя тяга блока в груди
{{exercise:Двойная верхняя тяга блока в груди}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз
Подход 3: _ кг x _ раз
Подход 4: _ кг x _ раз

![[Pasted image 20240523213357.png|300]]
### Подъемы с гантелями
{{exercise:Подъемы с гантелями}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20240523214401.png|300]]
![[Pasted image 20240523214826.png|300x300]]
![[Pasted image 20240523214828.png|300x300]]
### Французский жим с нижнего блока
{{exercise:Французский жим с нижнего блока}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20240523215257.png|300]]
### Подъем гантелей на дельты
{{exercise:Подъем гантелей на дельты}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20240523215704.png|300]]
![[Pasted image 20240523215711.png|300]]
### Жим ногами на носки
{{exercise:Жим ногами на носки}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

## Заметки
`,

	WEDNESDAY: `# Тренировка - Среда

**Дата:** {{date}}
**Место:** {{location}}

## Упражнения

![[Pasted image 20251004115009.png|300x300]]
### Жим ног
{{exercise:Жим ног}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз
Подход 3: _ кг x _ раз

![[Pasted image 20240523221030.png|300]]
### Жим от груди в Смите
{{exercise:Жим от груди в Смите}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20240523221812.png]]
### Подъём гантелей на дельты лежа
{{exercise:Подъём гантелей на дельты лежа}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20240523222301.png|300]]
### Разгибание ног в тренажере
{{exercise:Разгибание ног в тренажере}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20240523222856.png|300]]
### Подъем EZ-штанги на бицепс стоя
{{exercise:Подъем EZ-штанги на бицепс стоя}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20251004122326.png|300]]
### Скручивание на пресс на скамье
{{exercise:Скручивание на пресс на скамье}}
Подход 1: _ раз
Подход 2: _ раз
Подход 3: _ раз

## Заметки
`,

	FRIDAY: `# Тренировка - Пятница

**Дата:** {{date}}
**Место:** {{location}}

## Упражнения

![[Pasted image 20251004115159.png|400x250]]
### Жим штанги лёжа узким хватом
{{exercise:Жим штанги лёжа узким хватом}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20251004115509.png|400x250]]
### Становая тяга классика (средний вес)
{{exercise:Становая тяга классика (средний вес)}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20251004121231.png|400x300]]
### Тяга горизонтального блока к поясу
{{exercise:Тяга горизонтального блока к поясу}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20251004121429.png]]
### Жим гантелей на наклонной скамье (45°)
{{exercise:Жим гантелей на наклонной скамье (45°)}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20251004121547.png|400x250]]
### Разгибания рук с гантелью из-за головы (французский жим сидя)
{{exercise:Разгибания рук с гантелью из-за головы (французский жим сидя)}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20240523215257.png|300]]
### Подъем гантелей на дельты
{{exercise:Подъем гантелей на дельты}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

![[Pasted image 20251004121737.png|300]]
### Подъёмы ног в висе
{{exercise:Подъёмы ног в висе}}
Подход 1: _ раз
Подход 2: _ раз

![[Pasted image 20251004121913.png|300]]
### Гиперэкстензия (икры)
{{exercise:Гиперэкстензия (икры)}}
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

## Заметки
`,

	HOME: `# Домашняя тренировка

**Дата:** {{date}}
**Место:** Дома

## Инструкции

- 3 круга с отдыхом 2 минуты между кругами
- Общая длительность тренировки — около 25 минут
- TabataTimer

## Круг 1

### Отжимания
{{exercise:Отжимания}}
_ раз

### Приседания
{{exercise:Приседания}}
_ раз

### Пресс
{{exercise:Пресс}}
_ раз

## Круг 2

### Отжимания
{{exercise:Отжимания}}
_ раз

### Приседания
{{exercise:Приседания}}
_ раз

### Пресс
{{exercise:Пресс}}
_ раз

## Круг 3

### Отжимания
{{exercise:Отжимания}}
_ раз

### Приседания
{{exercise:Приседания}}
_ раз

### Пресс
{{exercise:Пресс}}
_ раз

## Заметки
`
};

export const EXERCISE_TEMPLATE = `# {{exerciseName}} - Прогрессия

## Статистика

\`\`\`dataviewjs
const exerciseName = "{{exerciseName}}";
const logsFolder = "{{workoutFolder}}/Logs";
const exerciseHeader = "### " + exerciseName;

const allPages = dv.pages('"' + logsFolder + '"');
const rows = [];
const summary = new Map();

const setRegex = /^Подход\\s*(\\d+):\\s*(.+)$/i;
const weightRegex = /(\\d+[,.]?\\d*)\\s*кг/i;
const repsRegex = /(\\d+)\\s*раз/i;

for (const page of allPages) {
	const content = await dv.io.load(page.file.path);
	const lines = content.split("\\n");
	const date = page.file.name.slice(0, 10);
	
	let i = 0;
	let foundExercise = false;
	
	while (i < lines.length) {
		const line = lines[i].trim();
		
		if (line === exerciseHeader) {
			foundExercise = true;
			i++;
			let setNumber = 0;
			
			while (i < lines.length) {
				const currentLine = lines[i].trim();
				if (currentLine.startsWith("###") || currentLine.startsWith("##")) break;
				
				if (currentLine.length > 0) {
					const setMatch = setRegex.exec(currentLine);
					if (setMatch) {
						setNumber = parseInt(setMatch[1]);
						const details = setMatch[2];
						const weightMatch = weightRegex.exec(details);
						const repsMatch = repsRegex.exec(details);
						const weight = weightMatch ? weightMatch[1].replace(",", ".") : "—";
						const reps = repsMatch ? repsMatch[1] : "—";
						
						rows.push([date, setNumber, weight, reps, details]);
						if (repsMatch) {
							summary.set(date, (summary.get(date) ?? 0) + Number(repsMatch[1]));
						}
					} else if (currentLine.includes("раз") || currentLine.includes("кг")) {
						setNumber++;
						const weightMatch = weightRegex.exec(currentLine);
						const repsMatch = repsRegex.exec(currentLine);
						const weight = weightMatch ? weightMatch[1].replace(",", ".") : "—";
						const reps = repsMatch ? repsMatch[1] : "—";
						
						rows.push([date, setNumber, weight, reps, currentLine]);
						if (repsMatch) {
							summary.set(date, (summary.get(date) ?? 0) + Number(repsMatch[1]));
						}
					}
				}
				i++;
			}
			break;
		}
		i++;
	}
}

if (rows.length === 0) {
	dv.paragraph("Данные по подходам пока не найдены.");
} else {
	rows.sort((a, b) => {
		if (a[0] === b[0]) {
			return Number(a[1]) - Number(b[1]);
		}
		return a[0] > b[0] ? -1 : 1;
	});

	dv.table(["Дата", "Подход", "Вес (кг)", "Повторения", "Описание"], rows);

	const summaryRows = Array.from(summary.entries())
		.sort((a, b) => (a[0] > b[0] ? -1 : 1))
		.map(([date, reps]) => [date, reps]);

	if (summaryRows.length > 0) {
		dv.paragraph("");
		dv.header(3, "Суммарные повторения по дням");
		dv.table(["Дата", "Повторения"], summaryRows);
	}
}
\`\`\`

## Заметки
`;
