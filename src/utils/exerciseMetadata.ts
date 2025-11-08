import { App } from 'obsidian';

export interface ExerciseMetadata {
	name: string;
	hasWeight: boolean;
	imageLink?: string; // Ссылка на изображение упражнения
}

export interface ExerciseMetadataStore {
	version: string;
	exercises: Record<string, ExerciseMetadata>;
}

export class ExerciseMetadataManager {
	private app: App;
	private metadataFilePath: string;
	private metadata: ExerciseMetadataStore;

	constructor(app: App, pluginDir: string) {
		this.app = app;
		this.metadataFilePath = `${pluginDir}/exercise-metadata.json`;
		this.metadata = this.getDefaultMetadata();
	}

	private getDefaultMetadata(): ExerciseMetadataStore {
		return {
			version: '1.0.0',
			exercises: {}
		};
	}

	async load(): Promise<void> {
		try {
			const adapter = this.app.vault.adapter;
			// metadataFilePath уже относительный путь (начинается с .obsidian)
			const filePath = this.metadataFilePath;
			
			console.log('[ExerciseMetadata] 📂 Попытка загрузить:', filePath);
			
			if (await adapter.exists(filePath)) {
				console.log('[ExerciseMetadata] ✅ Файл существует');
				const data = await adapter.read(filePath);
				console.log('[ExerciseMetadata] 📄 Размер данных:', data.length, 'байт');
				this.metadata = JSON.parse(data);
				console.log('[ExerciseMetadata] ✅ Метаданные загружены, упражнений:', Object.keys(this.metadata.exercises).length);
				console.log('[ExerciseMetadata] 📋 Список упражнений:', Object.keys(this.metadata.exercises).slice(0, 10).join(', '), '...');
			} else {
				console.log('[ExerciseMetadata] ⚠️ Файл метаданных не найден, создаём новый');
			}
		} catch (error) {
			console.error('[ExerciseMetadata] ❌ Ошибка загрузки метаданных:', error);
			this.metadata = this.getDefaultMetadata();
		}
	}

	async save(): Promise<void> {
		try {
			const adapter = this.app.vault.adapter;
			// metadataFilePath уже относительный путь
			const filePath = this.metadataFilePath;
			
			await adapter.write(filePath, JSON.stringify(this.metadata, null, 2));
			console.log('[ExerciseMetadata] Метаданные сохранены');
		} catch (error) {
			console.error('[ExerciseMetadata] Ошибка сохранения метаданных:', error);
		}
	}

	async addExercise(name: string, hasWeight: boolean, imageLink?: string): Promise<void> {
		this.metadata.exercises[name] = { name, hasWeight, imageLink };
		await this.save();
		console.log('[ExerciseMetadata] Добавлено упражнение:', name, 'hasWeight:', hasWeight, 'imageLink:', imageLink);
	}

	async removeExercise(name: string): Promise<void> {
		if (this.metadata.exercises[name]) {
			delete this.metadata.exercises[name];
			await this.save();
			console.log('[ExerciseMetadata] Удалено упражнение:', name);
		}
	}

