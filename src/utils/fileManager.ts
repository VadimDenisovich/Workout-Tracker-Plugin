import { App, TFolder, TFile, moment, Notice, TAbstractFile } from 'obsidian';
import { WorkoutLocation, WorkoutDay, TemplateKey, ExerciseInfo, WorkoutTrackerSettings, CustomTemplate } from '../types';
import { TEMPLATE_FILES, DEFAULT_EXERCISES, EXERCISE_TEMPLATE } from '../templates';

export class FileManager {
	constructor(
		private app: App, 
		private pluginDir: string,
		private getSettings: () => WorkoutTrackerSettings
	) {}

	private async getTemplate(key: TemplateKey): Promise<string> {
		const settings = this.getSettings();
		
		// Сначала проверяем переопределения из настроек (для синхронизации между устройствами)
		if (settings.templateOverrides && settings.templateOverrides[key]) {
			console.log(`[FileManager] Используем переопределение из настроек для ${key}`);
			return settings.templateOverrides[key]!; // Уверены, что не undefined
		}
		
		try {
			// Используем Obsidian API для чтения файла (работает на всех платформах)
			const templatesPath = `${this.pluginDir}/src/templates.ts`;
			const content = await this.app.vault.adapter.read(templatesPath);
			
			// Ищем нужный шаблон в файле - используем ту же регулярку что и в TemplateUpdater
			const regex = new RegExp(`(\\s+${key}:\\s*)\`([\\s\\S]*?)\`(,?)`, 'm');
			const match = content.match(regex);
			
			if (match && match[2]) {
				return match[2];
			}
			
			// Если не нашли в файле, падаем в fallback
			throw new Error(`Template ${key} not found in templates.ts`);
		} catch (error) {
			// Fallback на импорт (используется при ошибках чтения файла)
			console.log('[FileManager] Не удалось загрузить шаблон из файла, используем импорт:', error);
			const { WORKOUT_TEMPLATES } = await import('../templates');
			return WORKOUT_TEMPLATES[key];
		}
	}

	private async getExerciseTemplate(hasWeight: boolean = true): Promise<string> {
		const settings = this.getSettings();
		const chartMin = settings.chartRepsMin ?? 0;
		const chartMax = settings.chartRepsMax ?? 15;
		
		try {
			// Используем Obsidian API для чтения файла (работает на всех платформах)
			const templateFileName = hasWeight 
				? 'exercise-stats-with-weight-cached.dataviewjs'
				: 'exercise-stats-no-weight-cached.dataviewjs';
			
			const dataviewjsPath = `${this.pluginDir}/src/templates/${templateFileName}`;
			let dataviewjsCode = await this.app.vault.adapter.read(dataviewjsPath);
			
			// Заменяем плейсхолдеры для диапазона графика
			dataviewjsCode = dataviewjsCode.replace(/{{chartRepsMin}}/g, String(chartMin));
			dataviewjsCode = dataviewjsCode.replace(/{{chartRepsMax}}/g, String(chartMax));
			
			// Создаём полный шаблон
			const template = `# {{exerciseName}} - Прогрессия

## Статистика

\`\`\`dataviewjs
${dataviewjsCode}
\`\`\`

## Заметки
`;
			
			return template;
		} catch (error) {
			// Fallback для случаев, когда файл не найден
			console.log('[FileManager] Не удалось загрузить шаблон из файла, используем встроенный:', error);
			return this.getEmbeddedExerciseTemplate(hasWeight, chartMin, chartMax);
		}
	}

