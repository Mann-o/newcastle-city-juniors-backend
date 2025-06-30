import { BaseCommand } from '@adonisjs/core/build/standalone'
import StripeTransactionService from 'App/Services/StripeTransactionService'

export default class SyncStripeData extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'sync:stripe'

  /**
   * Command description is displayed in the "help" output
   */
  public static description = 'Sync historical Stripe data to local database for fast queries'

  public static settings = {
    /**
     * Set the following value to true, if you want to load the application
     * before running the command. Don't forget to call `node ace generate:manifest`
     * afterwards.
     */
    loadApp: true,

    /**
     * Set the following value to true, if you want this command to keep running until
     * you manually decide to exit the process. Don't forget to call
     * `node ace generate:manifest` afterwards.
     */
    stayAlive: false,
  }

  public async run() {
    this.logger.info('Starting Stripe data synchronization...')

    try {
      const stripeTransactionService = new StripeTransactionService()

      this.logger.info('Syncing historical subscriptions...')
      await stripeTransactionService.syncHistoricalSubscriptions()

      this.logger.info('Syncing historical payments...')
      await stripeTransactionService.syncHistoricalPayments()

      this.logger.success('Stripe data synchronization completed successfully!')
    } catch (error) {
      this.logger.error('Failed to sync Stripe data:', error.message)
      process.exit(1)
    }
  }
}
