import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'

import Stripe from 'stripe'
import { parseISO, getUnixTime, getYear, getMonth, addMonths } from 'date-fns'

import Player from 'App/Models/Player'
import User from 'App/Models/User'
import CreatePlayerValidator from 'App/Validators/CreatePlayerValidator'
import Permission from 'App/Models/Permission'

export default class PlayerController {
  public async createPlayer({ auth, request, response }: HttpContextContract) {
    await request.validate(CreatePlayerValidator)

    try {
      const authenticatedUser = auth.use('api').user!

      const user = await User.query().where('id', authenticatedUser.id).first()

      if (!user) {
        throw new Error()
      }

      const dualTeam = (request.input('secondTeam') !== 'none');

      const identityVerificationPhoto = request.file('identityVerificationPhoto')!
      const ageVerificationPhoto = request.file('ageVerificationPhoto')!

      await identityVerificationPhoto.moveToDisk('identity-verification-photos', {}, 'spaces')
      await ageVerificationPhoto.moveToDisk('age-verification-photos', {}, 'spaces')

      let player;

      if (request.input('existingPlayerId')) {
        player = await Player.findOrFail(request.input('existingPlayerId'))

        player.firstName = request.input('firstName')
        player.middleNames = request.input('middleNames')
        player.lastName = request.input('lastName')
        player.dateOfBirth = request.input('dateOfBirth')
        player.sex = request.input('sex')
        player.medicalConditions = request.input('medicalConditions')
        player.mediaConsented = request.input('mediaConsented')
        player.ageGroup = request.input('ageGroup')
        player.team = request.input('team')
        player.secondTeam = request.input('secondTeam');
        player.paymentDate = request.input('paymentDate')
        player.membershipFeeOption = request.input('membershipFeeOption')
        player.acceptedCodeOfConduct = request.input('acceptedCodeOfConduct')
        player.acceptedDeclaration = request.input('acceptedDeclaration')
        player.parentId = request.input('parentId')

        await player.save()
      } else {
        player = await Player.create({
          ...request.only([
            'firstName',
            'middleNames',
            'lastName',
            'dateOfBirth',
            'sex',
            'medicalConditions',
            'mediaConsented',
            'ageGroup',
            'team',
            'secondTeam',
            'paymentDate',
            'membershipFeeOption',
            'acceptedCodeOfConduct',
            'acceptedDeclaration',
            'parentId',
          ]),
          userId: user.id,
          identityVerificationPhoto: identityVerificationPhoto.fileName,
          ageVerificationPhoto: ageVerificationPhoto.fileName,
        })
      }

      const requiredPermission = 'free-child';
      const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
      const hasRequiredPermission = userPermissions.includes(requiredPermission);

      if (!hasRequiredPermission) {
        const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
          apiVersion: Env.get('STRIPE_API_VERSION'),
        })

        if (request.input('membershipFeeOption') === 'subscription') {
          const trialEndDate = addMonths(new Date(), 1)

          const subscription = await stripeClient.subscriptions.create({
            customer: user.stripeCustomerId,
            trial_end: getUnixTime(
              parseISO(`${getYear(trialEndDate)}-${(getMonth(trialEndDate) + 1).toString().padStart(2, '0')}-${String(player.paymentDate).padStart(2, '0')}`),
            ),
            cancel_at: getUnixTime(parseISO(`${(getYear(trialEndDate) + 1)}-06-${String(player.paymentDate).padStart(2, '0')}`)),
            items: [{ price: Env.get(`STRIPE_PRICE_ID_SUBSCRIPTION_${player.sex.toUpperCase()}_${dualTeam ? 'MULTI' : 'SINGLE'}_TEAM`) }],
            proration_behavior: 'none',
          })

          player.stripeSubscriptionId = subscription.id

          await player.save()
        }

        const session = await stripeClient.checkout.sessions.create({
          mode: 'payment',
          payment_method_options: {
            card: {
              setup_future_usage: 'off_session',
            },
          },
          payment_method_types: ['card'],
          customer: user.stripeCustomerId,
          line_items: [
            {
              ...(player.membershipFeeOption === 'upfront' && {
              price: Env.get(`STRIPE_PRICE_ID_UPFRONT_${player.sex.toUpperCase()}_${dualTeam ? 'MULTI' : 'SINGLE'}_TEAM`),
              }),
              ...(player.membershipFeeOption === 'subscription' && {
                price: Env.get(`STRIPE_PRICE_ID_SUBSCRIPTION_UPFRONT_${player.sex.toUpperCase()}`),
              }),
              quantity: 1,
              adjustable_quantity: {
                enabled: false,
              },
            },
          ],
          payment_intent_data: {
            setup_future_usage: 'off_session',
          },
          allow_promotion_codes: true,
          metadata: {
            playerId: player.id,
          },
          cancel_url: `${
            Env.get('NODE_ENV') === 'production'
              ? 'https://newcastlecityjuniors.co.uk'
              : 'http://localhost:3000'
          }/portal/players/register?player=${player.id}`,
          success_url: `${
            Env.get('NODE_ENV') === 'production'
              ? 'https://newcastlecityjuniors.co.uk'
              : 'http://localhost:3000'
          }/portal/players?status=success&id={CHECKOUT_SESSION_ID}`,
        })

        if (session.url) {
          response.send({
            checkoutUrl: session.url,
          })
        } else {
          response.abort('Unable to create a Stripe checkout session', 502)
        }
      } else {
        const freeChildPermission = await Permission.query().where({ name: 'free-child' }).first();

        await user!.related('permissions').detach([freeChildPermission!.id])

        response.ok({
          status: 'OK',
          code: 200,
        })
      }
    } catch(error) {
      console.log(error);

      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to create or update player',
      })
    }
  }

  public async getPlayer({ auth, params, response }: HttpContextContract) {
    const user = auth.use('api').user!

    try {
      const player = await Player.query().where('userId', user.id).andWhere('id', params.playerId).first()

      if (!player) {
        return response.notFound({
          status: 'Not Found',
          code: 404,
          message: 'Player not found',
        })
      }

      return response.ok({
        status: 'OK',
        code: 200,
        data: {
          ...player.serialize(),
        },
      })
    } catch (error) {
      console.log(error)
      response.internalServerError();
    }
  }

  public async updatePlayer({ auth, request, response, params }: HttpContextContract) {
    const user = auth.use('api').user!

    const player = await Player.query().where({
      id: params.playerId,
      userId: user.id,
    }).firstOrFail()

    player.firstName = request.input('firstName')
    player.middleNames = request.input('middleNames')
    player.lastName = request.input('lastName')
    player.dateOfBirth = request.input('dateOfBirth')
    player.sex = request.input('sex')
    player.medicalConditions = request.input('medicalConditions')

    const identityVerificationPhoto = request.file('identityVerificationPhoto')
    const ageVerificationPhoto = request.file('ageVerificationPhoto')

    if (identityVerificationPhoto) {
      await identityVerificationPhoto.moveToDisk('identity-verification-photos', {}, 'spaces')
      player.identityVerificationPhoto = identityVerificationPhoto.fileName!
    }

    if (ageVerificationPhoto) {
      await ageVerificationPhoto.moveToDisk('age-verification-photos', {}, 'spaces')
      player.ageVerificationPhoto = ageVerificationPhoto.fileName!
    }

    await player.save()

    return response.ok({
      status: 'OK',
      code: 200,
      data: player.serialize(),
    })
  }

  public async getAllPlayers({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const players = await Player.query().where('userId', user.id)

    return response.ok({
      status: 'OK',
      code: 200,
      data: players,
    })
  }

  public async getAllPlayersCount({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const playerCount = (await Player.query().where('userId', user.id)).length

    return response.ok({
      status: 'OK',
      code: 200,
      data: playerCount,
    })
  }
}
