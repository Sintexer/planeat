import { describe, expect, it } from 'vitest'
import type { GroceryItem } from './GroceryItem'
import {
  groceryListView,
  shoppingSectionGroupKey,
  shoppingSectionSelectOptions,
} from './shoppingSections'

function item(overrides: Partial<GroceryItem> & Pick<GroceryItem, 'id' | 'label'>): GroceryItem {
  return {
    listId: 'list-1',
    quantity: null,
    checked: false,
    origin: 'generated',
    quantityManuallyEdited: false,
    ...overrides,
  }
}

describe('shoppingSectionGroupKey', () => {
  it('maps missing and blank sections to other', () => {
    expect(shoppingSectionGroupKey(undefined)).toBe('other')
    expect(shoppingSectionGroupKey('  ')).toBe('other')
  })

  it('keeps explicit keys, including unknown ones', () => {
    expect(shoppingSectionGroupKey('produce')).toBe('produce')
    expect(shoppingSectionGroupKey('aisle-9')).toBe('aisle-9')
  })
})

describe('groceryListView', () => {
  const produce = item({ id: 'a', label: 'Apples', shoppingSection: 'produce' })
  const pantry = item({ id: 'b', label: 'Flour', shoppingSection: 'pantry' })
  const unsectioned = item({ id: 'c', label: 'Tape' })
  const checkedProduce = item({
    id: 'd',
    label: 'Bananas',
    shoppingSection: 'produce',
    checked: true,
  })
  const unknown = item({ id: 'e', label: 'Vitamin D', shoppingSection: 'pharmacy' })

  it('groups by starter order, unknown keys before Other, unsectioned under Other', () => {
    const view = groceryListView([unsectioned, pantry, unknown, produce], {
      hideChecked: false,
      grouped: true,
    })
    expect(view.mode).toBe('grouped')
    if (view.mode !== 'grouped') return
    expect(view.groups.map((group) => group.key)).toEqual([
      'produce',
      'pantry',
      'pharmacy',
      'other',
    ])
    expect(view.groups.at(-1)?.items.map((row) => row.id)).toEqual(['c'])
  })

  it('does not reorder by checked state', () => {
    const applesChecked = item({
      id: 'a',
      label: 'Apples',
      shoppingSection: 'produce',
      checked: true,
    })
    const flour = item({ id: 'b', label: 'Flour', shoppingSection: 'pantry' })
    const view = groceryListView([flour, applesChecked], {
      hideChecked: false,
      grouped: false,
    })
    expect(view.mode).toBe('flat')
    if (view.mode !== 'flat') return
    expect(view.items.map((row) => row.id)).toEqual(['a', 'b'])
  })

  it('hides checked items without regrouping the rest', () => {
    const view = groceryListView([produce, checkedProduce, pantry], {
      hideChecked: true,
      grouped: true,
    })
    expect(view.mode).toBe('grouped')
    if (view.mode !== 'grouped') return
    expect(view.groups.map((group) => group.key)).toEqual(['produce', 'pantry'])
    expect(view.groups[0]?.items.map((row) => row.id)).toEqual(['a'])
  })
})

describe('shoppingSectionSelectOptions', () => {
  it('includes an unrecognized current value so it can round-trip in the Select', () => {
    const values = shoppingSectionSelectOptions('aisle-9').map((option) => option.value)
    expect(values).toContain('aisle-9')
    expect(values).toContain('produce')
  })
})
