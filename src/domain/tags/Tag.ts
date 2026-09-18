export type TagId = string

export interface Tag {
  id: TagId
  name: string
  /** Absent or false = active. Additive; older rows omit the field. */
  archived?: boolean
  createdAt: number
  updatedAt: number
}

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase()
}

export function tagMatchesName(tag: Tag, rawName: string): boolean {
  const needle = normalizeTagName(rawName)
  if (!needle) return false
  return normalizeTagName(tag.name) === needle
}

export function isTagArchived(tag: Pick<Tag, 'archived'>): boolean {
  return tag.archived === true
}

export function tagCreateAutocompleteNames(tags: readonly Tag[]): string[] {
  return tags.filter((tag) => !isTagArchived(tag)).map((tag) => tag.name)
}

export function archivedTagIdSet(tags: readonly Tag[]): Set<TagId> {
  return new Set(tags.filter(isTagArchived).map((tag) => tag.id))
}

/** Replace `from` with `to` on a live assignment list, collapsing duplicates. */
export function rewriteTagIds(tagIds: readonly TagId[], from: TagId, to: TagId): TagId[] {
  const next: TagId[] = []
  const seen = new Set<TagId>()
  for (const id of tagIds) {
    const mapped = id === from ? to : id
    if (seen.has(mapped)) continue
    seen.add(mapped)
    next.push(mapped)
  }
  return next
}

export function removeTagId(tagIds: readonly TagId[], remove: TagId): TagId[] {
  return tagIds.filter((id) => id !== remove)
}

/** Append missing ids, preserving existing order and de-duplicating. */
export function addTagIds(tagIds: readonly TagId[], toAdd: readonly TagId[]): TagId[] {
  const next = [...tagIds]
  const seen = new Set(tagIds)
  for (const id of toAdd) {
    if (seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next
}
