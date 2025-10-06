import { App, TFile, FileSystemAdapter } from 'obsidian';
import { promises as fs } from 'fs';
import { join } from 'path';
import { TemplateKey } from '../types';
import { TEMPLATE_FILES, TEMPLATE_KEYS } from '../templates';

export class TemplateUpdater {
 	private templateSourcePath: string | null = null;

	constructor(
		private app: App,
		private pluginId: string,
		private onOverridesChange: (() => Promise<void> | void) | null = null
	) {
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			const basePath = adapter.getBasePath();
			this.templateSourcePath = join(basePath, '.obsidian', 'plugins', this.pluginId, 'src', 'templates.ts');
		}
	}

	async updateTemplateInCode(templateName: string, newContent: string): Promise<void> {
		console.log(`[TemplateUpdater] updateTemplateInCode вызван для "${templateName}"`);
		console.log(`[TemplateUpdater] Длина нового контента: ${newContent.length} символов`);
		
		const templateKey = this.getTemplateKey(templateName);
		if (!templateKey) {
			console.log(`[TemplateUpdater] ❌ Не найден ключ для шаблона "${templateName}"`);
			return;
		}
		
		console.log(`[TemplateUpdater] Ключ шаблона: ${templateKey}`);
		console.log(`[TemplateUpdater] Путь к templates.ts: ${this.templateSourcePath}`);

		// Сразу обновляем исходный код templates.ts
		await this.updateTemplateSource(templateKey, newContent);
		console.log(`[TemplateUpdater] ✅ Шаблон обновлён в исходном коде`);
	}

	async syncTemplatesWithFiles(workoutFolder: string): Promise<void> {
		for (const key of TEMPLATE_KEYS) {
			const fileName = TEMPLATE_FILES[key];
			const filePath = `${workoutFolder}/Templates/${fileName}`;
			const file = this.app.vault.getAbstractFileByPath(filePath);

			if (file instanceof TFile) {
				try {
					const content = await this.app.vault.read(file);
					// Сразу обновляем исходный код templates.ts
					await this.updateTemplateSource(key, content);
				} catch (error) {
					console.error(`Ошибка при чтении шаблона ${fileName}:`, error);
				}
			}
		}
	}

	private getTemplateKey(templateName: string): TemplateKey | null {
		const mapping: Record<string, TemplateKey> = {
			'Monday': 'MONDAY',
			'Wednesday': 'WEDNESDAY',
			'Friday': 'FRIDAY',
			'Home': 'HOME'
		};

		return mapping[templateName] ?? null;
	}

	private async updateTemplateSource(key: TemplateKey, content: string): Promise<void> {
		console.log(`[updateTemplateSource] Начало обновления для ключа: ${key}`);
		
		if (!this.templateSourcePath) {
			console.log(`[updateTemplateSource] ❌ templateSourcePath не установлен!`);
			return;
		}

		try {
			console.log(`[updateTemplateSource] Чтение файла: ${this.templateSourcePath}`);
			const fileContent = await fs.readFile(this.templateSourcePath, 'utf8');
			console.log(`[updateTemplateSource] Файл прочитан, размер: ${fileContent.length} символов`);
			
			const sanitized = this.escapeTemplateLiteral(content);
			console.log(`[updateTemplateSource] Контент экранирован, размер: ${sanitized.length} символов`);
			
			// Ищем ключ в объекте WORKOUT_TEMPLATES (а не в TEMPLATE_FILES)
			// Паттерн: KEY: `содержимое`,
			const regex = new RegExp(`(\\s+${key}:\\s*)\`([\\s\\S]*?)\`(,?)`, 'm');
			
			console.log(`[updateTemplateSource] Regex паттерн: ${regex}`);
			console.log(`[updateTemplateSource] Тест regex: ${regex.test(fileContent)}`);
			
			if (!regex.test(fileContent)) {
				console.log(`[updateTemplateSource] ❌ Regex не нашёл паттерн в файле!`);
				// Попробуем найти что есть в файле
				const lines = fileContent.split('\n');
				const keyLine = lines.find(l => l.includes(key + ':'));
				console.log(`[updateTemplateSource] Строка с ключом в файле: ${keyLine}`);
				
				// Попробуем найти начало объекта WORKOUT_TEMPLATES
				const templateObjStart = fileContent.indexOf('export const WORKOUT_TEMPLATES');
				if (templateObjStart !== -1) {
					const snippet = fileContent.substring(templateObjStart, templateObjStart + 200);
					console.log(`[updateTemplateSource] Начало WORKOUT_TEMPLATES: ${snippet}`);
				}
				return;
			}

			const updated = fileContent.replace(regex, (match, prefix, oldContent, comma) => {
				console.log(`[updateTemplateSource] ✅ Найдено совпадение!`);
				console.log(`[updateTemplateSource] Префикс: "${prefix}"`);
				console.log(`[updateTemplateSource] Старый контент (первые 50 символов): ${oldContent.substring(0, 50)}...`);
				console.log(`[updateTemplateSource] Старый контент (последние 50 символов): ...${oldContent.substring(oldContent.length - 50)}`);
				console.log(`[updateTemplateSource] Старая длина: ${oldContent.length}`);
				console.log(`[updateTemplateSource] Новая длина: ${sanitized.length}`);
				console.log(`[updateTemplateSource] Comma: "${comma}"`);
				const replacement = `${prefix}\`${sanitized}\`${comma}`;
				console.log(`[updateTemplateSource] Замена (первые 100 символов): ${replacement.substring(0, 100)}...`);
				return replacement;
			});
			console.log(`[updateTemplateSource] Контент заменён, изменился: ${updated !== fileContent}`);
			
			if (updated !== fileContent) {
				await fs.writeFile(this.templateSourcePath, updated, 'utf8');
				console.log(`[updateTemplateSource] ✅ Файл успешно записан на диск`);
			} else {
				console.log(`[updateTemplateSource] ⚠️ Контент не изменился, запись пропущена`);
			}
		} catch (error) {
			console.error('[updateTemplateSource] ❌ Ошибка:', error);
		}
	}

	private escapeTemplateLiteral(value: string): string {
		return value
			.replace(/\\/g, '\\\\')
			.replace(/`/g, '\\`');
	}
}