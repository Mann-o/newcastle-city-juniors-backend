import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Database from '@ioc:Adonis/Lucid/Database'

import Stripe from 'stripe'
import { format, fromUnixTime } from 'date-fns';

import Player from 'App/Models/Player'
import Parent from 'App/Models/Parent'
// import User from 'App/Models/User'

export default class PlayerController {
  public async getAllPlayers({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-players'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission));

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const players = await Player.all()

    return response.ok({
      status: 'OK',
      code: 200,
      data: players,
    })
  }

  public async getParentForPlayer({ auth, response, params }: HttpContextContract) {
    const authUser = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-players'];
    const userPermissions = (await authUser!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission));

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    // const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
    //   apiVersion: Env.get('STRIPE_API_VERSION'),
    // })

    const player = await Player.query().where({ id: params.playerId }).firstOrFail()

    const parent = await Parent.query().where({ id: player.parentId }).firstOrFail()

    // const user = await User.query().where({ id: player.userId }).firstOrFail()

    // const { data: charges } = await stripeClient.charges.list({ customer: user.stripeCustomerId })

    return response.ok({
      status: 'OK',
      code: 200,
      data: {
        parent,
        // charges,
      },
    })
  }

  public async togglePlayerWgsRegistrationStatus({ auth, response, params }: HttpContextContract) {
    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-players'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission));

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const player = await Player.query().where({ id: params.playerId }).firstOrFail()

    player.wgsRegistered = !player.wgsRegistered

    await player.save();

    return response.ok({
      status: 'OK',
      code: 200,
      data: {
        message: 'success',
      },
    })
  }

  public async getTeamsForPaymentStatusPage({ response }: HttpContextContract) {
    const firstTeams = await Database.from('players').distinct('team').orderBy('team');
    const secondTeams = await Database.from('players').distinct('second_team').orderBy('second_team', 'asc');

    const teams: string[] = [...firstTeams, ...secondTeams].reduce((acc, player) => {
      if (!acc.includes(player.team)) acc.push(player.team);
      if (!acc.includes(player.secondTeam)) acc.push(player.secondTeam);
      return acc;
    }, [] as string[]);

    return response.ok({
      status: 'OK',
      code: 200,
      data: teams,
    });
  }

  public async getSubscriptionsPaymentSchedule({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-players'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission));

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const players = await Player.query()
      .where('membership_fee_option', 'subscription')
      .preload('user')
      .orderBy('last_name', 'asc')

    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
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
          name: player.full_name,
          paid: player.paid,
          team: player.team,
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

        if (acc.hasOwnProperty(player.ageGroup)) {
          acc[player.ageGroup].push(mappedPlayer)
        } else {
          acc[player.ageGroup] = [mappedPlayer]
        }

        return acc
      }, {}),
    )
      .map(([ageGroup, players]) => ({
        ageGroup,
        players,
      }))
      .sort((a, b) => parseInt(a.ageGroup) - parseInt(b.ageGroup))

    return response.ok({
      status: 'OK',
      code: 200,
      data: ageGroups,
    })
  }

  public async getPresentationTicketsPaymentSchedule({ auth, response }: HttpContextContract) {

    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-payments'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission));

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const paymentIntents: any[] = [];
    const orders: any[] = [];

    const playerTickets = {
      id: 'price_1N2sgiJgy48auTmo5gZVPEEb',
      total: 0,
    }

    const visitorTickets = {
      id: 'price_1N2sgdJgy48auTmo0aouX7Kk',
      total: 0,
    }

    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    for await (const paymentIntent of stripeClient.paymentIntents.search({
      query: 'amount<=1000 AND status:"succeeded" AND created>1682895600',
      limit: 100,
    })) {
      paymentIntents.push(paymentIntent.id);
    }

    for (const paymentIntent of paymentIntents) {
      const checkout: any = await stripeClient.checkout.sessions.list({
        payment_intent: paymentIntent,
        expand: ['data.line_items'],
      });

      if (checkout.data[0].status === 'complete') {
        const order = {
          created: checkout.data[0].created,
          customer: checkout.data[0].customer_details.email,
          tickets: {
            player: 0,
            visitor: 0,
          },
          player: checkout.data[0].metadata.presentationTicketPlayerName,
          team: checkout.data[0].metadata.presentationTicketTeam,
        };

        if (checkout.data[0].line_items.data.some((item: any) => item.price.id === playerTickets.id)) {
          playerTickets.total += checkout.data[0].line_items.data.filter((item: any) => item.price.id === playerTickets.id)[0].quantity;
          order.tickets.player = checkout.data[0].line_items.data.filter((item: any) => item.price.id === playerTickets.id)[0].quantity;
        }

        if (checkout.data[0].line_items.data.some((item: any) => item.price.id === visitorTickets.id)) {
          visitorTickets.total += checkout.data[0].line_items.data.filter((item: any) => item.price.id === visitorTickets.id)[0].quantity;
          order.tickets.visitor = checkout.data[0].line_items.data.filter((item: any) => item.price.id === visitorTickets.id)[0].quantity;
        }

        orders.push(order);
      }
    };

    return response.ok({
      status: 'OK',
      code: 200,
      data: {
        totals: {
          player: playerTickets.total,
          visitor: visitorTickets.total,
        },
        orders,
      },
    })
  }
}
