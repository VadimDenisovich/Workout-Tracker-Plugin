export type TemplateKey = 'MONDAY' | 'WEDNESDAY' | 'FRIDAY' | 'HOME';

export type TemplateOverrides = Partial<Record<TemplateKey, string>>;

export interface ExerciseInfo {
	name: string;
	hasWeight: boolean;
}

export interface WorkoutTrackerSettings {
	workoutFolder: string;
	previousWorkoutFolder?: string;
	exerciseRegistry: ExerciseInfo[];
	chartRepsMin: number;
	chartRepsMax: number;
}

export interface Exercise {
	name: string;
	filePath: string;
}

export enum WorkoutDay {
	MONDAY = 'Monday',
	WEDNESDAY = 'Wednesday', 
	FRIDAY = 'Friday'
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