	private getEmbeddedExerciseTemplate(hasWeight: boolean, chartMin: number, chartMax: number): string {
		// Встроенные шаблоны для мобильных устройств
		const templateWithWeight = `# {{exerciseName}} - Прогрессия

## Статистика

\`\`\`dataviewjs
const exerciseName = "{{exerciseName}}";

const plugin = app.plugins.plugins['workout-tracker'];
const chartMin = plugin?.settings?.chartRepsMin ?? ${chartMin};
const chartMax = plugin?.settings?.chartRepsMax ?? ${chartMax};

// Читаем данные из кэша
const cache = plugin?.exerciseCache;

if (!cache) {
	dv.paragraph("⚠️ Кэш не загружен. Перезагрузите плагин.");
} else {
	const exerciseData = cache.getExerciseData(exerciseName);
	
	if (!exerciseData || exerciseData.history.length === 0) {
		dv.paragraph("Данные по подходам пока не найдены.");
	} else {
		const rows = [];
		const maxReps = new Map();
		const maxRepsWeight = new Map();
		const pageLinks = new Map();
		
		// Обрабатываем историю из кэша
		for (const session of exerciseData.history) {
			const date = session.date;
			const dateParts = date.split('-');
			const displayDate = dateParts[2] + "." + dateParts[1] + "." + dateParts[0];
			
			// Создаём ссылку на лог
			const logFiles = dv.pages('"{{workoutFolder}}/Logs"')
				.filter(p => p.file.name.startsWith(date));
			const logLink = logFiles.length > 0 
				? "[[" + logFiles[0].file.path + "|" + displayDate + "]]"
				: displayDate;
			pageLinks.set(date, logLink);
			
			// Обрабатываем подходы
			session.sets.forEach((set, i) => {
				rows.push({
					date: date,
					setNumber: i + 1,
					weight: set.weight,
					reps: set.reps,
					circle: 0
				});
				
				if (!maxReps.has(date) || set.reps > maxReps.get(date)) {
					maxReps.set(date, set.reps);
					maxRepsWeight.set(date, set.weight);
				}
			});
		}
		
		if (rows.length === 0) {
			dv.paragraph("Данные по подходам пока не найдены.");
		} else {
			// Группируем по дате
			const groupedByDate = new Map();
			for (const row of rows) {
				if (!groupedByDate.has(row.date)) {
					groupedByDate.set(row.date, []);
				}
				groupedByDate.get(row.date).push(row);
			}
			
			const sortedDates = Array.from(groupedByDate.keys()).sort();
			
		// График с Chart.js
		dv.header(3, "📊 График прогресса");
		
		// Создаём контейнер сразу
		const chartContainer = dv.el('div', '', { 
			attr: { style: 'position: relative; height: 280px; width: 100%; margin: 15px 0;' }
		});
		
		// Показываем индикатор загрузки
		const loadingDiv = chartContainer.createEl('div', { 
			text: '⏳ Загрузка графика...',
			attr: { style: 'text-align: center; padding: 50px; color: rgba(200,200,200,0.7);' }
		});
		
		// Небольшая задержка для асинхронной загрузки Chart.js
		setTimeout(() => {
			try {
				// Проверяем доступность Chart.js
				if (!window.Chart) {
					loadingDiv.textContent = '❌ Chart.js не загружен. Перезагрузите Obsidian.';
					loadingDiv.style.color = '#ff6b6b';
					return;
				}
				
				// Удаляем индикатор загрузки
				loadingDiv.remove();
				
				// Создаём canvas для графика
				const chartCanvas = chartContainer.createEl('canvas');

			// Подготавливаем данные (от старых к новым - слева направо)
			const dataPoints = [];
	
			sortedDates.forEach(date => {
				const sets = groupedByDate.get(date);
				sets.forEach((set, idx) => {
					const parts = date.split('-');
					const dateLabel = parts[2] + "." + parts[1];
					dataPoints.push({
						date: date,
						dateLabel: dateLabel,
						setIndex: idx + 1,
						weight: set.weight,
						reps: set.reps
					});
				});
			});				const labels = dataPoints.map(() => '');
				
				// Тёмная тема
				const theme = {
					grid: 'rgba(100, 100, 100, 0.2)',
					text: 'rgba(200, 200, 200, 0.9)',
					weight: 'rgba(100, 180, 255, 0.9)',
					reps: 'rgba(150, 255, 150, 0.9)'
				};
				
				// Создаём уникальный ID для этого графика
				const chartId = 'chart-' + exerciseName.replace(/\\s+/g, '-');
				
				// Уничтожаем старый экземпляр если существует
				if (window[chartId]) {
					try {
						window[chartId].destroy();
					} catch (e) {}
				}
				
				// Создаём и сохраняем новый экземпляр
				window[chartId] = new Chart(chartCanvas, {
				type: 'line',
				data: {
					labels: labels,
					datasets: [
						{
							label: 'Вес (кг)',
							data: dataPoints.map(p => p.weight),
							borderColor: theme.weight,
							backgroundColor: theme.weight,
							pointRadius: 5,
							pointHoverRadius: 7,
							borderWidth: 2,
							yAxisID: 'y',
							tension: 0.2
						},
						{
							label: 'Повторения',
							data: dataPoints.map(p => p.reps),
							borderColor: theme.reps,
							backgroundColor: theme.reps,
							pointRadius: 5,
							pointHoverRadius: 7,
							borderWidth: 2,
							yAxisID: 'y1',
							tension: 0.2
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					animation: false,
					interaction: { mode: 'index', intersect: false },
					plugins: {
						title: {
							display: true,
							text: \`Прогресс: \${exerciseName}\`,
							color: theme.text,
							font: { size: 16, weight: 'bold' }
						},
						legend: { display: true, labels: { color: theme.text } },
						tooltip: {
							backgroundColor: 'rgba(30, 30, 30, 0.9)',
							titleColor: theme.text,
							bodyColor: theme.text,
							callbacks: {
								title: (items) => {
									const p = dataPoints[items[0].dataIndex];
									return \`\${p.dateLabel} | Подход \${p.setIndex}\`;
								},
								label: (ctx) => {
									const p = dataPoints[ctx.dataIndex];
									return ctx.dataset.label === 'Вес (кг)' 
										? \`Вес: \${p.weight} кг\` 
										: \`Повторения: \${p.reps} раз\`;
								}
							}
						}
					},
					scales: {
						x: {
							title: { display: false },
							ticks: { display: false },
							grid: { display: false }
						},
						y: {
							position: 'left',
							title: { display: true, text: 'Вес (кг)', color: theme.weight },
							ticks: { 
								color: theme.text,
								stepSize: 1
							},
							grid: { color: theme.grid }
						},
						y1: {
							position: 'right',
							title: { display: true, text: 'Повторения', color: theme.reps },
							ticks: { 
								color: theme.text,
								stepSize: 1,
								precision: 0
							},
							grid: { drawOnChartArea: false }
						}
					}
				}
			});
			
		} catch (error) {
			loadingDiv.textContent = '❌ Ошибка: ' + error.message;
			loadingDiv.style.color = '#ff6b6b';
		}
			}, 100);
			
		// Таблица по дням (от новых к старым)
		dv.header(3, "История подходов");
		const tableRows = [];
		
		for (const date of sortedDates.slice().reverse()) {
			const sets = groupedByDate.get(date);
			const setsText = sets.map((s, idx) => 
				'• ' + s.weight + ' кг × ' + s.reps + ' раз'
			).join("<br>");
			
			tableRows.push([
				pageLinks.get(date),
				setsText,
				maxReps.get(date) + ' раз',
				maxRepsWeight.get(date) + ' кг'
			]);
		}
			
			dv.table(
				["Дата", "Подходы", "Макс повторений", "Вес при макс"],
				tableRows
			);
			
			// Статистика за последнюю тренировку
			if (exerciseData.lastWorkout) {
			dv.header(3, "Последняя тренировка");
			
			const lastDate = exerciseData.lastWorkout.date;
			const dateParts = lastDate.split('-');
			const displayDate = dateParts[2] + "." + dateParts[1] + "." + dateParts[0];
			
			// Создаём ссылку на лог
			const logFiles = dv.pages('"{{workoutFolder}}/Logs"')
				.filter(p => p.file.name.startsWith(lastDate));
			const logLink = logFiles.length > 0 
				? "[[" + logFiles[0].file.path + "|" + displayDate + "]]"
				: displayDate;
			
			dv.paragraph("📅 **Дата:** " + logLink);
			
			if (exerciseData.lastWorkout.maxActualWeight) {
				const max = exerciseData.lastWorkout.maxActualWeight;
				dv.paragraph("💪 **Максимальный вес за тренировку:** " + max.weight + " кг × " + max.reps + " раз");
			}
			
			if (exerciseData.lastWorkout.maxActualWorkingSet) {
				const working = exerciseData.lastWorkout.maxActualWorkingSet;
				dv.paragraph("🔥 **Максимальное количество повторений:** " + working.reps + " раз с " + working.weight + " кг");
			}
		}			// Рекорды за все время
			dv.header(3, "Рекорды");
			
			// Максимальный вес
			if (exerciseData.allTimeMaxWeight) {
				const record = exerciseData.allTimeMaxWeight;
				const dateParts = record.date.split('-');
				const displayDate = dateParts[2] + "." + dateParts[1] + "." + dateParts[0];
				
				// Ищем ссылку на лог
				const logFiles = dv.pages('"{{workoutFolder}}/Logs"')
					.filter(p => p.file.name.startsWith(record.date));
				const logLink = logFiles.length > 0 
					? "[[" + logFiles[0].file.path + "|" + displayDate + "]]"
					: displayDate;
				
				dv.paragraph("💪 **Максимальный вес:** " + record.weight + " кг на " + record.reps + " раз (" + logLink + ")");
			}
			
			// Максимум повторений
			if (exerciseData.allTimeMaxReps) {
				const record = exerciseData.allTimeMaxReps;
				const dateParts = record.date.split('-');
				const displayDate = dateParts[2] + "." + dateParts[1] + "." + dateParts[0];
				
				// Ищем ссылку на лог
				const logFiles = dv.pages('"{{workoutFolder}}/Logs"')
					.filter(p => p.file.name.startsWith(record.date));
				const logLink = logFiles.length > 0 
					? "[[" + logFiles[0].file.path + "|" + displayDate + "]]"
					: displayDate;
				
				if (record.weight !== undefined) {
					dv.paragraph("🔥 **Максимум повторений:** " + record.reps + " раз с " + record.weight + " кг (" + logLink + ")");
				} else {
					dv.paragraph("🔥 **Максимум повторений:** " + record.reps + " раз (" + logLink + ")");
				}
			}
		}
	}
}
\`\`\`

## Заметки
`;

		const templateNoWeight = `# {{exerciseName}} - Прогрессия

## Статистика

\`\`\`dataviewjs
const exerciseName = "{{exerciseName}}";

const plugin = app.plugins.plugins['workout-tracker'];

// Читаем данные из кэша
const cache = plugin?.exerciseCache;

if (!cache) {
	dv.paragraph("⚠️ Кэш не загружен. Перезагрузите плагин.");
} else {
	const exerciseData = cache.getExerciseData(exerciseName);
	
	if (!exerciseData || exerciseData.history.length === 0) {
		dv.paragraph("Данные по подходам пока не найдены.");
	} else {
		// Таблица по дням
		dv.header(3, "История");
		const tableRows = [];
		const pageLinks = new Map();
		
		for (const session of exerciseData.history) {
			const date = session.date;
			const dateParts = date.split('-');
			const displayDate = dateParts[2] + "." + dateParts[1] + "." + dateParts[0];
			
			const logFiles = dv.pages('"{{workoutFolder}}/Logs"')
				.filter(p => p.file.name.startsWith(date));
			const logLink = logFiles.length > 0 
				? "[[" + logFiles[0].file.path + "|" + displayDate + "]]"
				: displayDate;
			
			const maxReps = Math.max(...session.sets.map(s => s.reps));
			const setsText = session.sets.map(s => s.reps + ' раз').join(', ');
			
			tableRows.push([logLink, setsText, maxReps + ' раз']);
		}
		
		dv.table(
			["Дата", "Подходы", "Максимум"],
			tableRows.reverse()
		);
		
		// Рекорды
		dv.header(3, "Рекорды");
		
		if (exerciseData.allTimeMaxReps) {
			const record = exerciseData.allTimeMaxReps;
			const dateParts = record.date.split('-');
			const displayDate = dateParts[2] + "." + dateParts[1] + "." + dateParts[0];
			
			const logFiles = dv.pages('"{{workoutFolder}}/Logs"')
				.filter(p => p.file.name.startsWith(record.date));
			const logLink = logFiles.length > 0 
				? "[[" + logFiles[0].file.path + "|" + displayDate + "]]"
				: displayDate;
			
			dv.paragraph("🔥 **Максимум повторений:** " + record.reps + " раз (" + logLink + ")");
		}
	}
}
\`\`\`

## Заметки
`;

		return hasWeight ? templateWithWeight : templateNoWeight;
	}

