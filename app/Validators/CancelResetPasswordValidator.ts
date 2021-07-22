import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class CancelResetPasswordValidator {
  public schema = schema.create({
    email: schema.string({ escape: true, trim: true }, [rules.email({ sanitize: true }), rules.maxLength(255)]),
    resetToken: schema.string({}, [rules.maxLength(255)]),
  })

  public messages = {
    'email.string': `Field '{{ field }}' must be a string`,
    'email.required': `Field '{{ field }}' is required`,
    'email.email': `Field '{{ field }}' must be a valid email address`,
    'email.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'resetToken.string': `Field '{{ field }}' must be a string`,
    'resetToken.required': `Field '{{ field }}' is required`,
    'resetToken.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
  }
}
