import { App, TFile } from 'obsidian';
import { TemplateKey, WorkoutTrackerSettings } from '../types';
import { TEMPLATE_FILES, TEMPLATE_KEYS } from '../templates';

export class TemplateUpdater {
 	private pluginDir: string | null = null;

	constructor(
		private app: App,
		private pluginId: string,
		private getSettings: () => WorkoutTrackerSettings,
		private saveSettings: () => Promise<void>
	) {
		// Используем относительный путь к директории плагина (без basePath)
		this.pluginDir = `.obsidian/plugins/${this.pluginId}`;
	}

	async updateTemplateInCode(templateName: string, newContent: string): Promise<void> {
		const templateKey = this.getTemplateKey(templateName);
		if (!templateKey) {
			// Это может быть кастомный шаблон, не стандартный день недели
			return;
		}

		// Сохраняем переопределение в настройки (для синхронизации между устройствами)
		const settings = this.getSettings();
		if (!settings.templateOverrides) {
			settings.templateOverrides = {};
		}
		settings.templateOverrides[templateKey] = newContent;
		await this.saveSettings();

		// Обновляем исходный код templates.ts (работает только на десктопе)
		await this.updateTemplateSource(templateKey, newContent);
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
			'Tuesday': 'TUESDAY',
			'Wednesday': 'WEDNESDAY',
			'Thursday': 'THURSDAY',
			'Friday': 'FRIDAY',
			'Saturday': 'SATURDAY',
			'Sunday': 'SUNDAY',
			'Home': 'HOME'
		};

		return mapping[templateName] ?? null;
	}

	private async updateTemplateSource(key: TemplateKey, content: string): Promise<void> {
		if (!this.pluginDir) {
			return;
		}

		try {
			const templateSourcePath = `${this.pluginDir}/src/templates.ts`;
			const fileContent = await this.app.vault.adapter.read(templateSourcePath);
			
			const sanitized = this.escapeTemplateLiteral(content);
			
			// Ищем ключ в объекте WORKOUT_TEMPLATES (а не в TEMPLATE_FILES)
			// Паттерн: KEY: `содержимое`,
			const regex = new RegExp(`(\\s+${key}:\\s*)\`([\\s\\S]*?)\`(,?)`, 'm');
			
			if (!regex.test(fileContent)) {
				return;
			}

			const updated = fileContent.replace(regex, (match: string, prefix: string, oldContent: string, comma: string) => {
				return `${prefix}\`${sanitized}\`${comma}`;
			});
			
			if (updated !== fileContent) {
				await this.app.vault.adapter.write(templateSourcePath, updated);
			}
		} catch (error) {
			console.error('[updateTemplateSource] Ошибка:', error);
		}
	}

	private escapeTemplateLiteral(value: string): string {
		return value
			.replace(/\\/g, '\\\\')
			.replace(/`/g, '\\`');
	}
}