import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Stripe from 'stripe'

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

      const player = await Player.create({
        ...request.body(),
        userId: user.id,
      })

      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: '2020-08-27',
      })

      let cost: number
      if (player.sex === 'male') {
        cost = player.membershipFeeOption === 'upfront' ? 30000 : 5700
      } else {
        cost = player.membershipFeeOption === 'upfront' ? 20000 : 4000
      }

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: cost,
        currency: 'gbp',
        customer: user.stripeCustomerId,
      })

      player.stripePaymentIntentId = paymentIntent.id
      await player.save()

      return response.ok({
        status: 'OK',
        code: 200,
        message: 'Player created successfully',
        data: player,
      })
    } catch {
      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to create player',
      })
    }
  }

  public async getPlayer({ auth, params, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const player = await Player.query().where('userId', user.id).andWhere('id', params.playerId).preload('ageGroup').first()

    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: '2020-08-27',
    })

    const paymentIntent = await stripeClient.paymentIntents.retrieve(player!.stripePaymentIntentId)

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
        payment_intent: paymentIntent,
      },
    })
  }

  public async getAllPlayers({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const players = await Player.query().where('userId', user.id).preload('ageGroup')

    return response.ok({
      status: 'OK',
      code: 200,
      data: players,
    })
  }

  // public async updatePlayer({ request, response }: HttpContextContract) {

  // }

  // public async deletePlayer({ request, response }: HttpContextContract) {

  // }
}
