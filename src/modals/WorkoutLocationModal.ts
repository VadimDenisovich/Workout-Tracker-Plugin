import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import { WorkoutLocation, WorkoutDay, CustomTemplate } from '../types';
import { TemplateNameModal } from './TemplateNameModal';
import { DAY_NAMES_RU } from '../templates';

export class WorkoutLocationModal extends Modal {
	private resolve: (value: { location: WorkoutLocation; templateType?: WorkoutDay; customTemplate?: CustomTemplate }) => void;
	private reject: (reason?: any) => void;
	private isNonTrainingDay: boolean;
	private plugin: any; // WorkoutTrackerPlugin
	private shouldReject: boolean = true;

	constructor(app: App, plugin: any, isNonTrainingDay = false) {
		super(app);
		this.plugin = plugin;
		this.isNonTrainingDay = isNonTrainingDay;
	}

	show(): Promise<{ location: WorkoutLocation; templateType?: WorkoutDay; customTemplate?: CustomTemplate }> {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			this.open();
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Выберите место тренировки' });

		new Setting(contentEl)
			.setName('Спортзал')
			.setDesc('Тренировка в спортзале')
			.addButton(button => button
				.setButtonText('Выбрать')
				.onClick(() => {
					if (this.isNonTrainingDay) {
						this.showTemplateSelection();
					} else {
						this.shouldReject = false;
						this.resolve({ location: WorkoutLocation.GYM });
						this.close();
					}
				}));

		new Setting(contentEl)
			.setName('Дома')
			.setDesc('Домашняя тренировка')
			.addButton(button => button
				.setButtonText('Выбрать')
				.onClick(() => {
					this.shouldReject = false;
					this.resolve({ location: WorkoutLocation.HOME });
					this.close();
				}));

		new Setting(contentEl)
			.setName('Эксперимент')
			.setDesc('Экспериментальные тренировки')
			.addButton(button => button
				.setButtonText('Выбрать')
				.onClick(() => {
					this.showExperimentSelection();
				}));
	}

	private showTemplateSelection() {
		const { contentEl } = this;
		contentEl.empty();
		
		// Разрешаем закрытие через крестик
		this.shouldReject = true;

		contentEl.createEl('h2', { text: 'Выберите шаблон тренировки' });

		// Get selected training days from settings
		const trainingDays = this.plugin.settings.trainingDays || [
			WorkoutDay.MONDAY,
			WorkoutDay.WEDNESDAY,
			WorkoutDay.FRIDAY
		];

		// Define order of days
		const dayOrder = [
			WorkoutDay.MONDAY,
			WorkoutDay.TUESDAY,
			WorkoutDay.WEDNESDAY,
			WorkoutDay.THURSDAY,
			WorkoutDay.FRIDAY,
			WorkoutDay.SATURDAY,
			WorkoutDay.SUNDAY
		];

		// Sort training days by week order
		const sortedDays = trainingDays.sort((a: WorkoutDay, b: WorkoutDay) => {
			return dayOrder.indexOf(a) - dayOrder.indexOf(b);
		});

		// Build templates list from sorted training days
		const templates = sortedDays.map((day: WorkoutDay) => ({
			day: day,
			name: DAY_NAMES_RU[day]
		}));

		templates.forEach((template: { day: WorkoutDay; name: string }) => {
			new Setting(contentEl)
				.setName(template.name)
				.addButton(button => button
					.setButtonText('Выбрать')
					.onClick(() => {
						this.shouldReject = false;
						this.resolve({ 
							location: WorkoutLocation.GYM, 
							templateType: template.day 
						});
						this.close();
					}));
		});
	}

