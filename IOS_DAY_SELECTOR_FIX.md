# Исправление проблемы с кружками выбора дней на iOS

## Проблема
При нажатии на кружок выбора тренировочного дня в настройках на iPhone:
- Кружок вначале окрашивался как выбранный
- При попытке снять выбор, кружок не снимал цвета
- Только надпись меняла цвет на черный
- После первого исправления кружки вообще пропали и отображались как вертикальный текст
- **Эффект hover на iOS создавал ощущение, что кнопка нажалась неправильно**

## Причины
1. **Проверка состояния через CSS-класс**: Код использовал `dayCircle.hasClass('selected')` для проверки состояния, что могло вызывать рассинхронизацию на iOS из-за задержек в применении стилей
2. **Конфликты с !important**: Использование `!important` в CSS может конфликтовать с темами Obsidian
3. **Кеширование стилей на iOS**: Safari на iOS агрессивно кеширует стили, требуется полная перезагрузка приложения
4. **Эффект hover на touchscreen устройствах**: На мобильных устройствах hover "залипает" после тапа, создавая визуальную путаницу

## Решение

### 1. Изменения в main.ts (строка 621)
**Было:**
```typescript
const isSelected = dayCircle.hasClass('selected');

if (isSelected) {
    dayCircle.removeClass('selected');
    this.plugin.settings.trainingDays = this.plugin.settings.trainingDays.filter(d => d !== day);
} else {
    dayCircle.addClass('selected');
    this.plugin.settings.trainingDays.push(day);
}
```

**Стало:**
```typescript
// Function to update visual state
const updateVisualState = (selected: boolean) => {
    if (selected) {
        dayCircle.addClass('selected');
    } else {
        dayCircle.removeClass('selected');
    }
    // Force repaint on iOS
    void dayCircle.offsetHeight;
};

// Check state from settings array, not from CSS class
const isSelected = this.plugin.settings.trainingDays.includes(day);

if (isSelected) {
    this.plugin.settings.trainingDays = this.plugin.settings.trainingDays.filter(d => d !== day);
    updateVisualState(false);
} else {
    this.plugin.settings.trainingDays.push(day);
    updateVisualState(true);
}
```

**Ключевые улучшения:**
- Проверка состояния из массива данных, а не из CSS
- Функция `updateVisualState` для централизованного управления визуальным состоянием
- `void dayCircle.offsetHeight` - принудительная перерисовка элемента на iOS

### 2. Изменения в styles.css
**Убрано:**
- Все `!important` (могли конфликтовать с темами)
- Универсальный `transition: all 0.2s ease`

**Добавлено:**
```css
.day-circle {
    transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
}

/* Hover effect only on desktop */
@media (hover: hover) and (pointer: fine) {
    .day-circle:hover {
        background-color: var(--interactive-accent-hover);
        transform: scale(1.05);
    }
    
    .day-circle.selected:hover {
        background-color: var(--interactive-accent-hover);
    }
}
```

**Преимущества:**
- Более специфичные transition'ы для лучшей производительности
- Нет конфликтов с темами Obsidian
- **Hover отключён на touchscreen устройствах** - используется media query `@media (hover: hover) and (pointer: fine)`
- **Hover сохранён на десктопе** для интерактивности с мышью
- Правильное поведение на iOS без "залипания" состояния hover

## Тестирование
После обновления плагина **НА IPHONE**:

### Важно! Как правильно обновить плагин на iPhone:
1. **Синхронизируйте файлы** через iCloud/Obsidian Sync
2. **Полностью закройте приложение Obsidian**:
   - Свайп вверх от нижнего края
   - Найдите Obsidian в списке приложений
   - Свайп вверх по превью Obsidian, чтобы закрыть
3. **Откройте Obsidian заново**
4. Откройте настройки плагина

### Проверка работы:
1. Должны отображаться **круглые кнопки** с аббревиатурами дней (ПН, ВТ, СР, и т.д.)
2. Нажмите на любой кружок - он должен окраситься в цвет акцента
3. Нажмите на него снова - цвет должен полностью исчезнуть (остаётся только рамка)
4. Проверьте работу для всех дней недели

## Если кружки не появились
1. Убедитесь, что файл `styles.css` обновился в папке плагина
2. Попробуйте отключить и снова включить плагин в настройках
3. Перезагрузите iPhone полностью (выключить/включить)
4. Проверьте, что используется последняя версия файлов (синхронизация прошла успешно)

Дата исправления: 19 октября 2025  
Версия исправления: 2.0
