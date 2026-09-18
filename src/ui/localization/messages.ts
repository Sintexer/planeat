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
  'grocery.updateTitle': 'Update from plan',
  'grocery.updateLinked': 'An open list is linked to this plan:',
  'grocery.updatePlanChanged': 'The plan has changed since that list was generated.',
  'grocery.updateAdded': 'Added',
  'grocery.updateChanged': 'Changed',
  'grocery.updateRemoved': 'No longer required by plan',
  'grocery.updateOverrides': 'Quantity you edited',
  'grocery.updateWillUncheck': 'Will be unchecked (amount increased)',
  'grocery.updateManualKept': 'Your manual items will remain.',
  'grocery.updateNoLineDiffs':
    'Generated lines match the plan. Updating only refreshes sources and the plan revision.',
  'grocery.updateKeepQuantity': 'Keep my quantity',
  'grocery.updateUsePlanned': 'Use planned quantity',
  'grocery.updateExisting': 'Update existing',
  'grocery.createNew': 'Create new',
  'grocery.updateCancel': 'Cancel',
  'quantity.unspecified': 'quantity unspecified',
  'settings.language': 'Interface language',
  'settings.measurement': 'Measurement display',
  'settings.measurementAsEntered': 'As entered',
  'settings.measurementMetric': 'Metric (g/kg, mL/L)',
  'settings.measurementUs': 'US customary (oz, fl oz, cups)',
  'settings.measurementHelp':
    'This only changes how compatible units are shown. Saved recipes, cups, and plans do not change.',
  'settings.backupPhotos':
    'Backups include photo URLs, not image files. Offline, missing photos show a placeholder.',
} as const

export type MessageId = keyof typeof enMessages
