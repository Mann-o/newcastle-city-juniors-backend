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
      // Get players with their transactions in a single optimized query
      const players = await Database
        .from('players')
        .leftJoin('parents', 'players.parent_id', 'parents.id')
        .leftJoin('users', 'parents.user_id', 'users.id')
        .leftJoin('user_permissions', 'users.id', 'user_permissions.user_id')
        .leftJoin('permissions', 'user_permissions.permission_id', 'permissions.id')
        .leftJoin('stripe_transactions', 'players.id', 'stripe_transactions.player_id')
        .select(
          'players.*',
          'parents.first_name as parent_first_name',
          'parents.last_name as parent_last_name',
          'parents.email as parent_email',
          'users.id as user_id',
          'permissions.name as permission_name',
          'stripe_transactions.type as transaction_type',
          'stripe_transactions.status as transaction_status',
          'stripe_transactions.stripe_id as transaction_stripe_id'
        )
        .where('players.team', request.input('team'))
        .orWhere('players.second_team', request.input('team'))
        .orderBy('players.first_name', 'asc')

      // Group data by player
      const playerMap = new Map()

      for (const row of players) {
        if (!playerMap.has(row.id)) {
          playerMap.set(row.id, {
            ...row,
            permissions: [],
            transactions: []
          })
        }

        const player = playerMap.get(row.id)

        // Add permission if not already added
        if (row.permission_name && !player.permissions.includes(row.permission_name)) {
          player.permissions.push(row.permission_name)
        }

        // Add transaction if exists
        if (row.transaction_type) {
          player.transactions.push({
            type: row.transaction_type,
            status: row.transaction_status,
            stripeId: row.transaction_stripe_id
          })
        }
      }

      const formattedPlayers = Array.from(playerMap.values()).map(player => {
        const isCoach = player.permissions.includes('coach')

        let paymentInfo = {
          isCoach,
          upfrontFeePaid: false,
          registrationFeePaid: false,
          subscriptionUpToDate: false,
          notes: null as string | null,
        }

        if (isCoach) {
          // Coaches get free membership
          paymentInfo.upfrontFeePaid = true
          paymentInfo.registrationFeePaid = true
          paymentInfo.subscriptionUpToDate = true
        } else if (player.membership_fee_option === 'upfront') {
          // Check for successful upfront payment
          const upfrontTransaction = player.transactions.find(t =>
            t.type === 'upfront_payment' && t.status === 'succeeded'
          )
          paymentInfo.upfrontFeePaid = !!upfrontTransaction
        } else if (player.membership_fee_option === 'subscription') {
          // Check for successful registration fee
          const registrationTransaction = player.transactions.find(t =>
            t.type === 'registration_fee' && t.status === 'succeeded'
          )
          paymentInfo.registrationFeePaid = !!registrationTransaction

          // Check subscription status
          const subscriptionTransaction = player.transactions.find(t =>
            t.type === 'subscription'
          )

          if (subscriptionTransaction) {
            if (subscriptionTransaction.status === 'active' || subscriptionTransaction.status === 'trialing') {
              paymentInfo.subscriptionUpToDate = true
            } else {
              paymentInfo.notes = `Subscription ${subscriptionTransaction.status}`
            }
          } else {
            paymentInfo.notes = 'No subscription found'
          }
        }

        return {
          id: player.id,
          firstName: player.first_name,
          middleNames: player.middle_names,
          lastName: player.last_name,
          dateOfBirth: player.date_of_birth,
          sex: player.sex,
          medicalConditions: player.medical_conditions,
          membershipFeeOption: player.membership_fee_option,
          ageGroup: player.age_group,
          team: player.team,
          secondTeam: player.second_team,
          stripeUpfrontPaymentId: player.stripe_upfront_payment_id,
          stripeRegistrationFeeId: player.stripe_registration_fee_id,
          stripeSubscriptionId: player.stripe_subscription_id,
          paymentInfo,
          parent: {
            firstName: player.parent_first_name,
            lastName: player.parent_last_name,
            email: player.parent_email,
            userId: player.user_id,
          },
        }
      })

      return response.ok({
        status: 'OK',
        code: 200,
        data: formattedPlayers,
      })
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
