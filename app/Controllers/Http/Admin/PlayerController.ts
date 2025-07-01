import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Database from '@ioc:Adonis/Lucid/Database'

import Stripe from 'stripe'

import Player from 'App/Models/Player'
import Parent from 'App/Models/Parent'
import User from 'App/Models/User'
import StripeTransactionService from 'App/Services/StripeTransactionService'

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

    // Use the fast local database query instead of slow Stripe API calls
    const transactionService = new StripeTransactionService();
    const ageGroups = await transactionService.getSubscriptionSchedule();

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
            } else {
              // Handle payment error from latest invoice
              try {
                if (
                  subscription.latest_invoice != null
                  && typeof subscription.latest_invoice !== 'string'
                ) {
                  const invoice = subscription.latest_invoice as any; // Type assertion for newer API
                  if (invoice.payment_intent && typeof invoice.payment_intent !== 'string') {
                    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
                    formattedPlayer.paymentInfo.notes = paymentIntent.last_payment_error?.message || 'Payment failed'
                  } else {
                    formattedPlayer.paymentInfo.notes = 'Payment failed'
                  }
                } else {
                  formattedPlayer.paymentInfo.notes = 'No invoice found'
                }
              } catch (error) {
                formattedPlayer.paymentInfo.notes = 'Unable to retrieve payment status'
              }
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

  public async setDefaultPaymentMethod({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-payments'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission)) || userPermissions.includes('sudo');

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const users: User[] = await User.all()

    if (users.length > 0) {
      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: Env.get('STRIPE_API_VERSION'),
      })

      // Check if the user has a default payment method, and if not set it to their last used payment method
      for (const user of users) {
        const customer = await stripeClient.customers.retrieve(user.stripeCustomerId) as Stripe.Customer

        if (customer?.default_source == null) {
          const paymentMethods = await stripeClient.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: 'card',
          })

          if (paymentMethods.data.length > 0) {
            const defaultPaymentMethod = paymentMethods.data[paymentMethods.data.length - 1]

            await stripeClient.customers.update(user.stripeCustomerId, {
              invoice_settings: {
                default_payment_method: defaultPaymentMethod.id,
              },
            })
          }
        }
      }
    }

    return response.ok({
      status: 'OK',
      code: 200,
      data: {
        message: 'success',
      },
    })
  }

  public async getParentEmails({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const requiredPermissions = ['staff'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission)) || userPermissions.includes('sudo');

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const players: Player[] = await Player.query().preload('parent')

    if (players.length > 0) {
      const parentEmails = players
        .filter(player => player?.parent?.email != null)
        .map(player => player.parent.email)
        .filter((value: String, index: Number, self: String[]) => {
          return self.indexOf(value) === index
        })

      return response.ok({
        status: 'OK',
        code: 200,
        data: {
          parentEmails,
        },
      })
    }
  }

  public async getGiftAidDeclarations({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const requiredPermissions = ['staff', 'view-players'];
    const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
    const hasRequiredPermissions = requiredPermissions.every(requiredPermission => userPermissions.includes(requiredPermission));

    if (!hasRequiredPermissions) {
      return response.unauthorized()
    }

    const transactionService = new StripeTransactionService();
    const giftAidData = await transactionService.getGiftAidDeclarations();

    return response.ok({
      status: 'OK',
      code: 200,
      data: giftAidData,
    })
  }
}
