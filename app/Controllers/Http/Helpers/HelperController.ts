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

    const paymentIntents: any[] = []

    /* eslint-disable @typescript-eslint/naming-convention */
    var { has_more, data } = await stripeClient.paymentIntents.list({
      limit: 100,
      starting_after: 'pi_1JCqVqJgy48auTmo9HOK9550',
    })

    paymentIntents.push(...data.map(({ id, status, amount }) => ({ id, status, amount })))

    while (has_more) {
      var { has_more, data } = await stripeClient.paymentIntents.list({
        limit: 100,
        starting_after: paymentIntents[paymentIntents.length - 1].id,
      })
      paymentIntents.push(...data.map(({ id, status, amount }) => ({ id, status, amount })))
    }
    /* eslint-enable @typescript-eslint/naming-convention */

    for (const player of players as Player[]) {
      const paymentIntent = paymentIntents.find(({ id }) => id === player.stripePaymentIntentId)

      if (!paymentIntent) {
        throw new Error('payment intent not found...')
      }

      if (paymentIntent?.status === 'succeeded') {
        player.paid = true
        player.amountPaid = `£${(paymentIntent.amount / 100).toFixed(2)}`
      } else {
        player.paid = false
      }
    }

    const ageGroups = players.reduce((acc, player: any) => {
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
  }
}
