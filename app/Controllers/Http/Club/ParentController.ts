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

  public async getParent({ auth, params, response }: HttpContextContract) {
    const user = auth.use('api').user!

    try {
      const parent = await Parent.query().where('userId', user.id).andWhere('id', params.parentId).first()

      if (!parent) {
        return response.notFound({
          status: 'Not Found',
          code: 404,
          message: 'Parent not found',
        })
      }

      return response.ok({
        status: 'OK',
        code: 200,
        data: {
          ...parent.serialize(),
        },
      })
    } catch (error) {
      console.log(error)
      response.internalServerError();
    }
  }

  public async updateParent({ auth, request, response, params }: HttpContextContract) {
    const user = auth.use('api').user!

    const parent = await Parent.query().where({
      id: params.parentId,
      userId: user.id,
    }).firstOrFail()

    parent.title = request.input('title')
    parent.otherTitle = request.input('otherTitle')
    parent.firstName = request.input('firstName')
    parent.middleNames = request.input('middleNames') || null
    parent.lastName = request.input('lastName')
    parent.dateOfBirth = request.input('dateOfBirth')
    parent.email = request.input('email')
    parent.addressLineOne = request.input('addressLineOne')
    parent.addressLineTwo = request.input('addressLineTwo') || null
    parent.addressLineThree = request.input('addressLineThree') || null
    parent.addressLineFour = request.input('addressLineFour') || null
    parent.addressLineFive = request.input('addressLineFive') || null
    parent.postalCode = request.input('postalCode')
    parent.mobileNumber = request.input('mobileNumber')

    await parent.save()

    return response.ok({
      status: 'OK',
      code: 200,
      data: parent.serialize(),
    })
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
