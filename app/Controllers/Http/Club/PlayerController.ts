import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
import Env from '@ioc:Adonis/Core/Env'

import Stripe from 'stripe'
import { parseISO, getUnixTime, addMonths, getMonth, getYear } from 'date-fns'

import Player from 'App/Models/Player'
import User from 'App/Models/User'
import CreatePlayerValidator from 'App/Validators/CreatePlayerValidator'

export default class PlayerController {
  public async createPlayer({ auth, request, response }: HttpContextContract) {
    await request.validate(CreatePlayerValidator)

    try {
      const authenticatedUser = auth.use('api').user!

      const user = await User.query().where('id', authenticatedUser.id).first()

      if (!user) {
        throw new Error()
      }

      const requiredPermissionsForFreeRegistration: string[] = ['coach'];
      const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
      const hasRequiredPermissionsForFreeRegistration = requiredPermissionsForFreeRegistration.every(requiredPermission => userPermissions.includes(requiredPermission)) || userPermissions.includes('sudo');

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
        player.membershipFeeOption = hasRequiredPermissionsForFreeRegistration ? 'upfront' : request.input('membershipFeeOption')
        player.acceptedCodeOfConduct = request.input('acceptedCodeOfConduct')
        player.acceptedDeclaration = request.input('acceptedDeclaration')
        player.giftAidDeclarationAccepted = request.input('giftAidDeclarationAccepted')
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
            'giftAidDeclarationAccepted',
            'parentId',
          ]),
          userId: user.id,
          identityVerificationPhoto: identityVerificationPhoto.fileName,
          ageVerificationPhoto: ageVerificationPhoto.fileName,
        })
      }

      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: Env.get('STRIPE_API_VERSION'),
      })

      if (hasRequiredPermissionsForFreeRegistration) {
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
              price: Env.get('STRIPE_SUBS_COACH'),
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
          return response.send({
            checkoutUrl: session.url,
          })
        } else {
          return response.abort('Unable to create a Stripe checkout session', 502)
        }
      } else if (request.input('membershipFeeOption') === 'subscription') {
        const trialEndDate = addMonths(new Date(), 1)
        const subscription = await stripeClient.subscriptions.create({
          customer: user.stripeCustomerId,
          trial_end: getUnixTime(
            parseISO(`${getYear(trialEndDate)}-${(getMonth(trialEndDate) + 1).toString().padStart(2, '0')}-${String(player.paymentDate).padStart(2, '0')}`),
          ),
          cancel_at: getUnixTime(parseISO(`2025-06-${String(player.paymentDate).padStart(2, '0')}`)),
          items: [{ price: Env.get(`STRIPE_SUBS_${dualTeam ? 'DUAL' : 'SINGLE'}_TEAM_${player.sex.toUpperCase()}`) }],
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
            price: Env.get(`STRIPE_UPFRONT_${dualTeam ? 'DUAL' : 'SINGLE'}_TEAM_${player.sex.toUpperCase()}`),
            }),
            ...(player.membershipFeeOption === 'subscription' && {
              price: Env.get(`STRIPE_REG_FEE_${dualTeam ? 'DUAL' : 'SINGLE'}_TEAM_${player.sex.toUpperCase()}`),
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
    player.giftAidDeclarationAccepted = request.input('giftAidDeclarationAccepted')

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

  public async getRemainingTicketsCount({ response }: HttpContextContract) {
    const ticketsRemainingJson = await Database.from('config').where('key', 'tickets_remaining').select('value').first()

    const ticketsRemaining = ticketsRemainingJson.value.count

    return response.ok({
      status: 'OK',
      code: 200,
      data: {
        ticketsRemaining,
      },
    })
  }
}
