import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'

import Player from 'App/Models/Player'

import Stripe from 'stripe'

export default class HelperController {
  public async getPaymentSchedule2021({ view }: HttpContextContract) {
    const players = await Player.query().preload('user').preload('ageGroup')

    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: '2020-08-27',
    })

    const paymentIntents: Stripe.PaymentIntent[] = []

    for await (const paymentIntent of stripeClient.paymentIntents.list({
      limit: 100,
      created: {
        gt: 1626134400,
      },
    })) {
      paymentIntents.push(paymentIntent)
    }

    for (const player of players as Player[]) {
      const paymentIntent = paymentIntents.find(({ id }) => id === player.stripePaymentIntentId)

      if (paymentIntent?.status === 'succeeded') {
        player.paid = true
        player.amountPaid = `£${(paymentIntent.amount / 100).toFixed(2)}`
      } else {
        player.paid = false
      }
    }

    const ageGroups = Object.entries(
      players.reduce((acc, player: any) => {
        const mappedPlayer = {
          name: player.fullName,
          paid: player.paid,
          stripePaymentIntentId: player.stripePaymentIntentId,
          ...(player.paid && {
            amountPaid: player.amountPaid,
          }),
          user: player.user,
        }

        if (acc.hasOwnProperty(player.ageGroup.name)) {
          acc[player.ageGroup.name].push(mappedPlayer)
        } else {
          acc[player.ageGroup.name] = [mappedPlayer]
        }

        return acc
      }, {}),
    )
      .map(([key, value]) => ({
        ageGroupName: key,
        players: value,
      }))
      .sort((a, b) => {
        return parseInt(a.ageGroupName.split(' ')[1].replace(/s/, '')) - parseInt(b.ageGroupName.split(' ')[1].replace(/s/, ''))
      })

    return view.render('payment-schedule', { ageGroups })
  }
}
