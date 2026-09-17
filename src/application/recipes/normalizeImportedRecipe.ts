import type { SchemaOrgRecipeNode } from '../ports/RecipeTextExtractor'
import type { ImportedRecipeDraft, NormalizedImport } from './ImportedRecipeDraft'
import { decodeHtmlEntities, parseIngredientLine } from './parseIngredientLine'

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return decodeHtmlEntities(value.trim())
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) return decodeHtmlEntities(item.trim())
    }
  }
  return undefined
}

function firstUrl(value: unknown): string {
  const direct = asString(value)
  if (direct && /^https?:\/\//i.test(direct)) return direct
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = firstUrl(item)
      if (nested) return nested
    }
    return ''
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const id = asString(record['@id']) ?? asString(record.url) ?? asString(record.contentUrl)
    if (id && /^https?:\/\//i.test(id)) return id
  }
  return ''
}

/** Parse ISO-8601 durations like PT1H30M, PT45M, P1DT2H into minutes. */
export function parseIso8601DurationMinutes(value: unknown): number | undefined {
  const raw = asString(value)
  if (!raw) return undefined
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(raw)
  if (!match) return undefined
  const days = Number(match[1] ?? 0)
  const hours = Number(match[2] ?? 0)
  const minutes = Number(match[3] ?? 0)
  const seconds = Number(match[4] ?? 0)
  const total = days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60)
  return total > 0 ? total : undefined
}

function flattenInstructions(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return decodeHtmlEntities(value.trim())
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (typeof item === 'string') return decodeHtmlEntities(item.trim())
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          const text = asString(record.text) ?? asString(record.name)
          if (text) return `${index + 1}. ${text}`
          if (record.itemListElement) return flattenInstructions(record.itemListElement)
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.itemListElement) return flattenInstructions(record.itemListElement)
    return asString(record.text) ?? asString(record.name) ?? ''
  }
  return ''
}

function ingredientStrings(node: SchemaOrgRecipeNode): string[] {
  const raw = node.recipeIngredient ?? node.ingredients
  if (!raw) return []
  if (typeof raw === 'string') return [raw.trim()].filter(Boolean)
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          return asString(record.name) ?? asString(record.text) ?? ''
        }
        return ''
      })
      .filter(Boolean)
  }
  return []
}

function parseYield(value: unknown): { value: number | ''; unit: string; hint?: string } {
  if (value === undefined || value === null) {
    return { value: '', unit: 'serving', hint: 'Yield was missing — enter it before saving.' }
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return { value, unit: 'serving' }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseYield(item)
      if (parsed.value !== '') return parsed
    }
  }
  const text = asString(value)
  if (!text) {
    return { value: '', unit: 'serving', hint: 'Yield was ambiguous — enter it before saving.' }
  }
  const match = /(\d+(?:\.\d+)?)/.exec(text)
  if (match) {
    const num = Number(match[1])
    if (Number.isFinite(num) && num > 0) {
      const lower = text.toLowerCase()
      const unit = /\bcups?\b/.test(lower)
        ? 'cup' // unspecified convention — never invent cup-us / cup-metric
        : /\bml\b/.test(lower)
          ? 'ml'
          : /\b(g|grams?)\b/.test(lower)
            ? 'g'
            : 'serving'
      return { value: num, unit }
    }
  }
  return { value: '', unit: 'serving', hint: `Yield “${text}” needs confirmation.` }
}

export function normalizeImportedRecipe(node: SchemaOrgRecipeNode): NormalizedImport {
  const hints: string[] = []
  const displayName = asString(node.name) ?? 'Imported recipe'

  const yieldInfo = parseYield(node.recipeYield ?? node.yield)
  if (yieldInfo.hint) hints.push(yieldInfo.hint)

  const lines = ingredientStrings(node).map(parseIngredientLine)
  if (lines.length === 0) {
    hints.push('No ingredients found — add them before saving.')
  } else {
    const cupCount = lines.filter((l) => l.measurementStatus === 'ambiguous-cup').length
    const tbspCount = lines.filter((l) => l.measurementStatus === 'ambiguous-tbsp').length
    const ozCount = lines.filter((l) => l.measurementStatus === 'ambiguous-oz').length
    const unresolvedCount = lines.filter((l) => l.measurementStatus === 'unresolved').length
    if (cupCount > 0) {
      hints.push(
        `${cupCount} ingredient line${cupCount === 1 ? '' : 's'} use cup — confirm US, metric, or keep unspecified.`,
      )
    }
    if (tbspCount > 0) {
      hints.push(
        `${tbspCount} ingredient line${tbspCount === 1 ? '' : 's'} use tablespoon with no specified convention — keep unspecified or pick a known unit.`,
      )
    }
    if (ozCount > 0) {
      hints.push(
        `${ozCount} ingredient line${ozCount === 1 ? '' : 's'} say ounce — confirm weight or fluid, or leave unresolved.`,
      )
    }
    if (unresolvedCount > 0) {
      hints.push(
        `${unresolvedCount} ingredient measurement${unresolvedCount === 1 ? '' : 's'} could not be resolved — original text is kept; you can save without resolving.`,
      )
    }
  }

  const active = parseIso8601DurationMinutes(node.prepTime)
  const cook = parseIso8601DurationMinutes(node.cookTime)
  const total =
    parseIso8601DurationMinutes(node.totalTime) ??
    (active !== undefined || cook !== undefined
      ? (active ?? 0) + (cook ?? 0) || undefined
      : undefined)

  const sourceUrl = firstUrl(node.url) || firstUrl(node.mainEntityOfPage) || firstUrl(node['@id'])
  const photoUrl = firstUrl(node.image)

  hints.push(
    'Defaults applied: role Complete, meal type Dinner, effort Regular, reuse Fresh only — adjust if needed.',
  )
  if (lines.length > 0) {
    hints.push(
      'Imported ingredient names are suggested against your catalog. You can leave lines unlinked; aliases are added only if you confirm.',
    )
  }

  const form: ImportedRecipeDraft = {
    name: displayName,
    yieldValue: yieldInfo.value,
    yieldUnit: yieldInfo.unit,
    portionValue: 1,
    portionUnit: yieldInfo.unit === 'serving' ? 'serving' : yieldInfo.unit,
    instructions: flattenInstructions(node.recipeInstructions ?? node.instructions),
    roles: ['complete'],
    mealTypes: ['dinner'],
    effort: 'regular',
    activeTimeMinutes: active ?? '',
    totalTimeMinutes: total ?? '',
    reusePolicy: 'fresh-only',
    freezerFriendly: false,
    freezingNotes: '',
    sourceUrl,
    photoUrl,
    cuisine: '',
    maxPreferredRepeats: '',
    notes: asString(node.description) ?? '',
    ingredientLines:
      lines.length > 0
        ? lines
        : [
            {
              name: '',
              quantityValue: '',
              quantityUnit: 'g',
              quantityText: '',
              note: '',
              originalText: '',
              measurementStatus: 'known',
            },
          ],
  }

  return { form, hints, displayName }
}

export { parseIngredientLine } from './parseIngredientLine'
