import { DateTime } from 'luxon'
import { BaseModel, column, beforeSave, hasMany, HasMany, manyToMany, ManyToMany } from '@ioc:Adonis/Lucid/Orm'
import Hash from '@ioc:Adonis/Core/Hash'

import Parent from 'App/Models/Parent'
import Player from 'App/Models/Player'
import Permission from 'App/Models/Permission'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @hasMany(() => Parent)
  public parents: HasMany<typeof Parent>

  @hasMany(() => Player)
  public players: HasMany<typeof Player>

  @column()
  public email: string

  @column()
  public emailVerified: boolean

  @column()
  public emailVerificationToken: string | null

  @column({ serializeAs: null })
  public password: string

  @column()
  public rememberMeToken: string | null

  @column()
  public stripeCustomerId: string

  @column()
  public resetPasswordToken: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @column.dateTime({ autoCreate: false, autoUpdate: false })
  public lastLoggedIn: DateTime | null

  @manyToMany(() => Permission, {
    localKey: 'id',
    relatedKey: 'id',
    pivotForeignKey: 'user_id',
    pivotRelatedForeignKey: 'permission_id',
    pivotTable: 'user_permissions',
    pivotTimestamps: true,
  })
  public permissions: ManyToMany<typeof Permission>

  @beforeSave()
  public static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await Hash.make(user.password)
    }

    if (user.$dirty.email) {
      user.email = user.email.toLowerCase()
    }
  }
}
