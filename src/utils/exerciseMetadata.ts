import { App } from 'obsidian';

export interface ExerciseMetadata {
	name: string;
	hasWeight: boolean;
}

export interface ExerciseMetadataStore {
	version: string;
	exercises: Record<string, ExerciseMetadata>;
}

export class ExerciseMetadataManager {
	private app: App;
	private metadataFilePath: string;
	private metadata: ExerciseMetadataStore;

	constructor(app: App, pluginDir: string) {
		this.app = app;
		this.metadataFilePath = `${pluginDir}/exercise-metadata.json`;
		this.metadata = this.getDefaultMetadata();
	}

	private getDefaultMetadata(): ExerciseMetadataStore {
		return {
			version: '1.0.0',
			exercises: {}
		};
	}

	async load(): Promise<void> {
		try {
			const adapter = this.app.vault.adapter;
			const relativePath = this.metadataFilePath.replace(/^.*\.obsidian/, '.obsidian');
			
			if (await adapter.exists(relativePath)) {
				const data = await adapter.read(relativePath);
				this.metadata = JSON.parse(data);
				console.log('[ExerciseMetadata] Метаданные загружены, упражнений:', Object.keys(this.metadata.exercises).length);
			} else {
				console.log('[ExerciseMetadata] Файл метаданных не найден, создаём новый');
			}
		} catch (error) {
			console.error('[ExerciseMetadata] Ошибка загрузки метаданных:', error);
			this.metadata = this.getDefaultMetadata();
		}
	}

	async save(): Promise<void> {
		try {
			const adapter = this.app.vault.adapter;
			const relativePath = this.metadataFilePath.replace(/^.*\.obsidian/, '.obsidian');
			
			await adapter.write(relativePath, JSON.stringify(this.metadata, null, 2));
			console.log('[ExerciseMetadata] Метаданные сохранены');
		} catch (error) {
			console.error('[ExerciseMetadata] Ошибка сохранения метаданных:', error);
		}
	}

	async addExercise(name: string, hasWeight: boolean): Promise<void> {
		this.metadata.exercises[name] = { name, hasWeight };
		await this.save();
		console.log('[ExerciseMetadata] Добавлено упражнение:', name, 'hasWeight:', hasWeight);
	}

	async removeExercise(name: string): Promise<void> {
		if (this.metadata.exercises[name]) {
			delete this.metadata.exercises[name];
			await this.save();
			console.log('[ExerciseMetadata] Удалено упражнение:', name);
		}
	}

	hasWeight(exerciseName: string): boolean | null {
		const exercise = this.metadata.exercises[exerciseName];
		return exercise ? exercise.hasWeight : null;
	}

	getAll(): Record<string, ExerciseMetadata> {
		return this.metadata.exercises;
	}

	async syncFromRegistry(exerciseRegistry: Array<{ name: string; hasWeight: boolean }>): Promise<void> {
		console.log('[ExerciseMetadata] Синхронизация с реестром упражнений...');
		
		// Добавляем/обновляем упражнения из реестра
		for (const exercise of exerciseRegistry) {
			this.metadata.exercises[exercise.name] = {
				name: exercise.name,
				hasWeight: exercise.hasWeight
			};
		}

		await this.save();
		console.log('[ExerciseMetadata] Синхронизация завершена');
	}
}
