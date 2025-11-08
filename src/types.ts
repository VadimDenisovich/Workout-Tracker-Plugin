export type TemplateKey = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY' | 'HOME';

export type TemplateOverrides = Partial<Record<TemplateKey, string>>;

export interface ExerciseInfo {
	name: string;
	hasWeight: boolean;
	imageLink?: string; // Ссылка на изображение упражнения (например, "![[image.png|400]]")
}

export interface CustomTemplate {
	name: string;
	fileName: string;
	content: string;
	type: 'workout' | 'experiment' | 'muscle-group' | 'special-day';
}

export interface WorkoutTrackerSettings {
	workoutFolder: string;
	previousWorkoutFolder?: string;
	exerciseRegistry: ExerciseInfo[];
	customTemplates: CustomTemplate[];
	templateOverrides: TemplateOverrides; // Переопределения стандартных шаблонов
	chartRepsMin: number;
	chartRepsMax: number;
	trainingDays: WorkoutDay[]; // Дни недели, когда пользователь тренируется
}

export interface Exercise {
	name: string;
	filePath: string;
}

export enum WorkoutDay {
	MONDAY = 'Monday',
	TUESDAY = 'Tuesday',
	WEDNESDAY = 'Wednesday',
	THURSDAY = 'Thursday',
	FRIDAY = 'Friday',
	SATURDAY = 'Saturday',
	SUNDAY = 'Sunday'
}

export enum WorkoutLocation {
	GYM = 'gym',
	HOME = 'home'
}

export interface WorkoutSession {
	date: string;
	location: WorkoutLocation;
	template: string;
}