import { DateTime } from 'luxon'
import { BaseModel, column, beforeSave, hasMany, HasMany, hasManyThrough, HasManyThrough } from '@ioc:Adonis/Lucid/Orm'
import Hash from '@ioc:Adonis/Core/Hash'

import Player from 'App/Models/Player'
import Team from 'App/Models/Team'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @hasMany(() => Player)
  public players: HasMany<typeof Player>

  @hasManyThrough([() => Team, () => Player])
  public teams: HasManyThrough<typeof Team>

  @column()
  public title: string

  @column()
  public firstName: string

  @column()
  public lastName: string

  @column()
  public houseNameOrNumber: string

  @column()
  public postcode: string

  @column()
  public mobileNumber: string

  @column()
  public email: string

  @column()
  public emailVerified: boolean

  @column()
  public emailVerificationToken: string | null

  @column()
  public giftAidConsented: boolean

  @column()
  public additionalParentOrGuardian: boolean

  @column()
  public alternateTitle: string | null

  @column()
  public alternateFirstName: string | null

  @column()
  public alternateLastName: string | null

  @column()
  public alternateHouseNameOrNumber: string | null

  @column()
  public alternatePostcode: string | null

  @column()
  public alternateMobileNumber: string | null

  @column()
  public alternateEmail: string | null

  @column({ serializeAs: null })
  public password: string

  @column()
  public acceptedCodeOfConduct: boolean

  @column()
  public rememberMeToken: string | null

  @column()
  public stripeCustomerId: string

  @column()
  public stripePaymentMethodId: string | undefined

  @column()
  public stripeLast4: string | undefined

  @column()
  public resetPasswordToken: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @column.dateTime({ autoCreate: false, autoUpdate: false })
  public lastLoggedIn: DateTime | null

  @beforeSave()
  public static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await Hash.make(user.password)
    }

    if (user.$dirty.email) {
      user.email = user.email.toLowerCase()
    }

    if (user.$dirty.alternateEmail && user.alternateEmail !== null) {
      user.alternateEmail = user.alternateEmail.toLowerCase()
    }
  }
}
