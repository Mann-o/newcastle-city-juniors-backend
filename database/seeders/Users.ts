import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'

import User from 'App/Models/User'

export default class UserSeeder extends BaseSeeder {
  public static developmentOnly = true

  public async run() {
    await User.create({
      email: 'me@liam-potter.co.uk',
      emailVerified: true,
      password: 'testtest',
      stripeCustomerId: 'cus_JowxOgyfAvN1KV',
    })
  }
}
