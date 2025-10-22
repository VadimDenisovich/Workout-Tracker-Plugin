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
	private normalizedNameMap: Map<string, string>; // Map: нормализованное имя -> оригинальное имя

	constructor(app: App, pluginDir: string, metadataManager: ExerciseMetadataManager) {
		this.app = app;
		this.cacheFilePath = `${pluginDir}/exercise-cache.json`;
		this.cache = this.getDefaultCache();
		this.metadataManager = metadataManager;
		this.normalizedNameMap = new Map();
	}

	/**
	 * Нормализует название упражнения:
	 * - Приводит к нижнему регистру
	 * - Заменяет ё на е
	 * - Удаляет лишние пробелы
	 */
	private normalizeExerciseName(name: string): string {
		return name
			.toLowerCase()
			.replace(/ё/g, 'е')
			.trim()
			.replace(/\s+/g, ' ');
	}

	/**
	 * Обновляет карту нормализованных имён для быстрого поиска
	 */
	private rebuildNormalizedNameMap(): void {
		this.normalizedNameMap.clear();
		for (const exerciseName of Object.keys(this.cache.exercises)) {
			const normalized = this.normalizeExerciseName(exerciseName);
			this.normalizedNameMap.set(normalized, exerciseName);
		}
		console.log('[ExerciseCache] Карта нормализованных имён обновлена:', this.normalizedNameMap.size, 'упражнений');
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
			
			// cacheFilePath уже относительный путь (начинается с .obsidian)
			const filePath = this.cacheFilePath;
			
			console.log('[ExerciseCache] Загрузка кэша из:', filePath);
			
			if (await adapter.exists(filePath)) {
				const data = await adapter.read(filePath);
				this.cache = JSON.parse(data);
				console.log('[ExerciseCache] Кэш загружен, упражнений:', Object.keys(this.cache.exercises).length);
				this.rebuildNormalizedNameMap();
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
			
			// cacheFilePath уже относительный путь
			const filePath = this.cacheFilePath;
			
			console.log('[ExerciseCache] Сохранение кэша в:', filePath);
			await adapter.write(filePath, JSON.stringify(this.cache, null, 2));
			console.log('[ExerciseCache] Кэш сохранён');
		} catch (error) {
			console.error('[ExerciseCache] Ошибка сохранения кэша:', error);
		}
	}

	async rebuildCache(logsFolder: string): Promise<number> {
		console.log('[ExerciseCache] Начинаем rebuild кэша...');
		console.log('[ExerciseCache] Папка логов:', logsFolder);
		
		const logsPath = logsFolder.endsWith('/') ? logsFolder : `${logsFolder}/`;
		console.log('[ExerciseCache] Нормализованный путь:', logsPath);
		
		const allFiles = this.app.vault.getMarkdownFiles()
			.filter(file => file.path.startsWith(logsPath) && file.path.endsWith('.md'));

		console.log('[ExerciseCache] Найдено файлов логов:', allFiles.length);
		console.log('[ExerciseCache] Уже закэшировано файлов:', this.cache.cachedFiles.length);
		
		// Отладка: показываем первые несколько путей файлов
		if (allFiles.length > 0) {
			console.log('[ExerciseCache] Примеры найденных файлов:', allFiles.slice(0, 3).map(f => f.path).join(', '));
		} else {
			// Показываем все markdown файлы для отладки
			const allMd = this.app.vault.getMarkdownFiles();
			console.log('[ExerciseCache] ⚠️ Не найдено файлов! Всего MD файлов в хранилище:', allMd.length);
			if (allMd.length > 0) {
				console.log('[ExerciseCache] Примеры путей MD файлов:', allMd.slice(0, 5).map(f => f.path).join(', '));
			}
		}

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
		this.rebuildNormalizedNameMap(); // Обновляем карту после добавления новых упражнений
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
					// Извлекаем название упражнения, убирая ### и возможную ссылку [[название]]
					let exerciseText = line.replace(/^###\s*/, '').trim();
					
					// Проверяем, есть ли ссылка в формате [[Exercises/Название|Название]] или [[Название]]
					const linkMatch = exerciseText.match(/\[\[(?:Exercises\/)?([^\]|]+)(?:\|[^\]]+)?\]\]/);
					if (linkMatch) {
						currentExercise = linkMatch[1].trim();
					} else {
						// Если нет ссылки, используем текст как есть
						currentExercise = exerciseText;
					}
					
					console.log('[ExerciseCache] Найдено упражнение:', currentExercise, 'в файле:', file.basename);
					
					// Определяем тип упражнения из метаданных
					const metadataHasWeight = this.metadataManager.hasWeight(currentExercise);
					hasWeight = metadataHasWeight !== null ? metadataHasWeight : false;
					
					console.log('[ExerciseCache] Метаданные для', currentExercise, '- hasWeight:', hasWeight, 'metadata:', metadataHasWeight);
					
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
						console.log('[ExerciseCache] Добавлен подход с весом для', currentExercise, ':', weight, 'кг x', reps, 'раз');
					} else {
						// Упражнение без веса (только повторения)
						const simpleReps = details.match(simpleRepsRegex);
						if (simpleReps) {
							const reps = parseInt(simpleReps[1]);
							exerciseData.sets.push({ reps }); // Без weight
							console.log('[ExerciseCache] Добавлен подход без веса для', currentExercise, ':', reps, 'раз');
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
		console.log('[ExerciseCache] 🔍 getExerciseData вызван для:', exerciseName);
		console.log('[ExerciseCache] 📊 HEX запроса:', Array.from(exerciseName).map(c => c.charCodeAt(0).toString(16)).join(' '));
		
		// Нормализуем Unicode (как в metadataManager)
		const normalizedInput = exerciseName.normalize('NFC');
		
		// Сначала пытаемся найти точное совпадение
		if (this.cache.exercises[normalizedInput]) {
			console.log('[ExerciseCache] ✅ Найдено точное совпадение');
			return this.cache.exercises[normalizedInput];
		}
		
		// Пробуем все ключи с нормализацией
		for (const key of Object.keys(this.cache.exercises)) {
			if (key.normalize('NFC') === normalizedInput) {
				console.log('[ExerciseCache] ✅ Найдено через Unicode нормализацию:', key);
				return this.cache.exercises[key];
			}
		}
		
		// Если не нашли, ищем через нормализованное имя (старый метод)
		const normalized = this.normalizeExerciseName(exerciseName);
		const originalName = this.normalizedNameMap.get(normalized);
		
		if (originalName && this.cache.exercises[originalName]) {
			console.log('[ExerciseCache] ✅ Найдено упражнение через normalizedNameMap:', exerciseName, '->', originalName);
			return this.cache.exercises[originalName];
		}
		
		console.log('[ExerciseCache] ❌ Упражнение НЕ НАЙДЕНО');
		console.log('[ExerciseCache] 📋 Доступные ключи (первые 5):', Object.keys(this.cache.exercises).slice(0, 5));
		
		return null;
	}

	getAllExercises(): Record<string, ExerciseData> {
		return this.cache.exercises;
	}

	getCachedFilesCount(): number {
		return this.cache.cachedFiles.length;
	}

	async clearCache(): Promise<void> {
		this.cache = this.getDefaultCache();
		this.normalizedNameMap.clear();
		await this.save();
		console.log('[ExerciseCache] Кэш очищен');
	}

	async recacheFile(file: TFile): Promise<void> {
		console.log('[ExerciseCache] 🔄 Пересчёт кэша для файла:', file.path);
		
		// Удаляем файл из списка закэшированных
		const fileIndex = this.cache.cachedFiles.indexOf(file.path);
		if (fileIndex !== -1) {
			this.cache.cachedFiles.splice(fileIndex, 1);
			console.log('[ExerciseCache] Файл удалён из списка закэшированных');
		}

		// Извлекаем дату из имени файла
		const dateMatch = file.basename.match(/^(\d{4}-\d{2}-\d{2})/);
		if (!dateMatch) {
			console.warn('[ExerciseCache] Не удалось извлечь дату из файла:', file.path);
			return;
		}
		const workoutDate = dateMatch[1];

		// Удаляем все данные упражнений за эту дату
		for (const exerciseName in this.cache.exercises) {
			const exercise = this.cache.exercises[exerciseName];
			
			// Удаляем сессию с этой датой
			const sessionIndex = exercise.history.findIndex(s => s.date === workoutDate);
			if (sessionIndex !== -1) {
				exercise.history.splice(sessionIndex, 1);
				console.log('[ExerciseCache] Удалена сессия:', exerciseName, 'дата:', workoutDate);
			}

			// Пересчитываем статистику
			if (exercise.history.length > 0) {
				exercise.history.sort((a, b) => b.date.localeCompare(a.date));
				exercise.lastWorkout = exercise.history[0];

				// Пересчёт allTimeMaxReps
				exercise.allTimeMaxReps = null;
				for (const session of exercise.history) {
					const maxRepsSet = session.sets.reduce((max, set) => 
						set.reps > max.reps ? set : max
					);
					
					if (!exercise.allTimeMaxReps || maxRepsSet.reps > exercise.allTimeMaxReps.reps) {
						exercise.allTimeMaxReps = {
							...(exercise.hasWeight && maxRepsSet.weight !== undefined && { weight: maxRepsSet.weight }),
							reps: maxRepsSet.reps,
							date: session.date
						};
					}
				}

				// Пересчёт allTimeMaxWeight
				if (exercise.hasWeight) {
					exercise.allTimeMaxWeight = null;
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
			} else {
				// Если нет истории - удаляем упражнение
				delete this.cache.exercises[exerciseName];
				console.log('[ExerciseCache] Удалено упражнение (нет истории):', exerciseName);
			}
		}

		// Заново парсим файл
		await this.parseLogFile(file);
		
		// Обновляем карту нормализованных имён
		this.rebuildNormalizedNameMap();
		
		// Сохраняем кэш
		await this.save();
		console.log('[ExerciseCache] ✅ Кэш файла обновлён и сохранён');
	}
}
