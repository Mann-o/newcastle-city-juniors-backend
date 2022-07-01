// @ts-nocheck
import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Env from '@ioc:Adonis/Core/Env'
import Stripe from 'stripe'
import { faker } from '@faker-js/faker'
import { DateTime } from 'luxon'

import User from 'App/Models/User'

export default class PlayerSeeder extends BaseSeeder {
  public static developmentOnly = true

  public async run() {
    const user1 = await User.findOrFail(1)

    await user1.related('players').createMany([
      {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        dateOfBirth: DateTime.fromISO('2010-07-27'),
        sex: 'female',
        membershipFeeOption: 'upfront',
      },
      {
        firstName: faker.name.firstName(),
        middleNames: faker.name.firstName(),
        lastName: faker.name.lastName(),
        dateOfBirth: DateTime.fromISO('2013-03-16'),
        sex: 'female',
        membershipFeeOption: 'subscription',
      },
    ])
  }
}
