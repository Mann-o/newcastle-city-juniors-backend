import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'

import User from 'App/Models/User'
import Permission from 'App/Models/Permission'

export default class UserPermissionSeeder extends BaseSeeder {
  public static developmentOnly = true

  public async run() {
    const user = await User.findOrFail(1)
    const permission = await Permission.findOrFail(1)

    await user.related('permissions').attach([permission.id])
  }
}
