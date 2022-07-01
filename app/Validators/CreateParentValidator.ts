import { schema, rules } from '@ioc:Adonis/Core/Validator'

export default class CreateParentValidator {
  public schema = schema.create({
    title: schema.string({ escape: true, trim: true }, [rules.maxLength(255)]),
    otherTitle: schema.string.nullableAndOptional({ escape: true, trim: true }, [
      rules.requiredWhen('title', '=', 'other'),
      rules.maxLength(255),
    ]),
    firstName: schema.string({ escape: true, trim: true }, [rules.maxLength(255)]),
    middleNames: schema.string.optional({ escape: true, trim: true }, [rules.maxLength(255)]),
    lastName: schema.string({ escape: true, trim: true }, [rules.maxLength(255)]),
    dateOfBirth: schema.date({ format: 'yyyy-MM-dd' }),
    email: schema.string({ escape: true, trim: true }, [
      rules.email(),
      rules.maxLength(255),
      rules.unique({ table: 'parents', column: 'email', caseInsensitive: true }),
    ]),
    addressLineOne: schema.string({ escape: true, trim: true }, [rules.maxLength(255)]),
    addressLineTwo: schema.string.nullableAndOptional({ escape: true, trim: true }, [rules.maxLength(255)]),
    addressLineThree: schema.string.nullableAndOptional({ escape: true, trim: true }, [rules.maxLength(255)]),
    addressLineFour: schema.string.nullableAndOptional({ escape: true, trim: true }, [rules.maxLength(255)]),
    addressLineFive: schema.string.nullableAndOptional({ escape: true, trim: true }, [rules.maxLength(255)]),
    postalCode: schema.string({ escape: true, trim: true }, [rules.maxLength(255)]),
    mobileNumber: schema.string({ escape: true, trim: true }, [rules.maxLength(255)]),
    acceptedCodeOfConduct: schema.boolean([rules.isTrue()]),
  })

  public messages = {
    'title.string': `Field '{{ field }}' must be a string`,
    'title.required': `Field '{{ field }}' is required`,
    'title.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'otherTitle.string': `Field '{{ field }}' must be a string`,
    'otherTitle.requiredWhen': `Field '{{ field }}' is required when {{ otherField }} is 'Other'`,
    'otherTitle.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'firstName.string': `Field '{{ field }}' must be a string`,
    'firstName.required': `Field '{{ field }}' is required`,
    'firstName.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'middleNames.string': `Field '{{ field }}' must be a string`,
    'middleNames.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'lastName.string': `Field '{{ field }}' must be a string`,
    'lastName.required': `Field '{{ field }}' is required`,
    'lastName.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'dateOfBirth.date': `Field '{{ field }}' must be a date in the format 'yyyy-mm-dd'`,
    'dateOfBirth.required': `Field '{{ field }}' is required`,
    'email.string': `Field '{{ field }}' must be a string`,
    'email.required': `Field '{{ field }}' is required`,
    'email.email': `Field '{{ field }}' must be a valid email address`,
    'email.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'email.unique': `Field '{{ field }}' value is already in use`,
    'addressLineOne.string': `Field '{{ field }}' must be a string`,
    'addressLineOne.required': `Field '{{ field }}' is required`,
    'addressLineOne.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'addressLineTwo.string': `Field '{{ field }}' must be a string`,
    'addressLineTwo.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'addressLineThree.string': `Field '{{ field }}' must be a string`,
    'addressLineThree.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'addressLineFour.string': `Field '{{ field }}' must be a string`,
    'addressLineFour.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'addressLineFive.string': `Field '{{ field }}' must be a string`,
    'addressLineFive.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'postalCode.string': `Field '{{ field }}' must be a string`,
    'postalCode.required': `Field '{{ field }}' is required`,
    'postalCode.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'mobileNumber.string': `Field '{{ field }}' must be a string`,
    'mobileNumber.required': `Field '{{ field }}' is required`,
    'mobileNumber.maxLength': `Field '{{ field }}' must be a maximum of 255 characters`,
    'acceptedCodeOfConduct.boolean': `Field '{{ field }}' must be a boolean`,
    'acceptedCodeOfConduct.isTrue': `Field '{{ field }}' must be ticked`,
  }
}
