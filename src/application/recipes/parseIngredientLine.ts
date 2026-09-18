import { findUnitDefinition } from '../../domain/shared/UnitRegistry'
import type { ImportedIngredientLine, MeasurementStatus } from './ImportedRecipeDraft'

/** Word → registry key (or the unspecified `oz` token). Never maps oz/lb onto `piece`. */
const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  cup: 'cup',
  cups: 'cup',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  piece: 'piece',
  pieces: 'piece',
  serving: 'serving',
  servings: 'serving',
}

/** Words that mean a countable item → unit `piece`, kept as part of the name. */
const COUNT_WORDS = new Set([
  'clove',
  'cloves',
  'rib',
  'ribs',
  'stalk',
  'stalks',
  'sprig',
  'sprigs',
  'leaf',
  'leaves',
  'medium',
  'large',
  'small',
  'whole',
  'can',
  'cans',
  'package',
  'packages',
  'bunch',
  'bunches',
])

const VULGAR_FRACTIONS: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function evalFraction(text: string): number {
  const [a, b] = text.split('/').map(Number)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return Number.NaN
  return a / b
}

function parseNumberToken(token: string): number | undefined {
  const t = token.trim()
  if (!t) return undefined
  if (t.includes('/')) {
    const v = evalFraction(t)
    return Number.isFinite(v) && v > 0 ? v : undefined
  }
  const v = Number(t)
  return Number.isFinite(v) && v > 0 ? v : undefined
}

function normalizeUnicodeFractions(text: string): string {
  let result = text
  for (const [glyph, ascii] of Object.entries(VULGAR_FRACTIONS)) {
    result = result.replace(new RegExp(`(\\d)${glyph}`, 'g'), `$1 ${ascii}`)
    result = result.replaceAll(glyph, ascii)
  }
  return result
}

function stripTrailingPrice(text: string): string {
  return text.replace(/\s*\(\$[0-9.]+[*]*\)\s*$/g, '').trim()
}

function extractTrailingNotes(text: string): { remainder: string; notes: string[] } {
  const notes: string[] = []
  let remainder = text.trim()
  while (true) {
    const match = /^(.*)\(([^)]+)\)\s*$/.exec(remainder)
    if (!match) break
    const before = match[1].trim()
    const inside = match[2].trim()
    if (/^\$[0-9.]+[*]*$/.test(inside)) {
      remainder = before
      continue
    }
    const cleaned = inside
      .replace(/,?\s*\$[0-9.]+[*]*\s*/g, '')
      .replace(/\s*,\s*$/g, '')
      .trim()
    if (cleaned) notes.unshift(cleaned)
    remainder = before
  }
  return { remainder: remainder.trim(), notes }
}

function statusForUnit(unit: string): MeasurementStatus {
  if (unit === 'cup') return 'ambiguous-cup'
  if (unit === 'oz') return 'ambiguous-oz'
  const definition = findUnitDefinition(unit)
  if (definition?.legacy && definition.key === 'cup') return 'ambiguous-cup'
  return 'known'
}

function classifyUnit(raw: string): { unit: string; status: MeasurementStatus } | undefined {
  const key = raw.toLowerCase()
  const aliased = UNIT_ALIASES[key]
  if (aliased) return { unit: aliased, status: statusForUnit(aliased) }
  const definition = findUnitDefinition(key)
  if (definition) return { unit: definition.key, status: statusForUnit(definition.key) }
  return undefined
}

function joinNotes(parts: string[]): string {
  return parts.filter(Boolean).join('; ')
}

function parsedLine(
  fields: Omit<ImportedIngredientLine, 'originalText'> & { originalText: string },
): ImportedIngredientLine {
  return fields
}

function unresolvedLine(input: {
  originalText: string
  name: string
  quantityText: string
  note: string
}): ImportedIngredientLine {
  return {
    name: input.name,
    quantityValue: '',
    quantityUnit: '',
    quantityText: input.quantityText,
    note: input.note,
    originalText: input.originalText,
    measurementStatus: 'unresolved',
  }
}

/**
 * Parse a free-text recipeIngredient line into name + qty/unit/note.
 * Always keeps `originalText`. Does not invent a cup convention, oz family, or range endpoint.
 */
