import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import faker from '@faker-js/faker/locale/en_GB'

import User from 'App/Models/User'

export default class UserSeeder extends BaseSeeder {
  public static developmentOnly = true

  public async run() {
    await User.createMany([
      {
        title: faker.name.prefix().replace('.', ''),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        houseNameOrNumber: faker.datatype.number(100).toString(),
        postcode: faker.address.zipCode(),
        mobileNumber: faker.phone.phoneNumber().replace(/ /g, ''),
        email: 'me@liam-potter.co.uk',
        emailVerified: true,
        password: 'testtest',
        additionalParentOrGuardian: false,
        giftAidConsented: true,
        stripeCustomerId: 'cus_JowxOgyfAvN1KV',
      },
      {
        title: faker.name.prefix().replace('.', ''),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        houseNameOrNumber: faker.datatype.number(100).toString(),
        postcode: faker.address.zipCode(),
        mobileNumber: faker.phone.phoneNumber().replace('/ /g', ''),
        email: 'suzannerobinson15@hotmail.com',
        emailVerified: true,
        password: 'testtest',
        additionalParentOrGuardian: true,
        alternateTitle: faker.name.prefix().replace('.', ''),
        alternateFirstName: faker.name.firstName(),
        alternateLastName: faker.name.lastName(),
        alternateHouseNameOrNumber: faker.datatype.number(100).toString(),
        alternatePostcode: faker.address.zipCode(),
        alternateMobileNumber: faker.phone.phoneNumber().replace('/ /g', ''),
        alternateEmail: 'me@liam-potter.co.uk',
        giftAidConsented: true,
        stripeCustomerId: 'cus_Jq8OIfitxenH39',
      },
    ])
  }
}
