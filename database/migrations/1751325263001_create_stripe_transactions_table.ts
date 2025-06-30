import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class CreateStripeTransactionsTable extends BaseSchema {
  protected tableName = 'stripe_transactions'

  public async up() {
    this.schema.createTable(this.tableName, table => {
      table.increments('id').primary()

      // Link to our data
      table.integer('player_id').unsigned().nullable().index()
      table.foreign('player_id').references('id').inTable('players').onDelete('set null')
      table.integer('user_id').unsigned().nullable().index()
      table.foreign('user_id').references('id').inTable('users').onDelete('set null')

      // Stripe IDs and references
      table.string('stripe_id', 255).notNullable().unique().index() // Subscription, payment intent, or charge ID
      table.string('stripe_customer_id', 255).nullable().index()
      table.string('stripe_parent_id', 255).nullable().index() // Links to subscription for payments

      // Transaction details
      table.enum('type', [
        'subscription',
        'registration_fee',
        'upfront_payment',
        'monthly_payment',
        'refund'
      ]).notNullable().index()
      table.enum('status', [
        'active',
        'canceled',
        'past_due',
        'trialing',
        'incomplete',
        'succeeded',
        'failed',
        'pending',
        'refunded'
      ]).notNullable().index()

      // Financial data
      table.integer('amount_cents').nullable() // Amount in cents
      table.string('currency', 3).defaultTo('gbp')
      table.integer('amount_refunded_cents').defaultTo(0)

      // Subscription specific
      table.timestamp('trial_start', { useTz: true }).nullable()
      table.timestamp('trial_end', { useTz: true }).nullable()
      table.timestamp('current_period_start', { useTz: true }).nullable()
      table.timestamp('current_period_end', { useTz: true }).nullable()
      table.timestamp('cancel_at', { useTz: true }).nullable()
      table.timestamp('canceled_at', { useTz: true }).nullable()
      table.integer('billing_cycle_anchor').nullable() // Unix timestamp

      // Payment method details
      table.string('payment_method_type', 50).nullable() // card, sepa_debit, etc.
      table.string('card_brand', 20).nullable() // visa, mastercard, etc.
      table.string('card_last4', 4).nullable()
      table.string('card_exp_month', 2).nullable()
      table.string('card_exp_year', 4).nullable()

      // Event tracking
      table.timestamp('stripe_created_at', { useTz: true }).nullable()
      table.timestamp('processed_at', { useTz: true }).nullable()
      table.string('webhook_event_id', 255).nullable() // For idempotency

      // Metadata storage (JSON for flexible data)
      table.json('metadata').nullable()
      table.text('notes').nullable() // For admin notes

      // Error handling
      table.text('last_error').nullable()
      table.integer('retry_count').defaultTo(0)

      // Timestamps
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      // Additional indexes for common queries
      table.index(['type', 'status'], 'stripe_transactions_type_status_index')
      table.index(['created_at'], 'stripe_transactions_created_at_index')
      table.index(['stripe_created_at'], 'stripe_transactions_stripe_created_at_index')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
