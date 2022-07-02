import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'

import Stripe from 'stripe'
import { parseISO, getUnixTime, getYear, getMonth, addMonths } from 'date-fns'

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

      const identityVerificationPhoto = request.file('identityVerificationPhoto')!
      const ageVerificationPhoto = request.file('ageVerificationPhoto')!

      await identityVerificationPhoto.moveToDisk('identity-verification-photos');
      await ageVerificationPhoto.moveToDisk('age-verification-photos');

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
          cancel_at: getUnixTime(parseISO(`2023-06-${String(player.paymentDate).padStart(2, '0')}`)),
          items: [{ price: Env.get(`STRIPE_MEMBERSHIP_PRICE_ID_SUBSCRIPTION_${player.sex.toUpperCase()}`) }],
          proration_behavior: 'none',
        })

        player.stripeSubscriptionId = subscription.id

        await player.save()
      }

      const session = await stripeClient.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer: user.stripeCustomerId,
        line_items: [
          {
            ...(player.membershipFeeOption === 'upfront' && {
              price: Env.get(`STRIPE_MEMBERSHIP_PRICE_ID_UPFRONT_${player.sex.toUpperCase()}`),
            }),
            ...(player.membershipFeeOption === 'subscription' && {
              price: Env.get(`STRIPE_MEMBERSHIP_PRICE_ID_SUBSCRIPTION_UPFRONT_${player.sex.toUpperCase()}`),
            }),
            quantity: 1,
            adjustable_quantity: {
              enabled: false,
            },
          }
        ],
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

      // const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      //   apiVersion: Env.get('STRIPE_API_VERSION'),
      // })

      // const paymentIntent = await stripeClient.paymentIntents.retrieve(player.stripePaymentIntentId)

      // if (player.stripeSubscriptionId === null) {
      //   return response.ok({
      //     status: 'OK',
      //     code: 200,
      //     data: {
      //       ...player.serialize(),
      //       payment_intent: paymentIntent,
      //       subscription: null,
      //     },
      //   })
      // }

      // const subscription = await stripeClient.subscriptions.retrieve(player.stripeSubscriptionId)

      return response.ok({
        status: 'OK',
        code: 200,
        data: {
          ...player.serialize(),
          // payment_intent: paymentIntent,
          // subscription,
        },
      })
    } catch (error) {
      console.log(error)
      response.internalServerError();
    }
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

  // public async updatePlayer({ request, response }: HttpContextContract) {

  // }

  // public async deletePlayer({ request, response }: HttpContextContract) {

  // }
}
