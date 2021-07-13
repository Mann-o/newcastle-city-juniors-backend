import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Team from 'App/Models/Team'

export default class TeamController {
  public async getAllTeams({ response }: HttpContextContract) {
    const teams = await Team.query().preload('ageGroup')

    return response.ok({
      status: 'OK',
      code: 200,
      data: teams,
    })
  }
}