export function parseIngredientLine(line: string): ImportedIngredientLine {
  const decoded = decodeHtmlEntities(line).trim()
  const withoutPrice = stripTrailingPrice(decoded)
  const { remainder: afterNotes, notes } = extractTrailingNotes(withoutPrice)
  const normalized = normalizeUnicodeFractions(afterNotes).replace(/\s+/g, ' ').trim()
  const note = joinNotes(notes)
  const originalText = decoded

  if (!normalized) {
    return unresolvedLine({
      originalText,
      name: withoutPrice || decoded,
      quantityText: withoutPrice || decoded,
      note,
    })
  }

  const mixed =
    /^(\d+)\s+(\d+\/\d+)\s+([a-zA-Z]+)\b(?:\s+of\s+|\s+)?(.+)$/i.exec(normalized) ??
    /^(\d+)\s+(\d+\/\d+)\s+(.+)$/i.exec(normalized)

  if (mixed) {
    const whole = Number(mixed[1])
    const frac = evalFraction(mixed[2])
    const value = whole + frac
    if (Number.isFinite(value) && value > 0) {
      if (mixed.length === 5) {
        const classified = classifyUnit(mixed[3])
        if (classified) {
          return parsedLine({
            name: mixed[4].trim(),
            quantityValue: value,
            quantityUnit: classified.unit,
            quantityText: '',
            note,
            originalText,
            measurementStatus: classified.status,
          })
        }
        if (COUNT_WORDS.has(mixed[3].toLowerCase())) {
          return parsedLine({
            name: `${mixed[3]} ${mixed[4]}`.trim(),
            quantityValue: value,
            quantityUnit: 'piece',
            quantityText: '',
            note,
            originalText,
            measurementStatus: 'known',
          })
        }
        return unresolvedLine({
          originalText,
          name: mixed[4].trim(),
          quantityText: `${mixed[1]} ${mixed[2]} ${mixed[3]}`,
          note,
        })
      }
      return parsedLine({
        name: mixed[3].trim(),
        quantityValue: value,
        quantityUnit: 'piece',
        quantityText: '',
        note,
        originalText,
        measurementStatus: 'known',
      })
    }
  }

  const ranged =
    /^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\b(?:\s+of\s+|\s+)?(.+)$/i.exec(
      normalized,
    ) ?? /^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s+(.+)$/i.exec(normalized)
  if (ranged) {
    const classified = ranged.length === 5 ? classifyUnit(ranged[3]) : undefined
    const name =
      ranged.length === 5
        ? classified
          ? ranged[4].trim()
          : `${ranged[3]} ${ranged[4]}`.trim()
        : ranged[3].trim()
    const amountPhrase =
      ranged.length === 5 ? `${ranged[1]}-${ranged[2]} ${ranged[3]}` : `${ranged[1]}-${ranged[2]}`
    return unresolvedLine({
      originalText,
      name,
      quantityText: amountPhrase,
      note,
    })
  }

  const withUnit = /^(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-zA-Z-]+)\b(?:\s+of\s+|\s+)?(.+)$/i.exec(
    normalized,
  )
  if (withUnit) {
    const value = parseNumberToken(withUnit[1])
    const unitRaw = withUnit[2]
    const rest = withUnit[3].trim()
    const classified = classifyUnit(unitRaw)
    if (value !== undefined && classified) {
      return parsedLine({
        name: rest,
        quantityValue: value,
        quantityUnit: classified.unit,
        quantityText: '',
        note,
        originalText,
        measurementStatus: classified.status,
      })
    }
    if (value !== undefined && COUNT_WORDS.has(unitRaw.toLowerCase())) {
      return parsedLine({
        name: rest ? `${unitRaw} ${rest}`.trim() : unitRaw,
        quantityValue: value,
        quantityUnit: 'piece',
        quantityText: '',
        note,
        originalText,
        measurementStatus: 'known',
      })
    }
    if (value !== undefined) {
      return unresolvedLine({
        originalText,
        name: rest,
        quantityText: `${withUnit[1]} ${unitRaw}`,
        note,
      })
    }
  }

  const bareQty = /^(\d+(?:\.\d+)?|\d+\/\d+)\s+(.+)$/i.exec(normalized)
  if (bareQty) {
    const value = parseNumberToken(bareQty[1])
    const rest = bareQty[2].trim()
    if (value !== undefined && rest) {
      return parsedLine({
        name: rest,
        quantityValue: value,
        quantityUnit: 'piece',
        quantityText: '',
        note,
        originalText,
        measurementStatus: 'known',
      })
    }
  }

  return unresolvedLine({
    originalText,
    name: normalized,
    quantityText: normalized,
    note,
  })
}
