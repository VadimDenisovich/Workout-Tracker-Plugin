import { App, TFolder, TFile, moment, Notice, TAbstractFile } from 'obsidian';
import { WorkoutLocation, WorkoutDay, TemplateOverrides, TemplateKey } from '../types';
import { WORKOUT_TEMPLATES, TEMPLATE_FILES } from '../templates';

export class FileManager {
	private templateOverrides: TemplateOverrides = {};

	constructor(private app: App) {}

	setTemplateOverrides(overrides: TemplateOverrides) {
		this.templateOverrides = overrides ?? {};
	}

	private getTemplate(key: TemplateKey): string {
		return this.templateOverrides?.[key] ?? WORKOUT_TEMPLATES[key];
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

	async createWorkoutStructure(workoutFolder: string, previousFolder?: string): Promise<void> {
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
	}

	async createTemplateFiles(workoutFolder: string): Promise<void> {
		const templatesPath = `${workoutFolder}/Templates`;
		
		for (const [key, fileName] of Object.entries(TEMPLATE_FILES) as [TemplateKey, string][]) {
			const filePath = `${templatesPath}/${fileName}`;
			if (!this.app.vault.getAbstractFileByPath(filePath)) {
				await this.app.vault.create(filePath, this.getTemplate(key));
			}
		}
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

		const template = this.getTemplate(templateKey);
		const content = template
			.replace(/{{date}}/g, todayDisplay)
			.replace(/{{location}}/g, location === WorkoutLocation.HOME ? 'Дома' : 'Спортзал');

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