	hasWeight(exerciseName: string): boolean | null {
		console.log('[ExerciseMetadata] 🔍 Поиск метаданных для:', exerciseName);
		console.log('[ExerciseMetadata] 📊 HEX:', Array.from(exerciseName).map(c => c.charCodeAt(0).toString(16)).join(' '));
		
		// Нормализуем Unicode (приводим к NFD, затем обратно к NFC)
		const normalizedInput = exerciseName.normalize('NFC');
		
		// Сначала пробуем точное совпадение
		let exercise = this.metadata.exercises[normalizedInput];
		
		if (exercise) {
			console.log('[ExerciseMetadata] ✅ Найдено точное совпадение, hasWeight:', exercise.hasWeight);
			return exercise.hasWeight;
		}
		
		// Пробуем все ключи с нормализацией
		const normalizedKeys = Object.keys(this.metadata.exercises).map(key => ({
			original: key,
			normalized: key.normalize('NFC')
		}));
		
		// Поиск точного совпадения после нормализации
		for (const {original, normalized} of normalizedKeys) {
			if (normalized === normalizedInput) {
				console.log('[ExerciseMetadata] ✅ Найдено после Unicode нормализации:', original);
				return this.metadata.exercises[original].hasWeight;
			}
		}
		
		// Если не найдено, пробуем замену ё→е (используем charCode)
		const withE = normalizedInput.replace(/\u0451/g, 'е').replace(/\u0401/g, 'Е');
		console.log('[ExerciseMetadata] 🔄 Пробуем нормализацию (ё→е):', withE);
		
		exercise = this.metadata.exercises[withE];
		if (exercise) {
			console.log('[ExerciseMetadata] ✅ Найдено через нормализацию (ё→е), hasWeight:', exercise.hasWeight);
			return exercise.hasWeight;
		}
		
		// Пробуем поиск с заменой ё→е в ключах
		for (const key of Object.keys(this.metadata.exercises)) {
			const keyWithE = key.normalize('NFC').replace(/\u0451/g, 'е').replace(/\u0401/g, 'Е');
			if (keyWithE === withE) {
				console.log('[ExerciseMetadata] ✅ Найдено в ключах после замены ё→е:', key);
				return this.metadata.exercises[key].hasWeight;
			}
		}
		
		// Если всё ещё не найдено, пробуем обратную нормализацию (е→ё)
		const withYo = normalizedInput.replace(/подъем/gi, 'подъём').replace(/Подъем/g, 'Подъём');
		console.log('[ExerciseMetadata] 🔄 Пробуем обратную нормализацию (е→ё):', withYo);
		
		exercise = this.metadata.exercises[withYo];
		if (exercise) {
			console.log('[ExerciseMetadata] ✅ Найдено через обратную нормализацию (е→ё), hasWeight:', exercise.hasWeight);
			return exercise.hasWeight;
		}
		
		// Ничего не найдено - выводим отладочную информацию
		console.log('[ExerciseMetadata] ⚠️ Упражнение НЕ НАЙДЕНО после всех попыток');
		console.log('[ExerciseMetadata] 📋 Доступные ключи (первые 10):', Object.keys(this.metadata.exercises).slice(0, 10));
		console.log('[ExerciseMetadata] 📊 Всего упражнений:', Object.keys(this.metadata.exercises).length);
		
		// Проверим, есть ли похожие упражнения
		const similar = Object.keys(this.metadata.exercises).filter(key => 
			key.toLowerCase().includes('дельты') || key.toLowerCase().includes('гантел')
		);
		if (similar.length > 0) {
			console.log('[ExerciseMetadata] 🔎 Похожие упражнения:', similar);
		}
		
		return null;
	}

	getAll(): Record<string, ExerciseMetadata> {
		return this.metadata.exercises;
	}

	async syncFromRegistry(exerciseRegistry: Array<{ name: string; hasWeight: boolean }>): Promise<void> {
		console.log('[ExerciseMetadata] Синхронизация с реестром упражнений...');
		
		// Добавляем/обновляем упражнения из реестра
		for (const exercise of exerciseRegistry) {
			// Сохраняем существующий imageLink, если он есть
			const existingImageLink = this.metadata.exercises[exercise.name]?.imageLink;
			
			this.metadata.exercises[exercise.name] = {
				name: exercise.name,
				hasWeight: exercise.hasWeight,
				imageLink: existingImageLink
			};
		}

		await this.save();
		console.log('[ExerciseMetadata] Синхронизация завершена');
	}

