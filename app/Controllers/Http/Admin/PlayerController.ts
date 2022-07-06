import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import Player from 'App/Models/Player'

export default class PlayerController {
  public async getAllPlayers({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-players'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission));

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const players = await Player.all()

    return response.ok({
      status: 'OK',
      code: 200,
      data: players,
    })
  }

  public async getParentForPlayer({ auth, response, params }: HttpContextContract) {
    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-players'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission));

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const player = await Player.first(params.playerId)

    const parent = await player!.related('parent').query()

    return response.ok({
      status: 'OK',
      code: 200,
      data: parent[0],
    })
  }
}
