import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import AgeGroup from 'App/Models/AgeGroup'

export default class AgeGroupSeeder extends BaseSeeder {
  public static developmentOnly = true

  public async run() {
    await AgeGroup.createMany([
      { name: 'Under 7s' },
      { name: 'Under 8s' },
      { name: 'Under 9s' },
      { name: 'Under 10s' },
      { name: 'Under 11s' },
      { name: 'Under 12s' },
      { name: 'Under 13s' },
      { name: 'Under 14s' },
      { name: 'Under 15s' },
      { name: 'Under 16s' },
    ])
  }
}
