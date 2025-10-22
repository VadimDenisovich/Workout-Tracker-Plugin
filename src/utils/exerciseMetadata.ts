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
			// metadataFilePath уже относительный путь (начинается с .obsidian)
			const filePath = this.metadataFilePath;
			
			console.log('[ExerciseMetadata] 📂 Попытка загрузить:', filePath);
			
			if (await adapter.exists(filePath)) {
				console.log('[ExerciseMetadata] ✅ Файл существует');
				const data = await adapter.read(filePath);
				console.log('[ExerciseMetadata] 📄 Размер данных:', data.length, 'байт');
				this.metadata = JSON.parse(data);
				console.log('[ExerciseMetadata] ✅ Метаданные загружены, упражнений:', Object.keys(this.metadata.exercises).length);
				console.log('[ExerciseMetadata] 📋 Список упражнений:', Object.keys(this.metadata.exercises).slice(0, 10).join(', '), '...');
			} else {
				console.log('[ExerciseMetadata] ⚠️ Файл метаданных не найден, создаём новый');
			}
		} catch (error) {
			console.error('[ExerciseMetadata] ❌ Ошибка загрузки метаданных:', error);
			this.metadata = this.getDefaultMetadata();
		}
	}

	async save(): Promise<void> {
		try {
			const adapter = this.app.vault.adapter;
			// metadataFilePath уже относительный путь
			const filePath = this.metadataFilePath;
			
			await adapter.write(filePath, JSON.stringify(this.metadata, null, 2));
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
		console.log('[ExerciseMetadata] 🔍 Поиск метаданных для:', exerciseName);
		console.log('[ExerciseMetadata] 📊 HEX:', Array.from(exerciseName).map(c => c.charCodeAt(0).toString(16)).join(' '));
		
		// Нормализуем Unicode (приводим к NFD, затем обратно к NFC)
		const normalizedInput = exerciseName.normalize('NFC');
		
		// Сначала пробуем точное совпадение
		let exercise = this.metadata.exercises[normalizedInput];
		
		if (exercise) {
			console.log('[ExerciseMetadata] ✅ Найдено точное совпадение, hasWeight:', exercise.hasWeight);
			return exercise.hasWeight;
		}
		
		// Пробуем все ключи с нормализацией
		const normalizedKeys = Object.keys(this.metadata.exercises).map(key => ({
			original: key,
			normalized: key.normalize('NFC')
		}));
		
		// Поиск точного совпадения после нормализации
		for (const {original, normalized} of normalizedKeys) {
			if (normalized === normalizedInput) {
				console.log('[ExerciseMetadata] ✅ Найдено после Unicode нормализации:', original);
				return this.metadata.exercises[original].hasWeight;
			}
		}
		
		// Если не найдено, пробуем замену ё→е (используем charCode)
		const withE = normalizedInput.replace(/\u0451/g, 'е').replace(/\u0401/g, 'Е');
		console.log('[ExerciseMetadata] 🔄 Пробуем нормализацию (ё→е):', withE);
		
		exercise = this.metadata.exercises[withE];
		if (exercise) {
			console.log('[ExerciseMetadata] ✅ Найдено через нормализацию (ё→е), hasWeight:', exercise.hasWeight);
			return exercise.hasWeight;
		}
		
		// Пробуем поиск с заменой ё→е в ключах
		for (const key of Object.keys(this.metadata.exercises)) {
			const keyWithE = key.normalize('NFC').replace(/\u0451/g, 'е').replace(/\u0401/g, 'Е');
			if (keyWithE === withE) {
				console.log('[ExerciseMetadata] ✅ Найдено в ключах после замены ё→е:', key);
				return this.metadata.exercises[key].hasWeight;
			}
		}
		
		// Если всё ещё не найдено, пробуем обратную нормализацию (е→ё)
		const withYo = normalizedInput.replace(/подъем/gi, 'подъём').replace(/Подъем/g, 'Подъём');
		console.log('[ExerciseMetadata] 🔄 Пробуем обратную нормализацию (е→ё):', withYo);
		
		exercise = this.metadata.exercises[withYo];
		if (exercise) {
			console.log('[ExerciseMetadata] ✅ Найдено через обратную нормализацию (е→ё), hasWeight:', exercise.hasWeight);
			return exercise.hasWeight;
		}
		
		// Ничего не найдено - выводим отладочную информацию
		console.log('[ExerciseMetadata] ⚠️ Упражнение НЕ НАЙДЕНО после всех попыток');
		console.log('[ExerciseMetadata] 📋 Доступные ключи (первые 10):', Object.keys(this.metadata.exercises).slice(0, 10));
		console.log('[ExerciseMetadata] 📊 Всего упражнений:', Object.keys(this.metadata.exercises).length);
		
		// Проверим, есть ли похожие упражнения
		const similar = Object.keys(this.metadata.exercises).filter(key => 
			key.toLowerCase().includes('дельты') || key.toLowerCase().includes('гантел')
		);
		if (similar.length > 0) {
			console.log('[ExerciseMetadata] 🔎 Похожие упражнения:', similar);
		}
		
		return null;
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
