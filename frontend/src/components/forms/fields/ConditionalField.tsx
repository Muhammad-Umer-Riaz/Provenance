import type { ReactNode } from 'react'

interface Props {
  condition: string | undefined
  watchValues: Partial<Record<string, unknown>>
  children: ReactNode
}

function evaluateCondition(condition: string, values: Partial<Record<string, unknown>>): boolean {
  const neqMatch = condition.match(/^(\w+)\s*!=\s*'([^']*)'$/)
  if (neqMatch) {
    const v = values[neqMatch[1]]
    if (v === undefined || v === null || v === '') return false
    return v !== neqMatch[2]
  }

  const eqMatch = condition.match(/^(\w+)\s*===?\s*'([^']*)'$/)
  if (eqMatch) {
    const v = values[eqMatch[1]]
    if (v === undefined || v === null || v === '') return false
    return v === eqMatch[2]
  }

  return true
}

export function ConditionalField({ condition, watchValues, children }: Props) {
  if (!condition) return <>{children}</>
  if (!evaluateCondition(condition, watchValues)) return null
  return <>{children}</>
}