	private async showExperimentSelection() {
		const { contentEl } = this;
		contentEl.empty();
		
		// Разрешаем закрытие через крестик
		this.shouldReject = true;

		contentEl.createEl('h2', { text: 'Выберите шаблон эксперимента' });

		// Синхронизация: проверяем, какие шаблоны существуют
		await this.syncCustomTemplates('experiment');

		const experimentTemplates = this.plugin.settings.customTemplates.filter(
			(t: CustomTemplate) => t.type === 'experiment'
		);

		// Контейнер для списка шаблонов
		const listContainer = contentEl.createEl('div', { cls: 'template-list-container' });
		listContainer.style.marginBottom = '20px';

		if (experimentTemplates.length === 0) {
			// Пустое состояние
			const emptyState = listContainer.createEl('div', { cls: 'empty-state' });
			emptyState.style.textAlign = 'center';
			emptyState.style.padding = '80px 20px 60px 20px';
			emptyState.style.color = 'var(--text-muted)';
			
			emptyState.createEl('p', { 
				text: 'Пока пусто',
				cls: 'empty-state-text'
			});
			emptyState.querySelector('.empty-state-text')!.setAttribute('style', 'font-size: 16px; margin: 0;');
		} else {
			// Показываем список шаблонов
			experimentTemplates.forEach((template: CustomTemplate) => {
				new Setting(listContainer)
					.setName(template.name)
					.addButton(button => button
						.setButtonText('🗑️')
						.setClass('template-delete-button-small')
						.setTooltip('Удалить шаблон')
						.onClick(async () => {
							await this.deleteTemplate(template);
						}))
					.addButton(button => button
						.setButtonText('Выбрать')
						.onClick(() => {
							this.shouldReject = false;
							this.resolve({ 
								location: WorkoutLocation.GYM,
								customTemplate: template
							});
							this.close();
						}));
			});
		}

		// Добавляем кнопку "Создать" внизу по центру
		const buttonContainer = contentEl.createEl('div', { cls: 'centered-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'center';
		buttonContainer.style.marginTop = '40px';
		buttonContainer.style.position = 'relative';
		buttonContainer.style.zIndex = '1';

		const createButton = buttonContainer.createEl('button', {
			text: 'Создать',
			cls: 'mod-cta'
		});
		createButton.style.minWidth = '120px';
		createButton.style.padding = '8px 16px';

		createButton.onclick = async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await this.createNewExperimentTemplate();
		};
	}

	private async deleteTemplate(template: CustomTemplate) {
		const templatesPath = `${this.plugin.settings.workoutFolder}/Templates`;
		const filePath = `${templatesPath}/${template.fileName}`;
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file instanceof TFile) {
			try {
				await this.app.vault.delete(file);
				
				// Удаляем из настроек
				this.plugin.settings.customTemplates = this.plugin.settings.customTemplates.filter(
					(t: CustomTemplate) => t.fileName !== template.fileName
				);
				await this.plugin.saveSettings();

				new Notice(`Шаблон "${template.name}" удалён`);
				
				// Обновляем список
				this.showExperimentSelection();
			} catch (error) {
				console.error('Error deleting template:', error);
				new Notice('Ошибка при удалении шаблона');
			}
		} else {
			// Файл не существует, удаляем только из настроек
			this.plugin.settings.customTemplates = this.plugin.settings.customTemplates.filter(
				(t: CustomTemplate) => t.fileName !== template.fileName
			);
			await this.plugin.saveSettings();
			new Notice(`Шаблон "${template.name}" удалён из списка`);
			this.showExperimentSelection();
		}
	}

	private async syncCustomTemplates(type: 'workout' | 'experiment') {
		const templatesPath = `${this.plugin.settings.workoutFolder}/Templates`;
		const templatesFolder = this.app.vault.getAbstractFileByPath(templatesPath);
		
		if (!templatesFolder) {
			return;
		}

		// Получаем текущие шаблоны из настроек
		const currentTemplates = this.plugin.settings.customTemplates.filter(
			(t: CustomTemplate) => t.type === type
		);

		// Проверяем каждый шаблон на существование файла
		const validTemplates: CustomTemplate[] = [];
		
		for (const template of currentTemplates) {
			const filePath = `${templatesPath}/${template.fileName}`;
			const file = this.app.vault.getAbstractFileByPath(filePath);
			
			if (file) {
				// Файл существует, оставляем шаблон
				validTemplates.push(template);
			} else {
				// Файл не существует, удаляем из списка
				console.log(`Template file not found, removing: ${template.name}`);
			}
		}

		// Обновляем список шаблонов в настройках
		const otherTemplates = this.plugin.settings.customTemplates.filter(
			(t: CustomTemplate) => t.type !== type
		);

		this.plugin.settings.customTemplates = [...otherTemplates, ...validTemplates];
		
		// Сохраняем изменения если были удаления
		if (currentTemplates.length !== validTemplates.length) {
			await this.plugin.saveSettings();
		}
	}

