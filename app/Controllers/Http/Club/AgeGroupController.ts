import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import AgeGroup from 'App/Models/AgeGroup'

export default class AgeGroupController {
  public async getAllAgeGroups({ response }: HttpContextContract) {
    const ageGroups = await AgeGroup.query().orderBy('id', 'asc')

    return response.ok({
      status: 'OK',
      code: 200,
      data: ageGroups,
    })
  }
}
