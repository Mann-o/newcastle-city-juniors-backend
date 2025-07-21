import { BaseCommand } from '@adonisjs/core/build/standalone'
import Database from '@ioc:Adonis/Lucid/Database'
import Env from '@ioc:Adonis/Core/Env'

export default class DiagnoseWebhooks extends BaseCommand {
  public static commandName = 'diagnose:webhooks'
  public static description = 'Diagnose webhook processing issues'

  public async run() {
    this.logger.info('Starting webhook diagnostics...')

    try {
      // 1. Check environment variables
      this.logger.info('=== Environment Variables ===')
      const stripeSecret = Env.get('STRIPE_API_SECRET')
      const webhookSecret = Env.get('STRIPE_WEBHOOK_SECRET')
      const apiVersion = Env.get('STRIPE_API_VERSION')

      this.logger.info(`STRIPE_API_SECRET: ${stripeSecret ? '✓ Set (length: ' + stripeSecret.length + ')' : '✗ Missing'}`)
      this.logger.info(`STRIPE_WEBHOOK_SECRET: ${webhookSecret ? '✓ Set (length: ' + webhookSecret.length + ')' : '✗ Missing'}`)
      this.logger.info(`STRIPE_API_VERSION: ${apiVersion || '✗ Missing'}`)

      // 2. Check database connectivity
      this.logger.info('\n=== Database Connectivity ===')
      try {
        await Database.rawQuery('SELECT 1 as test')
        this.logger.info('✓ Database connection successful')
      } catch (error) {
        this.logger.error('✗ Database connection failed:', error.message)
        return
      }

      // 3. Check if tables exist
      this.logger.info('\n=== Table Existence ===')
      const tables = ['users', 'players', 'stripe_transactions']

      for (const table of tables) {
        try {
          const result = await Database.rawQuery(`SELECT COUNT(*) as count FROM ${table}`)
          this.logger.info(`✓ Table '${table}' exists (${result.rows[0].count} records)`)
        } catch (error) {
          this.logger.error(`✗ Table '${table}' missing or inaccessible:`, error.message)
        }
      }

      // 4. Check recent webhook activity (if any logs exist)
      this.logger.info('\n=== Recent Activity Check ===')
      try {
        const recentUsers = await Database.from('users').select('id', 'email', 'created_at').orderBy('created_at', 'desc').limit(3)
        this.logger.info(`Recent users (${recentUsers.length}):`)
        recentUsers.forEach(user => {
          this.logger.info(`  - ID: ${user.id}, Email: ${user.email}, Created: ${user.created_at}`)
        })

        const recentPlayers = await Database.from('players').select('id', 'first_name', 'last_name', 'created_at').orderBy('created_at', 'desc').limit(3)
        this.logger.info(`Recent players (${recentPlayers.length}):`)
        recentPlayers.forEach(player => {
          this.logger.info(`  - ID: ${player.id}, Name: ${player.first_name} ${player.last_name}, Created: ${player.created_at}`)
        })

        const recentTransactions = await Database.from('stripe_transactions').select('id', 'stripe_id', 'type', 'status', 'created_at').orderBy('created_at', 'desc').limit(3)
        this.logger.info(`Recent stripe transactions (${recentTransactions.length}):`)
        recentTransactions.forEach(tx => {
          this.logger.info(`  - ID: ${tx.id}, Stripe ID: ${tx.stripe_id}, Type: ${tx.type}, Status: ${tx.status}, Created: ${tx.created_at}`)
        })
      } catch (error) {
        this.logger.error('Error checking recent activity:', error.message)
      }

      // 5. Test webhook endpoint accessibility
      this.logger.info('\n=== Webhook Configuration Check ===')
      this.logger.info('Your webhook endpoint should be configured in Stripe to point to:')
      this.logger.info('  POST /stripe/webhooks')
      this.logger.info('\nRequired webhook events to enable in Stripe Dashboard:')
      this.logger.info('  - checkout.session.completed')
      this.logger.info('  - payment_intent.succeeded')
      this.logger.info('  - invoice.payment_succeeded')
      this.logger.info('  - customer.subscription.updated')
      this.logger.info('  - customer.subscription.deleted')
      this.logger.info('  - charge.succeeded')

      // 6. Test Stripe API connectivity
      this.logger.info('\n=== Stripe API Connectivity ===')
      if (stripeSecret) {
        try {
          const Stripe = (await import('stripe')).default
          const stripe = new Stripe(stripeSecret, {
            apiVersion: apiVersion || '2024-06-20',
          })

          // Test API call
          const account = await stripe.accounts.retrieve()
          this.logger.info(`✓ Stripe API connection successful`)
          this.logger.info(`  Account ID: ${account.id}`)
          this.logger.info(`  Business Name: ${account.business_profile?.name || 'Not set'}`)
          this.logger.info(`  Account created: ${account.created ? new Date(account.created * 1000).toISOString() : 'Unknown'}`)
        } catch (error) {
          this.logger.error('✗ Stripe API connection failed:', error.message)
        }
      }

      this.logger.info('\n=== Diagnosis Complete ===')
      this.logger.info('If webhooks are being received but not processing:')
      this.logger.info('1. Check your server logs for webhook errors')
      this.logger.info('2. Verify webhook signature validation')
      this.logger.info('3. Test with a simple webhook payload')
      this.logger.info('4. Check if the webhook URL is accessible from Stripe')

    } catch (error) {
      this.logger.error('Diagnostic failed:', error.message)
      this.logger.error(error.stack)
    }
  }
}
