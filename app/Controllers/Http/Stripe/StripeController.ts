import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Mail from '@ioc:Adonis/Addons/Mail'
import Stripe from 'stripe'
import Player from 'App/Models/Player'

import { parseISO, getUnixTime, getYear, getMonth, addMonths } from 'date-fns'
import User from 'App/Models/User'

export default class StripeController {
  public async getPresentation2021EventPaymentIntent({ response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: '2020-08-27',
    })

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: 250,
      currency: 'gbp',
    })

    response.send({
      clientSecret: paymentIntent.client_secret,
    })
  }

  public async createCheckout({ request, response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: '2020-08-27',
    })

    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      ...request.body(),
      cancel_url: '',
      success_url: '',
    })

    response.send({
      id: session.id,
    })
  }

  public async handleCheckoutWebhook({ request, response }: HttpContextContract) {
    const { data, type } = request.body()

    if (type === 'checkout.session.completed') {
      if (data?.object?.metadata?.event === 'presentation-2021') {
        const email = data.object.customer_email
        const metadata = {
          ...data.object.metadata,
          total_cost: data.object.amount_total,
        }

        // send email!
        Mail.send(message => {
          message
            .from('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
            .to(email)
            .subject('Presentation 2020-21 Tickets')
            .htmlView('emails/presentation-2021', { metadata })
        })
      }
    }

    response.ok({ status: 'success' })
  }

  public async getPaymentsForUser({ auth, response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: '2020-08-27',
    })

    const authenticatedUser = auth.use('api').user!

    const payments = await stripeClient.charges.list({
      customer: authenticatedUser.stripeCustomerId,
    })

    return response.ok({
      status: 'OK',
      code: 200,
      data: payments,
    })
  }

  public async createCustomerPortalSession({ auth, request, response }: HttpContextContract) {
    const authenticatedUser = auth.use('api').user!
    const returnUrl = request.input('returnUrl')

    const user = await User.query().where('id', authenticatedUser.id).first()

    if (!user) {
      return response.unauthorized({
        status: 'Unauthorised',
        code: 401,
        message: 'User is not authorised to make this request',
      })
    }

    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: '2020-08-27',
    })

    const session = await stripeClient.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    })

    return response.ok({
      status: 'OK',
      code: 200,
      data: session,
    })
  }

  public async createSubscriptionForUser({ auth, request, response }: HttpContextContract) {
    const authenticatedUser = auth.use('api').user!
    const playerId = request.input('playerId')
    const subscriptionDate = request.input('subscriptionDate').padStart(2, '0')

    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: '2020-08-27',
    })

    const user = await User.query().where('id', authenticatedUser.id).first()
    const player = await Player.query().where('id', playerId).first()

    try {
      if (!user) {
        return response.unauthorized({
          status: 'Unauthorised',
          code: 401,
          message: 'User is not authorised to make this request',
        })
      }

      if (!player) {
        return response.notFound({
          status: 'Not Found',
          code: 404,
          message: 'Player not found',
        })
      }

      if (player.membershipFeeOption !== 'subscription') {
        return response.badRequest({
          status: 'Bad Request',
          code: 400,
          message: 'Player is not configured for subscriptions',
        })
      }

      const trialEndDate = addMonths(new Date(), 1)

      const subscription = await stripeClient.subscriptions.create({
        customer: user.stripeCustomerId,
        trial_end: getUnixTime(
          parseISO(`${getYear(trialEndDate)}-${(getMonth(trialEndDate) + 1).toString().padStart(2, '0')}-${subscriptionDate}`),
        ),
        cancel_at: getUnixTime(parseISO('2022-05-16')),
        items: [{ price: Env.get(`STRIPE_SUBSCRIPTION_PRICE_ID_${player.sex.toUpperCase()}`) }],
        proration_behavior: 'none',
      })

      player.stripeSubscriptionId = subscription.id
      await player.save()

      return response.ok({
        status: 'OK',
        code: 200,
        message: 'Subscription created successfully',
      })
    } catch (error) {
      console.log(error)

      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to create subscription',
      })
    }
  }
}
