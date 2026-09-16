export type TagId = string

export interface Tag {
  id: TagId
  name: string
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
