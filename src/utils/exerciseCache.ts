import { App, Notice } from 'obsidian';
import { TFile } from 'obsidian';
import { ExerciseMetadataManager } from './exerciseMetadata';

export interface ExerciseSet {
	weight?: number; // Опциональный для упражнений без веса
	reps: number;
}

export interface WorkoutSession {
	date: string;
	sets: ExerciseSet[];
	maxActualWeight?: { weight: number; reps: number }; // Только для упражнений с весом
	maxActualWorkingSet?: { weight: number; reps: number }; // Только для упражнений с весом
}

export interface ExerciseData {
	name: string;
	hasWeight: boolean;
	history: WorkoutSession[];
	lastWorkout: WorkoutSession | null;
	allTimeMaxReps: {
		weight?: number; // Опциональный для упражнений без веса
		reps: number;
		date: string;
	} | null;
	allTimeMaxWeight?: {
		weight: number;
		reps: number;
		date: string;
	} | null; // Только для упражнений с весом
}

export interface CacheData {
	version: string;
	lastUpdate: string;
	cachedFiles: string[]; // список закэшированных файлов
	exercises: Record<string, ExerciseData>;
}

export class ExerciseCache {
	private app: App;
	private cacheFilePath: string;
	private cache: CacheData;
	private metadataManager: ExerciseMetadataManager;

	constructor(app: App, pluginDir: string, metadataManager: ExerciseMetadataManager) {
		this.app = app;
		this.cacheFilePath = `${pluginDir}/exercise-cache.json`;
		this.cache = this.getDefaultCache();
		this.metadataManager = metadataManager;
	}

	private getDefaultCache(): CacheData {
		return {
			version: '1.0.0',
			lastUpdate: new Date().toISOString(),
			cachedFiles: [],
			exercises: {}
		};
	}

	async load(): Promise<void> {
		try {
			const adapter = this.app.vault.adapter;
			
			// Используем относительный путь от корня хранилища
			const relativePath = this.cacheFilePath.replace(/^.*\.obsidian/, '.obsidian');
			
			console.log('[ExerciseCache] Загрузка кэша из:', relativePath);
			
			if (await adapter.exists(relativePath)) {
				const data = await adapter.read(relativePath);
				this.cache = JSON.parse(data);
				console.log('[ExerciseCache] Кэш загружен, упражнений:', Object.keys(this.cache.exercises).length);
			} else {
				console.log('[ExerciseCache] Кэш не найден, создаём новый');
			}
		} catch (error) {
			console.error('[ExerciseCache] Ошибка загрузки кэша:', error);
			this.cache = this.getDefaultCache();
		}
	}

	async save(): Promise<void> {
		try {
			this.cache.lastUpdate = new Date().toISOString();
			const adapter = this.app.vault.adapter;
			
			// Используем относительный путь от корня хранилища
			const relativePath = this.cacheFilePath.replace(/^.*\.obsidian/, '.obsidian');
			
			console.log('[ExerciseCache] Сохранение кэша в:', relativePath);
			await adapter.write(relativePath, JSON.stringify(this.cache, null, 2));
			console.log('[ExerciseCache] Кэш сохранён');
		} catch (error) {
			console.error('[ExerciseCache] Ошибка сохранения кэша:', error);
		}
	}

