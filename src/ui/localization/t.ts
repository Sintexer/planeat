import type { UiLocale } from '../../domain/shared/Locale'
import { enMessages, type MessageId } from './messages'

const catalogs: Record<UiLocale, Record<MessageId, string>> = {
  en: enMessages,
}

export function t(locale: UiLocale, id: MessageId): string {
  return catalogs[locale][id] ?? enMessages[id]
}

export type { MessageId }
