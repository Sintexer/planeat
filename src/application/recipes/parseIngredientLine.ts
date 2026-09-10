import type { ImportedIngredientLine } from './ImportedRecipeDraft'
import { isQuantityUnit } from '../../domain/shared/Quantity'

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
  oz: 'piece', // not in QUANTITY_UNITS — map to piece for storage
  ounce: 'piece',
  ounces: 'piece',
  lb: 'piece',
  pound: 'piece',
  pounds: 'piece',
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
  // Mixed number like 1.5 already decimal, or "1 1/2" handled before this
  const v = Number(t)
  return Number.isFinite(v) && v > 0 ? v : undefined
}

function normalizeUnicodeFractions(text: string): string {
  let result = text
  for (const [glyph, ascii] of Object.entries(VULGAR_FRACTIONS)) {
    // Mixed number: digit immediately before vulgar fraction → "1 1/2"
    result = result.replace(new RegExp(`(\\d)${glyph}`, 'g'), `$1 ${ascii}`)
    result = result.replaceAll(glyph, ascii)
  }
  // Collapse "1 1/2" into a single evaluable form later via regex
  return result
}

function stripTrailingPrice(text: string): string {
  return text.replace(/\s*\(\$[0-9.]+[*]*\)\s*$/g, '').trim()
}

function extractTrailingNotes(text: string): { remainder: string; notes: string[] } {
  const notes: string[] = []
  let remainder = text.trim()
  // Pull trailing parentheticals from the end repeatedly
  while (true) {
    const match = /^(.*)\(([^)]+)\)\s*$/.exec(remainder)
    if (!match) break
    const before = match[1].trim()
    const inside = match[2].trim()
    // Don't treat a lone price leftover as note (already stripped), but keep other notes
    if (/^\$[0-9.]+[*]*$/.test(inside)) {
      remainder = before
      continue
    }
    // Notes that embed a price: "freshly cracked, $0.02" → drop the price part
    const cleaned = inside
      .replace(/,?\s*\$[0-9.]+[*]*\s*/g, '')
      .replace(/\s*,\s*$/g, '')
      .trim()
    if (cleaned) notes.unshift(cleaned)
    remainder = before
  }
  return { remainder: remainder.trim(), notes }
}

function resolveUnit(raw: string): string | undefined {
  const key = raw.toLowerCase()
  if (UNIT_ALIASES[key]) return UNIT_ALIASES[key]
  if (isQuantityUnit(key)) return key
  return undefined
}

function joinNotes(parts: string[]): string {
  return parts.filter(Boolean).join('; ')
}

/**
 * Parse a free-text recipeIngredient line into name + qty/unit/note.
 * Name is the cleaned remainder (not the full original string).
 */
export function parseIngredientLine(line: string): ImportedIngredientLine {
  const decoded = decodeHtmlEntities(line).trim()
  const withoutPrice = stripTrailingPrice(decoded)
  const { remainder: afterNotes, notes } = extractTrailingNotes(withoutPrice)
  const normalized = normalizeUnicodeFractions(afterNotes).replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return { name: withoutPrice || decoded, quantityValue: '', quantityUnit: 'g', note: '' }
  }

  // Mixed number: "1 1/2 tsp …"
  const mixed =
    /^(\d+)\s+(\d+\/\d+)\s+([a-zA-Z]+)\b(?:\s+of\s+|\s+)?(.+)$/i.exec(normalized) ??
    /^(\d+)\s+(\d+\/\d+)\s+(.+)$/i.exec(normalized)

  if (mixed) {
    const whole = Number(mixed[1])
    const frac = evalFraction(mixed[2])
    const value = whole + frac
    if (Number.isFinite(value) && value > 0) {
      if (mixed.length === 5) {
        const unit = resolveUnit(mixed[3])
        if (unit) {
          return {
            name: mixed[4].trim(),
            quantityValue: value,
            quantityUnit: unit,
            note: joinNotes(notes),
          }
        }
      }
      return {
        name: (mixed.length === 5 ? `${mixed[3]} ${mixed[4]}` : mixed[3]).trim(),
        quantityValue: value,
        quantityUnit: 'piece',
        note: joinNotes(notes),
      }
    }
  }

  // Range with unit: "1-3 tsp salt" / "1–3 tsp salt"
  const ranged =
    /^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\b(?:\s+of\s+|\s+)?(.+)$/i.exec(
      normalized,
    )
  if (ranged) {
    const low = Number(ranged[1])
    const high = Number(ranged[2])
    const unit = resolveUnit(ranged[3])
    if (Number.isFinite(low) && low > 0 && unit) {
      return {
        name: ranged[4].trim(),
        quantityValue: low,
        quantityUnit: unit,
        note: joinNotes([...notes, `range ${ranged[1]}-${ranged[2]}`]),
      }
    }
    if (Number.isFinite(low) && low > 0) {
      return {
        name: normalized.replace(/^\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?\s*/, '').trim(),
        quantityValue: low,
        quantityUnit: 'piece',
        note: joinNotes([...notes, Number.isFinite(high) ? `range ${ranged[1]}-${ranged[2]}` : '']),
      }
    }
  }

  // Qty + unit + name: "8 cups chicken broth" / "1/4 tsp black pepper"
  const withUnit = /^(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-zA-Z]+)\b(?:\s+of\s+|\s+)?(.+)$/i.exec(
    normalized,
  )
  if (withUnit) {
    const value = parseNumberToken(withUnit[1])
    const unitRaw = withUnit[2]
    const rest = withUnit[3].trim()
    const unit = resolveUnit(unitRaw)
    if (value !== undefined && unit) {
      return {
        name: rest,
        quantityValue: value,
        quantityUnit: unit,
        note: joinNotes(notes),
      }
    }
    // Count word as unit: "3 garlic cloves" already covered if cloves is rest;
    // "3 cloves garlic" → unitRaw cloves
    if (value !== undefined && COUNT_WORDS.has(unitRaw.toLowerCase())) {
      return {
        name: rest ? `${unitRaw} ${rest}`.trim() : unitRaw,
        quantityValue: value,
        quantityUnit: 'piece',
        note: joinNotes(notes),
      }
    }
  }

  // Qty + name without measure unit: "3 garlic cloves", "1 medium yellow onion"
  const bareQty = /^(\d+(?:\.\d+)?|\d+\/\d+)\s+(.+)$/i.exec(normalized)
  if (bareQty) {
    const value = parseNumberToken(bareQty[1])
    const rest = bareQty[2].trim()
    if (value !== undefined && rest) {
      // "1 medium yellow onion" — medium is a size adjective, keep in name
      return {
        name: rest,
        quantityValue: value,
        quantityUnit: 'piece',
        note: joinNotes(notes),
      }
    }
  }

  // Fraction-only leading without ASCII digits already normalized: "1/4 tsp …" handled above
  return {
    name: normalized,
    quantityValue: '',
    quantityUnit: 'g',
    note: joinNotes(notes),
  }
}
