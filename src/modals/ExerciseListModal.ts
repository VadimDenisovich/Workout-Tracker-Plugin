import { App, Modal, Setting, TFile, Notice } from 'obsidian';
import { Exercise } from '../types';
import { FileManager } from '../utils/fileManager';
import { EXERCISE_TEMPLATE } from '../templates';
import WorkoutTrackerPlugin from '../../main';

export class ExerciseListModal extends Modal {
	private plugin: WorkoutTrackerPlugin;
	private fileManager: FileManager;
	private searchQuery = '';

	constructor(app: App, plugin: WorkoutTrackerPlugin, fileManager: FileManager) {
		super(app);
		this.plugin = plugin;
		this.fileManager = fileManager;
	}

	onOpen() {
		this.searchQuery = '';
		this.renderExerciseList();
	}

	async renderExerciseList() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('exercise-modal-content');

		const header = contentEl.createEl('div', { cls: 'exercise-modal-header' });
		header.createEl('h2', { text: 'Упражнения' });

		const addButton = header.createEl('button', {
			cls: 'exercise-add-button'
		});
		addButton.setAttribute('aria-label', 'Добавить упражнение');
		addButton.title = 'Добавить упражнение';
		addButton.addEventListener('click', () => this.createNewExercise());

		const searchContainer = contentEl.createEl('div', { cls: 'exercise-search' });
		const searchInput = searchContainer.createEl('input', {
			type: 'search',
			placeholder: 'Поиск упражнения'
		});
		searchInput.value = this.searchQuery;
		searchInput.addEventListener('input', (event) => {
			const target = event.target as HTMLInputElement;
			this.searchQuery = target.value;
			this.renderExerciseList();
		});
		searchInput.focus({ preventScroll: true });
		if (this.searchQuery) {
			const end = this.searchQuery.length;
			searchInput.setSelectionRange(end, end);
		}

		const exerciseList = contentEl.createEl('div', { cls: 'exercise-modal-list' });

		try {
			const exercises = await this.getExercises();
			const normalizedQuery = this.searchQuery.trim().toLocaleLowerCase();
			const filtered = normalizedQuery
				? exercises.filter(exercise => exercise.name.toLocaleLowerCase().includes(normalizedQuery))
				: exercises;

			if (filtered.length === 0) {
				exerciseList.createEl('p', {
					text: normalizedQuery ? 'По запросу ничего не найдено' : 'Упражнения не найдены'
				});
				return;
			}

			filtered.forEach(exercise => {
				const exerciseItem = exerciseList.createEl('div', { cls: 'exercise-modal-item' });
				
				const exerciseButton = exerciseItem.createEl('button', {
					text: exercise.name,
					cls: 'exercise-modal-button'
				});
				exerciseButton.addEventListener('click', async () => {
					await this.openExerciseFile(exercise.filePath);
					this.close();
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
		const result = await this.promptForExerciseName();
		if (!result) return;

		const { name: exerciseName, hasWeight } = result;
		const exercisesPath = `${this.plugin.settings.workoutFolder}/Exercises`;
		const filePath = `${exercisesPath}/${exerciseName}.md`;

		// Проверяем, что файл не существует
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			new Notice('Упражнение с таким названием уже существует');
			return;
		}

		// Используем правильный шаблон в зависимости от hasWeight
		const template = await this.fileManager['getExerciseTemplate'](hasWeight);
		const content = template
			.replace(/{{exerciseName}}/g, exerciseName)
			.replace(/{{workoutFolder}}/g, this.plugin.settings.workoutFolder);

		try {
			const file = await this.app.vault.create(filePath, content);
			// ВАЖНО: Сначала регистрируем упражнение, ПОТОМ открываем файл
			// Иначе событие file-open сработает раньше и не найдет упражнение в реестре
			await this.plugin.registerExercise(exerciseName, hasWeight);
			await this.app.workspace.getLeaf().openFile(file);
			this.searchQuery = '';
			await this.renderExerciseList(); // Обновляем список
			this.close();
		} catch (error) {
			new Notice('Ошибка при создании упражнения');
		}
	}

	private async deleteExercise(exercise: Exercise) {
		const confirmed = confirm(`Удалить упражнение "${exercise.name}"?`);
		if (!confirmed) return;

		try {
			await this.fileManager.deleteExerciseFile(exercise.filePath);
			await this.plugin.unregisterExercise(exercise.name);
			await this.renderExerciseList(); // Обновляем список
			new Notice(`Упражнение "${exercise.name}" удалено`);
		} catch (error) {
			new Notice('Ошибка при удалении упражнения');
		}
	}

	private async promptForExerciseName(): Promise<{ name: string; hasWeight: boolean } | null> {
		return new Promise((resolve) => {
			const modal = new ExerciseNameModal(this.app, resolve);
			modal.open();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ExerciseNameModal extends Modal {
	private resolve: (value: { name: string; hasWeight: boolean } | null) => void;
	private hasWeight = false;

	constructor(app: App, resolve: (value: { name: string; hasWeight: boolean } | null) => void) {
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

		// Переключатель "Упражнение с весом"
		const toggleContainer = contentEl.createEl('div', { cls: 'exercise-weight-toggle' });
		toggleContainer.style.marginTop = '10px';
		toggleContainer.style.display = 'flex';
		toggleContainer.style.alignItems = 'center';
		toggleContainer.style.gap = '10px';

		const checkbox = toggleContainer.createEl('input', { type: 'checkbox' });
		checkbox.checked = this.hasWeight;
		checkbox.style.cursor = 'pointer';
		checkbox.addEventListener('change', () => {
			this.hasWeight = checkbox.checked;
		});

		const toggleLabel = toggleContainer.createEl('label', { text: 'Упражнение с весом' });
		toggleLabel.style.cursor = 'pointer';
		toggleLabel.addEventListener('click', () => {
			checkbox.checked = !checkbox.checked;
			this.hasWeight = checkbox.checked;
		});

		const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
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
				this.resolve({ name: value, hasWeight: this.hasWeight });
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