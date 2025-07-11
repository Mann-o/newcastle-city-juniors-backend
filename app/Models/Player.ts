import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column, computed, HasMany, hasMany } from '@ioc:Adonis/Lucid/Orm'
import Stripe from 'stripe'

import User from 'App/Models/User'
import Parent from 'App/Models/Parent'
import StripeTransaction from 'App/Models/StripeTransaction'

export default class Player extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public firstName: string

  @column()
  public middleNames: string

  @column()
  public lastName: string

  @column.date()
  public dateOfBirth: DateTime

  @column()
  public sex: string

  @column()
  public medicalConditions: string

  @column()
  public acceptedCodeOfConduct: boolean

  @column()
  public acceptedDeclaration: boolean

  @column()
  public giftAidDeclarationAccepted: boolean

  @column()
  public membershipFeeOption: string

  @column()
  public ageGroup: string

  @column()
  public team: string

  @column()
  public secondTeam: string

  @column()
  public paymentDate: number

  @column()
  public mediaConsented: boolean

  @column()
  public identityVerificationPhoto: string

  @column()
  public ageVerificationPhoto: string

  @column()
  public stripeSubscriptionId: string

  @column()
  public stripeRegistrationFeeId: string

  @column()
  public stripeUpfrontPaymentId: string

  @column()
  public wgsRegistered: boolean

  @column()
  public paid?: boolean

  @column()
  public amountPaid?: string

  @column()
  public paymentIntent?: any

  @column()
  public subscription?: Stripe.Subscription | 'not_setup'

  @computed()
  public get full_name() {
    let fullName = this.firstName

    if (this.middleNames !== '' && this.middleNames != null) {
      fullName += ` ${this.middleNames}`;
    }

    return fullName += ` ${this.lastName}`;
  }

  @column()
  public userId: number

  @belongsTo(() => User)
  public user: BelongsTo<typeof User>

  @column()
  public parentId: number

  @column()
  public active: boolean

  @belongsTo(() => Parent)
  public parent: BelongsTo<typeof Parent>

  @hasMany(() => StripeTransaction, {
    foreignKey: 'playerId',
  })
  public stripeTransactions: HasMany<typeof StripeTransaction>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
