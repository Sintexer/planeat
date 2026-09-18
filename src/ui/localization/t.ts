import type { UiLocale } from '../../domain/shared/Locale'
import { enMessages, type MessageId } from './messages'
import { enPlurals, type PluralCategory, type PluralId } from './plurals'
import { ruMessages, ruPlurals } from './ru'

export type MessageVars = Record<string, string | number>

const catalogs: Record<string, Record<MessageId, string>> = {
  en: enMessages,
  ru: ruMessages,
}

const pluralCatalogs: Record<string, Record<PluralId, Record<string, string>>> = {
  en: enPlurals,
  ru: ruPlurals,
}

export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key]),
  )
}

function templateFor(locale: string, id: MessageId): string {
  return catalogs[locale]?.[id] ?? enMessages[id]
}

export function t(locale: string, id: MessageId, vars?: MessageVars): string {
  return interpolate(templateFor(locale, id), vars)
}

function pluralCategory(locale: string, count: number): PluralCategory {
  const bcp47 = locale === 'en' ? 'en' : locale
  const category = new Intl.PluralRules(bcp47).select(count)
  return category as PluralCategory
}

export function tPlural(locale: string, id: PluralId, count: number, vars?: MessageVars): string {
  const category = pluralCategory(locale, count)
  const forms = pluralCatalogs[locale]?.[id] ?? enPlurals[id]
  const template = (forms[category] as string | undefined) ?? forms.other
  return interpolate(template, { count, ...vars })
}

export type Translate = (id: MessageId, vars?: MessageVars) => string
export type TranslatePlural = (id: PluralId, count: number, vars?: MessageVars) => string

export function bindT(locale: UiLocale | string): Translate {
  return (id, vars) => t(locale, id, vars)
}

export function bindTPlural(locale: UiLocale | string): TranslatePlural {
  return (id, count, vars) => tPlural(locale, id, count, vars)
}

export type { MessageId, PluralId }
