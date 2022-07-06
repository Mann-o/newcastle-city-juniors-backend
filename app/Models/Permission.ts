import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, ManyToMany } from '@ioc:Adonis/Lucid/Orm'

import User from 'App/Models/User'

export default class Permission extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @manyToMany(() => User, {
    localKey: 'id',
    relatedKey: 'id',
    pivotTable: 'user_permissions',
    pivotForeignKey: 'permission_id',
    pivotRelatedForeignKey: 'user_id',
    pivotTimestamps: true,
  })
  public permissions: ManyToMany<typeof User>
}
