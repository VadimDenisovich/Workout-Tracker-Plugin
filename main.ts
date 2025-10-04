import { App, Plugin, PluginSettingTab, Setting, Notice, moment, TFile } from 'obsidian';
import { WorkoutTrackerSettings, TemplateOverrides } from './src/types';
import { DEFAULT_SETTINGS } from './src/templates';
import { FileManager } from './src/utils/fileManager';
import { TemplateUpdater } from './src/utils/templateUpdater';
import { WorkoutLocationModal } from './src/modals/WorkoutLocationModal';
import { FolderSelectorModal } from './src/modals/FolderSelectorModal';
import { ExerciseListModal } from './src/modals/ExerciseListModal';
import { WorkoutLocation, WorkoutDay } from './src/types';

export default class WorkoutTrackerPlugin extends Plugin {
	settings: WorkoutTrackerSettings;
	private fileManager: FileManager;
	private templateUpdater: TemplateUpdater;

	async onload() {
		await this.loadSettings();
		this.fileManager = new FileManager(this.app);
		this.fileManager.setTemplateOverrides(this.settings.templateOverrides);
		this.templateUpdater = new TemplateUpdater(this.app, async (overrides) => {
			this.fileManager.setTemplateOverrides(overrides);
			await this.saveTemplateOverrides(overrides);
		});
		this.templateUpdater.setOverrides(this.settings.templateOverrides);

		// Создаем структуру папок при первом запуске
		await this.fileManager.createWorkoutStructure(
			this.settings.workoutFolder,
			this.settings.previousWorkoutFolder
		);

		// Синхронизируем шаблоны с файлами
		await this.templateUpdater.syncTemplatesWithFiles(this.settings.workoutFolder);

		// Мониторинг изменений файлов шаблонов
		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				if (file instanceof TFile && 
					file.path.includes(`${this.settings.workoutFolder}/Templates/`) && 
					file.extension === 'md') {
					const templateName = file.basename;
					const content = await this.app.vault.read(file);
					await this.templateUpdater.updateTemplateInCode(templateName, content);
					new Notice(`Шаблон "${templateName}" обновлен`);
				}
			})
		);

		// Кнопка создания лога тренировки
		this.addRibbonIcon('calendar-plus', 'Создать лог тренировки', async () => {
			await this.createWorkoutLog();
		});

		// Кнопка открытия упражнений
		this.addRibbonIcon('dumbbell', 'Упражнения', async () => {
			await this.openExerciseModal();
		});

		// Команды
		this.addCommand({
			id: 'create-workout-log',
			name: 'Создать лог тренировки',
			callback: async () => {
				await this.createWorkoutLog();
			}
		});

		this.addCommand({
			id: 'open-exercise-modal',
			name: 'Открыть упражнения',
			callback: async () => {
				await this.openExerciseModal();
			}
		});

		// Настройки
		this.addSettingTab(new WorkoutTrackerSettingTab(this.app, this));
	}

	async createWorkoutLog() {
		try {
			const today = moment();
			const dayOfWeek = today.day();
			const isTrainingDay = dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5; // Пн, Ср, Пт

			const modal = new WorkoutLocationModal(this.app, !isTrainingDay);
			const result = await modal.show();

			const { file, existed } = await this.fileManager.createWorkoutLog(
				this.settings.workoutFolder,
				result.location,
				result.templateType
			);

			await this.app.workspace.getLeaf().openFile(file);
			if (!existed) {
				new Notice('Лог тренировки создан');
			}

		} catch (error) {
			if (error !== 'Modal closed') {
				new Notice('Ошибка при создании лога тренировки');
			}
		}
	}

	async openExerciseModal() {
		const modal = new ExerciseListModal(this.app, this);
		modal.open();
	}

	onunload() {
		// Cleanup
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		const previousFolder = this.settings.previousWorkoutFolder;
		await this.persistSettings();

		await this.fileManager.createWorkoutStructure(
			this.settings.workoutFolder,
			previousFolder && previousFolder !== this.settings.workoutFolder ? previousFolder : undefined
		);

		this.settings.previousWorkoutFolder = this.settings.workoutFolder;
		await this.persistSettings();
	}

	private async saveTemplateOverrides(overrides: TemplateOverrides): Promise<void> {
		const currentSerialized = JSON.stringify(this.settings.templateOverrides ?? {});
		const nextSerialized = JSON.stringify(overrides ?? {});
		if (currentSerialized === nextSerialized) {
			return;
		}
		this.settings.templateOverrides = overrides ?? {};
		await this.persistSettings();
	}

	private async persistSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

class WorkoutTrackerSettingTab extends PluginSettingTab {
	plugin: WorkoutTrackerPlugin;

	constructor(app: App, plugin: WorkoutTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Настройки Workout Tracker' });

		new Setting(containerEl)
			.setName('Папка тренировок')
			.setDesc('Укажите папку для хранения данных о тренировках')
			.addText(text => {
				text
					.setPlaceholder('Выберите папку...')
					.setValue(this.plugin.settings.workoutFolder)
					.onChange(async (value) => {
						this.plugin.settings.workoutFolder = value;
						await this.plugin.saveSettings();
					});

				// Обработчик клика для открытия модального окна
				text.inputEl.addEventListener('click', async () => {
					try {
						const modal = new FolderSelectorModal(this.app, this.plugin.settings.workoutFolder);
						modal.setInputElement(text.inputEl);
						const selectedPath = await modal.show();
						
						// Сохраняем предыдущую папку
						const previousFolder = this.plugin.settings.workoutFolder;
						
						this.plugin.settings.workoutFolder = selectedPath;
						this.plugin.settings.previousWorkoutFolder = previousFolder;
						await this.plugin.saveSettings();
						text.setValue(selectedPath);
						
					} catch (error) {
						// Пользователь отменил выбор
					}
				});

				// Делаем поле только для чтения, чтобы избежать создания папок при вводе
				text.inputEl.readOnly = true;
				text.inputEl.style.cursor = 'pointer';
			});
	}
}
