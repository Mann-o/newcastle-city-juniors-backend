import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'

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
    const paymentIntents = [
      'pi_3N7E9uJgy48auTmo01zzCTEI',
      'pi_3N73BnJgy48auTmo04FueVnj',
      'pi_3N72aBJgy48auTmo0DnbHPLg',
      'pi_3N722LJgy48auTmo0z3VEdAp',
      'pi_3N70FCJgy48auTmo0P1OjC5a',
      'pi_3N70COJgy48auTmo0nNsouBc',
      'pi_3N70BtJgy48auTmo1qFpUUoP',
      'pi_3N6zsxJgy48auTmo0fCz0Gu5',
      'pi_3N6zKlJgy48auTmo1FEsjEsq',
      'pi_3N6z4kJgy48auTmo1RjgXepE',
      'pi_3N6x01Jgy48auTmo1XAf4fYh',
      'pi_3N6wNeJgy48auTmo11kHmVT6',
      'pi_3N6wB4Jgy48auTmo0h9l2V4M',
      'pi_3N6vtJJgy48auTmo0TXUWa2P',
      'pi_3N6uXoJgy48auTmo1F3arB2K',
      'pi_3N6uVpJgy48auTmo1ejjIGfY',
      'pi_3N6uGvJgy48auTmo14tlJr7U',
      'pi_3N6tLMJgy48auTmo0vWJEOIM',
      'pi_3N6tJBJgy48auTmo0qGQtWPu',
      'pi_3N6tEiJgy48auTmo1kgWKigd',
      'pi_3N6sz5Jgy48auTmo1t6BoTPZ',
      'pi_3N6sx8Jgy48auTmo04YIyQ0o',
      'pi_3N6ssHJgy48auTmo1Ijx5zcP',
      'pi_3N6skpJgy48auTmo1TFkM7Y5',
      'pi_3N6sbZJgy48auTmo1qavbbav',
      'pi_3N6sa3Jgy48auTmo0VqfCLEW',
      'pi_3N6sKRJgy48auTmo0ehDdC3A',
      'pi_3N6rv0Jgy48auTmo1zGamGV6',
      'pi_3N6rbPJgy48auTmo07yP9ooe',
      'pi_3N6rYZJgy48auTmo1KksWe5g',
      'pi_3N6rLDJgy48auTmo0GCTE2cp',
      'pi_3N6r1TJgy48auTmo0KjPh0KP',
      'pi_3N6qRdJgy48auTmo0pZmdy0w',
      'pi_3N6qJvJgy48auTmo1tITK0mW',
      'pi_3N6qBvJgy48auTmo0DATShXn',
      'pi_3N6qBbJgy48auTmo1lkUBYWl',
      'pi_3N6q63Jgy48auTmo1BxRmnjf',
      'pi_3N6q3KJgy48auTmo0cwtdvA4',
      'pi_3N6q1JJgy48auTmo18vROPZY',
      'pi_3N6fmbJgy48auTmo18xQj9lD',
      'pi_3N6eTBJgy48auTmo09E35RvI',
      'pi_3N6eHWJgy48auTmo05QyhPFa',
      'pi_3N6cUmJgy48auTmo0q6jLLfd',
      'pi_3N6cLWJgy48auTmo0D80gQnA',
      'pi_3N6c6iJgy48auTmo1Gl29a7h',
      'pi_3N6c78Jgy48auTmo1hX4BB6V',
      'pi_3N6M5gJgy48auTmo0oUDDgmU',
      'pi_3N6KeuJgy48auTmo1sWArqPB',
      'pi_3N6JvHJgy48auTmo1HGOmRoL',
      'pi_3N6J4SJgy48auTmo1roGzAYZ',
      'pi_3N6Fh9Jgy48auTmo0yfu3g3B',
      'pi_3N6Bl3Jgy48auTmo1VROMzJ5',
      'pi_3N6AJKJgy48auTmo1I5PricC',
      'pi_3N69TrJgy48auTmo141LVHUk',
      'pi_3N675BJgy48auTmo0Y04tTKl',
      'pi_3N674NJgy48auTmo1J6Ld3cE',
      'pi_3N66i4Jgy48auTmo1Uu01Ina',
      'pi_3N65yaJgy48auTmo1CilG2Gs',
      'pi_3N5wkEJgy48auTmo0EACw8H2',
      'pi_3N5w9NJgy48auTmo1sQe8ibh',
      'pi_3N5w1zJgy48auTmo1YsfrEo7',
      'pi_3N5vwNJgy48auTmo1RoIYJDA',
      'pi_3N5uhRJgy48auTmo0ZR9nMKv',
      'pi_3N5qdpJgy48auTmo0HP2MM0u',
      'pi_3N5nmfJgy48auTmo06iHLlfO',
      'pi_3N5n29Jgy48auTmo1CoOKdl4',
      'pi_3N5mYdJgy48auTmo05eEAMdg',
      'pi_3N5jkZJgy48auTmo071OQunI',
      'pi_3N5ZAiJgy48auTmo1fR1xu1d',
      'pi_3N5YO9Jgy48auTmo18q3pO7f',
      'pi_3N5UtRJgy48auTmo1RUQZ2V8',
      'pi_3N5UMmJgy48auTmo018XMS1j',
      'pi_3N5U3rJgy48auTmo0U7ZxHEB',
      'pi_3N5Tw2Jgy48auTmo1SjOgOHB',
      'pi_3N5Sl8Jgy48auTmo13RVKdya',
      'pi_3N5RSoJgy48auTmo1d16k0a1',
      'pi_3N5RJiJgy48auTmo0gYR6EEG',
      'pi_3N5RJWJgy48auTmo0zy3aS2d',
      'pi_3N5QefJgy48auTmo1NbpCsTP',
      'pi_3N5QVlJgy48auTmo1UxJvUSy',
      'pi_3N5PrqJgy48auTmo0mqaaboZ',
      'pi_3N58trJgy48auTmo16PVQFjo',
      'pi_3N55wnJgy48auTmo0w9auK4z',
      'pi_3N53pmJgy48auTmo0Ves4Wjv',
      'pi_3N532bJgy48auTmo1slG43hH',
      'pi_3N4sa4Jgy48auTmo1sflA4l4',
      'pi_3N4qggJgy48auTmo17oDkvIb',
      'pi_3N4pKQJgy48auTmo1jAjTVBO',
      'pi_3N4nmsJgy48auTmo0iGn1RPW',
      'pi_3N4nlvJgy48auTmo1cGcD0bl',
      'pi_3N4n8PJgy48auTmo16MLXQiq',
      'pi_3N4mjzJgy48auTmo12uuk4Gr',
      'pi_3N4jxBJgy48auTmo0lSD9Yc3',
      'pi_3N4iPlJgy48auTmo0auxp02z',
      'pi_3N4i8sJgy48auTmo0AO5X4ob',
      'pi_3N4i6vJgy48auTmo1rtxc0VX',
      'pi_3N4htwJgy48auTmo1gZzl0KJ',
      'pi_3N4htjJgy48auTmo09TWIvro',
      'pi_3N4hAuJgy48auTmo1O1SnLgR',
      'pi_3N4h51Jgy48auTmo0I1kOONG',
      'pi_3N4gPrJgy48auTmo0pdhrJge',
      'pi_3N4fIfJgy48auTmo0Ksnk4KV',
      'pi_3N4fIEJgy48auTmo0V6ggX0G',
      'pi_3N4f5DJgy48auTmo05SoCxNa',
      'pi_3N4f3nJgy48auTmo1528yTz4',
      'pi_3N4W8bJgy48auTmo16d5E4kW',
      'pi_3N4VzQJgy48auTmo13TvKWdl',
      'pi_3N4U8SJgy48auTmo0w7yJw77',
      'pi_3N4TlIJgy48auTmo1IFxtEFv',
      'pi_3N4U44Jgy48auTmo1QJmTiq3',
      'pi_3N4TlhJgy48auTmo012h8tA4',
      'pi_3N4Tg6Jgy48auTmo0yUwod98',
      'pi_3N4TXBJgy48auTmo0wo3BwWP',
      'pi_3N4TBoJgy48auTmo0raEw9Ls',
      'pi_3N4RKtJgy48auTmo0XNU0ep8',
      'pi_3N4QmYJgy48auTmo1P3nDc8m',
      'pi_3N4Oe9Jgy48auTmo0CJHawUe',
      'pi_3N4ObmJgy48auTmo1wdKtAlx',
      'pi_3N4OZwJgy48auTmo1OpIXx7H',
      'pi_3N4OXfJgy48auTmo0iFAY24A',
      'pi_3N4IAKJgy48auTmo1dfIt5mI',
      'pi_3N4I8bJgy48auTmo1F1UHNBM',
      'pi_3N47vgJgy48auTmo1pQU20CT',
      'pi_3N47kwJgy48auTmo1Yyiz8Jp',
      'pi_3N47UAJgy48auTmo00YU4FkD',
      'pi_3N45J4Jgy48auTmo1fiufQlR',
      'pi_3N44DVJgy48auTmo06M6WN3x',
      'pi_3N42jXJgy48auTmo1Xv997RA',
      'pi_3N42hFJgy48auTmo1Cq6dpuE',
      'pi_3N42fZJgy48auTmo0lO6MKkp',
      'pi_3N40uWJgy48auTmo0Gjq3GJR',
      'pi_3N3zr5Jgy48auTmo0JTrhmtA',
      'pi_3N3yoHJgy48auTmo0xHschLc',
      'pi_3N3ygjJgy48auTmo1V90YSIe',
      'pi_3N3xqeJgy48auTmo0dfpf5PW',
      'pi_3N3xj6Jgy48auTmo0IgtTLWO',
      'pi_3N3xgdJgy48auTmo0c43K2zZ',
      'pi_3N3xcHJgy48auTmo15McL7vR',
      'pi_3N3wHQJgy48auTmo075dkBOu',
      'pi_3N3vhHJgy48auTmo1yEp695K',
      'pi_3N3vZaJgy48auTmo1NpPDhkY',
      'pi_3N3v7GJgy48auTmo1IHDRnxF',
      'pi_3N3v51Jgy48auTmo0QHPerUz',
      'pi_3N3mxQJgy48auTmo1oorVHiR',
      'pi_3N3mxgJgy48auTmo1WEh7hFg',
      'pi_3N3mosJgy48auTmo0gZdcxcZ',
      'pi_3N3mkkJgy48auTmo1rHNq0lu',
      'pi_3N3mbMJgy48auTmo0GlHPFY0',
      'pi_3N3md6Jgy48auTmo0aKszn9T',
      'pi_3N3mXwJgy48auTmo1jdWj5tA',
      'pi_3N3mTYJgy48auTmo0yFwRwt0',
      'pi_3N3mSMJgy48auTmo1rwMmJPL',
      'pi_3N3mR0Jgy48auTmo0RREZWgd',
      'pi_3N3mKFJgy48auTmo0OxmlU1I',
      'pi_3N3kkFJgy48auTmo0bZeAj0v',
      'pi_3N3mGBJgy48auTmo1FSc4tUE',
      'pi_3N3m60Jgy48auTmo1BVgoocI',
      'pi_3N3lubJgy48auTmo1k30XQG9',
      'pi_3N3lobJgy48auTmo0qCeXYG4',
      'pi_3N3lloJgy48auTmo1d92yipb',
      'pi_3N3llJJgy48auTmo0S2zVvYo',
      'pi_3N3lk0Jgy48auTmo1W0NE8ui',
      'pi_3N3litJgy48auTmo1DufTEtC',
      'pi_3N3lj5Jgy48auTmo1QZqQIl4',
      'pi_3N3lg4Jgy48auTmo16CuEy7Y',
      'pi_3N3lg7Jgy48auTmo1V1qQRTV',
      'pi_3N3lf8Jgy48auTmo15upDuJG',
      'pi_3N3lczJgy48auTmo1RdB4Iy7',
      'pi_3N3labJgy48auTmo1gqUshN2',
      'pi_3N3lVQJgy48auTmo1Vvlm6aZ',
      'pi_3N3lV5Jgy48auTmo04J2FwMx',
      'pi_3N3lV2Jgy48auTmo0dN5QyRk',
      'pi_3N3lSLJgy48auTmo1aQPI94G',
      'pi_3N3lSCJgy48auTmo1krKQyHO',
      'pi_3N3lPnJgy48auTmo19tyq7c6',
      'pi_3N3lN5Jgy48auTmo0ywPNEJm',
      'pi_3N3lPUJgy48auTmo11I2LUlz',
      'pi_3N3lOSJgy48auTmo1zqtXwU4',
      'pi_3N3lNVJgy48auTmo1XXqEOtk',
      'pi_3N3lNiJgy48auTmo00qK4MJp',
      'pi_3N3lMiJgy48auTmo0pF4dUhX',
      'pi_3N3lJmJgy48auTmo0Ss6Ok9m',
      'pi_3N3lEdJgy48auTmo1mWHWhlB',
      'pi_3N3lE6Jgy48auTmo0WrLl9uu',
      'pi_3N3l97Jgy48auTmo18bQUhm6',
      'pi_3N3l7FJgy48auTmo0MQBKXq6',
      'pi_3N3l6ZJgy48auTmo1GoXKoMV',
      'pi_3N3l4cJgy48auTmo0BWhfvPn',
      'pi_3N3l3XJgy48auTmo10av8qyK',
      'pi_3N3l1jJgy48auTmo0SHjbQ0E',
      'pi_3N3l2RJgy48auTmo0x2cgacr',
      'pi_3N3l1pJgy48auTmo0ZQJu4ES',
      'pi_3N3l1aJgy48auTmo11Vdxq7x',
      'pi_3N3kfNJgy48auTmo0L2eQhTS',
      'pi_3N3kzTJgy48auTmo0DC6JtXH',
      'pi_3N3kydJgy48auTmo1HcXRSGH',
      'pi_3N3kvRJgy48auTmo0p2zQ3x6',
      'pi_3N3knDJgy48auTmo0pdm92Zr',
      'pi_3N3kiyJgy48auTmo1Kak7vLi',
      'pi_3N3kf0Jgy48auTmo0Me8QUP4',
      'pi_3N3kfdJgy48auTmo1DHaOwoo',
      'pi_3N3keLJgy48auTmo0QBPNZ6o',
      'pi_3N3kV7Jgy48auTmo0Pp9j5Sj',
      'pi_3N3kY1Jgy48auTmo1V4WeANY',
      'pi_3N3kX0Jgy48auTmo0QqZ7EXK',
      'pi_3N3kWcJgy48auTmo0FhuXqF3',
      'pi_3N3kTJJgy48auTmo16YQsQ6S',
      'pi_3N3kTFJgy48auTmo0w6RQ7AB',
      'pi_3N3kRdJgy48auTmo1FbnPYiK',
      'pi_3N3kNlJgy48auTmo0VA1h8Z9',
      'pi_3N3kMJJgy48auTmo0xlsFxzC',
      'pi_3N3kMnJgy48auTmo0pEaImvA',
      'pi_3N3kGaJgy48auTmo0WziGnqQ',
    ]

    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-payments'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission));

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const playerTickets = {
      id: 'price_1N2sgiJgy48auTmo5gZVPEEb',
      total: 0,
    }

    const visitorTickets = {
      id: 'price_1N2sgdJgy48auTmo0aouX7Kk',
      total: 0,
    }

    const orders: any[] = [];

    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

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
      data: orders,
    })
  }
}
