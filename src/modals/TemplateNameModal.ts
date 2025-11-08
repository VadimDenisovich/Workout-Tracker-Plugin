import { App, Modal } from 'obsidian';

export class TemplateNameModal extends Modal {
	private resolve: (value: string | null) => void;
	private templateType: 'workout' | 'experiment' | 'muscle-group' | 'special-day';

	constructor(app: App, resolve: (value: string | null) => void, templateType: 'workout' | 'experiment' | 'muscle-group' | 'special-day' = 'workout') {
		super(app);
		this.resolve = resolve;
		this.templateType = templateType;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		let title: string;
		switch (this.templateType) {
			case 'experiment':
				title = 'Создать шаблон эксперимента';
				break;
			case 'muscle-group':
				title = 'Создать шаблон на группу мышц';
				break;
			case 'special-day':
				title = 'Создать шаблон для особого дня';
				break;
			default:
				title = 'Создать шаблон тренировки';
		}
		
		contentEl.createEl('h2', { text: title });

		const input = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Название шаблона'
		});
		input.style.width = '100%';
		input.style.padding = '10px';
		input.style.marginTop = '10px';
		input.style.marginBottom = '20px';
		input.style.borderRadius = '8px';
		input.style.border = '1px solid var(--background-modifier-border)';
		input.focus();

		const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'center';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '20px';
		
		const createButton = buttonContainer.createEl('button', {
			text: 'Создать',
			cls: 'mod-cta'
		});

		const cancelButton = buttonContainer.createEl('button', {
			text: 'Отмена'
		});

		const handleCreate = () => {
			const value = input.value.trim();
			if (value) {
				this.resolve(value);
				this.close();
			}
		};

		const handleCancel = () => {
			this.resolve(null);
			this.close();
		};

		createButton.addEventListener('click', handleCreate);
		cancelButton.addEventListener('click', handleCancel);

		input.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				handleCreate();
			} else if (e.key === 'Escape') {
				handleCancel();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