	async rebuildCache(logsFolder: string): Promise<number> {
		console.log('[ExerciseCache] Начинаем rebuild кэша...');
		
		const logsPath = `${logsFolder}`;
		const allFiles = this.app.vault.getMarkdownFiles()
			.filter(file => file.path.startsWith(logsPath) && file.path.endsWith('.md'));

		console.log('[ExerciseCache] Найдено файлов логов:', allFiles.length);
		console.log('[ExerciseCache] Уже закэшировано файлов:', this.cache.cachedFiles.length);

		// Проверяем и удаляем несуществующие файлы из кэша
		const existingFilePaths = new Set(allFiles.map(f => f.path));
		const removedFiles: string[] = [];
		
		this.cache.cachedFiles = this.cache.cachedFiles.filter(cachedPath => {
			if (!existingFilePaths.has(cachedPath)) {
				removedFiles.push(cachedPath);
				return false; // Удаляем из кэша
			}
			return true; // Оставляем
		});

		if (removedFiles.length > 0) {
			console.log('[ExerciseCache] 🗑️ Удалено несуществующих файлов из кэша:', removedFiles.length);
			console.log('[ExerciseCache] Удалённые файлы:', removedFiles.map(p => p.split('/').pop()).join(', '));
			await this.save(); // Сохраняем изменения
		}

		// Определяем новые файлы
		const newFiles = allFiles.filter(file => !this.cache.cachedFiles.includes(file.path));
		
		if (newFiles.length === 0) {
			console.log('[ExerciseCache] ✅ Нет новых файлов для кэширования');
			return 0;
		}

		console.log('[ExerciseCache] ⚡ Новых файлов для кэширования:', newFiles.length);
		console.log('[ExerciseCache] Список новых файлов:', newFiles.map(f => f.basename).join(', '));

		for (const file of newFiles) {
			await this.parseLogFile(file);
		}

		await this.save();
		console.log('[ExerciseCache] ✅ Кэширование завершено, сохранено');
		return newFiles.length;
	}

	private async parseLogFile(file: TFile): Promise<void> {
		try {
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			// Извлекаем дату из имени файла (формат: YYYY-MM-DD-Day.md)
			const dateMatch = file.basename.match(/^(\d{4}-\d{2}-\d{2})/);
			if (!dateMatch) {
				console.warn('[ExerciseCache] Не удалось извлечь дату из файла:', file.path);
				return;
			}
			const workoutDate = dateMatch[1];

			// Храним все упражнения из этого лога
			const exercisesInLog = new Map<string, { sets: ExerciseSet[], hasWeight: boolean }>();
			
			let currentExercise: string | null = null;
			let hasWeight = false;

			const setRegex = /^Подход\s*(\d+):\s*(.+)$/i;
			const weightRegex = /(\d+[,.]?\d*)\s*кг/i;
			const repsRegex = /(\d+)\s*раз/i;
			const simpleRepsRegex = /^(\d+)\s*раз$/i;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim();

				// Находим заголовок упражнения
				if (line.startsWith('###')) {
					currentExercise = line.replace(/^###\s*/, '').trim();
					
					// Определяем тип упражнения из метаданных
					const metadataHasWeight = this.metadataManager.hasWeight(currentExercise);
					hasWeight = metadataHasWeight !== null ? metadataHasWeight : false;
					
					// Создаём запись для упражнения если её нет
					if (!exercisesInLog.has(currentExercise)) {
						exercisesInLog.set(currentExercise, { sets: [], hasWeight });
					}
					
					continue;
				}

				// Пропускаем строки со статистикой
				if (line.includes('Максималка:') || 
					line.includes('Последний актуальный подход') || 
					line.includes('Максимальный вес')) {
					continue;
				}

				if (!currentExercise) continue;

				const exerciseData = exercisesInLog.get(currentExercise)!;

				// Парсим подход в формате "Подход 1: X кг x Y раз" или "Подход 1: X раз"
				const setMatch = line.match(setRegex);
				if (setMatch) {
					const details = setMatch[2];
					const weightMatch = details.match(weightRegex);
					const repsMatch = details.match(repsRegex);

					if (weightMatch && repsMatch) {
						// Упражнение с весом
						const weight = parseFloat(weightMatch[1].replace(',', '.'));
						const reps = parseInt(repsMatch[1]);
						exerciseData.sets.push({ weight, reps });
					} else {
						// Упражнение без веса (только повторения)
						const simpleReps = details.match(simpleRepsRegex);
						if (simpleReps) {
							const reps = parseInt(simpleReps[1]);
							exerciseData.sets.push({ reps }); // Без weight
						}
					}
				} else {
					// Парсим упрощённый формат для HOME: просто "15 раз" на следующей строке после заголовка
					const directReps = line.match(simpleRepsRegex);
					if (directReps) {
						const reps = parseInt(directReps[1]);
						exerciseData.sets.push({ reps }); // Без weight
					}
				}
			}

			// Сохраняем все упражнения из лога
			for (const [exerciseName, data] of exercisesInLog.entries()) {
				if (data.sets.length > 0) {
					this.addExerciseData(exerciseName, workoutDate, data.sets, data.hasWeight);
				}
			}

			// Добавляем файл в список закэшированных
			if (!this.cache.cachedFiles.includes(file.path)) {
				this.cache.cachedFiles.push(file.path);
			}

			console.log('[ExerciseCache] Файл обработан:', file.path);
		} catch (error) {
			console.error('[ExerciseCache] Ошибка парсинга файла:', file.path, error);
		}
	}

