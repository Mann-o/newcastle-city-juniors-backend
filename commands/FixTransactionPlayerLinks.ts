import { BaseCommand } from '@adonisjs/core/build/standalone'
import StripeTransaction from 'App/Models/StripeTransaction'
import Player from 'App/Models/Player'
import Database from '@ioc:Adonis/Lucid/Database'

export default class FixTransactionPlayerLinks extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'fix:transaction-player-links'

  /**
   * Command description is displayed in the "help" output
   */
  public static description = 'Fix existing transactions missing player ID links and players missing Stripe ID fields'

  public static settings = {
    /**
     * Set the following value to true, if you want to load the application
     * before running the command
     */
    loadApp: true,

    /**
     * Set the following value to true, if you want this command to keep running until
     * you manually decide to exit the process
     */
    stayAlive: false,
  }

  public async run() {
    this.logger.info('Finding transactions missing player links...')

    try {
      // Find transactions that are missing player IDs but have metadata that could link them
      this.logger.info('Querying for orphaned transactions...')
      const orphanedTransactions = await Database
        .from('stripe_transactions')
        .select('id', 'stripe_id', 'type')
        .whereNull('player_id')

      this.logger.info(`Found ${orphanedTransactions.length} transactions without player links`)

      let fixedCount = 0

      for (const transaction of orphanedTransactions) {
        let playerFound = false

        // Try to find player by subscription ID
        if (transaction.type === 'subscription' && transaction.stripe_id) {
          const playerWithSubscription = await Player.query()
            .where('stripe_subscription_id', transaction.stripe_id)
            .first()

          if (playerWithSubscription) {
            await Database
              .from('stripe_transactions')
              .where('id', transaction.id)
              .update({ player_id: playerWithSubscription.id })

            this.logger.info(`✓ Linked subscription transaction ${transaction.stripe_id} to player ${playerWithSubscription.id}`)
            fixedCount++
            playerFound = true
          }
        }

        // Try to find player by payment intent IDs
        if (!playerFound && transaction.type === 'upfront_payment' && transaction.stripe_id) {
          const playerWithPayment = await Player.query()
            .where('stripe_upfront_payment_id', transaction.stripe_id)
            .first()

          if (playerWithPayment) {
            await Database
              .from('stripe_transactions')
              .where('id', transaction.id)
              .update({ player_id: playerWithPayment.id })

            this.logger.info(`✓ Linked upfront payment transaction ${transaction.stripe_id} to player ${playerWithPayment.id}`)
            fixedCount++
            playerFound = true
          }
        }

        if (!playerFound && transaction.type === 'registration_fee' && transaction.stripe_id) {
          const playerWithRegFee = await Player.query()
            .where('stripe_registration_fee_id', transaction.stripe_id)
            .first()

          if (playerWithRegFee) {
            await Database
              .from('stripe_transactions')
              .where('id', transaction.id)
              .update({ player_id: playerWithRegFee.id })

            this.logger.info(`✓ Linked registration fee transaction ${transaction.stripe_id} to player ${playerWithRegFee.id}`)
            fixedCount++
            playerFound = true
          }
        }

        if (!playerFound) {
          this.logger.info(`  Could not link transaction ${transaction.stripe_id} (type: ${transaction.type})`)
        }
      }

      this.logger.success(`Fixed ${fixedCount} out of ${orphanedTransactions.length} orphaned transactions`)

      // Also fix players that might be missing their Stripe ID fields
      this.logger.info('Checking for players missing Stripe ID fields...')

      let playerFixedCount = 0

      // Find players missing stripe IDs but have associated transactions
      const playersWithMissingIds = await Player.query()
        .where((query) => {
          query.whereNull('stripe_subscription_id')
            .orWhereNull('stripe_upfront_payment_id')
            .orWhereNull('stripe_registration_fee_id')
        })

      this.logger.info(`Found ${playersWithMissingIds.length} players with missing Stripe ID fields`)

      for (const player of playersWithMissingIds) {
        let updated = false

        // Find subscription transaction for this player
        if (!player.stripeSubscriptionId) {
          const subscriptionTransaction = await StripeTransaction.query()
            .where('player_id', player.id)
            .where('type', 'subscription')
            .first()

          if (subscriptionTransaction) {
            player.stripeSubscriptionId = subscriptionTransaction.stripeId
            updated = true
            this.logger.info(`✓ Set stripeSubscriptionId for player ${player.id}`)
          }
        }

        // Find upfront payment transaction for this player
        if (!player.stripeUpfrontPaymentId) {
          const upfrontTransaction = await StripeTransaction.query()
            .where('player_id', player.id)
            .where('type', 'upfront_payment')
            .first()

          if (upfrontTransaction) {
            player.stripeUpfrontPaymentId = upfrontTransaction.stripeId
            updated = true
            this.logger.info(`✓ Set stripeUpfrontPaymentId for player ${player.id}`)
          }
        }

        // Find registration fee transaction for this player
        if (!player.stripeRegistrationFeeId) {
          const regFeeTransaction = await StripeTransaction.query()
            .where('player_id', player.id)
            .where('type', 'registration_fee')
            .first()

          if (regFeeTransaction) {
            player.stripeRegistrationFeeId = regFeeTransaction.stripeId
            updated = true
            this.logger.info(`✓ Set stripeRegistrationFeeId for player ${player.id}`)
          }
        }

        if (updated) {
          await player.save()
          playerFixedCount++
        }
      }

      this.logger.success(`Fixed Stripe ID fields for ${playerFixedCount} players`)

    } catch (error) {
      this.logger.error('Failed to fix transaction player links:', error.message)
      process.exit(1)
    }
  }
}
