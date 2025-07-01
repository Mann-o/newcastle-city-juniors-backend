import { BaseCommand } from '@adonisjs/core/build/standalone'
import Database from '@ioc:Adonis/Lucid/Database'

export default class FixMetadata extends BaseCommand {
  public static commandName = 'fix:metadata'
  public static description = 'Fix corrupted metadata in stripe_transactions table'
  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    this.logger.info('Fixing corrupted metadata in stripe_transactions table...')

    try {
      // Get all transactions with problematic metadata
      const transactions = await Database
        .from('stripe_transactions')
        .select('id', 'stripe_id', 'metadata')

      this.logger.info(`Found ${transactions.length} transactions to check`)

      let fixedCount = 0

      for (const transaction of transactions) {
        let needsUpdate = false
        let newMetadata = '{}'

        // Check if metadata is problematic
        if (!transaction.metadata) {
          newMetadata = '{}'
          needsUpdate = true
        } else if (typeof transaction.metadata === 'string') {
          if (transaction.metadata === '[object Object]' ||
              transaction.metadata.includes('[object Object]') ||
              transaction.metadata === 'null' ||
              transaction.metadata === 'undefined') {
            newMetadata = '{}'
            needsUpdate = true
          } else {
            // Try to parse existing JSON to validate it
            try {
              JSON.parse(transaction.metadata)
              // It's valid JSON, keep it
            } catch (error) {
              // Invalid JSON, reset to empty object
              newMetadata = '{}'
              needsUpdate = true
            }
          }
        } else if (typeof transaction.metadata === 'object') {
          // Convert object to JSON string
          try {
            newMetadata = JSON.stringify(transaction.metadata)
            needsUpdate = true
          } catch (error) {
            newMetadata = '{}'
            needsUpdate = true
          }
        }

        if (needsUpdate) {
          await Database
            .from('stripe_transactions')
            .where('id', transaction.id)
            .update({ metadata: newMetadata })

          this.logger.info(`✓ Fixed metadata for transaction ${transaction.stripe_id}`)
          fixedCount++
        }
      }

      this.logger.info(`✅ Fixed ${fixedCount} transactions with corrupted metadata`)

    } catch (error) {
      this.logger.error(`Failed to fix metadata: ${error.message}`)
      throw error
    }
  }
}
