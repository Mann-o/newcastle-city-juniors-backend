// @ts-nocheck
import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Env from '@ioc:Adonis/Core/Env'
import Stripe from 'stripe'
import { faker } from '@faker-js/faker'
import { DateTime } from 'luxon'

import User from 'App/Models/User'

export default class ParentSeeder extends BaseSeeder {
  public static developmentOnly = true

  public async run() {
    const user1 = await User.findOrFail(1)

    await user1.related('parents').createMany([
      {
        title: faker.helpers.arrayElement(['mr', 'mrs', 'miss', 'ms']),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        dateOfBirth: DateTime.fromISO('1988-07-02'),
        email: faker.internet.email(),
        addressLineOne: faker.address.streetAddress(false),
        postalCode: faker.address.zipCode(),
        mobileNumber: faker.phone.number('07#########'),
        acceptedCodeOfConduct: true,
      },
      {
        title: 'other',
        otherTitle: faker.name.prefix(),
        firstName: faker.name.firstName(),
        middleNames: faker.name.firstName(),
        lastName: faker.name.lastName(),
        dateOfBirth: DateTime.fromISO('1987-03-27'),
        email: faker.internet.email(),
        addressLineOne: faker.address.streetAddress(false),
        postalCode: faker.address.zipCode(),
        mobileNumber: faker.phone.number('07#########'),
        acceptedCodeOfConduct: true,
      },
    ])
  }
}
