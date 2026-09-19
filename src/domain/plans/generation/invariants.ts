import { recipeExcludeReasons, simpleFoodExcludeReasons } from './constraints'
import {
  mergeGenerationSearchBudget,
  type GeneratedComponent,
  type GenerationInput,
  type WeekGenerationProposal,
} from './proposal'
import { validateProposalAgainstLive } from './proposalValidation'
import { emptyWeekObjective } from './scoring'
import { weekObjectiveForAssignments } from './search'

const ALLOWED_UNFILLED = new Set(['no-eligible-candidates', 'search-incomplete'])

export function proposalIdentity(proposal: WeekGenerationProposal): string {
  return JSON.stringify({
    assignments: proposal.assignments.map((row) => ({
      slotId: row.slotId,
      source: row.source,
      components: row.components.map(componentIdentity),
    })),
    unfilled: proposal.unfilled.map((row) => ({
      slotId: row.slotId,
      reason: row.reason,
    })),
  })
}

function componentIdentity(component: GeneratedComponent) {
  if (component.type === 'recipe') {
    return {
      type: component.type,
      recipeId: component.recipeId,
      output: component.outputQuantity,
      allocated: component.allocatedQuantity,
      proposedEventId: component.proposedEventId,
    }
  }
  if (component.type === 'simple-food') {
    return {
      type: component.type,
      simpleFoodId: component.simpleFoodId,
      allocated: component.allocatedQuantity,
    }
  }
  return {
    type: component.type,
    cookingEventId: component.cookingEventId,
    proposedEventId: component.proposedEventId,
    allocated: component.allocatedQuantity,
  }
}

export function generationInvariantIssues(
  input: GenerationInput,
  proposal: WeekGenerationProposal,
): string[] {
  const issues: string[] = []
  const requested = new Set(input.requestedSlots.map((row) => row.slot.id))
  const assigned = proposal.assignments.map((row) => row.slotId)
  const unfilled = proposal.unfilled.map((row) => row.slotId)
  const seen = new Set<string>()
  for (const slotId of [...assigned, ...unfilled]) {
    if (!requested.has(slotId)) issues.push(`extra-slot:${slotId}`)
    if (seen.has(slotId)) issues.push(`duplicate-slot:${slotId}`)
    seen.add(slotId)
  }
  for (const slotId of requested) {
    if (!seen.has(slotId)) issues.push(`missing-slot:${slotId}`)
  }

  if (proposal.assignments.length < emptyWeekObjective().coverage) {
    issues.push('coverage-worse-than-empty')
  }
  const reconstructed = weekObjectiveForAssignments(input, proposal.assignments)
  if (reconstructed.coverage > proposal.assignments.length) {
    issues.push('coverage-exceeds-assignments')
  }

  const liveIssue = validateProposalAgainstLive(proposal, input)
  if (liveIssue) issues.push(`live:${liveIssue}`)

  const excluded = new Set(input.policy.excludedRecipeIds)
  const recipes = new Map(input.recipes.map((recipe) => [recipe.id, recipe]))
  const foods = new Map((input.simpleFoods ?? []).map((food) => [food.id, food]))
  for (const assignment of proposal.assignments) {
    for (const component of assignment.components) {
      if (component.type === 'recipe') {
        if (excluded.has(component.recipeId)) issues.push(`excluded-recipe:${component.recipeId}`)
        const recipe = recipes.get(component.recipeId)
        if (recipe) {
          const reasons = recipeExcludeReasons(recipe, input.policy)
          for (const reason of reasons)
            issues.push(`recipe-exclude:${component.recipeId}:${reason}`)
        }
      } else if (component.type === 'simple-food') {
        const food = foods.get(component.simpleFoodId)
        if (food) {
          const reasons = simpleFoodExcludeReasons(food, input.policy)
          for (const reason of reasons)
            issues.push(`food-exclude:${component.simpleFoodId}:${reason}`)
        }
      } else {
        if (excluded.has(component.recipeId)) issues.push(`excluded-leftover:${component.recipeId}`)
        const recipe = recipes.get(component.recipeId) ?? leftoverRecipe(input, component.recipeId)
        if (recipe) {
          const reasons = recipeExcludeReasons(recipe, input.policy)
          for (const reason of reasons) {
            issues.push(`leftover-exclude:${component.recipeId}:${reason}`)
          }
        }
      }
    }
  }

  const budget = mergeGenerationSearchBudget(input.searchBudget)
  if (proposal.expansionsUsed > budget.expansionBudget) {
    issues.push(`over-budget:${proposal.expansionsUsed}>${budget.expansionBudget}`)
  }

  for (const row of proposal.unfilled) {
    if (!ALLOWED_UNFILLED.has(row.reason)) issues.push(`bad-unfilled:${row.reason}`)
  }

  return issues
}

function leftoverRecipe(input: GenerationInput, recipeId: string) {
  return input.cookingEvents?.find((event) => event.recipeId === recipeId)?.recipe
}
