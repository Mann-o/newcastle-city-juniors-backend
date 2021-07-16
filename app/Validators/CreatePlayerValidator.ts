import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class CreatePlayerValidator {
  public schema = schema.create({
    fullName: schema.string({ escape: true, trim: true }, [rules.alpha({ allow: ['space', 'dash'] }), rules.maxLength(255)]),
    dateOfBirth: schema.date({ format: 'yyyy-MM-dd' }),
    sex: schema.enum(['male', 'female'] as const),
    ageGroupId: schema.number(),
    membershipFeeOption: schema.enum(['upfront', 'subscription']),
    acceptedPlayerCodeOfConduct: schema.boolean([rules.isTrue()]),
    acceptedParentCodeOfConduct: schema.boolean([rules.isTrue()]),
    acceptedDeclaration: schema.boolean([rules.isTrue()]),
  })

  public messages = {
    'fullName.string': `Field '{{ field }}' must be a string`,
    'fullName.required': `Field '{{ field }}' is required`,
    'fullName.alpha': `Field '{{ field }}' must have a-z characters only`,
    'fullName.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'dateOfBirth.date': `Field '{{ field }}' must be a date in the format 'yyyy-mm-dd'`,
    'sex.enum': `Field '{{ field }}' must be 'male' or 'female'`,
    'ageGroupId.number': `Field '{{ field }}' must be a number`,
    'membershipFeeOption.enum': `Field '{{ field }} must be 'upfront' or 'subscription'`,
    'acceptedPlayerCodeOfConduct.boolean': `Field '{{ field }}' must be a boolean`,
    'acceptedPlayerCodeOfConduct.isTrue': `Field '{{ field }}' must be true`,
    'acceptedParentCodeOfConduct.boolean': `Field '{{ field }}' must be a boolean`,
    'acceptedParentCodeOfConduct.isTrue': `Field '{{ field }}' must be true`,
    'acceptedDeclaration.boolean': `Field '{{ field }}' must be a boolean`,
    'acceptedDeclaration.isTrue': `Field '{{ field }}' must be true`,
  }
}
