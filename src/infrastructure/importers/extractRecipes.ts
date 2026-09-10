import type {
  ExtractRecipesResult,
  SchemaOrgRecipeNode,
} from '../../application/ports/RecipeTextExtractor'
import { isRecipeType, schemaOrgRecipeNodeSchema } from './schemaOrgRecipeSchema'

const URL_ONLY_RE = /^https?:\/\/\S+$/i

function collectRecipes(node: unknown, into: SchemaOrgRecipeNode[]): void {
  if (node === null || node === undefined) return

  if (Array.isArray(node)) {
    for (const item of node) collectRecipes(item, into)
    return
  }

  if (typeof node !== 'object') return

  const record = node as Record<string, unknown>

  if (isRecipeType(record['@type'])) {
    const parsed = schemaOrgRecipeNodeSchema.safeParse(record)
    if (parsed.success) into.push(parsed.data as SchemaOrgRecipeNode)
  }

  if (Array.isArray(record['@graph'])) {
    collectRecipes(record['@graph'], into)
  }

  if (record.mainEntity) collectRecipes(record.mainEntity, into)
  if (record.mainEntityOfPage) collectRecipes(record.mainEntityOfPage, into)
}

function extractJsonLdScriptBodies(html: string): string[] {
  const bodies: string[] = []
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const body = match[1]?.trim()
    if (body) bodies.push(body)
  }
  return bodies
}

function looksLikeHtml(raw: string): boolean {
  const trimmed = raw.trim().toLowerCase()
  return (
    trimmed.includes('<html') ||
    trimmed.includes('<!doctype') ||
    trimmed.includes('<script') ||
    trimmed.includes('<head') ||
    trimmed.includes('<body')
  )
}

function parseJsonDocuments(text: string): unknown[] {
  const docs: unknown[] = []
  try {
    docs.push(JSON.parse(text))
    return docs
  } catch {
    /* try cleaned */
  }

  const trimmed = text.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const cleaned = trimmed.replace(/<!--[\s\S]*?-->/g, '').trim()
      docs.push(JSON.parse(cleaned))
    } catch {
      /* ignore */
    }
  }
  return docs
}

/**
 * Extract Schema.org Recipe nodes from pasted JSON/JSON-LD or HTML with
 * embedded application/ld+json. Never fetches a URL.
 */
export function extractRecipesFromText(raw: string): ExtractRecipesResult {
  const text = raw.trim()
  if (!text) return { ok: false, error: 'empty' }
  if (URL_ONLY_RE.test(text)) return { ok: false, error: 'url-only' }

  const recipes: SchemaOrgRecipeNode[] = []
  let parsedSomething = false

  const tryParseBlob = (blob: string) => {
    const docs = parseJsonDocuments(blob)
    if (docs.length === 0) return
    parsedSomething = true
    for (const doc of docs) collectRecipes(doc, recipes)
  }

  if (looksLikeHtml(text)) {
    const bodies = extractJsonLdScriptBodies(text)
    if (bodies.length === 0) {
      tryParseBlob(text)
    } else {
      for (const body of bodies) tryParseBlob(body)
    }
  } else {
    tryParseBlob(text)
  }

  if (recipes.length === 0) {
    if (!parsedSomething) return { ok: false, error: 'parse-failed' }
    return { ok: false, error: 'no-recipe' }
  }

  const named = recipes.filter((r) => {
    const name = r.name
    if (typeof name === 'string') return name.trim().length > 0
    if (Array.isArray(name)) return name.some((n) => typeof n === 'string' && n.trim())
    return false
  })
  if (named.length === 0) return { ok: false, error: 'no-recipe' }

  return { ok: true, recipes: named }
}

export class SchemaOrgRecipeExtractor {
  extractRecipesFromText(raw: string): ExtractRecipesResult {
    return extractRecipesFromText(raw)
  }
}
