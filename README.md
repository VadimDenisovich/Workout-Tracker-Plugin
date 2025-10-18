# Workout Tracker for Obsidian

Smart workout journaling for Obsidian: spin up daily logs from templates, manage an exercise library with progress charts, and keep your folder structure tidy without leaving the vault.

## ✨ Highlights

- **One-click workout logs** – Ribbon button and command palette command pick the correct template based on your selected training days. If a log for today already exists you get redirected with a notice.
- **Customizable training schedule** – Select your training days (Monday through Sunday) with clickable day circles in settings. The plugin automatically uses the right template on your training days and shows template selection on rest days.
- **All 7 days supported** – Templates for every day of the week (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday) plus Home workouts.
- **Home vs gym flows** – A location picker lets you choose "Gym" (date-based template) or "Home" (circuit template that creates files like `2025-10-03-Home.md`).
- **Experiment templates** – Create custom experimental workout templates for testing new programs.
- **Exercise library modal** – Floating modal with a full-width search bar, per-exercise open/delete actions, and a bold "+" button in a rounded square to add new drills.
- **Automatic folder management** – Keeps `Exercises/`, `Logs/`, and `Templates/` in sync. Changing the workout folder migrates the whole structure instead of recreating it.
- **Dataview-powered stats** – Exercise cards ship with dataviewjs tables and Mermaid charts (weight vs reps or bodyweight volume) and handle set numbering for home circuits.
- **Template sync** – Editing any template file (Monday.md through Sunday.md, Home.md) automatically updates the source code so future logs use your version.
- **Chart range settings** – Configure min/max reps from the settings tab; weighted exercise files are refreshed automatically after every change.
- **Smart caching** – Exercise data is cached for instant loading and automatically updates when you modify workout logs.
- **Update structure button** – Re-run folder migration on demand while preserving customized templates.

## 📦 Installation

### Option 1 · Use a release build
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release.
2. Create `<your-vault>/.obsidian/plugins/workout-tracker/` (keep the folder name in sync with `manifest.json` → `id`).
3. Drop the files into that folder.
4. In Obsidian go to **Settings → Community plugins**, disable **Restricted mode** if needed, and enable **Workout Tracker**.

### Option 2 · Build from source
```bash
cd /path/to/your/vault/.obsidian/plugins
git clone https://github.com/VadimDenisovich/Workout-Tracker-Plugin.git workout-tracker
cd workout-tracker
npm install
npm run build
```

The build outputs `main.js` at the repository root. Confirm `main.js`, `manifest.json`, and `styles.css` are present, then enable the plugin inside Obsidian.

### Development watch mode
```bash
npm run dev
```

esbuild runs in watch mode; reload Obsidian (`Cmd/Ctrl + R`) to see changes.

## ✅ Requirements

