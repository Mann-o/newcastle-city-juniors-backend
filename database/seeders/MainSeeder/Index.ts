import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Application from '@ioc:Adonis/Core/Application'

export default class IndexSeeder extends BaseSeeder {
  private async runSeeder(seeder: { default: typeof BaseSeeder }) {
    if (seeder.default.developmentOnly && !Application.inDev) {
      return
    }

    await new seeder.default(this.client).run()
  }

  public async run() {
    await this.runSeeder(await import('../Users'))
    await this.runSeeder(await import('../Permissions'))
    await this.runSeeder(await import('../UserPermissions'))
    await this.runSeeder(await import('../Parents'))
    await this.runSeeder(await import('../Players'))
  }
}