	/**
	 * Синхронизирует exercise-metadata.json с файлами в папке Exercises
	 * Добавляет новые упражнения из файловой системы
	 * Удаляет упражнения, которых нет в файловой системе
	 * @param exercisesPath Путь к папке Exercises (например, "Workout/Exercises")
	 * @param exerciseRegistry Реестр упражнений из настроек для определения hasWeight
	 * @returns Объект с информацией о количестве добавленных и удаленных упражнений
	 */
	async syncWithFileSystem(
		exercisesPath: string, 
		exerciseRegistry: Array<{ name: string; hasWeight: boolean }>
	): Promise<{ added: number; removed: number }> {
		console.log('[ExerciseMetadata] 🔄 Синхронизация с файловой системой...');
		console.log('[ExerciseMetadata] 📂 Путь к упражнениям:', exercisesPath);
		
		let added = 0;
		let removed = 0;

		try {
			// Получаем список файлов из папки Exercises
			const files = this.app.vault.getMarkdownFiles();
			const exerciseFiles = files.filter(f => f.path.startsWith(exercisesPath) && f.extension === 'md');
			
			console.log('[ExerciseMetadata] 📁 Найдено файлов упражнений:', exerciseFiles.length);
			
			// Создаем Set с именами файлов (без расширения)
			const fileNames = new Set<string>();
			exerciseFiles.forEach(file => {
				const exerciseName = file.basename;
				fileNames.add(exerciseName);
			});
			
			// 1. Добавляем новые упражнения из файловой системы
			for (const exerciseName of fileNames) {
				if (!this.metadata.exercises[exerciseName]) {
					// Определяем hasWeight из реестра или ставим false по умолчанию
					const registryEntry = exerciseRegistry.find(ex => ex.name === exerciseName);
					const hasWeight = registryEntry?.hasWeight ?? false;
					
					this.metadata.exercises[exerciseName] = {
						name: exerciseName,
						hasWeight: hasWeight
					};
					
					added++;
					console.log('[ExerciseMetadata] ➕ Добавлено новое упражнение:', exerciseName, 'hasWeight:', hasWeight);
				}
			}
			
			// 2. Удаляем упражнения, которых нет в файловой системе
			const metadataKeys = Object.keys(this.metadata.exercises);
			for (const exerciseName of metadataKeys) {
				if (!fileNames.has(exerciseName)) {
					delete this.metadata.exercises[exerciseName];
					removed++;
					console.log('[ExerciseMetadata] ➖ Удалено упражнение (файл не найден):', exerciseName);
				}
			}
			
			// Сохраняем изменения
			if (added > 0 || removed > 0) {
				await this.save();
				console.log('[ExerciseMetadata] ✅ Синхронизация завершена. Добавлено:', added, 'Удалено:', removed);
			} else {
				console.log('[ExerciseMetadata] ✅ Синхронизация завершена. Изменений нет.');
			}
			
		} catch (error) {
			console.error('[ExerciseMetadata] ❌ Ошибка синхронизации с файловой системой:', error);
		}
		
		return { added, removed };
	}

