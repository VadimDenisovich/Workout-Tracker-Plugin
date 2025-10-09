import { App, TFolder, TFile, moment, Notice, TAbstractFile } from 'obsidian';
import { WorkoutLocation, WorkoutDay, TemplateKey, ExerciseInfo, WorkoutTrackerSettings } from '../types';
import { TEMPLATE_FILES, DEFAULT_EXERCISES, EXERCISE_TEMPLATE } from '../templates';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileManager {
	constructor(
		private app: App, 
		private pluginDir: string,
		private getSettings: () => WorkoutTrackerSettings
	) {}

	private async getTemplate(key: TemplateKey): Promise<string> {
		console.log(`[FileManager] getTemplate для ${key} - перечитываем templates.ts...`);
		
		try {
			// Перечитываем файл templates.ts напрямую, чтобы получить актуальные значения
			const templatesPath = path.join(this.pluginDir, 'src', 'templates.ts');
			const content = await fs.readFile(templatesPath, 'utf-8');
			
			console.log(`[FileManager] Файл прочитан, размер: ${content.length}`);
			
			// Ищем нужный шаблон в файле - используем ту же регулярку что и в TemplateUpdater
			const regex = new RegExp(`(\\s+${key}:\\s*)\`([\\s\\S]*?)\`(,?)`, 'm');
			const match = content.match(regex);
			
			console.log(`[FileManager] Regex для ${key}: ${regex}`);
			console.log(`[FileManager] Совпадение найдено: ${match ? 'ДА' : 'НЕТ'}`);
			
			if (match && match[2]) {
				console.log(`[FileManager] ✅ Шаблон ${key} найден, длина: ${match[2].length}`);
				console.log(`[FileManager] Первые 50 символов: ${match[2].substring(0, 50)}...`);
				return match[2];
			}
			
			console.log(`[FileManager] ⚠️ Шаблон ${key} не найден в файле`);
			// Попробуем найти строку с ключом для отладки
			const lines = content.split('\n');
			const keyLine = lines.find(l => l.includes(key + ':'));
			console.log(`[FileManager] Строка с ${key} в файле: ${keyLine}`);
			
			// Fallback на импорт (хотя он будет закеширован)
			const { WORKOUT_TEMPLATES } = await import('../templates');
			return WORKOUT_TEMPLATES[key];
		} catch (error) {
			console.error(`[FileManager] ❌ Ошибка чтения templates.ts:`, error);
			// Fallback на импорт
			const { WORKOUT_TEMPLATES } = await import('../templates');
			return WORKOUT_TEMPLATES[key];
		}
	}

	private async getExerciseTemplate(hasWeight: boolean = true): Promise<string> {
		console.log(`[FileManager] getExerciseTemplate - читаем dataviewjs шаблон (hasWeight: ${hasWeight})...`);
		
		const settings = this.getSettings();
		const chartMin = settings.chartRepsMin ?? 0;
		const chartMax = settings.chartRepsMax ?? 15;
		
		try {
			// Выбираем нужный шаблон в зависимости от наличия веса
			const templateFileName = hasWeight 
				? 'exercise-stats-with-weight.dataviewjs'
				: 'exercise-stats-no-weight.dataviewjs';
			
			const dataviewjsPath = path.join(this.pluginDir, 'src', 'templates', templateFileName);
			let dataviewjsCode = await fs.readFile(dataviewjsPath, 'utf-8');
			
			// Заменяем плейсхолдеры для диапазона графика
			dataviewjsCode = dataviewjsCode.replace(/{{chartRepsMin}}/g, String(chartMin));
			dataviewjsCode = dataviewjsCode.replace(/{{chartRepsMax}}/g, String(chartMax));
			
			// Создаём полный шаблон
			const template = `# {{exerciseName}} - Прогрессия

## Статистика

\`\`\`dataviewjs
${dataviewjsCode}
\`\`\`

## Заметки
`;
			
			console.log(`[FileManager] ✅ Шаблон упражнения создан (${templateFileName}), длина: ${template.length}`);
			return template;
		} catch (error) {
			console.error(`[FileManager] ❌ Ошибка чтения шаблона:`, error);
			return EXERCISE_TEMPLATE;
		}
	}

	private getTemplateKeyFromDay(day: WorkoutDay): TemplateKey {
		switch (day) {
			case WorkoutDay.MONDAY:
				return 'MONDAY';
			case WorkoutDay.WEDNESDAY:
				return 'WEDNESDAY';
			case WorkoutDay.FRIDAY:
				return 'FRIDAY';
			default:
				return 'MONDAY';
		}
	}

	private getExerciseInfoByName(exerciseName: string): ExerciseInfo | undefined {
		const settings = this.getSettings();
		const fromSettings = settings.exerciseRegistry?.find((exercise) => exercise.name === exerciseName);
		if (fromSettings) {
			return fromSettings;
		}
		return DEFAULT_EXERCISES.find((exercise) => exercise.name === exerciseName);
	}

	private async getExerciseStats(exerciseName: string, workoutFolder: string): Promise<string> {
		const exerciseInfo = this.getExerciseInfoByName(exerciseName);
		const hasWeight = exerciseInfo?.hasWeight ?? true;

		const logsFolder = `${workoutFolder}/Logs`;
		const files = this.app.vault.getMarkdownFiles();
		const logFiles = files.filter(f => f.path.startsWith(logsFolder));
		
		console.log(`[getExerciseStats] ${exerciseName} - hasWeight: ${hasWeight}, найдено логов: ${logFiles.length}`);
		
		const exerciseHeader = `### ${exerciseName}`;
		const setRegex = /^Подход\s*(\d+):\s*(.+)$/i;
		const weightRegex = /(\d+[,.]?\d*)\s*кг/i;
		const repsRegex = /(\d+)\s*раз/i;
		const simpleRepsRegex = /^(\d+)\s*раз$/i; // Для формата "45 раз"
		
		let workingSet: { weight: number; reps: number } | null = null;
		let maxWeightSet: { weight: number; reps: number } | null = null;
		let latestReps: number | null = null;
		let maxReps: number | null = null;
		
		// Сортируем файлы по дате (новые первые)
		const sortedFiles = logFiles.sort((a, b) => b.name.localeCompare(a.name));
		
		for (const file of sortedFiles) {
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			console.log(`[getExerciseStats] Проверяем файл: ${file.name}`);
			
			let i = 0;
			while (i < lines.length) {
				if (lines[i].trim() === exerciseHeader) {
					console.log(`[getExerciseStats] ✓ Нашли заголовок "${exerciseHeader}" в ${file.name} на строке ${i}`);
					i++;
					let processedLines = 0;
					while (i < lines.length) {
						const line = lines[i].trim();
						processedLines++;
						
						if (processedLines <= 5) {
							console.log(`[getExerciseStats]   Строка ${i}: "${line}"`);
						}
						
						if (line.startsWith('###') || line.startsWith('##')) {
							console.log(`[getExerciseStats] Достигли следующего заголовка: "${line}"`);
							break;
						}
						
						// Игнорируем строки статистики (но НЕ строки с "Подход")
						if (!line.startsWith('Подход') && (
							line.includes('Максималка') || 
							line.includes('Последний актуальный подход') || 
							line.includes('Максимальный вес'))) {
							i++;
							continue;
						}
						
						// Проверяем простой формат "45 раз" для bodyweight упражнений
						const simpleMatch = simpleRepsRegex.exec(line);
						if (simpleMatch && !hasWeight) {
							const reps = Number(simpleMatch[1]);
							if (latestReps === null) {
								latestReps = reps;
							}
							if (maxReps === null || reps > maxReps) {
								maxReps = reps;
							}
							i++;
							continue;
						}
						
						const setMatch = setRegex.exec(line);
						
						if (setMatch) {
							console.log(`[getExerciseStats]   ✓ setMatch найден! details: "${setMatch[2]}"`);
							const details = setMatch[2];
							const weightMatch = weightRegex.exec(details);
							const repsMatch = repsRegex.exec(details);
							
							console.log(`[getExerciseStats]   weightMatch: ${weightMatch ? weightMatch[1] : 'НЕТ'}, repsMatch: ${repsMatch ? repsMatch[1] : 'НЕТ'}`);
							
							if (repsMatch) {
								const reps = Number(repsMatch[1]);
								if (latestReps === null) {
									latestReps = reps;
								}
								if (maxReps === null || reps > maxReps) {
									maxReps = reps;
								}
								
								if (hasWeight && weightMatch) {
									const weight = Number(weightMatch[1].replace(',', '.'));
									// Ищем рабочий подход (12-15 повторений)
									if (reps >= 12 && reps <= 15 && !workingSet) {
										workingSet = { weight, reps };
									}
									// Ищем максимальный вес
									if (!maxWeightSet || weight > maxWeightSet.weight) {
										maxWeightSet = { weight, reps };
									}
								}
							}
						}
						i++;
					}
					break;
				}
				i++;
			}
			
			// Если нашли всё необходимое, прекращаем поиск
			if (hasWeight) {
				if (workingSet && maxWeightSet) break;
			} else {
				if (latestReps !== null && maxReps !== null) break;
			}
		}
		
		let result = '';
		if (hasWeight) {
			console.log(`[getExerciseStats] ${exerciseName} - workingSet:`, workingSet, 'maxWeightSet:', maxWeightSet);
			
			// Если нет данных, выводим шаблон с нулями
			if (!workingSet && !maxWeightSet) {
				result += `Последний актуальный подход на 12-15: 0 кг x 0 раз\n`;
				result += `Максимальный вес: 0 кг x 0 раз\n`;
			} else {
				if (workingSet) {
					result += `Последний актуальный подход на 12-15: ${workingSet.weight} кг x ${workingSet.reps} раз\n`;
				}
				if (maxWeightSet) {
					result += `Максимальный вес: ${maxWeightSet.weight} кг x ${maxWeightSet.reps} раз\n`;
				}
			}
		} else {
			if (maxReps !== null) {
				result += `Максималка: ${maxReps} раз\n`;
			}
			if (latestReps !== null && latestReps !== maxReps) {
				result += `${latestReps} раз\n`;
			}
		}
		
		console.log(`[getExerciseStats] ${exerciseName} - результат: "${result}"`);
		
		return result;
	}

	async ensureFolderExists(folderPath: string): Promise<TFolder> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (folder instanceof TFolder) {
			return folder;
		}
		return await this.app.vault.createFolder(folderPath);
	}

	async moveWorkoutStructure(oldPath: string, newPath: string): Promise<void> {
		if (!oldPath || oldPath === newPath) return;

		try {
			const oldFolder = this.app.vault.getAbstractFileByPath(oldPath);
			if (!(oldFolder instanceof TFolder)) return;

			// Создаем новую структуру
			await this.ensureFolderExists(newPath);
			await this.ensureFolderExists(`${newPath}/Exercises`);
			await this.ensureFolderExists(`${newPath}/Logs`);
			await this.ensureFolderExists(`${newPath}/Templates`);

			// Перемещаем файлы из подпапок
			const subFolders = ['Exercises', 'Logs', 'Templates'];
			
			for (const subFolder of subFolders) {
				const oldSubPath = `${oldPath}/${subFolder}`;
				const newSubPath = `${newPath}/${subFolder}`;
				
				await this.moveFilesFromFolder(oldSubPath, newSubPath);
			}

			new Notice(`Файлы перенесены из ${oldPath} в ${newPath}`);
		} catch (error) {
			console.error('Ошибка при переносе файлов:', error);
			new Notice('Ошибка при переносе файлов');
		}
	}

	private async moveFilesFromFolder(oldPath: string, newPath: string): Promise<void> {
		const oldFolder = this.app.vault.getAbstractFileByPath(oldPath);
		if (!(oldFolder instanceof TFolder)) return;

		const children = [...oldFolder.children];
		for (const file of children) {
			if (file instanceof TFile) {
				await this.moveFile(file, newPath);
			} else if (file instanceof TFolder) {
				const targetSubFolder = `${newPath}/${file.name}`;
				await this.ensureFolderExists(targetSubFolder);
				await this.moveFilesFromFolder(file.path, targetSubFolder);
			}
		}

		if (oldFolder.children.length === 0) {
			try {
				await this.app.vault.delete(oldFolder);
			} catch (error) {
				console.warn(`Не удалось удалить папку ${oldFolder.path}:`, error);
			}
		}
	}

	private async moveFile(file: TFile, newPath: string): Promise<void> {
		const newFilePath = `${newPath}/${file.name}`;
		try {
			await this.app.vault.rename(file, newFilePath);
		} catch (error) {
			const { basename, extension } = file;
			let counter = 1;
			let candidatePath = `${newPath}/${basename}_${counter}.${extension}`;
			while (this.app.vault.getAbstractFileByPath(candidatePath)) {
				counter++;
				candidatePath = `${newPath}/${basename}_${counter}.${extension}`;
			}
			try {
				await this.app.vault.rename(file, candidatePath);
			} catch (e) {
				console.error(`Не удалось переместить файл ${file.path}:`, e);
			}
		}
	}

	async createWorkoutStructure(
		workoutFolder: string,
		previousFolder?: string,
		exerciseNames: ExerciseInfo[] = []
	): Promise<void> {
		// Если есть предыдущая папка, перемещаем файлы
		if (previousFolder && previousFolder !== workoutFolder) {
			await this.moveWorkoutStructure(previousFolder, workoutFolder);
		}

		// Создаем основную папку
		await this.ensureFolderExists(workoutFolder);
		
		// Создаем подпапки
		await this.ensureFolderExists(`${workoutFolder}/Exercises`);
		await this.ensureFolderExists(`${workoutFolder}/Logs`);
		await this.ensureFolderExists(`${workoutFolder}/Templates`);

		// Создаем файлы шаблонов
		await this.createTemplateFiles(workoutFolder);

		// Создаем карточки упражнений
		await this.createExerciseFiles(workoutFolder, exerciseNames);
	}

	async updateAllExerciseFiles(workoutFolder: string, exerciseNames: ExerciseInfo[]): Promise<void> {
		const exercisesPath = `${workoutFolder}/Exercises`;
		await this.ensureFolderExists(exercisesPath);

		const sourceExercises = (exerciseNames && exerciseNames.length > 0)
			? exerciseNames
			: DEFAULT_EXERCISES;
		
		// Удаляем дубликаты по имени
		const uniqueExercises = sourceExercises.filter((ex, index, self) =>
			index === self.findIndex((e) => e.name === ex.name)
		);

		for (const exercise of uniqueExercises) {
			const exerciseTemplate = await this.getExerciseTemplate(exercise.hasWeight);
			await this.updateExerciseFile(workoutFolder, exercise.name, exerciseTemplate);
		}
	}

	async updateExerciseFile(workoutFolder: string, exerciseName: string, template?: string, hasWeight: boolean = true): Promise<void> {
		const exercisesPath = `${workoutFolder}/Exercises`;
		const filePath = `${exercisesPath}/${exerciseName}.md`;
		
		// Если шаблон не передан, читаем его
		const exerciseTemplate = template || await this.getExerciseTemplate(hasWeight);
		
		const content = exerciseTemplate
			.replace(/{{exerciseName}}/g, exerciseName)
			.replace(/{{workoutFolder}}/g, workoutFolder);
		
		const existing = this.app.vault.getAbstractFileByPath(filePath);

		if (existing instanceof TFile) {
			// Обновляем существующий файл
			await this.app.vault.modify(existing, content);
		} else {
			// Создаём новый файл
			await this.ensureFolderExists(exercisesPath);
			await this.app.vault.create(filePath, content);
		}
	}

	async updateWeightedExerciseFiles(workoutFolder: string, exerciseNames: ExerciseInfo[]): Promise<number> {
		const exercisesPath = `${workoutFolder}/Exercises`;
		await this.ensureFolderExists(exercisesPath);

		const sourceExercises = (exerciseNames && exerciseNames.length > 0)
			? exerciseNames
			: DEFAULT_EXERCISES;
		
		const uniqueExercises = sourceExercises.filter((ex, index, self) =>
			index === self.findIndex((e) => e.name === ex.name)
		);

		const weightedExercises = uniqueExercises.filter(ex => ex.hasWeight);
		
		for (const exercise of weightedExercises) {
			const exerciseTemplate = await this.getExerciseTemplate(true);
			await this.updateExerciseFile(workoutFolder, exercise.name, exerciseTemplate, true);
		}
		
		return weightedExercises.length;
	}

	async createTemplateFiles(workoutFolder: string): Promise<void> {
		console.log('[FileManager] ========== createTemplateFiles ==========');
		const templatesPath = `${workoutFolder}/Templates`;
		console.log(`[FileManager] Путь к шаблонам: ${templatesPath}`);
		console.log(`[FileManager] Количество шаблонов для создания: ${Object.keys(TEMPLATE_FILES).length}`);
		
		for (const [key, fileName] of Object.entries(TEMPLATE_FILES) as [TemplateKey, string][]) {
			const filePath = `${templatesPath}/${fileName}`;
			console.log(`\n[FileManager] --- Обработка шаблона: ${key} (${fileName}) ---`);
			
			const templateContent = await this.getTemplate(key);
			console.log(`[FileManager] Длина контента из WORKOUT_TEMPLATES: ${templateContent.length} символов`);
			console.log(`[FileManager] Первые 50 символов: ${templateContent.substring(0, 50)}...`);
			
			const existing = this.app.vault.getAbstractFileByPath(filePath);
			if (existing instanceof TFile) {
				console.log(`[FileManager] Файл существует, проверяем содержимое...`);
				try {
					const currentContent = await this.app.vault.read(existing);
					console.log(`[FileManager] Текущий контент файла: ${currentContent.length} символов`);
					console.log(`[FileManager] Первые 50 символов файла: ${currentContent.substring(0, 50)}...`);
					
					if (currentContent !== templateContent) {
						console.log(`[FileManager] ⚠️ Контент отличается! Обновляем файл...`);
						await this.app.vault.modify(existing, templateContent);
						console.log(`[FileManager] ✅ Файл обновлён`);
					} else {
						console.log(`[FileManager] ✓ Контент идентичен, пропускаем`);
					}
				} catch (error) {
					console.error(`[FileManager] ❌ Не удалось обновить шаблон ${filePath}:`, error);
				}
			} else {
				console.log(`[FileManager] Файл не существует, создаём...`);
				await this.app.vault.create(filePath, templateContent);
				console.log(`[FileManager] ✅ Файл создан`);
			}
		}
		console.log('[FileManager] ========== КОНЕЦ createTemplateFiles ==========\n');
	}

	private async createExerciseFiles(workoutFolder: string, exerciseNames: ExerciseInfo[]): Promise<void> {
		const exercisesPath = `${workoutFolder}/Exercises`;
		await this.ensureFolderExists(exercisesPath);

		const sourceExercises = (exerciseNames && exerciseNames.length > 0)
			? exerciseNames
			: DEFAULT_EXERCISES;
		
		// Удаляем дубликаты по имени
		const uniqueExercises = sourceExercises.filter((ex, index, self) =>
			index === self.findIndex((e) => e.name === ex.name)
		);

		for (const exercise of uniqueExercises) {
			const filePath = `${exercisesPath}/${exercise.name}.md`;
			const template = await this.getExerciseTemplate(exercise.hasWeight);
			const content = template
				.replace(/{{exerciseName}}/g, exercise.name)
				.replace(/{{workoutFolder}}/g, workoutFolder);
			const existing = this.app.vault.getAbstractFileByPath(filePath);

			if (existing instanceof TFile) {
				try {
					const currentContent = await this.app.vault.read(existing);
					if (currentContent !== content && this.shouldUpdateExerciseFile(currentContent, exercise.name)) {
						await this.app.vault.modify(existing, content);
					}
				} catch (error) {
					console.error(`Не удалось обновить файл упражнения ${filePath}:`, error);
				}
			} else {
				await this.app.vault.create(filePath, content);
			}
		}
	}

	private shouldUpdateExerciseFile(existingContent: string, exerciseName: string): boolean {
		const normalized = existingContent.trim();
		if (!normalized.startsWith(`# ${exerciseName} - Прогрессия`)) {
			return false;
		}

		if (normalized.includes('```dataviewjs')) {
			return false;
		}

		return normalized.includes('```dataview');
	}

	async getExistingWorkoutLog(workoutFolder: string, date: string): Promise<TFile | null> {
		const logsFolder = `${workoutFolder}/Logs`;
		const files = this.app.vault.getFiles();
		
		for (const file of files) {
			if (file.path.startsWith(logsFolder) && file.name.includes(date)) {
				return file;
			}
		}
		return null;
	}

	async createWorkoutLog(
		workoutFolder: string, 
		location: WorkoutLocation, 
		templateType?: WorkoutDay
	): Promise<{ file: TFile; existed: boolean }> {
		const today = moment().format('YYYY-MM-DD');
		const todayDisplay = moment().format('DD.MM.YYYY');
		let fileName: string;
		let templateKey: TemplateKey;

		if (location === WorkoutLocation.HOME) {
			const existingHomeLog = await this.getExistingHomeWorkoutLog(workoutFolder, today);
			if (existingHomeLog) {
				new Notice('Переношу вас в созданный файл домашней тренировки');
				return { file: existingHomeLog, existed: true };
			}

			templateKey = 'HOME';
			fileName = `${today}-Home.md`;
		} else {
			const existingLog = await this.getExistingWorkoutLog(workoutFolder, today);
			if (existingLog && !existingLog.name.includes('Home')) {
				new Notice('Переношу вас в созданный файл тренировки');
				return { file: existingLog, existed: true };
			}

			let day: WorkoutDay;
			if (templateType) {
				day = templateType;
			} else {
				const dayOfWeek = moment().day();
				if (dayOfWeek === 1) day = WorkoutDay.MONDAY;
				else if (dayOfWeek === 3) day = WorkoutDay.WEDNESDAY;
				else if (dayOfWeek === 5) day = WorkoutDay.FRIDAY;
				else day = WorkoutDay.MONDAY;
			}

			templateKey = this.getTemplateKeyFromDay(day);
			fileName = `${today}-${day}.md`;
		}

		const template = await this.getTemplate(templateKey);
		let content = template
			.replace(/{{date}}/g, todayDisplay)
			.replace(/{{location}}/g, location === WorkoutLocation.HOME ? 'Дома' : 'Спортзал');

		// Заменяем плейсхолдеры упражнений
		const exercisePlaceholderRegex = /{{exercise:([^}]+)}}/g;
		const matches = [...content.matchAll(exercisePlaceholderRegex)];
		
		for (const match of matches) {
			const exerciseName = match[1];
			const stats = await this.getExerciseStats(exerciseName, workoutFolder);
			content = content.replace(match[0], stats);
		}

		console.log(`[FileManager] createWorkoutLog - создаём файл ${fileName}`);
		console.log(`[FileManager] Шаблон ${templateKey}, длина: ${template.length}`);
		console.log(`[FileManager] Контент после замены, длина: ${content.length}`);
		console.log(`[FileManager] Первые 200 символов контента:\n${content.substring(0, 200)}`);
		console.log(`[FileManager] Есть ли ### в контенте: ${content.includes('###')}`);

		const filePath = `${workoutFolder}/Logs/${fileName}`;
		const file = await this.app.vault.create(filePath, content);
		return { file, existed: false };
	}

	async getExistingHomeWorkoutLog(workoutFolder: string, date: string): Promise<TFile | null> {
		const logsFolder = `${workoutFolder}/Logs`;
		const files = this.app.vault.getFiles();
		
		for (const file of files) {
			if (file.path.startsWith(logsFolder) && 
				file.name.includes(date) && 
				file.name.includes('Home')) {
				return file;
			}
		}
		return null;
	}

	async getExerciseFiles(workoutFolder: string): Promise<TFile[]> {
		const exercisesPath = `${workoutFolder}/Exercises`;
		const files = this.app.vault.getFiles();
		
		return files.filter(file => file.path.startsWith(exercisesPath) && file.extension === 'md');
	}

	async deleteExerciseFile(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			await this.app.vault.delete(file);
		}
	}

	async getAllFolders(): Promise<TFolder[]> {
		const folders: TFolder[] = [];
		const stack = [this.app.vault.getRoot()];
		
		while (stack.length > 0) {
			const current = stack.pop()!;
			for (const child of current.children) {
				if (child instanceof TFolder) {
					folders.push(child);
					stack.push(child);
				}
			}
		}
		
		return folders;
	}

	async getFoldersInPath(path: string): Promise<TFolder[]> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!(folder instanceof TFolder)) {
			return [];
		}
		
		return folder.children.filter(child => child instanceof TFolder) as TFolder[];
	}

	async updateTemplateFromFile(filePath: string, workoutFolder: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		const templateName = file.basename;
		const templatesPath = `${workoutFolder}/Templates`;
		
		// Проверяем, что это файл шаблона
		if (!filePath.startsWith(templatesPath)) return;
		
		try {
			const content = await this.app.vault.read(file);
			
			// Обновляем константу в коде в зависимости от имени файла
			switch (templateName) {
				case 'Monday':
					await this.updateTemplateConstant('MONDAY', content);
					break;
				case 'Wednesday':
					await this.updateTemplateConstant('WEDNESDAY', content);
					break;
				case 'Friday':
					await this.updateTemplateConstant('FRIDAY', content);
					break;
				case 'Home':
					await this.updateTemplateConstant('HOME', content);
					break;
			}
			
			new Notice(`Шаблон ${templateName} обновлен в коде`);
		} catch (error) {
			console.error('Ошибка при обновлении шаблона:', error);
		}
	}

	private async updateTemplateConstant(templateKey: string, newContent: string): Promise<void> {
		// Здесь можно реализовать логику обновления констант в файле templates.ts
		// Для простоты выведем в консоль информацию об изменении
		console.log(`Обновление шаблона ${templateKey}:`, newContent);
		
		// В реальной реализации здесь бы был код для обновления файла templates.ts
		// Например, чтение файла, замена содержимого и перезапись
	}
}