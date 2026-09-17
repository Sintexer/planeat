import type { Tag, TagId } from '../../domain/tags/Tag'

export type CreateTagInput = {
  name: string
}

export type UpdateTagInput = Partial<Pick<Tag, 'name' | 'archived'>>

export type TagLiveUsage = {
  recipeCount: number
  simpleFoodCount: number
}

export interface TagRepository {
  create(input: CreateTagInput): Promise<Tag>
  getAll(): Promise<Tag[]>
  getById(id: TagId): Promise<Tag | undefined>
  getByIds(ids: TagId[]): Promise<Tag[]>
  findByName(name: string): Promise<Tag | undefined>
  update(id: TagId, changes: UpdateTagInput): Promise<void>
  countLiveAssignments(id: TagId): Promise<TagLiveUsage>
  /**
   * Rewrite live recipe/simple-food `tagIds` (deduping) and delete the source tag.
   * Must not touch cooking-event / plan snapshots.
   */
  mergeLiveAssignments(sourceId: TagId, targetId: TagId): Promise<void>
  /**
   * Strip the tag from live recipes/simple foods and delete the catalog row.
   * Must not delete food items or rewrite snapshots.
   */
  deleteTagAndUnassign(id: TagId): Promise<void>
}