	private addExerciseData(
		exerciseName: string,
		date: string,
		sets: ExerciseSet[],
		hasWeight: boolean
	): void {
		// Создаём упражнение если его нет
		if (!this.cache.exercises[exerciseName]) {
			this.cache.exercises[exerciseName] = {
				name: exerciseName,
				hasWeight,
				history: [],
				lastWorkout: null,
				allTimeMaxReps: null,
				allTimeMaxWeight: null // Инициализируем для всех упражнений
			};
		}

		const exercise = this.cache.exercises[exerciseName];

		// Ищем существующую сессию с этой датой
		let existingSession = exercise.history.find(s => s.date === date);
		
		if (existingSession) {
			// ЗАМЕНЯЕМ подходы (не добавляем!), чтобы избежать дубликатов при повторном кэшировании
			existingSession.sets = [...sets];
		} else {
			// Создаём новую сессию
			const session: WorkoutSession = {
				date,
				sets: [...sets]
			};
			exercise.history.push(session);
		}

		// Сортируем историю по дате (новые первыми)
		exercise.history.sort((a, b) => b.date.localeCompare(a.date));

		// Пересчитываем статистику для всех сессий
		for (const session of exercise.history) {
			if (hasWeight) {
				// maxActualWeight - самый большой вес за тренировку
				const heaviestSet = session.sets.reduce((max, set) => 
					(set.weight ?? 0) > (max.weight ?? 0) ? set : max
				);
				if (heaviestSet.weight !== undefined) {
					session.maxActualWeight = { weight: heaviestSet.weight, reps: heaviestSet.reps };
				}

				// maxActualWorkingSet - максимальное количество повторений за тренировку
				const mostRepsSet = session.sets.reduce((max, set) => 
					set.reps > max.reps ? set : max
				);
				if (mostRepsSet.weight !== undefined) {
					session.maxActualWorkingSet = { weight: mostRepsSet.weight, reps: mostRepsSet.reps };
				}
			}
		}

		// Обновляем lastWorkout
		exercise.lastWorkout = exercise.history[0];

		// Обновляем allTimeMaxReps (максимальное количество повторений за все время)
		for (const session of exercise.history) {
			const maxRepsSet = session.sets.reduce((max, set) => 
				set.reps > max.reps ? set : max
			);
			
			if (!exercise.allTimeMaxReps || maxRepsSet.reps > exercise.allTimeMaxReps.reps) {
				exercise.allTimeMaxReps = {
					...(hasWeight && maxRepsSet.weight !== undefined && { weight: maxRepsSet.weight }),
					reps: maxRepsSet.reps,
					date: session.date
				};
			}
		}

		// Обновляем allTimeMaxWeight (максимальный вес за все время) - только для упражнений с весом
		if (hasWeight) {
			for (const session of exercise.history) {
				const maxWeightSet = session.sets.reduce((max, set) => 
					(set.weight !== undefined && (max.weight === undefined || set.weight > max.weight)) ? set : max
				);
				
				if (maxWeightSet.weight !== undefined) {
					if (!exercise.allTimeMaxWeight || maxWeightSet.weight > exercise.allTimeMaxWeight.weight) {
						exercise.allTimeMaxWeight = {
							weight: maxWeightSet.weight,
							reps: maxWeightSet.reps,
							date: session.date
						};
					}
				}
			}
		}

		console.log('[ExerciseCache] Добавлено:', exerciseName, 'дата:', date, 'подходов:', sets.length);
	}

	getExerciseData(exerciseName: string): ExerciseData | null {
		return this.cache.exercises[exerciseName] || null;
	}

	getAllExercises(): Record<string, ExerciseData> {
		return this.cache.exercises;
	}

	getCachedFilesCount(): number {
		return this.cache.cachedFiles.length;
	}

	async clearCache(): Promise<void> {
		this.cache = this.getDefaultCache();
		await this.save();
		console.log('[ExerciseCache] Кэш очищен');
	}
}
