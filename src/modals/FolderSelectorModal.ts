import { App, Modal, Setting, TFolder } from 'obsidian';
import { FileManager } from '../utils/fileManager';

export class FolderSelectorModal extends Modal {
	private resolve: (value: string) => void;
	private reject: (reason?: any) => void;
	private fileManager: FileManager;
	private currentPath: string = '';
	private inputElement: HTMLInputElement;

	constructor(app: App, currentValue: string = '') {
		super(app);
		this.fileManager = new FileManager(app);
		this.currentPath = currentValue;
	}

	setInputElement(input: HTMLInputElement) {
		this.inputElement = input;
	}

	show(): Promise<string> {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			this.open();
		});
	}

	onOpen() {
		this.displayFolders(this.currentPath);
	}

	private async displayFolders(path: string) {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h3', { text: 'Выбор папки тренировок' });

		if (path) {
			contentEl.createEl('p', { 
				text: `Текущий путь: ${path}`,
				cls: 'current-path-display'
			});
		}

		try {
			const folders = await this.getFoldersInPath(path);

			const folderList = contentEl.createEl('div', { cls: 'folder-list' });

			// Показываем папки в текущем пути
			folders.forEach(folder => {
				const folderItem = folderList.createEl('div', { cls: 'folder-item' });
				
				const folderButton = folderItem.createEl('button', {
					text: `📁 ${folder.name}`,
					cls: 'folder-button'
				});

				folderButton.addEventListener('click', () => {
					const newPath = path ? `${path}/${folder.name}` : folder.name;
					this.updateInputAndContinue(newPath);
				});
			});

			// Кнопка "Создать свою"
			const createItem = folderList.createEl('div', { cls: 'folder-item create-folder' });
			const createButton = createItem.createEl('button', {
				text: '+ Создать свою',
				cls: 'create-folder-button'
			});

			createButton.addEventListener('click', () => {
				this.showCreateFolderInput(path);
			});

			// Кнопки управления
			const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });

			if (path) {
				const selectButton = buttonContainer.createEl('button', {
					text: 'Выбрать эту папку',
					cls: 'mod-cta'
				});
				selectButton.addEventListener('click', () => {
					this.selectFolder(path);
				});

				const backButton = buttonContainer.createEl('button', {
					text: 'Назад'
				});
				backButton.addEventListener('click', () => {
					const parentPath = path.split('/').slice(0, -1).join('/');
					this.currentPath = parentPath;
					this.displayFolders(parentPath);
				});
			}

			const cancelButton = buttonContainer.createEl('button', {
				text: 'Отмена'
			});
			cancelButton.addEventListener('click', () => {
				this.close();
			});

		} catch (error) {
			contentEl.createEl('p', { text: 'Ошибка при загрузке папок' });
		}
	}

	private async getFoldersInPath(path: string): Promise<TFolder[]> {
		if (!path) {
			// Возвращаем папки верхнего уровня
			const allFolders = await this.fileManager.getAllFolders();
			return allFolders.filter(folder => !folder.path.includes('/'));
		} else {
			return await this.fileManager.getFoldersInPath(path);
		}
	}

	private updateInputAndContinue(newPath: string) {
		this.currentPath = newPath;
		
		// Обновляем поле ввода
		if (this.inputElement) {
			this.inputElement.value = newPath;
		}

		// Показываем подпапки
		this.displayFolders(newPath);
	}

	private showCreateFolderInput(currentPath: string) {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h3', { text: 'Создать новую папку' });

		if (currentPath) {
			contentEl.createEl('p', { text: `В папке: ${currentPath}` });
		}

		const input = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Название новой папки'
		});
		input.focus();

		const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
		
		const createButton = buttonContainer.createEl('button', {
			text: 'Создать',
			cls: 'mod-cta'
		});

		const backButton = buttonContainer.createEl('button', {
			text: 'Назад'
		});

		const handleCreate = async () => {
			const folderName = input.value.trim();
			if (folderName) {
				const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
				
				try {
					await this.fileManager.ensureFolderExists(newPath);
					this.selectFolder(newPath);
				} catch (error) {
					contentEl.createEl('p', { text: 'Ошибка при создании папки' });
				}
			}
		};

		const handleBack = () => {
			this.displayFolders(currentPath);
		};

		createButton.addEventListener('click', handleCreate);
		backButton.addEventListener('click', handleBack);
		input.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				handleCreate();
			}
		});
	}

	private selectFolder(path: string) {
		if (this.inputElement) {
			this.inputElement.value = path;
		}
		this.resolve(path);
		this.close();
	}

	onClose() {
		if (this.reject) {
			this.reject('Modal closed');
		}
	}
}