import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'

import AgeGroup from 'App/Models/AgeGroup'
import Player from 'App/Models/Player'

export default class Team extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: string

  @column()
  public ageGroupId: number

  @belongsTo(() => AgeGroup)
  public ageGroup: BelongsTo<typeof AgeGroup>

  @hasMany(() => Player, { localKey: 'id'})
  public players: HasMany<typeof Player>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
