export class ChartLoader {
	private static loading = false;
	private static loaded = false;

	static async ensureChartJS(app: any): Promise<boolean> {
		// Уже загружен
		if ((window as any).Chart) {
			this.loaded = true;
			return true;
		}

		// Уже загружается - ждём
		if (this.loading) {
			return new Promise((resolve) => {
				const checkInterval = setInterval(() => {
					if ((window as any).Chart) {
						clearInterval(checkInterval);
						resolve(true);
					}
				}, 50);
			});
		}

		// Начинаем загрузку
		this.loading = true;

		try {
			// Читаем локальный файл Chart.js
			const adapter = app.vault.adapter;
			const chartPath = '.obsidian/plugins/workout-tracker/src/chart.min.js';
			
			if (await adapter.exists(chartPath)) {
				// Загружаем из локального файла
				const chartCode = await adapter.read(chartPath);
				const script = document.createElement('script');
				script.textContent = chartCode;
				document.head.appendChild(script);
			} else {
				// Fallback на CDN если локальный файл не найден
				const script = document.createElement('script');
				script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
				await new Promise((resolve, reject) => {
					script.onload = resolve;
					script.onerror = reject;
					document.head.appendChild(script);
				});
			}

			this.loaded = true;
			this.loading = false;
			return true;
		} catch (error) {
			console.error('[ChartLoader] Ошибка загрузки Chart.js:', error);
			this.loading = false;
			return false;
		}
	}

	static isLoaded(): boolean {
		return this.loaded || !!(window as any).Chart;
	}
}