- Obsidian v0.15.0 or newer
- [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin (required for exercise stats)
- Node.js 18+ and npm (development only)

## 🗂️ Folder layout

On first launch—or whenever you pick a new workout folder—the plugin automatically creates this structure:

- `Logs/` – Gym and home workout logs; home sessions follow `YYYY-MM-DD-Home.md`.
- `Exercises/` – Exercise cards containing dataviewjs dashboards with progress charts.
- `Templates/` – Editable Markdown templates for all days:
  - **Weekday templates**: `Monday.md`, `Tuesday.md`, `Wednesday.md`, `Thursday.md`, `Friday.md`, `Saturday.md`, `Sunday.md`
  - **Home template**: `Home.md`
  - **Custom templates**: User-created experiment templates

The plugin remembers the previous folder and migrates existing files when you choose a new location. The **Update structure** button in settings re-runs the same migration and creates all 8 default templates automatically.

## 🧭 Everyday workflows

### Create a workout log
1. Click the calendar-days ribbon icon or run the "Создать лог тренировки" command.
2. The plugin checks if today is one of your selected training days (configured in settings):
   - **Training day** – Automatically creates a log with the correct template (e.g., Tuesday.md on Tuesday)
   - **Rest day** – Shows template selection modal with your configured training days sorted Monday through Sunday
3. Pick the location:
   - **Gym** – Uses the selected day template or prompts you to choose from your training days
   - **Home** – Uses the home circuit template (three rounds of push-ups, squats, core, 2-minute rest, TabataTimer suggestion)
   - **Experiment** – Choose from custom experimental templates or create a new one
4. If today's log already exists the plugin opens it and shows "Переношу вас в созданный файл".

### Configure training days
1. Open plugin settings
2. Find the "Дни тренировок" (Training Days) section
3. Click on day circles to select/deselect your training days:
   - **Selected** – Circle is filled with accent color
   - **Not selected** – Circle shows only outline
4. Your selection determines which template is used automatically and which templates appear in the selection modal
5. All 8 templates (Monday-Sunday + Home) are created automatically on first run

### Manage exercises
- Open the exercise modal via the dumbbell ribbon icon or "Открыть упражнения".
- Use the wide search bar to filter by name; spacing keeps it separated from the list.
- Select an exercise to open its card. Click the minus icon to delete the file and remove it from the registry.
- Add new exercises with the black "+" button; files are created under `Exercises/` and persisted in the settings registry (removal stays in sync).

### Exercise cards & stats
- **Weighted exercises** – Dataview aggregates sets from logs, builds a weight vs reps chart (Mermaid `xychart-beta`, bright orange `#FF6B00` line), and lists the latest sets with an option to show hidden records. Home workouts number sets based on the circuit round.
- **Bodyweight exercises** – Charts show total volume and max reps per day. Tables default to 10 rows with a “show all” toggle.
- Dataview scripts rely on string concatenation (no template literals) to avoid Obsidian parser issues and auto-refresh whenever you open a card.

## 🧱 Templates

### Gym days (Monday through Sunday)
Each template can be customized for your specific program. Default templates include:
- **Monday, Wednesday, Friday** – Pre-filled with specific exercises from the sample program
- **Tuesday, Thursday, Saturday, Sunday** – Simple templates ready for customization

Every exercise includes Obsidian image embeds followed by placeholder sets:

```
![[Pasted image 20240523211013.png|300]]
Set 1: _ kg × _ reps
Set 2: _ kg × _ reps
```

Warm-ups are intentionally omitted per specification.

### Home day (Home.md)
Three rounds with push-ups, squats, and abs plus timing notes. Repetition fields stay blank (`_ reps`) for quick filling during the session.

### Experiment templates
Create custom templates for experimental workouts:
1. Click "Gym" location → Select "Эксперимент"
2. Click "Создать" to make a new template
3. Edit the template file in `Templates/` folder
4. Use it for future experimental workouts

### Template synchronization
Any edits you make to template files in `Templates/` are automatically saved to the source code (`src/templates.ts`):
- Edit any template file (Monday.md, Tuesday.md, etc.)
- Save the file
- The plugin automatically updates the source code
- Future structure updates will use your customized templates
- Changes persist across plugin updates

## ⚙️ Settings

- **Training days selector** – Circular day buttons (ПН, ВТ, СР, ЧТ, ПТ, СБ, ВС) to select which days you train. Click to toggle selection. Selected days are highlighted with accent color.
- **Workout folder picker** – Read-only input that opens a nested folder browser. Each level lists subfolders plus a "+ create your own" action; newly created folders are applied immediately.
- **Chart range** – Two numeric inputs (min and max reps). Changing either value shows a notice and triggers auto-refresh of all weighted exercise files.
- **Update structure** – Rebuild/migrate `Exercises`, `Logs`, and `Templates` manually while preserving modified templates. Creates all 8 default templates automatically.
- **Rebuild cache** – Manually refresh the exercise cache from all workout logs.
- **Clear cache** – Reset the exercise cache (useful for troubleshooting).

## 🔄 Automation

- Exercise cards refresh themselves whenever you open them.
- Weighted exercise files are recreated after chart range changes (with progress notices).
- Template edits propagate to the source code automatically when you save changes.
- Exercise cache updates automatically when you modify workout logs.
- All 8 templates (Monday-Sunday + Home) are created automatically on first run or structure update.
- Training day selection persists in `data.json` and is used for automatic template selection.

## 🧪 Troubleshooting

- **Charts are empty** – Make sure Dataview is installed and logs include numeric weights/reps.
- **Template changes are ignored** – Confirm you edited files in the active `Templates/` folder. Changes are automatically saved to source code when you save the file.
- **Folder migration failed** – Toggle to another folder and back; the plugin keeps the previous path and migrates files accordingly.
- **Dataview SyntaxError** – Use the shipped templates (no template literals) or re-run **Update structure** to restore clean copies.
- **Wrong template on training day** – Check your training days selection in settings. The plugin uses your selected days to determine which template to use.
- **Exercise cache not updating** – Use the "Rebuild cache" button in settings or the command palette command "Обновить кэш упражнений".

## 📁 Data Storage

The plugin stores all settings in `data.json` (automatically created by Obsidian):
- Training days selection
- Workout folder path
- Exercise registry (list of all exercises with weight info)
- Chart range settings (min/max reps)
- Custom experiment templates

Additional data files (created automatically):
- `exercise-cache.json` – Cached exercise data for fast loading
- `exercise-metadata.json` – Exercise metadata and links

All data files are created automatically on first run. No manual configuration required!

## 🤝 Contributing

- Issues and PRs are welcome.
- Run `npm run build` before submitting changes to ensure the bundle compiles.
- Licensed under the MIT License – see [`LICENSE`](LICENSE).

---
Created by Vadim Denisovich · [GitHub Repository](https://github.com/VadimDenisovich/Workout-Tracker-Plugin)
