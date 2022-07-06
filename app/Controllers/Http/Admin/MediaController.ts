import Drive from '@ioc:Adonis/Core/Drive';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class MediaController {
  public async getVerificationPhoto({ auth, response, params }: HttpContextContract) {
    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-players'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission));

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    try {
      const image = await Drive.use('spaces').getStream(`${params.folder}/${params.filename}`)

      return response.stream(image)
    } catch (error) {
      console.log(error)
      return response.badRequest()
    }
  }

}
