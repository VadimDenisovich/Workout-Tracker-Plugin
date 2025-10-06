пш# Workout Tracker for Obsidian

Smart workout journaling for Obsidian: spin up daily logs from templates, manage an exercise library with progress charts, and keep your folder structure tidy without leaving the vault.

## ✨ Highlights

- **One-click workout logs** – Ribbon button and command palette command pick the correct template for Monday, Wednesday, Friday, or Home sessions. If a log for today already exists you get redirected with a notice.
- **Home vs gym flows** – A location picker lets you choose “Gym” (date-based template) or “Home” (circuit template that creates files like `2025-10-03-Home.md`).
- **Exercise library modal** – Floating modal with a full-width search bar, per-exercise open/delete actions, and a bold “+” button in a rounded square to add new drills.
- **Automatic folder management** – Keeps `Exercises/`, `Logs/`, and `Templates/` in sync. Changing the workout folder migrates the whole structure instead of recreating it.
- **Dataview-powered stats** – Exercise cards ship with dataviewjs tables and Mermaid charts (weight vs reps or bodyweight volume) and handle set numbering for home circuits.
- **Template sync** – Editing `Monday.md`, `Wednesday.md`, `Friday.md`, or `Home.md` updates the in-code defaults so future logs use your version.
- **Chart range settings** – Configure min/max reps from the settings tab; weighted exercise files are refreshed automatically after every change.
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

On first launch—or whenever you pick a new workout folder—the plugin guarantees this structure:

- `Logs/` – Gym and home workout logs; home sessions follow `YYYY-MM-DD-Home.md`.
- `Exercises/` – Exercise cards containing dataviewjs dashboards.
- `Templates/` – Editable Markdown templates (`Monday.md`, `Wednesday.md`, `Friday.md`, `Home.md`).

The plugin remembers the previous folder and migrates existing files when you choose a new location. The **Update structure** button in settings re-runs the same migration.

## 🧭 Everyday workflows

### Create a workout log
1. Click the dumbbell ribbon icon or run the “Создать лог тренировки” command.
2. Pick the location:
   - **Gym** – Picks Monday/Wednesday/Friday automatically; non-training days prompt you to choose a template manually.
   - **Home** – Uses the home circuit template (three rounds of push-ups, squats, core, 2-minute rest, TabataTimer suggestion).
3. If today’s log already exists the plugin opens it and shows “Переношу вас в созданный файл”.

### Manage exercises
- Open the exercise modal via the ribbon icon or “Открыть упражнения”.
- Use the wide search bar to filter by name; spacing keeps it separated from the list.
- Select an exercise to open its card. Click the minus icon to delete the file and remove it from the registry.
- Add new exercises with the black “+” button; files are created under `Exercises/` and persisted in the settings registry (removal stays in sync).

### Exercise cards & stats
- **Weighted exercises** – Dataview aggregates sets from logs, builds a weight vs reps chart (Mermaid `xychart-beta`, bright orange `#FF6B00` line), and lists the latest sets with an option to show hidden records. Home workouts number sets based on the circuit round.
- **Bodyweight exercises** – Charts show total volume and max reps per day. Tables default to 10 rows with a “show all” toggle.
- Dataview scripts rely on string concatenation (no template literals) to avoid Obsidian parser issues and auto-refresh whenever you open a card.

## 🧱 Templates

### Gym days (Monday / Wednesday / Friday)
Each template lists the planned exercises pulled from your program. Every exercise includes Obsidian image embeds followed by placeholder sets:

```
![[Pasted image 20240523211013.png|300]]
Set 1: _ kg × _ reps
Set 2: _ kg × _ reps
```

Warm-ups are intentionally omitted per specification.

### Home day (Home.md)
Three rounds with push-ups, squats, and abs plus timing notes. Repetition fields stay blank (`_ reps`) for quick filling during the session.

Any edits you make inside `Templates/` are captured and stored in the plugin so regenerated files keep your customizations.

## ⚙️ Settings

- **Workout folder picker** – Read-only input that opens a nested folder browser. Each level lists subfolders plus a “+ create your own” action; newly created folders are applied immediately.
- **Chart range** – Two numeric inputs (min and max reps). Changing either value shows a notice and triggers auto-refresh of all weighted exercise files.
- **Update structure** – Rebuild/migrate `Exercises`, `Logs`, and `Templates` manually while preserving modified templates.

## � Automation

- Exercise cards refresh themselves whenever you open them.
- Weighted exercise files are recreated after chart range changes (with progress notices).
- Template edits propagate to the internal defaults, and migrations respect your customized versions.

## 🧪 Troubleshooting

- **Charts are empty** – Make sure Dataview is installed and logs include numeric weights/reps.
- **Template changes are ignored** – Confirm you edited files in the active `Templates/` folder, then press **Update structure**.
- **Folder migration failed** – Toggle to another folder and back; the plugin keeps the previous path and migrates files accordingly.
- **Dataview SyntaxError** – Use the shipped templates (no template literals) or re-run **Update structure** to restore clean copies.

## 🤝 Contributing

- Issues and PRs are welcome.
- Run `npm run build` before submitting changes to ensure the bundle compiles.
- Licensed under the MIT License – see [`LICENSE`](LICENSE).

---
Created by Vadim Denisovich · [GitHub Repository](https://github.com/VadimDenisovich/Workout-Tracker-Plugin)
