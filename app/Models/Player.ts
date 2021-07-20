import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'

import Team from 'App/Models/Team'
import User from 'App/Models/User'
import AgeGroup from 'App/Models/AgeGroup'

export default class Player extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public fullName: string

  @column.date()
  public dateOfBirth: DateTime

  @column()
  public sex: string

  @column()
  public medicalConditions: string

  @column()
  public acceptedPlayerCodeOfConduct: boolean

  @column()
  public acceptedParentCodeOfConduct: boolean

  @column()
  public acceptedDeclaration: boolean

  @column()
  public membershipFeeOption: string

  @column()
  public mediaConsented: boolean

  @column()
  public stripePaymentIntentId: string

  @column()
  public paid?: boolean

  @column()
  public amountPaid?: string

  @column()
  public paymentIntent?: any

  @column()
  public userId: number

  @belongsTo(() => User)
  public user: BelongsTo<typeof User>

  @column()
  public teamId: number

  @belongsTo(() => Team)
  public team: BelongsTo<typeof Team>

  @column()
  public ageGroupId: number

  @belongsTo(() => AgeGroup)
  public ageGroup: BelongsTo<typeof AgeGroup>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
