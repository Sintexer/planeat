export const enMessages = {
  'ingredient.usuallyAtHome': 'Usually have at home — starts checked on new grocery lists',
  'ingredient.usuallyAtHomeShort': 'Usually have at home',
  'slot.eatingOut': 'Eating out',
  'slot.notPlanned': 'Not planned',
  'slot.addDish': 'Add dish',
  'pwa.offlineReady': 'App is ready to work offline.',
  'pwa.updateAvailable': 'An update is available.',
  'pwa.reloadWhenReady': 'Reload when ready',
  'photo.unavailable': 'Photo unavailable offline',
  'empty.recipes': 'No recipes or simple foods yet.',
  'empty.recipesHint':
    'Add a recipe or import a file. A starter set appears only on a brand-new library.',
  'empty.listsOpen': 'No open grocery lists. Generate one from Plan.',
  'empty.listsClosed': 'No closed lists yet.',
  'grocery.updateTitle': 'Grocery list already exists',
  'grocery.updateBody':
    'Updating replaces generated lines, keeps matching checkmarks, and leaves manual items. Creating new leaves the existing list untouched.',
  'grocery.updateExisting': 'Update existing',
  'grocery.createNew': 'Create new',
  'quantity.unspecified': 'quantity unspecified',
  'settings.language': 'Interface language',
  'settings.measurement': 'Measurement display',
  'settings.measurementAsEntered': 'As entered',
  'settings.measurementMetric': 'Metric (g/kg, mL/L only)',
  'settings.measurementUs': 'US customary (coming with unit registry)',
  'settings.measurementHelp':
    'This only changes how compatible metric units are shown. Saved recipes, cups, and plans do not change.',
  'settings.backupPhotos':
    'Backups include photo URLs, not image files. Offline, missing photos show a placeholder.',
} as const

export type MessageId = keyof typeof enMessages
