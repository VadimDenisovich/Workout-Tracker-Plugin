import { App, Modal, Notice } from 'obsidian';
import { CustomTemplate } from '../types';
import { TemplateNameModal } from './TemplateNameModal';

export class ExperimentTemplatesModal extends Modal {
	private plugin: any; // WorkoutTrackerPlugin
	private resolve: (value: CustomTemplate | null) => void;
	private reject: (reason?: any) => void;

	constructor(app: App, plugin: any) {
		super(app);
		this.plugin = plugin;
	}

	show(): Promise<CustomTemplate | null> {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			this.open();
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('experiment-templates-modal');

		contentEl.createEl('h2', { text: 'Шаблоны экспериментов' });

		const experimentTemplates = this.plugin.settings.customTemplates.filter(
			(t: CustomTemplate) => t.type === 'experiment'
		);

		if (experimentTemplates.length === 0) {
			const emptyState = contentEl.createEl('div', { cls: 'empty-state' });
			emptyState.style.textAlign = 'center';
			emptyState.style.padding = '40px 20px';
			emptyState.style.color = 'var(--text-muted)';
			
			emptyState.createEl('p', { 
				text: 'Пока здесь пусто',
				cls: 'empty-state-text'
			});
			emptyState.querySelector('.empty-state-text')!.setAttribute('style', 'font-size: 16px; margin-bottom: 10px;');
			
			emptyState.createEl('p', { 
				text: 'Создайте свой первый шаблон эксперимента',
				cls: 'empty-state-subtext'
			});
			emptyState.querySelector('.empty-state-subtext')!.setAttribute('style', 'font-size: 14px; color: var(--text-faint);');
		} else {
			const templateList = contentEl.createEl('div', { cls: 'template-list' });
			templateList.style.maxHeight = '400px';
			templateList.style.overflowY = 'auto';
			templateList.style.marginBottom = '20px';

			experimentTemplates.forEach((template: CustomTemplate) => {
				const templateItem = templateList.createEl('div', { cls: 'template-item' });
				templateItem.style.padding = '12px';
				templateItem.style.marginBottom = '8px';
				templateItem.style.border = '1px solid var(--background-modifier-border)';
				templateItem.style.borderRadius = '8px';
				templateItem.style.backgroundColor = 'var(--background-secondary)';
				templateItem.style.cursor = 'pointer';
				templateItem.style.transition = 'background-color 0.2s';

				templateItem.createEl('div', { text: template.name });

				templateItem.addEventListener('click', () => {
					this.resolve(template);
					this.close();
				});

				templateItem.addEventListener('mouseenter', () => {
					templateItem.style.backgroundColor = 'var(--background-modifier-hover)';
				});

				templateItem.addEventListener('mouseleave', () => {
					templateItem.style.backgroundColor = 'var(--background-secondary)';
				});
			});
		}

		// Кнопка "Создать" внизу по центру
		const buttonContainer = contentEl.createEl('div', { cls: 'centered-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'center';
		buttonContainer.style.marginTop = '20px';

		const createButton = buttonContainer.createEl('button', {
			text: 'Создать',
			cls: 'mod-cta centered-create-button'
		});
		createButton.style.minWidth = '120px';

		createButton.addEventListener('click', async () => {
			await this.createNewTemplate();
		});
	}

	private async createNewTemplate() {
		const templateName = await this.promptForTemplateName();
		if (!templateName) return;

		const templatesPath = `${this.plugin.settings.workoutFolder}/Templates`;
		const fileName = `${templateName}.md`;
		const filePath = `${templatesPath}/${fileName}`;

		// Проверяем, что файл не существует
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			new Notice('Шаблон с таким названием уже существует');
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
			await this.app.vault.create(filePath, defaultContent);

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
			
			// Обновляем модальное окно
			this.onOpen();
		} catch (error) {
			console.error('Error creating template:', error);
			new Notice('Ошибка при создании шаблона');
		}
	}

	private async promptForTemplateName(): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new TemplateNameModal(this.app, resolve, 'experiment');
			modal.open();
		});
	}

	onClose() {
		if (this.reject) {
			this.reject('Modal closed');
		}
	}
}
