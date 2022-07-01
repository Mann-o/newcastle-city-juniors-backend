import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class CreateUserValidator {
  public schema = schema.create({
    email: schema.string({ escape: true, trim: true }, [
      rules.email(),
      rules.maxLength(255),
      rules.unique({ table: 'users', column: 'email', caseInsensitive: true }),
    ]),
    password: schema.string({}, [
      rules.minLength(8),
      rules.maxLength(255),
      rules.confirmed('passwordConfirmation'),
    ]),
  })

  public messages = {
    'email.string': `Field '{{ field }}' must be a string`,
    'email.required': `Field '{{ field }}' is required`,
    'email.email': `Field '{{ field }}' must be a valid email address`,
    'email.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'email.unique': `Field '{{ field }}' value is already in use`,
    'password.string': `Field '{{ field }}' must be a string`,
    'password.required': `Field '{{ field }}' is required`,
    'password.minLength': `Field '{{ field }}' must be at least 8 characters`,
    'password.maxLength': `Field '{{ field }}' must be no more than 50 characters`,
    'password.confirmed': `Field '{{ field }}' must match field '{{ field }}Confirmation'`,
  }
}
