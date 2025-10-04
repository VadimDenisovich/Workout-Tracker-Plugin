import { App, Modal, Setting } from 'obsidian';
import { WorkoutLocation, WorkoutDay } from '../types';

export class WorkoutLocationModal extends Modal {
	private resolve: (value: { location: WorkoutLocation; templateType?: WorkoutDay }) => void;
	private reject: (reason?: any) => void;
	private isNonTrainingDay: boolean;

	constructor(app: App, isNonTrainingDay = false) {
		super(app);
		this.isNonTrainingDay = isNonTrainingDay;
	}

	show(): Promise<{ location: WorkoutLocation; templateType?: WorkoutDay }> {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			this.open();
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Выберите место тренировки' });

		new Setting(contentEl)
			.setName('Спортзал')
			.setDesc('Тренировка в спортзале')
			.addButton(button => button
				.setButtonText('Выбрать')
				.onClick(() => {
					if (this.isNonTrainingDay) {
						this.showTemplateSelection();
					} else {
						this.resolve({ location: WorkoutLocation.GYM });
						this.close();
					}
				}));

		new Setting(contentEl)
			.setName('Дома')
			.setDesc('Домашняя тренировка')
			.addButton(button => button
				.setButtonText('Выбрать')
				.onClick(() => {
					this.resolve({ location: WorkoutLocation.HOME });
					this.close();
				}));
	}

	private showTemplateSelection() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Выберите шаблон тренировки' });

		const templates = [
			{ day: WorkoutDay.MONDAY, name: 'Понедельник' },
			{ day: WorkoutDay.WEDNESDAY, name: 'Среда' },
			{ day: WorkoutDay.FRIDAY, name: 'Пятница' }
		];

		templates.forEach(template => {
			new Setting(contentEl)
				.setName(template.name)
				.addButton(button => button
					.setButtonText('Выбрать')
					.onClick(() => {
						this.resolve({ 
							location: WorkoutLocation.GYM, 
							templateType: template.day 
						});
						this.close();
					}));
		});
	}

	onClose() {
		if (this.reject) {
			this.reject('Modal closed');
		}
	}
}