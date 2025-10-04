import { ItemView, WorkspaceLeaf, TFile, Modal, App, Notice } from 'obsidian';
import { Exercise } from '../types';
import { FileManager } from '../utils/fileManager';
import { EXERCISE_TEMPLATE } from '../templates';
import WorkoutTrackerPlugin from '../../main';

export const EXERCISE_VIEW_TYPE = 'exercise-view';

export class ExerciseView extends ItemView {
	private plugin: WorkoutTrackerPlugin;
	private fileManager: FileManager;

	constructor(leaf: WorkspaceLeaf, plugin: WorkoutTrackerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.fileManager = new FileManager(this.app);
	}

	getViewType(): string {
		return EXERCISE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Упражнения';
	}

	getIcon(): string {
		return 'dumbbell';
	}

	async onOpen() {
		await this.renderExerciseList();
	}

	async renderExerciseList() {
		const container = this.containerEl.children[1];
		container.empty();

		const header = container.createEl('div', { cls: 'exercise-header' });
		header.createEl('h2', { text: 'Упражнения' });

		const addButton = header.createEl('button', { 
			text: 'Добавить упражнение',
			cls: 'mod-cta'
		});
		addButton.addEventListener('click', () => this.createNewExercise());

		const exerciseList = container.createEl('div', { cls: 'exercise-list' });

		try {
			const exercises = await this.getExercises();
			
			if (exercises.length === 0) {
				exerciseList.createEl('p', { text: 'Упражнения не найдены' });
				return;
			}

			exercises.forEach(exercise => {
				const exerciseItem = exerciseList.createEl('div', { cls: 'exercise-item' });
				
				const exerciseButton = exerciseItem.createEl('button', {
					text: exercise.name,
					cls: 'exercise-button'
				});
				exerciseButton.addEventListener('click', () => {
					this.openExerciseFile(exercise.filePath);
				});

				const deleteButton = exerciseItem.createEl('button', {
					text: '−',
					cls: 'exercise-delete-button'
				});
				deleteButton.addEventListener('click', async () => {
					await this.deleteExercise(exercise);
				});
			});

		} catch (error) {
			exerciseList.createEl('p', { text: 'Ошибка при загрузке упражнений' });
		}
	}

	private async getExercises(): Promise<Exercise[]> {
		const exerciseFiles = await this.fileManager.getExerciseFiles(this.plugin.settings.workoutFolder);
		return exerciseFiles.map(file => ({
			name: file.basename,
			filePath: file.path
		}));
	}

	private async openExerciseFile(filePath: string) {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			await this.app.workspace.getLeaf().openFile(file);
		}
	}

	private async createNewExercise() {
		const exerciseName = await this.promptForExerciseName();
		if (!exerciseName) return;

		const exercisesPath = `${this.plugin.settings.workoutFolder}/Exercises`;
		const filePath = `${exercisesPath}/${exerciseName}.md`;

		// Проверяем, что файл не существует
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			new Notice('Упражнение с таким названием уже существует');
			return;
		}

		const content = EXERCISE_TEMPLATE
			.replace(/{{exerciseName}}/g, exerciseName)
			.replace(/{{workoutFolder}}/g, this.plugin.settings.workoutFolder)
			.replace(/{{exerciseTag}}/g, exerciseName.toLowerCase().replace(/\s+/g, '-'));

		try {
			const file = await this.app.vault.create(filePath, content);
			await this.app.workspace.getLeaf().openFile(file);
			await this.renderExerciseList(); // Обновляем список
		} catch (error) {
			new Notice('Ошибка при создании упражнения');
		}
	}

	private async deleteExercise(exercise: Exercise) {
		const confirmed = confirm(`Удалить упражнение "${exercise.name}"?`);
		if (!confirmed) return;

		try {
			await this.fileManager.deleteExerciseFile(exercise.filePath);
			await this.renderExerciseList(); // Обновляем список
			new Notice(`Упражнение "${exercise.name}" удалено`);
		} catch (error) {
			new Notice('Ошибка при удалении упражнения');
		}
	}

	private async promptForExerciseName(): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new ExerciseNameModal(this.app, resolve);
			modal.open();
		});
	}
}

class ExerciseNameModal extends Modal {
	private resolve: (value: string | null) => void;

	constructor(app: App, resolve: (value: string | null) => void) {
		super(app);
		this.resolve = resolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Создать новое упражнение' });

		const input = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Название упражнения'
		});
		input.focus();

		const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
		
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
		input.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				handleCreate();
			}
		});
	}

	onClose() {
		this.resolve(null);
	}
}