import { App, Plugin, PluginSettingTab, Setting, Notice, moment, TFile } from 'obsidian';
import { WorkoutTrackerSettings, TemplateOverrides, ExerciseInfo, WorkoutDay } from './src/types';
import { DEFAULT_SETTINGS, DEFAULT_EXERCISES, DAY_NAMES_RU, DAY_ABBR } from './src/templates';
import { FileManager } from './src/utils/fileManager';
import { TemplateUpdater } from './src/utils/templateUpdater';
import { ExerciseCache } from './src/utils/exerciseCache';
import { ExerciseMetadataManager } from './src/utils/exerciseMetadata';
import { WorkoutLocationModal } from './src/modals/WorkoutLocationModal';
import { FolderSelectorModal } from './src/modals/FolderSelectorModal';
import { ExerciseListModal } from './src/modals/ExerciseListModal';
import { WorkoutLocation } from './src/types';

export default class WorkoutTrackerPlugin extends Plugin {
	settings: WorkoutTrackerSettings;
	fileManager: FileManager;
	exerciseCache: ExerciseCache;
	exerciseMetadata: ExerciseMetadataManager;
	private templateUpdater: TemplateUpdater;

	async onload() {
		await this.loadSettings();
		
		// Загружаем Chart.js глобально один раз при старте плагина
		this.loadChartJS();
		
		// Получаем путь к директории плагина
		const adapter = this.app.vault.adapter;
		const pluginDir = (adapter as any).basePath + '/.obsidian/plugins/' + this.manifest.id;
		
		this.fileManager = new FileManager(this.app, pluginDir, () => this.settings);
		this.templateUpdater = new TemplateUpdater(
			this.app, 
			this.manifest.id, 
			() => this.settings,
			async () => await this.persistSettings()
		);

		// Инициализируем менеджер метаданных упражнений
		try {
			this.exerciseMetadata = new ExerciseMetadataManager(this.app, pluginDir);
			await this.exerciseMetadata.load();
			
			// Синхронизируем метаданные с реестром упражнений
			await this.exerciseMetadata.syncFromRegistry(this.settings.exerciseRegistry);
		} catch (error) {
			console.error('[Main] Ошибка инициализации метаданных:', error);
			// Создаем пустой объект метаданных для продолжения работы
			this.exerciseMetadata = new ExerciseMetadataManager(this.app, pluginDir);
		}

		// Инициализируем кэш упражнений
		this.exerciseCache = new ExerciseCache(this.app, pluginDir, this.exerciseMetadata);
		await this.exerciseCache.load();
		
		// Создаем структуру папок ТОЛЬКО при первом запуске или при смене папки
		const needsStructureCreation = !this.settings.previousWorkoutFolder || 
			this.settings.previousWorkoutFolder !== this.settings.workoutFolder;
		
		if (needsStructureCreation) {
			console.log('[Main] 📁 Первый запуск или смена папки, создаём структуру...');
			try {
				await this.fileManager.createWorkoutStructure(
					this.settings.workoutFolder,
					this.settings.previousWorkoutFolder,
					this.settings.exerciseRegistry
				);
				// Обновляем previousWorkoutFolder после успешного создания
				this.settings.previousWorkoutFolder = this.settings.workoutFolder;
				await this.persistSettings();
			} catch (error) {
				// Игнорируем ошибку "Folder already exists" - это нормально
				if (error?.message?.includes('Folder already exists') || error?.message?.includes('already exists')) {
					console.log('[Main] ✅ Структура папок уже существует');
					this.settings.previousWorkoutFolder = this.settings.workoutFolder;
					await this.persistSettings();
				} else {
					console.error('[Main] Ошибка создания структуры папок:', error);
					new Notice('⚠️ Ошибка создания структуры папок. Проверьте консоль.');
				}
			}
		} else {
			console.log('[Main] ✅ Структура папок уже настроена, пропускаем создание');
		}

		// Синхронизируем шаблоны с файлами (НЕОБЯЗАТЕЛЬНАЯ операция)
		try {
			await this.templateUpdater.syncTemplatesWithFiles(this.settings.workoutFolder);
			console.log('[Main] ✅ Синхронизация шаблонов завершена');
		} catch (error) {
			console.error('[Main] ⚠️ Ошибка синхронизации шаблонов (не критично):', error);
		}
		
		// Регистрируем UI элементы и команды (КРИТИЧНО - должно выполниться)
		console.log('[Main] 📋 Регистрация UI элементов и команд...');
		this.registerUIAndCommands();
		
		// Обновляем кэш ПОСЛЕ того, как хранилище будет готово (НЕКРИТИЧНО)
		this.app.workspace.onLayoutReady(async () => {
			try {
				console.log('[Main] 🔄 Хранилище готово, обновляем кэш...');
				const logsFolder = `${this.settings.workoutFolder}/Logs`;
				const newCachedCount = await this.exerciseCache.rebuildCache(logsFolder);
				if (newCachedCount > 0) {
					new Notice(`✅ Закэшировано ${newCachedCount} ${this.pluralizeLogCount(newCachedCount)}!`);
					console.log(`[Main] Кэшировано новых логов при запуске: ${newCachedCount}`);
				}
			} catch (error) {
				console.error('[Main] Ошибка обновления кэша:', error);
			}
		});
	}

