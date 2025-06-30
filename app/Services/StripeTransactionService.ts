import Stripe from 'stripe'
import Env from '@ioc:Adonis/Core/Env'
import { DateTime } from 'luxon'
import StripeTransaction, { TransactionType, TransactionStatus } from 'App/Models/StripeTransaction'
import Player from 'App/Models/Player'

export default class StripeTransactionService {
  private stripe: Stripe

  constructor() {
    this.stripe = new Stripe(Env.get('STRIPE_API_SECRET'), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })
  }

  /**
   * Store or update a subscription in our database
   */
  public async storeSubscription(
    subscription: Stripe.Subscription,
    playerId?: number,
    webhookEventId?: string
  ): Promise<StripeTransaction> {
    const existingTransaction = await StripeTransaction.findByStripeId(subscription.id)

    const transactionData = {
      playerId: playerId || existingTransaction?.playerId || null,
      userId: null, // Will be populated from player relationship
      stripeId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripeParentId: null,
      type: 'subscription' as TransactionType,
      status: subscription.status as TransactionStatus,
      amountCents: subscription.items.data[0]?.price?.unit_amount || null,
      currency: subscription.currency || 'gbp',
      trialStart: subscription.trial_start ? DateTime.fromSeconds(subscription.trial_start) : null,
      trialEnd: subscription.trial_end ? DateTime.fromSeconds(subscription.trial_end) : null,
      currentPeriodStart: (subscription as any).current_period_start ? DateTime.fromSeconds((subscription as any).current_period_start) : null,
      currentPeriodEnd: (subscription as any).current_period_end ? DateTime.fromSeconds((subscription as any).current_period_end) : null,
      cancelAt: subscription.cancel_at ? DateTime.fromSeconds(subscription.cancel_at) : null,
      canceledAt: subscription.canceled_at ? DateTime.fromSeconds(subscription.canceled_at) : null,
      billingCycleAnchor: subscription.billing_cycle_anchor,
      stripeCreatedAt: DateTime.fromSeconds(subscription.created),
      processedAt: DateTime.now(),
      webhookEventId,
      metadata: subscription.metadata || {},
    }

    if (existingTransaction) {
      existingTransaction.merge(transactionData)
      await existingTransaction.save()
      return existingTransaction
    } else {
      return await StripeTransaction.create(transactionData)
    }
  }

  /**
   * Store a payment (PaymentIntent, Charge, or Invoice)
   */
  public async storePayment(
    payment: Stripe.PaymentIntent | Stripe.Charge | Stripe.Invoice,
    type: TransactionType,
    playerId?: number,
    parentSubscriptionId?: string,
    webhookEventId?: string
  ): Promise<StripeTransaction> {
    const existingTransaction = await StripeTransaction.findByStripeId(payment.id!)

    // Extract payment method details
    let paymentMethodDetails: any = {}
    if ('payment_method' in payment && payment.payment_method) {
      const pm = payment.payment_method as Stripe.PaymentMethod
      if (pm.card) {
        paymentMethodDetails = {
          paymentMethodType: 'card',
          cardBrand: pm.card.brand,
          cardLast4: pm.card.last4,
          cardExpMonth: pm.card.exp_month?.toString().padStart(2, '0'),
          cardExpYear: pm.card.exp_year?.toString(),
        }
      }
    }

    // Extract amount based on payment type
    let amountCents: number | null = null
    let status: TransactionStatus = 'pending'
    let stripeCreatedAt: DateTime | null = null

    if ('amount' in payment) {
      amountCents = payment.amount
      status = payment.status as TransactionStatus
      stripeCreatedAt = DateTime.fromSeconds(payment.created)
    } else if ('amount_paid' in payment) {
      amountCents = payment.amount_paid
      status = payment.status as TransactionStatus
      stripeCreatedAt = DateTime.fromSeconds(payment.created)
    }

    const transactionData = {
      playerId: playerId || existingTransaction?.playerId || null,
      userId: null,
      stripeId: payment.id,
      stripeCustomerId: payment.customer as string || null,
      stripeParentId: parentSubscriptionId || null,
      type,
      status,
      amountCents,
      currency: ('currency' in payment ? payment.currency : 'gbp') || 'gbp',
      stripeCreatedAt,
      processedAt: DateTime.now(),
      webhookEventId,
      metadata: payment.metadata || {},
      ...paymentMethodDetails,
    }

    if (existingTransaction) {
      existingTransaction.merge(transactionData)
      await existingTransaction.save()
      return existingTransaction
    } else {
      return await StripeTransaction.create(transactionData)
    }
  }

  /**
   * Sync all historical data from Stripe (run once for migration)
   */
  public async syncHistoricalData(createdAfter?: number): Promise<void> {
    console.log('Starting historical Stripe data sync...')

    // Sync subscriptions
    let subscriptionCount = 0
    for await (const subscription of this.stripe.subscriptions.list({
      limit: 100,
      ...(createdAfter && { created: { gt: createdAfter } }),
      expand: ['data.latest_invoice'],
    })) {
      try {
        // Try to find the player by subscription ID
        const player = await Player.query()
          .where('stripe_subscription_id', subscription.id)
          .first()

        await this.storeSubscription(subscription, player?.id)
        subscriptionCount++

        if (subscriptionCount % 10 === 0) {
          console.log(`Synced ${subscriptionCount} subscriptions...`)
        }
      } catch (error) {
        console.error(`Failed to sync subscription ${subscription.id}:`, error)
      }
    }

    // Sync payment intents
    let paymentCount = 0
    for await (const payment of this.stripe.paymentIntents.list({
      limit: 100,
      ...(createdAfter && { created: { gt: createdAfter } }),
    })) {
      try {
        // Determine payment type from metadata
        let type: TransactionType = 'monthly_payment'
        let playerId: number | undefined
        let parentSubscriptionId: string | undefined

        if (payment.metadata?.playerType) {
          switch (payment.metadata.playerType) {
            case 'upfront':
              type = 'upfront_payment'
              break
            case 'subscription':
              type = 'registration_fee'
              break
            default:
              type = 'monthly_payment'
          }
        }

        if (payment.metadata?.playerId) {
          playerId = parseInt(payment.metadata.playerId)
        }

        // Find player by payment intent ID if not in metadata
        if (!playerId) {
          const player = await Player.query()
            .where(query => {
              query.where('stripe_upfront_payment_id', payment.id)
                .orWhere('stripe_registration_fee_id', payment.id)
            })
            .first()
          playerId = player?.id
          parentSubscriptionId = player?.stripeSubscriptionId || undefined
        }

        await this.storePayment(payment, type, playerId, parentSubscriptionId)
        paymentCount++

        if (paymentCount % 10 === 0) {
          console.log(`Synced ${paymentCount} payments...`)
        }
      } catch (error) {
        console.error(`Failed to sync payment ${payment.id}:`, error)
      }
    }

    console.log(`Sync complete: ${subscriptionCount} subscriptions, ${paymentCount} payments`)
  }

  /**
   * Sync historical Stripe subscriptions to local database
   */
  public async syncHistoricalSubscriptions() {
    const stripe = new Stripe(Env.get('STRIPE_API_SECRET'), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    console.log('Fetching historical subscriptions from Stripe...')

    for await (const subscription of stripe.subscriptions.list({
      limit: 100,
      created: {
        gt: 1626134400, // After July 2021 when the system started
      },
      expand: ['data.latest_invoice'],
    })) {
      try {
        await this.storeSubscription(subscription)
        console.log(`✓ Synced subscription: ${subscription.id}`)
      } catch (error) {
        console.error(`✗ Failed to sync subscription ${subscription.id}:`, error.message)
      }
    }
  }

  /**
   * Sync historical Stripe payments to local database
   */
  public async syncHistoricalPayments() {
    const stripe = new Stripe(Env.get('STRIPE_API_SECRET'), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    console.log('Fetching historical payment intents from Stripe...')

    for await (const payment of stripe.paymentIntents.list({
      limit: 100,
      created: {
        gt: 1626134400, // After July 2021 when the system started
      },
    })) {
      try {
        // Determine payment type based on metadata or amount patterns
        let type: TransactionType = 'monthly_payment' // Default for historical payments
        if (payment.metadata?.type === 'registration_fee') {
          type = 'registration_fee'
        } else if (payment.metadata?.type === 'upfront_payment') {
          type = 'upfront_payment'
        }

        // Try to find associated player if available in metadata
        const playerId = payment.metadata?.player_id ? parseInt(payment.metadata.player_id) : undefined

        await this.storePayment(payment, type, playerId)
        console.log(`✓ Synced payment: ${payment.id}`)
      } catch (error) {
        console.error(`✗ Failed to sync payment ${payment.id}:`, error.message)
      }
    }
  }

  /**
   * Get fast subscription schedule from local database
   */
  public async getSubscriptionSchedule(): Promise<any> {
    const transactions = await StripeTransaction.query()
      .where('type', 'subscription')
      .whereIn('status', ['active', 'trialing'])
      .preload('player', (query) => {
        query.preload('user')
      })
      .orderBy('created_at', 'desc')

    // Group by age group
    const ageGroups = transactions.reduce((acc, transaction) => {
      if (!transaction.player) return acc

      const player = transaction.player
      const ageGroup = player.ageGroup || 'Unknown'

      const mappedPlayer = {
        name: `${player.firstName} ${player.lastName}`,
        team: player.team,
        stripeSubscriptionId: transaction.stripeId,
        subscriptionStatus: transaction.status,
        firstPaymentDate: transaction.trialEnd
          ? transaction.trialEnd.toFormat('dd/MM/yyyy')
          : transaction.currentPeriodStart?.toFormat('dd/MM/yyyy'),
        currentPeriodStart: transaction.currentPeriodStart?.toFormat('dd/MM/yyyy'),
        currentPeriodEnd: transaction.currentPeriodEnd?.toFormat('dd/MM/yyyy'),
        cancelAt: transaction.cancelAt?.toFormat('dd/MM/yyyy'),
        amountGbp: transaction.amountGbp,
        user: player.user,
      }

      if (!acc[ageGroup]) {
        acc[ageGroup] = []
      }
      acc[ageGroup].push(mappedPlayer)

      return acc
    }, {} as Record<string, any[]>)

    return Object.entries(ageGroups)
      .map(([ageGroup, players]) => ({
        ageGroup,
        players,
      }))
      .sort((a, b) => parseInt(a.ageGroup) - parseInt(b.ageGroup))
  }
}
