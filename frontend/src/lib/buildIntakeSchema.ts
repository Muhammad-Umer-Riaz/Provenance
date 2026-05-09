import { z } from 'zod'
import type { IntakeFieldSchema } from '@/types/template'

function buildFieldValidator(schema: IntakeFieldSchema): z.ZodTypeAny {
  const { type, required, validation, columns } = schema

  let base: z.ZodTypeAny

  switch (type) {
    case 'string':
      base = required ? z.string().min(1, 'Required') : z.string()
      break

    case 'number': {
      let n = z.number()
      if (validation?.min !== undefined) n = n.min(validation.min, `Min ${validation.min}`)
      if (validation?.max !== undefined) n = n.max(validation.max, `Max ${validation.max}`)
      base = n
      break
    }

    case 'integer': {
      let i = z.number().int('Must be a whole number')
      if (validation?.min !== undefined) i = i.min(validation.min, `Min ${validation.min}`)
      if (validation?.max !== undefined) i = i.max(validation.max, `Max ${validation.max}`)
      base = i
      break
    }

    case 'enum':
      base = required
        ? z.string({ required_error: 'Required', invalid_type_error: 'Required' }).min(1, 'Required')
        : z.string().optional()
      break

    case 'multi_enum':
      base = z.array(z.string())
      break

    case 'date':
      base = z.string()
      break

    case 'table': {
      if (!columns) { base = z.array(z.record(z.string(), z.unknown())); break }
      const rowShape: Record<string, z.ZodTypeAny> = {}
      for (const col of columns) {
        let cv: z.ZodTypeAny
        switch (col.type) {
          case 'integer': {
            let ci = z.number().int()
            if (col.validation?.min !== undefined) ci = ci.min(col.validation.min)
            if (col.validation?.max !== undefined) ci = ci.max(col.validation.max)
            cv = col.required === false ? ci.optional() : ci
            break
          }
          case 'number': {
            let cn = z.number()
            if (col.validation?.min !== undefined) cn = cn.min(col.validation.min)
            if (col.validation?.max !== undefined) cn = cn.max(col.validation.max)
            cv = col.required === false ? cn.optional() : cn
            break
          }
          case 'enum':
            cv = col.required === false ? z.string().optional() : z.string()
            break
          case 'date':
            cv = col.required === false ? z.string().optional() : z.string()
            break
          default:
            cv = col.required === false ? z.string().optional() : z.string().min(1, 'Required')
        }
        rowShape[col.name] = cv
      }
      base = z.array(z.object(rowShape))
      break
    }

    default:
      base = z.unknown()
  }

  if (!required && type !== 'multi_enum' && type !== 'table') {
    return base.optional()
  }
  return base
}

export function buildStepSchema(
  intake: Record<string, IntakeFieldSchema>,
  fieldNames: string[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const name of fieldNames) {
    if (intake[name]) {
      shape[name] = buildFieldValidator(intake[name])
    }
  }
  return z.object(shape)
}
