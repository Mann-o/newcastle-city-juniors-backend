// @ts-nocheck
import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Env from '@ioc:Adonis/Core/Env'
import Stripe from 'stripe'
import faker from 'faker/locale/en_GB'
import { DateTime } from 'luxon'

import User from 'App/Models/User'

export default class PlayerSeeder extends BaseSeeder {
  public static developmentOnly = true

  public async run() {
    const user1 = await User.findOrFail(1)
    const user2 = await User.findOrFail(2)

    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: '2020-08-27',
    })

    const paymentIntentUpfront1 = await stripeClient.paymentIntents.create({
      amount: 30000,
      currency: 'gbp',
      customer: user1.stripeCustomerId,
    })

    const paymentIntentUpfront2 = await stripeClient.paymentIntents.create({
      amount: 30000,
      currency: 'gbp',
      customer: user2.stripeCustomerId,
    })

    const paymentIntentSubscription = await stripeClient.paymentIntents.create({
      amount: 5700,
      currency: 'gbp',
      customer: user2.stripeCustomerId,
    })

    await user1.related('players').create({
      fullName: `${faker.name.firstName()} ${faker.name.lastName()}`,
      dateOfBirth: DateTime.fromISO('2013-03-16'),
      sex: faker.helpers.randomize(['male', 'female']),
      teamId: 8,
      membershipFeeOption: 'upfront',
      stripePaymentIntentId: paymentIntentUpfront1.id,
    })

    await user2.related('players').createMany([
      {
        fullName: `${faker.name.firstName()} ${faker.name.lastName()}`,
        dateOfBirth: DateTime.fromISO('2010-07-27'),
        sex: faker.helpers.randomize(['male', 'female']),
        teamId: 17,
        membershipFeeOption: 'upfront',
        stripePaymentIntentId: paymentIntentUpfront2.id,
      },
      {
        fullName: `${faker.name.firstName()} ${faker.name.lastName()}`,
        dateOfBirth: DateTime.fromISO('2013-03-16'),
        sex: faker.helpers.randomize(['male', 'female']),
        teamId: 8,
        medicalConditions: 'Allergic to Pineapple',
        membershipFeeOption: 'subscription',
        stripePaymentIntentId: paymentIntentSubscription.id,
      },
    ])
  }
}
