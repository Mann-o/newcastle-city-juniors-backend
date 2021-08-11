import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'

import Player from 'App/Models/Player'

import Stripe from 'stripe'
import { format, fromUnixTime } from 'date-fns'

export default class HelperController {
  public async getOneOffPaymentSchedule2021({ view }: HttpContextContract) {
    const players = await Player.query().preload('user').preload('ageGroup').orderBy('full_name', 'asc')

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
      .map(([ageGroupName, players]) => ({
        ageGroupName,
        players,
      }))
      .sort((a, b) => parseInt(a.ageGroupName.split(' ')[1].replace(/s/, '')) - parseInt(b.ageGroupName.split(' ')[1].replace(/s/, '')))

    return view.render('payment-schedule-one-off', { ageGroups })
  }

  public async getSubscriptionsPaymentSchedule2021({ view }: HttpContextContract) {
    const players = await Player.query()
      .where('membership_fee_option', 'subscription')
      .preload('user')
      .preload('ageGroup')
      .orderBy('full_name', 'asc')

    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: '2020-08-27',
    })

    const subscriptions: Stripe.Subscription[] = []

    for await (const subscription of stripeClient.subscriptions.list({
      limit: 100,
      created: {
        gt: 1626134400,
      },
      expand: ['data.latest_invoice'],
    })) {
      subscriptions.push(subscription)
    }

    for (const player of players as Player[]) {
      const subscription = subscriptions.find(({ id }) => id === player.stripeSubscriptionId)

      player.subscription = subscription ? subscription : 'not_setup'
    }

    const ageGroups = Object.entries(
      players.reduce((acc, player: any) => {
        const mappedPlayer = {
          name: player.fullName,
          paid: player.paid,
          stripeSubscriptionId: player.stripeSubscriptionId,
          subscriptionStatus: player.subscription === 'not_setup' ? 'not_setup' : player.subscription.status,
          ...(player.subscription !== 'not_setup' && {
            firstPaymentDate:
              player.subscription.status === 'trialing'
                ? format(fromUnixTime(player.subscription.trial_end), 'dd/MM/yyyy')
                : format(fromUnixTime(player.subscription.billing_cycle_anchor), 'dd/MM/yyyy'),
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
      .map(([ageGroupName, players]) => ({
        ageGroupName,
        players,
      }))
      .sort((a, b) => parseInt(a.ageGroupName.split(' ')[1].replace(/s/, '')) - parseInt(b.ageGroupName.split(' ')[1].replace(/s/, '')))

    return view.render('payment-schedule-subscriptions', { ageGroups })
  }
}
