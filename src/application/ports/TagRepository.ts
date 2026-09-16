import type { Tag, TagId } from '../../domain/tags/Tag'

export type CreateTagInput = {
  name: string
}

export type UpdateTagInput = Partial<Pick<Tag, 'name'>>

export interface TagRepository {
  create(input: CreateTagInput): Promise<Tag>
  getAll(): Promise<Tag[]>
  getById(id: TagId): Promise<Tag | undefined>
  getByIds(ids: TagId[]): Promise<Tag[]>
  findByName(name: string): Promise<Tag | undefined>
  update(id: TagId, changes: UpdateTagInput): Promise<void>
}