	private getTemplateKeyFromDay(day: WorkoutDay): TemplateKey {
		switch (day) {
			case WorkoutDay.MONDAY:
				return 'MONDAY';
			case WorkoutDay.TUESDAY:
				return 'TUESDAY';
			case WorkoutDay.WEDNESDAY:
				return 'WEDNESDAY';
			case WorkoutDay.THURSDAY:
				return 'THURSDAY';
			case WorkoutDay.FRIDAY:
				return 'FRIDAY';
			case WorkoutDay.SATURDAY:
				return 'SATURDAY';
			case WorkoutDay.SUNDAY:
				return 'SUNDAY';
			default:
				return 'MONDAY';
		}
	}

	private getExerciseInfoByName(exerciseName: string): ExerciseInfo | undefined {
		const settings = this.getSettings();
		const fromSettings = settings.exerciseRegistry?.find((exercise) => exercise.name === exerciseName);
		if (fromSettings) {
			return fromSettings;
		}
		return DEFAULT_EXERCISES.find((exercise) => exercise.name === exerciseName);
	}

	private async getExerciseStats(exerciseName: string, workoutFolder: string): Promise<string> {
		const exerciseInfo = this.getExerciseInfoByName(exerciseName);
		const hasWeight = exerciseInfo?.hasWeight ?? true;

		const logsFolder = `${workoutFolder}/Logs`;
		const files = this.app.vault.getMarkdownFiles();
		const logFiles = files.filter(f => f.path.startsWith(logsFolder));
		
		
		const exerciseHeader = `### ${exerciseName}`;
		const setRegex = /^Подход\s*(\d+):\s*(.+)$/i;
		const weightRegex = /(\d+[,.]?\d*)\s*кг/i;
		const repsRegex = /(\d+)\s*раз/i;
		const simpleRepsRegex = /^(\d+)\s*раз$/i; // Для формата "45 раз"
		
		let workingSet: { weight: number; reps: number } | null = null;
		let maxWeightSet: { weight: number; reps: number } | null = null;
		let latestReps: number | null = null;
		let maxReps: number | null = null;
		
		// Сортируем файлы по дате (новые первые)
		const sortedFiles = logFiles.sort((a, b) => b.name.localeCompare(a.name));
		
		for (const file of sortedFiles) {
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			
			let i = 0;
			while (i < lines.length) {
				if (lines[i].trim() === exerciseHeader) {
					i++;
					let processedLines = 0;
					while (i < lines.length) {
						const line = lines[i].trim();
						processedLines++;
						
						if (processedLines <= 5) {
						}
						
						if (line.startsWith('###') || line.startsWith('##')) {
							break;
						}
						
						// Игнорируем строки статистики (но НЕ строки с "Подход")
						if (!line.startsWith('Подход') && (
							line.includes('Максималка') || 
							line.includes('Последний актуальный подход') || 
							line.includes('Максимальный вес'))) {
							i++;
							continue;
						}
						
						// Проверяем простой формат "45 раз" для bodyweight упражнений
						const simpleMatch = simpleRepsRegex.exec(line);
						if (simpleMatch && !hasWeight) {
							const reps = Number(simpleMatch[1]);
							if (latestReps === null) {
								latestReps = reps;
							}
							if (maxReps === null || reps > maxReps) {
								maxReps = reps;
							}
							i++;
							continue;
						}
						
						const setMatch = setRegex.exec(line);
						
						if (setMatch) {
							const details = setMatch[2];
							const weightMatch = weightRegex.exec(details);
							const repsMatch = repsRegex.exec(details);
							
							
							if (repsMatch) {
								const reps = Number(repsMatch[1]);
								if (latestReps === null) {
									latestReps = reps;
								}
								if (maxReps === null || reps > maxReps) {
									maxReps = reps;
								}
								
								if (hasWeight && weightMatch) {
									const weight = Number(weightMatch[1].replace(',', '.'));
									// Ищем рабочий подход (12-15 повторений)
									if (reps >= 12 && reps <= 15 && !workingSet) {
										workingSet = { weight, reps };
									}
									// Ищем максимальный вес
									if (!maxWeightSet || weight > maxWeightSet.weight) {
										maxWeightSet = { weight, reps };
									}
								}
							}
						}
						i++;
					}
					break;
				}
				i++;
			}
			
			// Если нашли всё необходимое, прекращаем поиск
			if (hasWeight) {
				if (workingSet && maxWeightSet) break;
			} else {
				if (latestReps !== null && maxReps !== null) break;
			}
		}
		
		let result = '';
		if (hasWeight) {
			
			// Если нет данных, выводим шаблон с нулями
			if (!workingSet && !maxWeightSet) {
				result += `Последний актуальный подход на 12-15: 0 кг x 0 раз\n`;
				result += `Максимальный вес: 0 кг x 0 раз\n`;
			} else {
				if (workingSet) {
					result += `Последний актуальный подход на 12-15: ${workingSet.weight} кг x ${workingSet.reps} раз\n`;
				}
				if (maxWeightSet) {
					result += `Максимальный вес: ${maxWeightSet.weight} кг x ${maxWeightSet.reps} раз\n`;
				}
			}
		} else {
			if (maxReps !== null) {
				result += `Максималка: ${maxReps} раз\n`;
			} else {
				result += 'Максималка: 0 раз\n';
			}
		}
		
		
		return result;
	}

