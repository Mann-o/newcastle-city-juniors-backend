import { BaseCommand } from '@adonisjs/core/build/standalone'

export default class DbRefresh extends BaseCommand {
  public static commandName = 'db:refresh'

  public static description = 'Runs a full migration rollback, re-runs migrations and runs all seeders'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const { default: Database } = await import('@ioc:Adonis/Lucid/Database')

    let { batch } = await Database.from('adonis_schema').select('*').orderBy('id', 'desc').limit(1).first()

    if (batch) {

    }

    this.logger.info('Hello world!')
  }
}
