import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import Player from 'App/Models/Player'
import User from 'App/Models/User'

export type TransactionType = 'subscription' | 'registration_fee' | 'upfront_payment' | 'monthly_payment' | 'refund'
export type TransactionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'succeeded' | 'failed' | 'pending' | 'refunded'

export default class StripeTransaction extends BaseModel {
  public static table = 'stripe_transactions'

  @column({ isPrimary: true })
  public id: number

  @column()
  public playerId: number | null

  @column()
  public userId: number | null

  @column()
  public stripeId: string

  @column()
  public stripeCustomerId: string | null

  @column()
  public stripeParentId: string | null

  @column()
  public type: TransactionType

  @column()
  public status: TransactionStatus

  @column()
  public amountCents: number | null

  @column()
  public currency: string

  @column()
  public amountRefundedCents: number

  @column.dateTime()
  public trialStart: DateTime | null

  @column.dateTime()
  public trialEnd: DateTime | null

  @column.dateTime()
  public currentPeriodStart: DateTime | null

  @column.dateTime()
  public currentPeriodEnd: DateTime | null

  @column.dateTime()
  public cancelAt: DateTime | null

  @column.dateTime()
  public canceledAt: DateTime | null

  @column()
  public billingCycleAnchor: number | null

  @column()
  public paymentMethodType: string | null

  @column()
  public cardBrand: string | null

  @column()
  public cardLast4: string | null

  @column()
  public cardExpMonth: string | null

  @column()
  public cardExpYear: string | null

  @column.dateTime()
  public stripeCreatedAt: DateTime | null

  @column.dateTime()
  public processedAt: DateTime | null

  @column()
  public webhookEventId: string | null

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value || '{}'),
  })
  public metadata: Record<string, any>

  @column()
  public notes: string | null

  @column()
  public lastError: string | null

  @column()
  public retryCount: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  // Relationships
  @belongsTo(() => Player)
  public player: BelongsTo<typeof Player>

  @belongsTo(() => User)
  public user: BelongsTo<typeof User>

  // Computed properties
  public get amountGbp(): number {
    return this.amountCents ? this.amountCents / 100 : 0
  }

  public get amountRefundedGbp(): number {
    return this.amountRefundedCents / 100
  }

  public get netAmountGbp(): number {
    return this.amountGbp - this.amountRefundedGbp
  }

  // Helper methods
  public static async findByStripeId(stripeId: string): Promise<StripeTransaction | null> {
    return await this.query().where('stripe_id', stripeId).first()
  }

  public static async getPlayerTransactionHistory(playerId: number): Promise<StripeTransaction[]> {
    return await this.query()
      .where('player_id', playerId)
      .orderBy('stripe_created_at', 'desc')
      .preload('player')
      .preload('user')
  }

  public static async getSubscriptionPayments(subscriptionId: string): Promise<StripeTransaction[]> {
    return await this.query()
      .where(query => {
        query.where('stripe_id', subscriptionId)
          .orWhere('stripe_parent_id', subscriptionId)
      })
      .orderBy('stripe_created_at', 'asc')
  }

  public static async getActiveSubscriptions(): Promise<StripeTransaction[]> {
    return await this.query()
      .where('type', 'subscription')
      .whereIn('status', ['active', 'trialing'])
      .preload('player')
      .preload('user')
      .orderBy('created_at', 'desc')
  }
}
