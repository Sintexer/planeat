import { Combobox, Loader, TextInput, useCombobox } from '@mantine/core'
import Fuse from 'fuse.js'
import { useMemo, useState } from 'react'
import type { IngredientService } from '../../application/ingredients/IngredientService'
import type { Ingredient } from '../../domain/ingredients/Ingredient'
import { linkOrCreateIngredient } from './IngredientCandidateModal'

type IngredientSearchEntry = {
  ingredient: Ingredient
  searchText: string
}

function buildSearchEntries(
  ingredients: Ingredient[],
  labelFor: (ingredient: Ingredient) => string,
): IngredientSearchEntry[] {
  return ingredients.map((ingredient) => {
    const parts = [
      ingredient.name,
      labelFor(ingredient),
      ...ingredient.aliases,
      ...(ingredient.localizedAliases ?? []).map((alias) => alias.text),
      ...(ingredient.preferredLabels ?? []).map((entry) => entry.label),
    ]
    return { ingredient, searchText: parts.join(' | ') }
  })
}

interface IngredientNameFieldProps {
  value: string
  ingredientId?: string
  onResolved: (result: { name: string; ingredientId?: string }) => void
  ingredients: Ingredient[]
  ingredientService: IngredientService
  labelFor: (ingredient: Ingredient) => string
  label?: string
  /**
   * When false (import review), blur/Enter must not create catalog rows.
   * Combobox picks still link; Create uses `createIngredientForName` only.
   */
  eagerResolve?: boolean
  /** Called before linking a combobox pick. Return false to abort. */
  confirmBeforeLink?: (ingredient: Ingredient, phrase: string) => Promise<boolean>
}

/**
 * Ingredient name entry as a browsable combobox: click/focus to see every
 * ingredient without typing, or type to fuzzy-filter by name and alias.
 * Selecting an option links immediately. Typing free text and pressing Enter
 * or leaving the field resolves it right away too — via the same
 * alias-aware/ambiguity-safe lookup used at save time — rather than waiting
 * until the recipe is saved. Fuzzy search only proposes candidates to look
 * at; the actual link/create decision always goes through
 * `IngredientService`, never through whichever fuzzy hit is highlighted.
 */
export function IngredientNameField({
  value,
  ingredientId,
  onResolved,
  ingredients,
  ingredientService,
  labelFor,
  label = 'Ingredient',
  eagerResolve = true,
  confirmBeforeLink,
}: IngredientNameFieldProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })
  const [resolving, setResolving] = useState(false)

  const entries = useMemo(() => buildSearchEntries(ingredients, labelFor), [ingredients, labelFor])

  const fuse = useMemo(() => new Fuse(entries, { keys: ['searchText'], threshold: 0.4 }), [entries])

  const query = value.trim()

  const visibleIngredients = useMemo(() => {
    if (!query) {
      return [...ingredients].sort((a, b) => labelFor(a).localeCompare(labelFor(b)))
    }
    return fuse
      .search(query)
      .slice(0, 8)
      .map((result) => result.item.ingredient)
  }, [query, ingredients, labelFor, fuse])

  const hasExactMatch = visibleIngredients.some(
    (ingredient) => labelFor(ingredient).toLowerCase() === query.toLowerCase(),
  )

  const resolve = async (rawName: string) => {
    const trimmed = rawName.trim()
    if (!trimmed || resolving) return
    setResolving(true)
    try {
      const ingredient = await linkOrCreateIngredient(ingredientService, trimmed, labelFor)
      if (ingredient) {
        onResolved({ name: labelFor(ingredient), ingredientId: ingredient.id })
      }
    } finally {
      setResolving(false)
    }
  }

  const selectIngredient = async (ingredient: Ingredient) => {
    combobox.closeDropdown()
    if (confirmBeforeLink) {
      const allowed = await confirmBeforeLink(ingredient, value.trim() || labelFor(ingredient))
      if (!allowed) return
    }
    onResolved({ name: labelFor(ingredient), ingredientId: ingredient.id })
  }

  const createFromQuery = async () => {
    const trimmed = value.trim()
    if (!trimmed || resolving) return
    setResolving(true)
    try {
      if (eagerResolve) {
        await resolve(trimmed)
        return
      }
      const created = await ingredientService.createIngredientForName(trimmed)
      if (created.ok) {
        onResolved({ name: created.ingredient.name, ingredientId: created.ingredient.id })
      }
    } finally {
      setResolving(false)
    }
  }

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(optionValue) => {
        if (optionValue === '__create__') {
          combobox.closeDropdown()
          void createFromQuery()
          return
        }
        const ingredient = ingredients.find((candidate) => candidate.id === optionValue)
        if (ingredient) void selectIngredient(ingredient)
      }}
    >
      <Combobox.Target>
        <TextInput
          flex={1}
          label={label}
          placeholder="e.g. chicken"
          value={value}
          rightSection={resolving ? <Loader size="xs" /> : <Combobox.Chevron />}
          onChange={(event) => {
            const next = event.currentTarget.value
            // Editing the text invalidates any previous resolution until confirmed again.
            onResolved({ name: next, ingredientId: next === value ? ingredientId : undefined })
            combobox.openDropdown()
            combobox.updateSelectedOptionIndex()
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !ingredientId && eagerResolve) {
              event.preventDefault()
              combobox.closeDropdown()
              void resolve(value)
            }
          }}
          onBlur={() => {
            combobox.closeDropdown()
            if (eagerResolve && !ingredientId && value.trim()) void resolve(value)
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options mah={240} style={{ overflowY: 'auto' }}>
          {visibleIngredients.length === 0 && !query && (
            <Combobox.Empty>No ingredients yet — type a name to create one.</Combobox.Empty>
          )}
          {visibleIngredients.map((ingredient) => (
            <Combobox.Option value={ingredient.id} key={ingredient.id}>
              {labelFor(ingredient)}
            </Combobox.Option>
          ))}
          {query && !hasExactMatch && (
            <Combobox.Option value="__create__">Create new ingredient “{query}”</Combobox.Option>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
