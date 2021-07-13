declare module '@ioc:Adonis/Core/Validator' {
  import { Rule } from '@ioc:Adonis/Core/Validator'

  interface ComparisonOptionsObject {
    comparisonFieldName: string
  }

  export interface Rules {
    fieldMatch(options: ComparisonOptionsObject): Rule
    fieldNotMatch(options: ComparisonOptionsObject): Rule
    isTrue(): Rule
  }
}
