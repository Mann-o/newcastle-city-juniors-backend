import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column, computed } from '@ioc:Adonis/Lucid/Orm'

import User from 'App/Models/User'

export default class Parent extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public title: string

  @column()
  public otherTitle: string

  @column()
  public firstName: string

  @column()
  public middleNames: string

  @column()
  public lastName: string

  @column.date()
  public dateOfBirth: DateTime

  @column()
  public email: string

  @column()
  public addressLineOne: string

  @column()
  public addressLineTwo: string

  @column()
  public addressLineThree: string

  @column()
  public addressLineFour: string

  @column()
  public addressLineFive: string

  @column()
  public postalCode: string

  @column()
  public mobileNumber: string

  @column()
  public acceptedCodeOfConduct: boolean

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

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