	/**
	 * Сканирует файлы логов и собирает изображения упражнений
	 * Изображения находятся над заголовком 3-го уровня с названием упражнения
	 * @param logsPath Путь к папке Logs (например, "Workout/Logs")
	 * @returns Объект с информацией о количестве обновленных упражнений
	 */
	async updateImagesFromLogs(logsPath: string): Promise<{ updated: number; scanned: number }> {
		console.log('[ExerciseMetadata] 🖼️ Сканирование логов для поиска изображений...');
		console.log('[ExerciseMetadata] 📂 Путь к логам:', logsPath);
		
		let updated = 0;
		let scanned = 0;

		try {
			// Получаем все файлы логов
			const files = this.app.vault.getMarkdownFiles();
			const logFiles = files.filter(f => f.path.startsWith(logsPath) && f.extension === 'md');
			
			console.log('[ExerciseMetadata] 📁 Найдено файлов логов:', logFiles.length);
			
			// Регулярное выражение для поиска изображений перед заголовком 3 уровня
			// Формат: ![[image.png|400]] или ![[image.png]]
			// за которым следует ### Название упражнения
			const imageBeforeH3Regex = /!\[\[([^\]]+)\]\][\s\S]*?###\s+(?:\[\[)?([^\]\n]+?)(?:\]\])?\s*$/gm;
			
			for (const logFile of logFiles) {
				scanned++;
				
				try {
					const content = await this.app.vault.read(logFile);
					
					// Разбиваем контент на строки для более точного поиска
					const lines = content.split('\n');
					
					for (let i = 0; i < lines.length; i++) {
						const line = lines[i].trim();
						
						// Ищем заголовок 3 уровня с названием упражнения
						const h3Match = line.match(/^###\s+(?:\[\[)?([^\]\n]+?)(?:\]\])?\s*$/);
						
						if (h3Match) {
							const exerciseName = h3Match[1].trim();
							
							// Проверяем, есть ли это упражнение в метаданных
							if (!this.metadata.exercises[exerciseName]) {
								console.log('[ExerciseMetadata] ⚠️ Упражнение не найдено в метаданных:', exerciseName);
								continue;
							}
							
							// Ищем изображение над заголовком (в предыдущих строках)
							let imageLink: string | null = null;
							
							// Проверяем до 3 строк назад (чтобы учесть пустые строки)
							for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
								const prevLine = lines[j].trim();
								
								// Ищем паттерн ![[image.png|400]] или ![[image.png]]
								const imageMatch = prevLine.match(/^!\[\[([^\]]+)\]\]$/);
								
								if (imageMatch) {
									imageLink = prevLine; // Сохраняем полную строку с изображением
									break;
								}
								
								// Если встретили непустую строку, которая не изображение, прекращаем поиск
								if (prevLine && !imageMatch) {
									break;
								}
							}
							
							// Обновляем метаданные, если нашли изображение
							if (imageLink) {
								const currentImageLink = this.metadata.exercises[exerciseName].imageLink;
								
								// Обновляем только если изображения нет или оно отличается
								if (!currentImageLink || currentImageLink !== imageLink) {
									this.metadata.exercises[exerciseName].imageLink = imageLink;
									updated++;
									console.log('[ExerciseMetadata] 🖼️ Обновлено изображение для:', exerciseName, '→', imageLink);
								}
							}
						}
					}
					
				} catch (error) {
					console.error('[ExerciseMetadata] ❌ Ошибка чтения файла лога:', logFile.path, error);
				}
			}
			
			// Сохраняем изменения, если были обновления
			if (updated > 0) {
				await this.save();
				console.log('[ExerciseMetadata] ✅ Обновление изображений завершено. Обновлено:', updated);
			} else {
				console.log('[ExerciseMetadata] ✅ Изображения не требуют обновления');
			}
			
		} catch (error) {
			console.error('[ExerciseMetadata] ❌ Ошибка сканирования логов:', error);
		}
		
		return { updated, scanned };
	}

	/**
	 * Полное обновление метаданных: синхронизация с файловой системой и сбор изображений
	 * @param exercisesPath Путь к папке Exercises
	 * @param logsPath Путь к папке Logs
	 * @param exerciseRegistry Реестр упражнений из настроек
	 */
	async fullUpdate(
		exercisesPath: string,
		logsPath: string,
		exerciseRegistry: Array<{ name: string; hasWeight: boolean }>
	): Promise<{ exercises: { added: number; removed: number }; images: { updated: number; scanned: number } }> {
		console.log('[ExerciseMetadata] 🔄 Полное обновление метаданных...');
		
		// 1. Синхронизация с файловой системой
		const exercisesResult = await this.syncWithFileSystem(exercisesPath, exerciseRegistry);
		
		// 2. Сбор изображений из логов
		const imagesResult = await this.updateImagesFromLogs(logsPath);
		
		console.log('[ExerciseMetadata] ✅ Полное обновление завершено');
		
		return {
			exercises: exercisesResult,
			images: imagesResult
		};
	}
}
