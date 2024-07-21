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

    const players = (await Player.all()).sort((a, b) => (a.ageGroup as any) - (b.ageGroup as any))

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
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission)) || userPermissions.includes('sudo');

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const orders = await Database.from('presentation_2023_2024').orderBy('id', 'asc')

    return response.ok({
      status: 'OK',
      code: 200,
      data: {
        orders,
      },
    })
  }

  public async getSubsStatusForTeam({ auth, response, request }: HttpContextContract) {
    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-payments']
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => {
      return userPermissions.includes(requiredPermission)
        || userPermissions.includes('sudo')
    })

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    try {
      const players: Player[] = await Player.query()
        .where('team', request.input('team'))
        .orWhere('second_team', request.input('team'))
        .preload('parent', pq => pq.preload('user', uq => uq.preload('permissions')))
        .orderBy('first_name', 'asc')

      let formattedPlayers: any[] = []

      const expectedCosts = {
        singleTeam: {
          male: {
            upfront: 360,
            subscription: {
              monthly: 34,
              registration: 68,
            },
          },
          female: {
            upfront: 320,
            subscription: {
              monthly: 30,
              registration: 60,
            },
          },
        },
        dualTeam: {
          male: {
            upfront: 550,
            subscription: {
              monthly: 51,
              registration: 85,
            },
          },
          female: {
            upfront: 475,
            subscription: {
              monthly: 45,
              registration: 75,
            },
          },
        },
      }

      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: Env.get('STRIPE_API_VERSION'),
      })

      for (const player of players) {
        const formattedPlayer: any = {
          ...player.serialize(),
          paymentInfo: {
            isCoach: player.parent.user.permissions.some(({ name }) => name === 'coach'),
            upfrontFeePaid: false,
            registrationFeePaid: false,
            subscriptionUpToDate: false,
            notes: null,
          },
        }

        if (formattedPlayer.paymentInfo.isCoach) {
          formattedPlayer.paymentInfo.upfrontFeePaid = true
          formattedPlayer.paymentInfo.registrationFeePaid = true
          formattedPlayer.paymentInfo.subscriptionUpToDate = true

        } else if (player.membershipFeeOption === 'upfront') {
          if (player.stripeUpfrontPaymentId != null) {
            const payment: Stripe.PaymentIntent = await stripeClient.paymentIntents.retrieve(player.stripeUpfrontPaymentId)

            if (payment.status === 'succeeded') {
              formattedPlayer.paymentInfo.upfrontFeePaid = true
            }
          } else {
            const expectedCost = expectedCosts[(player.secondTeam !== 'none') ? 'dualTeam' : 'singleTeam'][player.sex].upfront

            const paymentIntents = await stripeClient.paymentIntents.list({
              customer: player.parent.user.stripeCustomerId,
              created: {
                gt: 1719792000,
              },
            })

            const paymentIntent = paymentIntents.data.find(({ amount }) => amount === expectedCost * 100)

            if (paymentIntent && paymentIntent.status === 'succeeded') {
              player.stripeUpfrontPaymentId = paymentIntent.id
              await player.save()
              formattedPlayer.paymentInfo.upfrontFeePaid = true
            }
          }

        } else if (player.membershipFeeOption === 'subscription') {
          if (player.stripeRegistrationFeeId != null) {
            const payment: Stripe.PaymentIntent = await stripeClient.paymentIntents.retrieve(player.stripeRegistrationFeeId)

            if (payment.status === 'succeeded') {
              formattedPlayer.paymentInfo.registrationFeePaid = true
            }
          } else {
            const expectedCost = expectedCosts[(player.secondTeam !== 'none') ? 'dualTeam' : 'singleTeam'][player.sex].subscription.registration

            const paymentIntents = await stripeClient.paymentIntents.list({
              customer: player.parent.user.stripeCustomerId,
              created: {
                gt: 1719792000,
              },
            })

            const paymentIntent = paymentIntents.data.find(({ amount }) => amount === expectedCost * 100)

            if (paymentIntent && paymentIntent.status === 'succeeded') {
              player.stripeRegistrationFeeId = paymentIntent.id
              await player.save()
              formattedPlayer.paymentInfo.registrationFeePaid = true
            }
          }

          if (player.stripeSubscriptionId) {
            const subscription: Stripe.Subscription = await stripeClient.subscriptions.retrieve(player.stripeSubscriptionId, {
              expand: [
                'latest_invoice.payment_intent',
                'schedule',
              ],
            })

            if (subscription.status === 'active' || subscription.status === 'trialing') {
              formattedPlayer.paymentInfo.subscriptionUpToDate = true
            } else if (
              subscription.latest_invoice != null
              && typeof subscription.latest_invoice !== 'string'
              && typeof subscription.latest_invoice.payment_intent !== 'string'
            ) {
              formattedPlayer.paymentInfo.notes = subscription.latest_invoice.payment_intent?.last_payment_error?.message || 'Unknown Error'
            } else {
              formattedPlayer.paymentInfo.notes = 'Unknown Error'
            }
          } else {
            formattedPlayer.paymentInfo.notes = 'Subscription not found'
          }
        }

        formattedPlayers.push(formattedPlayer)
      }

      return formattedPlayers
    } catch (error) {
      console.log(error)
      return response.internalServerError()
    }
  }
}