	private async createNewWorkoutTemplate() {
		const templateName = await this.promptForTemplateName();
		if (!templateName) {
			// Возвращаемся к выбору места
			this.onOpen();
			return;
		}

		const templatesPath = `${this.plugin.settings.workoutFolder}/Templates`;
		const fileName = `${templateName}.md`;
		const filePath = `${templatesPath}/${fileName}`;

		// Проверяем, что файл не существует
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			new Notice('Шаблон с таким названием уже существует');
			this.onOpen();
			return;
		}

		const defaultContent = `# Тренировка - ${templateName}

**Дата:** {{date}}
**Место:** {{location}}

## Упражнения

### Упражнение 1
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

## Заметки

`;

		try {
			// Создаем файл
			await this.app.vault.create(filePath, defaultContent);

			// Добавляем в настройки
			const newTemplate: CustomTemplate = {
				name: templateName,
				fileName: fileName,
				content: defaultContent,
				type: 'workout'
			};

			this.plugin.settings.customTemplates.push(newTemplate);
			await this.plugin.saveSettings();

			new Notice(`Шаблон тренировки "${templateName}" создан`);
			
			// Используем новый шаблон
			this.shouldReject = false;
			this.resolve({ 
				location: WorkoutLocation.GYM,
				customTemplate: newTemplate
			});
			this.close();
		} catch (error) {
			console.error('Error creating template:', error);
			new Notice('Ошибка при создании шаблона');
			this.onOpen();
		}
	}

	private async createNewExperimentTemplate() {
		const templateName = await this.promptForTemplateName('experiment');
		if (!templateName) {
			// Возвращаемся к выбору экспериментов
			this.showExperimentSelection();
			return;
		}

		const templatesPath = `${this.plugin.settings.workoutFolder}/Templates`;
		const fileName = `${templateName}.md`;
		const filePath = `${templatesPath}/${fileName}`;

		// Проверяем, что папка Templates существует
		const templatesFolder = this.app.vault.getAbstractFileByPath(templatesPath);
		if (!templatesFolder) {
			new Notice('Папка Templates не найдена');
			this.showExperimentSelection();
			return;
		}

		// Проверяем, что файл не существует
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			new Notice('Шаблон с таким названием уже существует');
			this.showExperimentSelection();
			return;
		}

		const defaultContent = `# Эксперимент - ${templateName}

**Дата:** {{date}}
**Место:** {{location}}

## Описание

Добавьте описание вашего эксперимента здесь.

## Упражнения

### Упражнение 1
Подход 1: _ кг x _ раз
Подход 2: _ кг x _ раз

## Заметки

`;

		try {
			// Создаем файл
			const file = await this.app.vault.create(filePath, defaultContent);

			// Добавляем в настройки
			const newTemplate: CustomTemplate = {
				name: templateName,
				fileName: fileName,
				content: defaultContent,
				type: 'experiment'
			};

			this.plugin.settings.customTemplates.push(newTemplate);
			await this.plugin.saveSettings();

			new Notice(`Шаблон эксперимента "${templateName}" создан`);
			
			// Открываем созданный файл шаблона
			await this.app.workspace.getLeaf().openFile(file);
			this.shouldReject = false;
			this.close();
		} catch (error) {
			console.error('Error creating experiment template:', error);
			new Notice(`Ошибка при создании шаблона: ${error.message}`);
			this.showExperimentSelection();
		}
	}

	private async promptForTemplateName(type: 'workout' | 'experiment' = 'workout'): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new TemplateNameModal(this.app, resolve, type);
			modal.open();
		});
	}

	onClose() {
		if (this.reject && this.shouldReject) {
			this.reject('Modal closed');
		}
	}
}