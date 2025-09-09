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
      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: Env.get('STRIPE_API_VERSION'),
      })

      // Get players with their basic info and relationships
      const players = await Database
        .from('players')
        .leftJoin('parents', 'players.parent_id', 'parents.id')
        .leftJoin('users', 'parents.user_id', 'users.id')
        .leftJoin('user_permissions', 'users.id', 'user_permissions.user_id')
        .leftJoin('permissions', 'user_permissions.permission_id', 'permissions.id')
        .select(
          'players.*',
          'parents.first_name as parent_first_name',
          'parents.last_name as parent_last_name',
          'parents.email as parent_email',
          'users.id as user_id',
          'users.stripe_customer_id as stripe_customer_id',
          'permissions.name as permission_name'
        )
        .where('players.team', request.input('team'))
        .orWhere('players.second_team', request.input('team'))
        .orderBy('players.first_name', 'asc')

      // Group data by player and collect permissions
      const playerMap = new Map()
      for (const row of players) {
        if (!playerMap.has(row.id)) {
          playerMap.set(row.id, {
            ...row,
            permissions: []
          })
        }

        const player = playerMap.get(row.id)
        if (row.permission_name && !player.permissions.includes(row.permission_name)) {
          player.permissions.push(row.permission_name)
        }
      }

      // Calculate the season months (July to May)
      const now = new Date()
      const currentMonth = now.getMonth() + 1 // 1-12
      const currentYear = now.getFullYear()

      // Determine season year based on current month
      let seasonStartYear = currentYear
      if (currentMonth >= 1 && currentMonth <= 5) {
        seasonStartYear = currentYear - 1 // We're in Jan-May, so season started previous year
      }

      // Generate season months array (July to May)
      const seasonMonths: Array<{
        month: number;
        year: number;
        name: string;
        key: string;
      }> = []

      for (let i = 0; i < 11; i++) {
        const monthIndex = (6 + i) % 12 // July = 6, wraps to May = 4
        const year = monthIndex >= 6 ? seasonStartYear : seasonStartYear + 1
        seasonMonths.push({
          month: monthIndex + 1, // Convert to 1-12
          year: year,
          name: new Date(year, monthIndex, 1).toLocaleString('default', { month: 'long' }),
          key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`
        })
      }

      const formattedPlayers: any[] = []

      for (const player of Array.from(playerMap.values())) {
        const isCoach = player.permissions.includes('coach')
        const playerRegistrationDate = new Date(player.created_at)

        let paymentInfo = {
          isCoach,
          upfrontFeePaid: false,
          registrationFeePaid: false,
          subscriptionUpToDate: false,
          monthlyPayments: [] as any[],
          notes: null as string | null,
        }

        if (isCoach) {
          // Coaches get free membership
          paymentInfo.upfrontFeePaid = true
          paymentInfo.registrationFeePaid = true
          paymentInfo.subscriptionUpToDate = true
        } else if (player.membership_fee_option === 'upfront') {
          // Query Stripe for upfront payment status
          if (player.stripe_customer_id && player.stripe_upfront_payment_id) {
            try {
              const paymentIntent = await stripeClient.paymentIntents.retrieve(player.stripe_upfront_payment_id, {
                expand: ['charges']
              })
              paymentInfo.upfrontFeePaid = paymentIntent.status === 'succeeded'

              // Check for refunds
              const paymentIntentData = paymentIntent as any
              if (paymentIntentData.charges?.data?.length > 0) {
                const charge = paymentIntentData.charges.data[0]
                if (charge.refunded) {
                  paymentInfo.notes = `Partially refunded: £${(charge.amount_refunded / 100).toFixed(2)} of £${(charge.amount / 100).toFixed(2)}`
                }
              }
            } catch (error) {
              console.error(`Error fetching upfront payment for player ${player.id}:`, error)
              paymentInfo.notes = 'Error fetching payment status'
            }
          }
        } else if (player.membership_fee_option === 'subscription') {
          // Handle subscription-based payments with month-by-month view
          if (player.stripe_customer_id) {
            try {
              // Get the subscription
              let subscription: Stripe.Subscription | null = null
              if (player.stripe_subscription_id) {
                try {
                  subscription = await stripeClient.subscriptions.retrieve(player.stripe_subscription_id)
                } catch (error) {
                  console.error(`Error fetching subscription ${player.stripe_subscription_id}:`, error)
                }
              }

              // Get all invoices for this customer
              const invoices = await stripeClient.invoices.list({
                customer: player.stripe_customer_id,
                limit: 100
              })

              // Get all payment intents for registration fees
              const paymentIntents = await stripeClient.paymentIntents.list({
                customer: player.stripe_customer_id,
                limit: 100,
                expand: ['data.charges']
              })

              // Check registration fee
              const registrationPayment = paymentIntents.data.find(pi =>
                pi.id === player.stripe_registration_fee_id
              )
              if (registrationPayment) {
                paymentInfo.registrationFeePaid = registrationPayment.status === 'succeeded'
              }

              // Process month-by-month payments
              for (const seasonMonth of seasonMonths) {
                const monthKey = seasonMonth.key
                const monthStart = new Date(seasonMonth.year, seasonMonth.month - 1, 1)
                const monthEnd = new Date(seasonMonth.year, seasonMonth.month, 0, 23, 59, 59)

                // Check if player was registered before this month
                if (playerRegistrationDate > monthEnd) {
                  paymentInfo.monthlyPayments.push({
                    month: seasonMonth.name,
                    year: seasonMonth.year,
                    monthKey: monthKey,
                    status: 'N/A',
                    reason: 'Player not yet registered',
                    amount: null,
                    refunded: null
                  })
                  continue
                }

                // Find invoice for this month
                const monthInvoice = invoices.data.find(invoice => {
                  const invoiceDate = new Date(invoice.created * 1000)
                  return invoiceDate >= monthStart && invoiceDate <= monthEnd
                })

                if (monthInvoice) {
                  let status = 'failed'
                  let reason = 'Unknown'

                  switch (monthInvoice.status) {
                    case 'paid':
                      status = 'paid'
                      reason = 'Payment successful'
                      break
                    case 'open':
                      // Check if payment is due yet
                      const dueDate = new Date(monthInvoice.due_date! * 1000)
                      const today = new Date()
                      if (today < dueDate) {
                        status = 'pending'
                        reason = `Payment due ${dueDate.toLocaleDateString()}`
                      } else {
                        status = 'overdue'
                        reason = `Payment overdue since ${dueDate.toLocaleDateString()}`
                      }
                      break
                    case 'uncollectible':
                      status = 'failed'
                      reason = 'Payment uncollectible'
                      break
                    case 'void':
                      status = 'void'
                      reason = 'Invoice voided'
                      break
                    default:
                      status = 'failed'
                      reason = `Invoice status: ${monthInvoice.status}`
                  }

                  // Check for refunds
                  let refundedAmount = 0
                  const invoiceData = monthInvoice as any
                  if (invoiceData.charge) {
                    try {
                      const charge = await stripeClient.charges.retrieve(invoiceData.charge as string)
                      refundedAmount = charge.amount_refunded
                    } catch (error) {
                      // Ignore charge fetch errors
                    }
                  }

                  paymentInfo.monthlyPayments.push({
                    month: seasonMonth.name,
                    year: seasonMonth.year,
                    monthKey: monthKey,
                    status: status,
                    reason: reason,
                    amount: monthInvoice.amount_paid / 100,
                    originalAmount: monthInvoice.total / 100,
                    refunded: refundedAmount > 0 ? refundedAmount / 100 : null,
                    invoiceId: monthInvoice.id,
                    dueDate: monthInvoice.due_date ? new Date(monthInvoice.due_date * 1000) : null
                  })
                } else {
                  // No invoice found for this month
                  const isFirstMonth = playerRegistrationDate >= monthStart && playerRegistrationDate <= monthEnd

                  if (isFirstMonth && registrationPayment) {
                    // This is the registration month, show registration payment status
                    let refundedAmount = 0
                    const registrationData = registrationPayment as any
                    if (registrationData.charges?.data?.length > 0) {
                      const charge = registrationData.charges.data[0]
                      refundedAmount = charge.amount_refunded
                    }

                    paymentInfo.monthlyPayments.push({
                      month: seasonMonth.name,
                      year: seasonMonth.year,
                      monthKey: monthKey,
                      status: registrationPayment.status === 'succeeded' ? 'paid' : 'failed',
                      reason: registrationPayment.status === 'succeeded' ? 'Registration fee (includes first month)' : 'Registration payment failed',
                      amount: registrationPayment.status === 'succeeded' ? registrationPayment.amount / 100 : 0,
                      originalAmount: registrationPayment.amount / 100,
                      refunded: refundedAmount > 0 ? refundedAmount / 100 : null,
                      paymentIntentId: registrationPayment.id
                    })
                  } else {
                    // Missing invoice for a month where payment should exist
                    paymentInfo.monthlyPayments.push({
                      month: seasonMonth.name,
                      year: seasonMonth.year,
                      monthKey: monthKey,
                      status: 'missing',
                      reason: 'No invoice found for this month',
                      amount: null,
                      refunded: null
                    })
                  }
                }
              }

              // Overall subscription status
              if (subscription) {
                paymentInfo.subscriptionUpToDate = ['active', 'trialing'].includes(subscription.status)
                if (!paymentInfo.subscriptionUpToDate) {
                  paymentInfo.notes = `Subscription ${subscription.status}`
                }
              } else {
                paymentInfo.notes = 'No active subscription found'
              }

            } catch (error) {
              console.error(`Error fetching subscription data for player ${player.id}:`, error)
              paymentInfo.notes = 'Error fetching subscription status'
            }
          }
        }

        formattedPlayers.push({
          id: player.id,
          createdAt: player.created_at,
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
          stripeCustomerId: player.stripe_customer_id,
          paymentInfo,
          parent: {
            firstName: player.parent_first_name,
            lastName: player.parent_last_name,
            email: player.parent_email,
            userId: player.user_id,
          },
        })
      }

      return response.ok({
        status: 'OK',
        code: 200,
        data: {
          players: formattedPlayers,
          seasonMonths: seasonMonths,
          seasonInfo: {
            startYear: seasonStartYear,
            endYear: seasonStartYear + 1,
            currentMonth: currentMonth,
            currentYear: currentYear
          }
        },
      })
    } catch (error) {
      console.error('Error in getSubsStatusForTeam:', error)
      return response.internalServerError({
        status: 'ERROR',
        code: 500,
        message: 'Internal server error',
        error: error.message
      })
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
