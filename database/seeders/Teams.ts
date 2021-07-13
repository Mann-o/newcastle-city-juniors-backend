import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'

import AgeGroup from 'App/Models/AgeGroup'

export default class TeamSeeder extends BaseSeeder {
  public static developmentOnly = true

  public async run() {
    const under7 = await AgeGroup.findOrFail(1)
    const under8 = await AgeGroup.findOrFail(2)
    const under9 = await AgeGroup.findOrFail(3)
    const under10 = await AgeGroup.findOrFail(4)
    const under11 = await AgeGroup.findOrFail(5)
    const under12 = await AgeGroup.findOrFail(6)
    const under13 = await AgeGroup.findOrFail(7)
    const under14 = await AgeGroup.findOrFail(8)
    const under15 = await AgeGroup.findOrFail(9)
    const under16 = await AgeGroup.findOrFail(10)

    await under7.related('teams').createMany([{ name: 'Saturday Team' }, { name: 'Juve' }, { name: 'NCJ' }])
    await under8.related('teams').createMany([{ name: 'Saturday Team' }, { name: 'Juve' }, { name: 'NCJ' }])
    await under9.related('teams').createMany([{ name: 'Saturday Team' }, { name: 'Juve' }, { name: 'NCJ' }])
    await under10.related('teams').createMany([{ name: 'Saturday Team' }, { name: 'Juve' }, { name: 'NCJ' }])
    await under11.related('teams').createMany([{ name: 'Saturday Team' }, { name: 'Juve' }, { name: 'NCJ' }])
    await under12.related('teams').createMany([{ name: 'Saturday Team' }, { name: 'Juve' }, { name: 'NCJ' }])
    await under13.related('teams').createMany([{ name: 'Saturday Team' }, { name: 'Juve' }, { name: 'NCJ' }])
    await under14.related('teams').createMany([{ name: 'Saturday Team' }, { name: 'Juve' }, { name: 'NCJ' }])
    await under15.related('teams').createMany([{ name: 'Saturday Team' }, { name: 'Juve' }, { name: 'NCJ' }])
    await under16.related('teams').createMany([{ name: 'Saturday Team' }, { name: 'Juve' }, { name: 'NCJ' }])
  }
}
