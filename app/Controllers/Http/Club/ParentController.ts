import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import Parent from 'App/Models/Parent'
import User from 'App/Models/User'
import CreateParentValidator from 'App/Validators/CreateParentValidator'

export default class ParentController {
  public async createParent({ auth, request, response }: HttpContextContract) {
    await request.validate(CreateParentValidator)

    try {
      const authenticatedUser = auth.use('api').user!

      const user = await User.query().where('id', authenticatedUser.id).first()

      if (!user) {
        throw new Error()
      }

      const parent = await Parent.create({
        ...request.body(),
        userId: user.id,
      })

      return response.ok({
        status: 'OK',
        code: 200,
        message: 'Parent/guardian created successfully',
        data: parent,
      })
    } catch {
      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to create parent/guardian',
      })
    }
  }

  public async getAllParents({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const parents = await Parent.query().where('userId', user.id)

    return response.ok({
      status: 'OK',
      code: 200,
      data: parents,
    })
  }

  public async getAllParentsCount({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const parentCount = (await Parent.query().where('userId', user.id)).length

    return response.ok({
      status: 'OK',
      code: 200,
      data: parentCount,
    })
  }
}
