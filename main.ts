import { App, Plugin, PluginSettingTab, Setting, Notice, moment, TFile } from 'obsidian';
import { WorkoutTrackerSettings, TemplateOverrides, ExerciseInfo } from './src/types';
import { DEFAULT_SETTINGS, DEFAULT_EXERCISES } from './src/templates';
import { FileManager } from './src/utils/fileManager';
import { TemplateUpdater } from './src/utils/templateUpdater';
import { ExerciseCache } from './src/utils/exerciseCache';
import { ExerciseMetadataManager } from './src/utils/exerciseMetadata';
import { WorkoutLocationModal } from './src/modals/WorkoutLocationModal';
import { FolderSelectorModal } from './src/modals/FolderSelectorModal';
import { ExerciseListModal } from './src/modals/ExerciseListModal';
import { WorkoutLocation, WorkoutDay } from './src/types';

export default class WorkoutTrackerPlugin extends Plugin {
	settings: WorkoutTrackerSettings;
	fileManager: FileManager;
	exerciseCache: ExerciseCache;
	exerciseMetadata: ExerciseMetadataManager;
	private templateUpdater: TemplateUpdater;

	async onload() {
		await this.loadSettings();
		
		// Получаем путь к директории плагина
		const adapter = this.app.vault.adapter;
		const pluginDir = (adapter as any).basePath + '/.obsidian/plugins/' + this.manifest.id;
		
		this.fileManager = new FileManager(this.app, pluginDir, () => this.settings);
		this.templateUpdater = new TemplateUpdater(this.app, this.manifest.id, async () => {
			// Callback больше не нужен, так как изменения сразу пишутся в templates.ts
		});

		// Инициализируем менеджер метаданных упражнений
		this.exerciseMetadata = new ExerciseMetadataManager(this.app, pluginDir);
		await this.exerciseMetadata.load();
		
		// Синхронизируем метаданные с реестром упражнений
		await this.exerciseMetadata.syncFromRegistry(this.settings.exerciseRegistry);

		// Инициализируем кэш упражнений
		this.exerciseCache = new ExerciseCache(this.app, pluginDir, this.exerciseMetadata);
		await this.exerciseCache.load();
		
		// Обновляем кэш при запуске плагина
		const logsFolder = `${this.settings.workoutFolder}/Logs`;
		const newCachedCount = await this.exerciseCache.rebuildCache(logsFolder);
		if (newCachedCount > 0) {
			new Notice(`✅ Закэшировано ${newCachedCount} ${this.pluralizeLogCount(newCachedCount)}!`);
			console.log(`[Main] Кэшировано новых логов при запуске: ${newCachedCount}`);
		}

		// Создаем структуру папок при первом запуске
		await this.fileManager.createWorkoutStructure(
			this.settings.workoutFolder,
			this.settings.previousWorkoutFolder,
			this.settings.exerciseRegistry
		);

		// Синхронизируем шаблоны с файлами
		await this.templateUpdater.syncTemplatesWithFiles(this.settings.workoutFolder);

		// Мониторинг изменений файлов шаблонов
		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				// Быстрая проверка - только .md файлы в папке Templates
				if (!(file instanceof TFile) || file.extension !== 'md') {
					return;
				}
				
				const templatesPath = `${this.settings.workoutFolder}/Templates/`;
				if (!file.path.startsWith(templatesPath)) {
					return;
				}
				
				console.log(`[Main] ✅ Обновление шаблона: ${file.basename}`);
				
				const templateName = file.basename;
				const content = await this.app.vault.read(file);
				
				await this.templateUpdater.updateTemplateInCode(templateName, content);
				new Notice(`Шаблон "${templateName}" обновлен`);
			})
		);

		// Автообновление файлов упражнений при открытии + кэширование логов
		this.registerEvent(
			this.app.workspace.on('file-open', async (file) => {
				if (!file || !(file instanceof TFile) || file.extension !== 'md') {
					return;
				}
				
				const exercisesPath = `${this.settings.workoutFolder}/Exercises/`;
				if (!file.path.startsWith(exercisesPath)) {
					return;
				}
				
				console.log(`[Main] 📖 Открыт файл упражнения: ${file.basename}`);
				
				// Обновляем кэш логов перед обновлением файла
				const logsFolder = `${this.settings.workoutFolder}/Logs`;
				const newCachedCount = await this.exerciseCache.rebuildCache(logsFolder);
				if (newCachedCount > 0) {
					console.log(`[Main] Закэшировано ${newCachedCount} новых логов при открытии упражнения`);
				}
				
				// Обновляем содержимое файла с актуальным шаблоном
				try {
					const exerciseName = file.basename;
					// Ищем информацию об упражнении в реестре
					const exerciseInfo = this.settings.exerciseRegistry.find(ex => ex.name === exerciseName);
					const hasWeight = exerciseInfo?.hasWeight ?? true; // По умолчанию с весом
					
					await this.fileManager.updateExerciseFile(
						this.settings.workoutFolder,
						exerciseName,
						undefined,
						hasWeight
					);
					console.log(`[Main] ✅ Файл "${exerciseName}" обновлен`);
				} catch (error) {
					console.error(`[Main] ❌ Ошибка обновления файла:`, error);
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

		this.addCommand({
			id: 'rebuild-cache',
			name: 'Обновить кэш упражнений',
			callback: async () => {
				const logsFolder = `${this.settings.workoutFolder}/Logs`;
				const count = await this.exerciseCache.rebuildCache(logsFolder);
				if (count > 0) {
					new Notice(`✅ Закэшировано ${count} ${this.pluralizeLogCount(count)}!`);
				} else {
					new Notice('✅ Все логи уже закэшированы!');
				}
			}
		});

		this.addCommand({
			id: 'refresh-exercise-files',
			name: 'Обновить файлы упражнений',
			callback: async () => {
				try {
					await this.fileManager.updateAllExerciseFiles(
						this.settings.workoutFolder,
						this.settings.exerciseRegistry
					);
					new Notice('Файлы упражнений обновлены');
				} catch (error) {
					console.error('Ошибка обновления файлов упражнений:', error);
					new Notice('Ошибка при обновлении файлов упражнений');
				}
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

			// Обновляем кэш после создания лога
			const logsFolder = `${this.settings.workoutFolder}/Logs`;
			const newCachedCount = await this.exerciseCache.rebuildCache(logsFolder);

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
		const modal = new ExerciseListModal(this.app, this, this.fileManager);
		modal.open();
	}

	onunload() {
		// Cleanup
	}

	async loadSettings() {
		const stored = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);

		const { registry, changed } = this.mergeExerciseRegistry(this.settings.exerciseRegistry);
		this.settings.exerciseRegistry = registry;

		if (changed) {
			await this.persistSettings();
		}
	}

	async saveSettings() {
		const previousFolder = this.settings.previousWorkoutFolder;
		await this.persistSettings();

		await this.fileManager.createWorkoutStructure(
			this.settings.workoutFolder,
			previousFolder && previousFolder !== this.settings.workoutFolder ? previousFolder : undefined,
			this.settings.exerciseRegistry
		);

		this.settings.previousWorkoutFolder = this.settings.workoutFolder;
		await this.persistSettings();
	}

	private async persistSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async refreshWorkoutStructure(): Promise<void> {
		console.log('[Main] ========== НАЧАЛО refreshWorkoutStructure ==========');
		console.log(`[Main] Папка тренировок: ${this.settings.workoutFolder}`);
		console.log(`[Main] Количество упражнений в реестре: ${this.settings.exerciseRegistry.length}`);
		
		try {
			console.log('[Main] Вызов createWorkoutStructure...');
			
			// Просто пересоздаём структуру - шаблоны уже актуальны в templates.ts
			await this.fileManager.createWorkoutStructure(
				this.settings.workoutFolder,
				undefined,
				this.settings.exerciseRegistry
			);
			
			console.log('[Main] ✅ createWorkoutStructure завершён успешно');
			new Notice('Структура тренировок обновлена');
			console.log('[Main] ========== КОНЕЦ refreshWorkoutStructure ==========');
		} catch (error) {
			console.error('[Main] ❌ Ошибка в refreshWorkoutStructure:', error);
			new Notice('Ошибка при обновлении структуры тренировок');
		}
	}

	async registerExercise(name: string, hasWeight: boolean = true): Promise<void> {
		const normalized = name.trim();
		if (!normalized) return;

		const exists = this.settings.exerciseRegistry.some((item) =>
			item.name.localeCompare(normalized, undefined, { sensitivity: 'accent' }) === 0
		);

		if (!exists) {
			this.settings.exerciseRegistry.push({ name: normalized, hasWeight });
			await this.persistSettings();
			
			// Добавляем в метаданные
			await this.exerciseMetadata.addExercise(normalized, hasWeight);
		}
	}

	async unregisterExercise(name: string): Promise<void> {
		const normalized = name.trim();
		if (!normalized) return;

		const index = this.settings.exerciseRegistry.findIndex((item) =>
			item.name.localeCompare(normalized, undefined, { sensitivity: 'accent' }) === 0
		);

		if (index !== -1) {
			this.settings.exerciseRegistry.splice(index, 1);
			await this.persistSettings();
			
			// Удаляем из метаданных
			await this.exerciseMetadata.removeExercise(normalized);
		}
	}

	private mergeExerciseRegistry(existing: ExerciseInfo[] | undefined): { registry: ExerciseInfo[]; changed: boolean } {
		const seen = new Set<string>();
		const registry: ExerciseInfo[] = [];

		const addExercise = (exercise: ExerciseInfo) => {
			if (!exercise?.name) return;
			const trimmed = exercise.name.trim();
			if (!trimmed) return;
			const key = trimmed.toLocaleLowerCase();
			if (seen.has(key)) return;
			seen.add(key);
			registry.push({ name: trimmed, hasWeight: exercise.hasWeight });
		};

		DEFAULT_EXERCISES.forEach(addExercise);
		(existing ?? []).forEach(addExercise);

		const original = existing ?? [];
		const changed =
			original.length !== registry.length ||
			registry.some((ex, index) => ex.name !== (original[index]?.name?.trim() ?? ''));

		return { registry, changed };
	}

	pluralizeLogCount(count: number): string {
		const lastDigit = count % 10;
		const lastTwoDigits = count % 100;
		
		if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
			return 'логов';
		}
		if (lastDigit === 1) {
			return 'лог';
		}
		if (lastDigit >= 2 && lastDigit <= 4) {
			return 'лога';
		}
		return 'логов';
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
						const modal = new FolderSelectorModal(this.app, this.plugin.fileManager, this.plugin.settings.workoutFolder);
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

	new Setting(containerEl)
		.setName('Диапазон повторений на графике')
		.setDesc('Установите минимальное и максимальное значение для оси Y на графиках упражнений с весом. После изменения файлы упражнений будут автоматически обновлены.')
		.addText(text => {
			text
				.setPlaceholder('Мин.')
				.setValue(String(this.plugin.settings.chartRepsMin))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0) {
						this.plugin.settings.chartRepsMin = num;
						await this.plugin.saveSettings();
						
						new Notice(`Диапазон графика изменён: ${this.plugin.settings.chartRepsMin}-${this.plugin.settings.chartRepsMax}. Обновляю файлы упражнений...`);
						
						try {
							const count = await this.plugin.fileManager.updateWeightedExerciseFiles(
								this.plugin.settings.workoutFolder,
								this.plugin.settings.exerciseRegistry
							);
							new Notice(`✅ Обновлено ${count} упражнений с весом`);
						} catch (error) {
							new Notice(`❌ Ошибка обновления: ${error.message}`);
						}
					}
				});
			text.inputEl.type = 'number';
			text.inputEl.style.width = '60px';
		})
		.addText(text => {
			text
				.setPlaceholder('Макс.')
				.setValue(String(this.plugin.settings.chartRepsMax))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.chartRepsMax = num;
						await this.plugin.saveSettings();
						
						new Notice(`Диапазон графика изменён: ${this.plugin.settings.chartRepsMin}-${this.plugin.settings.chartRepsMax}. Обновляю файлы упражнений...`);
						
						try {
							const count = await this.plugin.fileManager.updateWeightedExerciseFiles(
								this.plugin.settings.workoutFolder,
								this.plugin.settings.exerciseRegistry
							);
							new Notice(`✅ Обновлено ${count} упражнений с весом`);
						} catch (error) {
							new Notice(`❌ Ошибка обновления: ${error.message}`);
						}
					}
				});
			text.inputEl.type = 'number';
			text.inputEl.style.width = '60px';
		});		new Setting(containerEl)
			.setName('Обновить структуру')
			.setDesc('Пересоздать папки, шаблоны и карточки упражнений. Шаблоны будут использовать актуальные версии из кода.')
			.addButton(button => {
				button.setButtonText('Обновить');
				button.setCta();
				button.onClick(async () => {
					button.setDisabled(true);
					try {
						await this.plugin.refreshWorkoutStructure();
					} finally {
						button.setDisabled(false);
					}
				});
			});

		new Setting(containerEl)
			.setName('Кэширование логов')
			.setDesc('Обновить кэш упражнений из всех файлов логов. Это ускорит загрузку страниц упражнений.')
			.addButton(button => {
				button.setButtonText('Обновить кэш');
				button.onClick(async () => {
					button.setDisabled(true);
					button.setButtonText('Обновление...');
					try {
						const logsFolder = `${this.plugin.settings.workoutFolder}/Logs`;
						const count = await this.plugin.exerciseCache.rebuildCache(logsFolder);
						if (count > 0) {
							new Notice(`✅ Закэшировано ${count} ${this.plugin.pluralizeLogCount(count)}!`);
						} else {
							new Notice('✅ Все логи уже закэшированы!');
						}
					} catch (error) {
						new Notice(`❌ Ошибка кэширования: ${error.message}`);
					} finally {
						button.setDisabled(false);
						button.setButtonText('Обновить кэш');
					}
				});
			})
			.addButton(button => {
				button.setButtonText('Очистить кэш');
				button.setWarning();
				button.onClick(async () => {
					button.setDisabled(true);
					try {
						await this.plugin.exerciseCache.clearCache();
						new Notice('✅ Кэш очищен');
					} finally {
						button.setDisabled(false);
					}
				});
			});
	}
}
