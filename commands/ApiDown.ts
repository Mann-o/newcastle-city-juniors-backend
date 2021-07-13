import { BaseCommand } from '@adonisjs/core/build/standalone'
import fs from 'fs'

export default class ApiUp extends BaseCommand {
  public static commandName = 'api:down'

  public static description = 'Puts the NCJ API into maintenance mode'

  public static settings = {
    loadApp: false,
    stayAlive: false,
  }

  public async run() {
    if (fs.existsSync('./.downfile')) {
      this.logger.info('NCJ API is already in maintenance mode!')
    } else {
      fs.writeFileSync('./.downfile', '')
      this.logger.info('NCJ API is now in maintenance mode')
    }
  }
}
