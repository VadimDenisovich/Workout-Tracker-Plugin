import { App, TFile } from 'obsidian';
import { TemplateOverrides, TemplateKey } from '../types';
import { TEMPLATE_FILES, TEMPLATE_KEYS, WORKOUT_TEMPLATES } from '../templates';

export class TemplateUpdater {
	private overrides: TemplateOverrides = {};

	constructor(
		private app: App,
		private onOverridesChange: (overrides: TemplateOverrides) => Promise<void> | void
	) {}

	setOverrides(overrides: TemplateOverrides) {
		this.overrides = { ...(overrides ?? {}) };
	}

	getOverrides(): TemplateOverrides {
		return { ...this.overrides };
	}

	async updateTemplateInCode(templateName: string, newContent: string): Promise<void> {
		const templateKey = this.getTemplateKey(templateName);
		if (!templateKey) return;

		const changed = this.applyOverride(templateKey, newContent);
		if (changed) {
			await this.notifyChange();
		}
	}

	async syncTemplatesWithFiles(workoutFolder: string): Promise<void> {
		let changed = false;

		for (const key of TEMPLATE_KEYS) {
			const fileName = TEMPLATE_FILES[key];
			const filePath = `${workoutFolder}/Templates/${fileName}`;
			const file = this.app.vault.getAbstractFileByPath(filePath);

			if (file instanceof TFile) {
				try {
					const content = await this.app.vault.read(file);
					if (this.applyOverride(key, content)) {
						changed = true;
					}
				} catch (error) {
					console.error(`Ошибка при чтении шаблона ${fileName}:`, error);
				}
			}
		}

		if (changed) {
			await this.notifyChange();
		}
	}

	private async notifyChange(): Promise<void> {
		if (this.onOverridesChange) {
			await this.onOverridesChange({ ...this.overrides });
		}
	}

	private applyOverride(key: TemplateKey, content: string): boolean {
		const defaultContent = WORKOUT_TEMPLATES[key];
		if (content === defaultContent) {
			if (this.overrides[key]) {
				delete this.overrides[key];
				return true;
			}
			return false;
		}

		if (this.overrides[key] !== content) {
			this.overrides[key] = content;
			return true;
		}

		return false;
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
}