	private registerUIAndCommands(): void {
		// Мониторинг изменений файлов (шаблоны и логи)
		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				console.log(`[Main-Modify] 🔔 Событие modify сработало для файла: ${file.path}`);
				console.log(`[Main-Modify] Тип файла:`, file instanceof TFile ? 'TFile' : 'другое');
				console.log(`[Main-Modify] Расширение:`, file instanceof TFile ? file.extension : 'N/A');
				
				if (!(file instanceof TFile) || file.extension !== 'md') {
					console.log(`[Main-Modify] ❌ Пропускаем - не .md файл`);
					return;
				}
				
				const templatesPath = `${this.settings.workoutFolder}/Templates/`;
				const logsPath = `${this.settings.workoutFolder}/Logs/`;
				
				console.log(`[Main-Modify] Проверка путей:`);
				console.log(`[Main-Modify] - Файл: ${file.path}`);
				console.log(`[Main-Modify] - Templates: ${templatesPath}`);
				console.log(`[Main-Modify] - Logs: ${logsPath}`);
				
				// Обработка изменений в шаблонах
				if (file.path.startsWith(templatesPath)) {
					console.log(`[Main] ✅ Обновление шаблона: ${file.basename}`);
					
					const templateName = file.basename;
					const content = await this.app.vault.read(file);
					
					// Обновляем стандартный шаблон (если это день недели или Home)
					await this.templateUpdater.updateTemplateInCode(templateName, content);
					
					// Проверяем, является ли это кастомным шаблоном
					const customTemplate = this.settings.customTemplates.find(
						t => t.fileName === file.name
					);
					
					if (customTemplate) {
						// Обновляем содержимое кастомного шаблона в настройках
						customTemplate.content = content;
						await this.persistSettings();
						console.log(`[Main] ✅ Кастомный шаблон "${customTemplate.name}" обновлён в настройках`);
					}
					
					new Notice(`Шаблон "${templateName}" обновлен`);
					return;
				}
				
				// Обработка изменений в логах
				if (file.path.startsWith(logsPath)) {
					console.log(`[Main] 📝 Изменён файл лога: ${file.basename}`);
					console.log(`[Main] Полный путь файла: ${file.path}`);
					console.log(`[Main] Путь папки логов: ${logsPath}`);
					
					// Пересчитываем кэш для этого файла
					await this.exerciseCache.recacheFile(file);
					console.log(`[Main] ✅ Кэш для "${file.basename}" обновлён`);
					new Notice(`Кэш обновлён: ${file.basename}`);
					return;
				}
				
				console.log(`[Main-Modify] ⚠️ Файл не относится ни к шаблонам, ни к логам`);
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
		console.log('[Main] 📅 Добавление ribbon icon для создания лога...');
		const ribbonIconLog = this.addRibbonIcon('calendar-days', 'Создать лог тренировки', async () => {
			await this.createWorkoutLog();
		});
		console.log('[Main] 📅 Ribbon icon создан:', ribbonIconLog ? 'успешно' : 'не удалось');

		// Кнопка открытия упражнений
		console.log('[Main] 💪 Добавление ribbon icon для упражнений...');
		const ribbonIconExercises = this.addRibbonIcon('dumbbell', 'Упражнения', async () => {
			await this.openExerciseModal();
		});
		console.log('[Main] 💪 Ribbon icon создан:', ribbonIconExercises ? 'успешно' : 'не удалось');

		// Команды
		console.log('[Main] 🎯 Регистрация команд...');
		this.addCommand({
			id: 'create-workout-log',
			name: 'Создать лог тренировки',
			callback: async () => {
				await this.createWorkoutLog();
			}
		});
		console.log('[Main] ✅ Команда "Создать лог тренировки" зарегистрирована');

		this.addCommand({
			id: 'open-exercise-modal',
			name: 'Открыть упражнения',
			callback: async () => {
				await this.openExerciseModal();
			}
		});
		console.log('[Main] ✅ Команда "Открыть упражнения" зарегистрирована');

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
		
		console.log('[Main] ✅ Все UI элементы и команды зарегистрированы');
	}

