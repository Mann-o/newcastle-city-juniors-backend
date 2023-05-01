import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Stripe from 'stripe'
import Player from 'App/Models/Player'

import { parseISO, getUnixTime, getYear, getMonth, addMonths } from 'date-fns'
import User from 'App/Models/User'

export default class StripeController {
  public async getPresentation2021EventPaymentIntent({ response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: 250,
      currency: 'gbp',
    })

    response.send({
      clientSecret: paymentIntent.client_secret,
    })
  }

  public async getShoppableProducts({ response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    const prices: Stripe.Price[] = []

    for await (const price of stripeClient.prices.list({
      limit: 100,
      active: true,
      expand: ['data.product'],
    })) {
      prices.push(price)
    }

    response.send({
      prices: prices.filter((price: any) => price.product.metadata.list === 'true'),
    })
  }

  public async getAllShoppableProducts({ response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    const products: Stripe.Product[] = []

    for await (const product of stripeClient.products.list({ active: true })) {
      if (product.metadata.list === 'true') {
        products.push(product)
      }
    }

    const productsWithPrices = await Promise.all(
      products.map(async product => {
        const prices: Stripe.Price[] = []

        for await (const price of stripeClient.prices.list({
          product: product.id,
          active: true
        })) {
          prices.push(price)
        }

        return {
          ...product,
          prices: prices,
        }
      })
    )

    response.send({
      products: productsWithPrices.filter(product => product.metadata.list === 'true')
    })
  }

  public async createCheckout({ request, response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      cancel_url: 'https://newcastlecityjuniors.co.uk/cart',
      ...request.body(),
      success_url: `${request.body().success_url}?orderId={CHECKOUT_SESSION_ID}`,
    })

    if (session.url) {
      response.send({
        checkoutUrl: session.url,
      })
    } else {
      response.abort('Unable to create a Stripe checkout session', 502)
    }
  }

  public async getPaymentsForUser({ auth, response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
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
      apiVersion: Env.get('STRIPE_API_VERSION'),
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
      apiVersion: Env.get('STRIPE_API_VERSION'),
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

  public async getOrder({ request, response }: HttpContextContract) {
    if (request.body().orderId) {
      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: Env.get('STRIPE_API_VERSION'),
      })

      const order = await stripeClient.checkout.sessions.retrieve(request.body().orderId, {
        expand: ['line_items'],
      })

      if (order) {
        return response.ok(order)
      }

      return response.notFound({
        status: 'error',
        error: 'Order not found',
      })
    }

    return response.badRequest({
      status: 'error',
      error: 'No order ID was provided in the request',
    })
  }
}