	async ensureFolderExists(folderPath: string): Promise<TFolder> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (folder instanceof TFolder) {
			return folder;
		}
		return await this.app.vault.createFolder(folderPath);
	}

	async moveWorkoutStructure(oldPath: string, newPath: string): Promise<void> {
		if (!oldPath || oldPath === newPath) return;

		try {
			const oldFolder = this.app.vault.getAbstractFileByPath(oldPath);
			if (!(oldFolder instanceof TFolder)) return;

			// Создаем новую структуру
			await this.ensureFolderExists(newPath);
			await this.ensureFolderExists(`${newPath}/Exercises`);
			await this.ensureFolderExists(`${newPath}/Logs`);
			await this.ensureFolderExists(`${newPath}/Templates`);

			// Перемещаем файлы из подпапок
			const subFolders = ['Exercises', 'Logs', 'Templates'];
			
			for (const subFolder of subFolders) {
				const oldSubPath = `${oldPath}/${subFolder}`;
				const newSubPath = `${newPath}/${subFolder}`;
				
				await this.moveFilesFromFolder(oldSubPath, newSubPath);
			}

			new Notice(`Файлы перенесены из ${oldPath} в ${newPath}`);
		} catch (error) {
			new Notice('Ошибка при переносе файлов');
		}
	}

	private async moveFilesFromFolder(oldPath: string, newPath: string): Promise<void> {
		const oldFolder = this.app.vault.getAbstractFileByPath(oldPath);
		if (!(oldFolder instanceof TFolder)) return;

		const children = [...oldFolder.children];
		for (const file of children) {
			if (file instanceof TFile) {
				await this.moveFile(file, newPath);
			} else if (file instanceof TFolder) {
				const targetSubFolder = `${newPath}/${file.name}`;
				await this.ensureFolderExists(targetSubFolder);
				await this.moveFilesFromFolder(file.path, targetSubFolder);
			}
		}

		if (oldFolder.children.length === 0) {
			try {
				await this.app.vault.delete(oldFolder);
			} catch (error) {
			}
		}
	}

	private async moveFile(file: TFile, newPath: string): Promise<void> {
		const newFilePath = `${newPath}/${file.name}`;
		try {
			await this.app.vault.rename(file, newFilePath);
		} catch (error) {
			const { basename, extension } = file;
			let counter = 1;
			let candidatePath = `${newPath}/${basename}_${counter}.${extension}`;
			while (this.app.vault.getAbstractFileByPath(candidatePath)) {
				counter++;
				candidatePath = `${newPath}/${basename}_${counter}.${extension}`;
			}
			try {
				await this.app.vault.rename(file, candidatePath);
			} catch (e) {
			}
		}
	}

	async createWorkoutStructure(
		workoutFolder: string,
		previousFolder?: string,
		exerciseNames: ExerciseInfo[] = []
	): Promise<void> {
		// Если есть предыдущая папка, перемещаем файлы
		if (previousFolder && previousFolder !== workoutFolder) {
			await this.moveWorkoutStructure(previousFolder, workoutFolder);
		}

		// Создаем основную папку
		await this.ensureFolderExists(workoutFolder);
		
		// Создаем подпапки
		await this.ensureFolderExists(`${workoutFolder}/Exercises`);
		await this.ensureFolderExists(`${workoutFolder}/Logs`);
		await this.ensureFolderExists(`${workoutFolder}/Templates`);

		// Создаем файлы шаблонов
		await this.createTemplateFiles(workoutFolder);

		// Создаем карточки упражнений
		await this.createExerciseFiles(workoutFolder, exerciseNames);
	}

	async updateAllExerciseFiles(workoutFolder: string, exerciseNames: ExerciseInfo[]): Promise<void> {
		const exercisesPath = `${workoutFolder}/Exercises`;
		await this.ensureFolderExists(exercisesPath);

		const sourceExercises = (exerciseNames && exerciseNames.length > 0)
			? exerciseNames
			: DEFAULT_EXERCISES;
		
		// Удаляем дубликаты по имени
		const uniqueExercises = sourceExercises.filter((ex, index, self) =>
			index === self.findIndex((e) => e.name === ex.name)
		);

		for (const exercise of uniqueExercises) {
			const exerciseTemplate = await this.getExerciseTemplate(exercise.hasWeight);
			await this.updateExerciseFile(workoutFolder, exercise.name, exerciseTemplate);
		}
	}

	async updateExerciseFile(workoutFolder: string, exerciseName: string, template?: string, hasWeight: boolean = true): Promise<void> {
		const exercisesPath = `${workoutFolder}/Exercises`;
		const filePath = `${exercisesPath}/${exerciseName}.md`;
		
		// Если шаблон не передан, читаем его
		const exerciseTemplate = template || await this.getExerciseTemplate(hasWeight);
		
		const content = exerciseTemplate
			.replace(/{{exerciseName}}/g, exerciseName)
			.replace(/{{workoutFolder}}/g, workoutFolder);
		
		
		const existing = this.app.vault.getAbstractFileByPath(filePath);

		if (existing instanceof TFile) {
			// Обновляем существующий файл
			await this.app.vault.modify(existing, content);
		} else {
			// Создаём новый файл
			await this.ensureFolderExists(exercisesPath);
			await this.app.vault.create(filePath, content);
		}
	}

	async updateWeightedExerciseFiles(workoutFolder: string, exerciseNames: ExerciseInfo[]): Promise<number> {
		const exercisesPath = `${workoutFolder}/Exercises`;
		await this.ensureFolderExists(exercisesPath);

		const sourceExercises = (exerciseNames && exerciseNames.length > 0)
			? exerciseNames
			: DEFAULT_EXERCISES;
		
		const uniqueExercises = sourceExercises.filter((ex, index, self) =>
			index === self.findIndex((e) => e.name === ex.name)
		);

		const weightedExercises = uniqueExercises.filter(ex => ex.hasWeight);
		
		for (const exercise of weightedExercises) {
			const exerciseTemplate = await this.getExerciseTemplate(true);
			await this.updateExerciseFile(workoutFolder, exercise.name, exerciseTemplate, true);
		}
		
		return weightedExercises.length;
	}

	async createTemplateFiles(workoutFolder: string): Promise<void> {
		const templatesPath = `${workoutFolder}/Templates`;
		
		for (const [key, fileName] of Object.entries(TEMPLATE_FILES) as [TemplateKey, string][]) {
			const filePath = `${templatesPath}/${fileName}`;
			
			const templateContent = await this.getTemplate(key);
			
			const existing = this.app.vault.getAbstractFileByPath(filePath);
			if (existing instanceof TFile) {
				try {
					const currentContent = await this.app.vault.read(existing);
					
					// Обновляем ТОЛЬКО если содержимое отличается
					if (currentContent !== templateContent) {
						await this.app.vault.modify(existing, templateContent);
						console.log(`[FileManager] ✅ Обновлён шаблон: ${fileName}`);
					} else {
						console.log(`[FileManager] ⏭️ Шаблон не изменился, пропускаем: ${fileName}`);
					}
				} catch (error) {
					console.error(`[FileManager] Ошибка обновления шаблона ${fileName}:`, error);
				}
			} else {
				// Создаём новый шаблон
				await this.app.vault.create(filePath, templateContent);
				console.log(`[FileManager] ✅ Создан новый шаблон: ${fileName}`);
			}
		}
	}

	private async createExerciseFiles(workoutFolder: string, exerciseNames: ExerciseInfo[]): Promise<void> {
		const exercisesPath = `${workoutFolder}/Exercises`;
		await this.ensureFolderExists(exercisesPath);

		const sourceExercises = (exerciseNames && exerciseNames.length > 0)
			? exerciseNames
			: DEFAULT_EXERCISES;
		
		// Удаляем дубликаты по имени
		const uniqueExercises = sourceExercises.filter((ex, index, self) =>
			index === self.findIndex((e) => e.name === ex.name)
		);

		for (const exercise of uniqueExercises) {
			const filePath = `${exercisesPath}/${exercise.name}.md`;
			const existing = this.app.vault.getAbstractFileByPath(filePath);

			// СОЗДАЁМ файл ТОЛЬКО если его нет
			if (!existing) {
				const template = await this.getExerciseTemplate(exercise.hasWeight);
				const content = template
					.replace(/{{exerciseName}}/g, exercise.name)
					.replace(/{{workoutFolder}}/g, workoutFolder);
				
				await this.app.vault.create(filePath, content);
				console.log(`[FileManager] ✅ Создан новый файл упражнения: ${exercise.name}`);
			} else {
				console.log(`[FileManager] ⏭️ Файл упражнения уже существует, пропускаем: ${exercise.name}`);
			}
		}
	}

	private shouldUpdateExerciseFile(existingContent: string, exerciseName: string): boolean {
		const normalized = existingContent.trim();
		if (!normalized.startsWith(`# ${exerciseName} - Прогрессия`)) {
			return false;
		}

		if (normalized.includes('```dataviewjs')) {
			return false;
		}

		return normalized.includes('```dataview');
	}

	async getExistingWorkoutLog(workoutFolder: string, date: string): Promise<TFile | null> {
		const logsFolder = `${workoutFolder}/Logs`;
		const files = this.app.vault.getFiles();
		
		for (const file of files) {
			if (file.path.startsWith(logsFolder) && file.name.includes(date)) {
				return file;
			}
		}
		return null;
	}

	async createWorkoutLog(
		workoutFolder: string, 
		location: WorkoutLocation, 
		templateType?: WorkoutDay
	): Promise<{ file: TFile; existed: boolean }> {
		const today = moment().format('YYYY-MM-DD');
		const todayDisplay = moment().format('DD.MM.YYYY');
		let fileName: string;
		let templateKey: TemplateKey;

		if (location === WorkoutLocation.HOME) {
			const existingHomeLog = await this.getExistingHomeWorkoutLog(workoutFolder, today);
			if (existingHomeLog) {
				new Notice('Переношу вас в созданный файл домашней тренировки');
				return { file: existingHomeLog, existed: true };
			}

			templateKey = 'HOME';
			fileName = `${today}-Home.md`;
		} else {
			const existingLog = await this.getExistingWorkoutLog(workoutFolder, today);
			if (existingLog && !existingLog.name.includes('Home')) {
				new Notice('Переношу вас в созданный файл тренировки');
				return { file: existingLog, existed: true };
			}

			let day: WorkoutDay;
			if (templateType) {
				day = templateType;
			} else {
				// Fallback: определяем день недели по текущей дате
				const dayOfWeek = moment().day();
				const dayMapping: { [key: number]: WorkoutDay } = {
					0: WorkoutDay.SUNDAY,
					1: WorkoutDay.MONDAY,
					2: WorkoutDay.TUESDAY,
					3: WorkoutDay.WEDNESDAY,
					4: WorkoutDay.THURSDAY,
					5: WorkoutDay.FRIDAY,
					6: WorkoutDay.SATURDAY
				};
				day = dayMapping[dayOfWeek] || WorkoutDay.MONDAY;
			}

			templateKey = this.getTemplateKeyFromDay(day);
			fileName = `${today}-${day}.md`;
		}

		const template = await this.getTemplate(templateKey);
		let content = template
			.replace(/{{date}}/g, todayDisplay)
			.replace(/{{location}}/g, location === WorkoutLocation.HOME ? 'Дома' : 'Спортзал');

		// Заменяем плейсхолдеры упражнений
		const exercisePlaceholderRegex = /{{exercise:([^}]+)}}/g;
		const matches = [...content.matchAll(exercisePlaceholderRegex)];
		
		for (const match of matches) {
			const exerciseName = match[1];
			const stats = await this.getExerciseStats(exerciseName, workoutFolder);
			content = content.replace(match[0], stats);
		}


		const filePath = `${workoutFolder}/Logs/${fileName}`;
		const file = await this.app.vault.create(filePath, content);
		return { file, existed: false };
	}

	async createWorkoutLogFromCustomTemplate(
		workoutFolder: string,
		location: WorkoutLocation,
		customTemplate: CustomTemplate
	): Promise<{ file: TFile; existed: boolean }> {
		const today = moment().format('YYYY-MM-DD');
		const todayDisplay = moment().format('DD.MM.YYYY');
		
		// Проверяем существующий лог
		// Для экспериментальных шаблонов проверяем только логи из спортзала
		let existingLog: TFile | null = null;
		
		if (customTemplate.type === 'experiment') {
			// Для эксперимента проверяем только логи из спортзала (не содержащие "Home" в имени)
			const logsFolder = `${workoutFolder}/Logs`;
			const files = this.app.vault.getFiles();
			
			for (const file of files) {
				if (file.path.startsWith(logsFolder) && 
					file.name.includes(today) && 
					!file.name.includes('Home')) {
					existingLog = file;
					break;
				}
			}
		} else {
			// Для обычных шаблонов проверяем все логи
			existingLog = await this.getExistingWorkoutLog(workoutFolder, today);
		}
		
		if (existingLog) {
			new Notice('Переношу вас в созданный файл тренировки');
			return { file: existingLog, existed: true };
		}

		// Формируем имя файла на основе названия шаблона
		const fileName = `${today}-${customTemplate.name}.md`;
		
		// Используем контент из шаблона
		let content = customTemplate.content
			.replace(/{{date}}/g, todayDisplay)
			.replace(/{{location}}/g, location === WorkoutLocation.HOME ? 'Дома' : 'Спортзал');

		// Заменяем плейсхолдеры упражнений, если есть
		const exercisePlaceholderRegex = /{{exercise:([^}]+)}}/g;
		const matches = [...content.matchAll(exercisePlaceholderRegex)];
		
		for (const match of matches) {
			const exerciseName = match[1];
			const stats = await this.getExerciseStats(exerciseName, workoutFolder);
			content = content.replace(match[0], stats);
		}

		const filePath = `${workoutFolder}/Logs/${fileName}`;
		const file = await this.app.vault.create(filePath, content);
		return { file, existed: false };
	}

	async getExistingHomeWorkoutLog(workoutFolder: string, date: string): Promise<TFile | null> {
		const logsFolder = `${workoutFolder}/Logs`;
		const files = this.app.vault.getFiles();
		
		for (const file of files) {
			if (file.path.startsWith(logsFolder) && 
				file.name.includes(date) && 
				file.name.includes('Home')) {
				return file;
			}
		}
		return null;
	}

	async getExerciseFiles(workoutFolder: string): Promise<TFile[]> {
		const exercisesPath = `${workoutFolder}/Exercises`;
		const files = this.app.vault.getFiles();
		
		return files.filter(file => file.path.startsWith(exercisesPath) && file.extension === 'md');
	}

	async deleteExerciseFile(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			await this.app.vault.delete(file);
		}
	}

	async getAllFolders(): Promise<TFolder[]> {
		const folders: TFolder[] = [];
		const stack = [this.app.vault.getRoot()];
		
		while (stack.length > 0) {
			const current = stack.pop()!;
			for (const child of current.children) {
				if (child instanceof TFolder) {
					folders.push(child);
					stack.push(child);
				}
			}
		}
		
		return folders;
	}

	async getFoldersInPath(path: string): Promise<TFolder[]> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!(folder instanceof TFolder)) {
			return [];
		}
		
		return folder.children.filter(child => child instanceof TFolder) as TFolder[];
	}

	async updateTemplateFromFile(filePath: string, workoutFolder: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		const templateName = file.basename;
		const templatesPath = `${workoutFolder}/Templates`;
		
		// Проверяем, что это файл шаблона
		if (!filePath.startsWith(templatesPath)) return;
		
		try {
			const content = await this.app.vault.read(file);
			
			// Обновляем константу в коде в зависимости от имени файла
			switch (templateName) {
				case 'Monday':
					await this.updateTemplateConstant('MONDAY', content);
					break;
				case 'Wednesday':
					await this.updateTemplateConstant('WEDNESDAY', content);
					break;
				case 'Friday':
					await this.updateTemplateConstant('FRIDAY', content);
					break;
				case 'Home':
					await this.updateTemplateConstant('HOME', content);
					break;
			}
			
			new Notice(`Шаблон ${templateName} обновлен в коде`);
		} catch (error) {
		}
	}

	private async updateTemplateConstant(templateKey: string, newContent: string): Promise<void> {
		// Здесь можно реализовать логику обновления констант в файле templates.ts
		// Для простоты выведем в консоль информацию об изменении
		
		// В реальной реализации здесь бы был код для обновления файла templates.ts
		// Например, чтение файла, замена содержимого и перезапись
	}
}