	async createWorkoutLog() {
		try {
			const today = moment();
			const dayOfWeek = today.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
			
			// Map moment.js day numbers to WorkoutDay enum
			const dayMapping: { [key: number]: WorkoutDay } = {
				0: WorkoutDay.SUNDAY,
				1: WorkoutDay.MONDAY,
				2: WorkoutDay.TUESDAY,
				3: WorkoutDay.WEDNESDAY,
				4: WorkoutDay.THURSDAY,
				5: WorkoutDay.FRIDAY,
				6: WorkoutDay.SATURDAY
			};
			
			const currentDay = dayMapping[dayOfWeek];
			
			// Check if current day is in selected training days
			const isTrainingDay = this.settings.trainingDays.includes(currentDay);

			const modal = new WorkoutLocationModal(this.app, this, !isTrainingDay);
			const result = await modal.show();

			let file: TFile;
			let existed: boolean;

			// Если выбран пользовательский шаблон
			if (result.customTemplate) {
				const logResult = await this.fileManager.createWorkoutLogFromCustomTemplate(
					this.settings.workoutFolder,
					result.location,
					result.customTemplate
				);
				file = logResult.file;
				existed = logResult.existed;
			} else {
				const logResult = await this.fileManager.createWorkoutLog(
					this.settings.workoutFolder,
					result.location,
					result.templateType
				);
				file = logResult.file;
				existed = logResult.existed;
			}

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

		// Migrate old settings: if trainingDays is missing, use default
		if (!this.settings.trainingDays || this.settings.trainingDays.length === 0) {
			this.settings.trainingDays = [WorkoutDay.MONDAY, WorkoutDay.WEDNESDAY, WorkoutDay.FRIDAY];
		}

		// Migrate old settings: if templateOverrides is missing, initialize empty
		if (!this.settings.templateOverrides) {
			this.settings.templateOverrides = {};
		}

		// Синхронизируем пользовательские шаблоны с файлами
		await this.syncCustomTemplates();

		if (changed) {
			await this.persistSettings();
		}
	}

	async syncCustomTemplates() {
		if (!this.settings.customTemplates || this.settings.customTemplates.length === 0) {
			return;
		}

		const templatesPath = `${this.settings.workoutFolder}/Templates`;
		const templatesFolder = this.app.vault.getAbstractFileByPath(templatesPath);
		
		if (!templatesFolder) {
			return;
		}

		const validTemplates = [];
		let removedCount = 0;

		for (const template of this.settings.customTemplates) {
			const filePath = `${templatesPath}/${template.fileName}`;
			const file = this.app.vault.getAbstractFileByPath(filePath);
			
			if (file) {
				validTemplates.push(template);
			} else {
				removedCount++;
				console.log(`[Main] Template file not found, removing: ${template.name}`);
			}
		}

		if (removedCount > 0) {
			this.settings.customTemplates = validTemplates;
			await this.persistSettings();
			console.log(`[Main] Removed ${removedCount} missing custom templates`);
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
	
	private loadChartJS() {
		console.log('[Plugin] ═══════════════════════════════════');
		console.log('[Plugin] 🚀 loadChartJS() вызван');
		console.log('[Plugin] Текущее состояние window.Chart:', !!(window as any).Chart);
		console.log('[Plugin] Текущее состояние window.chartJSLoading:', !!(window as any).chartJSLoading);
		console.log('[Plugin] Текущее состояние window.chartJSLoaded:', !!(window as any).chartJSLoaded);
		
		// Проверяем, не загружен ли уже Chart.js
		if ((window as any).Chart) {
			console.log('[Plugin] ✅ Chart.js уже загружен, выходим');
			console.log('[Plugin] ═══════════════════════════════════');
			return;
		}

		// Проверяем, не идёт ли уже загрузка
		if ((window as any).chartJSLoading) {
			console.log('[Plugin] ⏳ Chart.js уже загружается, выходим');
			console.log('[Plugin] ═══════════════════════════════════');
			return;
		}

		console.log('[Plugin] 📥 Начинаем загрузку Chart.js с CDN...');
		(window as any).chartJSLoading = true;

		const script = document.createElement('script');
		script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
		script.async = true;
		
		console.log('[Plugin] 📝 Script элемент создан, src:', script.src);
		
		script.onload = () => {
			console.log('[Plugin] ✅✅✅ Chart.js успешно загружен глобально!');
			console.log('[Plugin] window.Chart теперь:', !!(window as any).Chart);
			console.log('[Plugin] typeof window.Chart:', typeof (window as any).Chart);
			(window as any).chartJSLoading = false;
			(window as any).chartJSLoaded = true;
			console.log('[Plugin] ═══════════════════════════════════');
		};
		
		script.onerror = (error) => {
			console.error('[Plugin] ❌❌❌ Ошибка загрузки Chart.js!');
			console.error('[Plugin] Error object:', error);
			(window as any).chartJSLoading = false;
			console.log('[Plugin] ═══════════════════════════════════');
		};
		
		console.log('[Plugin] 🔗 Добавляем script в document.head...');
		document.head.appendChild(script);
		console.log('[Plugin] ✅ Script добавлен в DOM');
		console.log('[Plugin] ═══════════════════════════════════');
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

		// Training Days Selector
		const trainingDaysSetting = new Setting(containerEl)
			.setName('Дни тренировок')
			.setDesc('Выберите дни недели, когда вы тренируетесь');

		const daysContainer = trainingDaysSetting.controlEl.createDiv({ cls: 'training-days-selector' });

		// All days of the week in order
		const allDays = [
			WorkoutDay.MONDAY,
			WorkoutDay.TUESDAY,
			WorkoutDay.WEDNESDAY,
			WorkoutDay.THURSDAY,
			WorkoutDay.FRIDAY,
			WorkoutDay.SATURDAY,
			WorkoutDay.SUNDAY
		];

		allDays.forEach(day => {
			const dayCircle = daysContainer.createDiv({ cls: 'day-circle' });
			dayCircle.textContent = DAY_ABBR[day];
			dayCircle.setAttribute('title', DAY_NAMES_RU[day]);

			// Set initial state
			if (this.plugin.settings.trainingDays.includes(day)) {
				dayCircle.addClass('selected');
			}

			// Click handler
			dayCircle.addEventListener('click', async () => {
				const isSelected = dayCircle.hasClass('selected');

				if (isSelected) {
					// Deselect
					dayCircle.removeClass('selected');
					this.plugin.settings.trainingDays = this.plugin.settings.trainingDays.filter(d => d !== day);
				} else {
					// Select
					dayCircle.addClass('selected');
					this.plugin.settings.trainingDays.push(day);
				}

				await this.plugin.saveSettings();
			});
		});

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
