import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'

import Permission from 'App/Models/Permission'

export default class PermissionSeeder extends BaseSeeder {
  public static developmentOnly = true

  public async run() {
    await Permission.createMany([
      { name: 'sudo' },
      { name: 'view_billing' },
      { name: 'view_parents' },
      { name: 'view_players' },
    ])
  }
}
