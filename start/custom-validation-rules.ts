import { validator } from '@ioc:Adonis/Core/Validator'
import { exists, getFieldValue, resolveAbsoluteName } from '@adonisjs/validator/build/src/Validator/helpers'

validator.rule('fieldMatch', (value: string, options: object, { errorReporter, pointer, arrayExpressionPointer, root, tip }) => {
  const { comparisonFieldName } = options[0]

  if (!exists(value) || typeof value !== 'string' || typeof comparisonFieldName !== 'string') {
    return
  }

  // eslint-disable-next-line eqeqeq
  if (getFieldValue(comparisonFieldName, root, tip) != value) {
    errorReporter.report(
      resolveAbsoluteName(comparisonFieldName, pointer),
      'fieldMatch',
      'fieldMatch validation failed',
      arrayExpressionPointer,
    )
  }
})

validator.rule('fieldNotMatch', (value: string, options: object, { errorReporter, pointer, arrayExpressionPointer, root, tip }) => {
  const { comparisonFieldName } = options[0]

  if (!exists(value) || typeof value !== 'string' || typeof comparisonFieldName !== 'string') {
    return
  }

  // eslint-disable-next-line eqeqeq
  if (getFieldValue(comparisonFieldName, root, tip) == value) {
    errorReporter.report(
      resolveAbsoluteName(comparisonFieldName, pointer),
      'fieldNotMatch',
      'fieldNotMatch validation failed',
      arrayExpressionPointer,
    )
  }
})

validator.rule('isTrue', (value: boolean, {}, { errorReporter, pointer, arrayExpressionPointer }) => {
  if (!exists(value) || typeof value !== 'boolean') {
    return
  }

  if (value !== true) {
    errorReporter.report(pointer, 'isTrue', 'isTrue validation failed', arrayExpressionPointer)
  }
})
