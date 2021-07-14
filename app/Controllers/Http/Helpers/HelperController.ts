// @ts-nocheck
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'

import Stripe from 'stripe'

import Player from 'App/Models/Player'

export default class HelperController {
  public async getPaymentSchedule2021({ view }: HttpContextContract) {
    const players = await Player.query().preload('ageGroup')

    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: '2020-08-27',
    })

    for (const player of players as Array<any>) {
      const paymentIntent = await stripeClient.paymentIntents.retrieve(player.stripePaymentIntentId)

      if (paymentIntent.status === 'succeeded') {
        player.paid = true
        player.amountPaid = `£${(paymentIntent.amount / 100).toFixed(2)}`
      } else {
        player.paid = false
      }
    }

    const ageGroups = players.reduce((acc, player) => {
      const mappedPlayer = {
        name: player.fullName,
        paid: player.paid,
        ...(player.paid && {
          amountPaid: player.amountPaid,
        }),
      }

      if (acc.hasOwnProperty(player.ageGroup.name)) {
        acc[player.ageGroup.name].push(mappedPlayer)
      } else {
        acc[player.ageGroup.name] = [mappedPlayer]
      }

      return acc
    }, {})

    return view.render('payment-schedule', { ageGroups })

    // return response.ok({
    //   status: 'OK',
    //   code: 200,
    //   data: ageGroups,
    // })
  }
}
