import { BaseCommand } from '@adonisjs/core/build/standalone'
import fs from 'fs'

export default class ApiUp extends BaseCommand {
  public static commandName = 'api:up'

  public static description = 'Takes the NCJ API out of maintenance mode'

  public static settings = {
    loadApp: false,
    stayAlive: false,
  }

  public async run() {
    if (!fs.existsSync('./.downfile')) {
      this.logger.info('NCJ API is already out of maintenance mode!')
    } else {
      fs.unlinkSync('./.downfile')
      this.logger.info('NCJ API is now out of maintenance mode')
    }
  }
}
