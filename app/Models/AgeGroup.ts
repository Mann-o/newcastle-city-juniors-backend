import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'

import Team from 'App/Models/Team'
import Player from 'App/Models/Player'

export default class AgeGroup extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: string

  @hasMany(() => Team)
  public teams: HasMany<typeof Team>

  @hasMany(() => Player)
  public players: HasMany<typeof Player>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
