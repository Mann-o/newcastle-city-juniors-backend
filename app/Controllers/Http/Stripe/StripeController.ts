import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
import Env from '@ioc:Adonis/Core/Env'
import Stripe from 'stripe'
import Player from 'App/Models/Player'
import User from 'App/Models/User'

import { parseISO, getUnixTime, getYear, getMonth, addMonths } from 'date-fns'

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
        cancel_at: getUnixTime(parseISO('2025-05-16')),
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

  public async createSummerCamp2023PaymentIntent({ request, response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    let paymentIntent: Stripe.PaymentIntent
    let isUpdate: boolean = false

    if (request.input('paymentIntentId') != null) {
      paymentIntent = await stripeClient.paymentIntents.update(request.input('paymentIntentId'), {
        amount: request.input('amount'),
        currency: 'gbp',
        metadata: {
          emailAddress: request.input('form.emailAddress'),
          clubName: request.input('form.clubName'),
          teamName: request.input('form.teamName'),
          ageGroup: request.input('form.ageGroup'),
          coachName: request.input('form.coachName'),
          contactNumber: request.input('form.contactNumber'),
          acceptedCoachQualificationAgreement: request.input('form.acceptedCoachQualificationAgreement'),
          acceptedOrganiserDecisionAgreement: request.input('form.acceptedOrganiserDecisionAgreement'),
          orderType: 'summer-camp-2023',
        },
      })

      isUpdate = true
    } else {
      paymentIntent = await stripeClient.paymentIntents.create({
        amount: request.input('amount'),
        currency: 'gbp',
        metadata: {
          emailAddress: request.input('form.emailAddress'),
          clubName: request.input('form.clubName'),
          teamName: request.input('form.teamName'),
          ageGroup: request.input('form.ageGroup'),
          coachName: request.input('form.coachName'),
          contactNumber: request.input('form.contactNumber'),
          acceptedCoachQualificationAgreement: request.input('form.acceptedCoachQualificationAgreement'),
          acceptedOrganiserDecisionAgreement: request.input('form.acceptedOrganiserDecisionAgreement'),
          orderType: 'summer-camp-2023',
        },
      })
    }

    return response.ok({
      status: 'OK',
      code: 200,
      paymentIntent,
      isUpdate,
    })
  }

  public async createSummerCup2024PaymentIntent({ request, response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    let paymentIntent: Stripe.PaymentIntent
    let isUpdate: boolean = false

    if (request.input('paymentIntentId') != null) {
      paymentIntent = await stripeClient.paymentIntents.update(request.input('paymentIntentId'), {
        amount: request.input('amount'),
        currency: 'gbp',
        metadata: {
          clubName: request.input('form.clubName'),
          teamName: request.input('form.teamName'),
          abilityLevel: request.input('form.abilityLevel'),
          tournamentEntry: request.input('form.tournamentEntry'),
          coachName: request.input('form.coachName'),
          contactNumber: request.input('form.contactNumber'),
          emailAddress: request.input('form.emailAddress'),
          acceptedNextYearsAgeGroupAgreement: request.input('form.acceptedNextYearsAgeGroupAgreement'),
          acceptedCoachQualificationAgreement: request.input('form.acceptedCoachQualificationAgreement'),
          acceptedOrganiserDecisionAgreement: request.input('form.acceptedOrganiserDecisionAgreement'),
          orderType: 'summer-cup-2024',
        },
      })

      isUpdate = true
    } else {
      paymentIntent = await stripeClient.paymentIntents.create({
        amount: request.input('amount'),
        currency: 'gbp',
        metadata: {
          clubName: request.input('form.clubName'),
          teamName: request.input('form.teamName'),
          abilityLevel: request.input('form.abilityLevel'),
          tournamentEntry: request.input('form.tournamentEntry'),
          coachName: request.input('form.coachName'),
          contactNumber: request.input('form.contactNumber'),
          emailAddress: request.input('form.emailAddress'),
          acceptedNextYearsAgeGroupAgreement: request.input('form.acceptedNextYearsAgeGroupAgreement'),
          acceptedCoachQualificationAgreement: request.input('form.acceptedCoachQualificationAgreement'),
          acceptedOrganiserDecisionAgreement: request.input('form.acceptedOrganiserDecisionAgreement'),
          orderType: 'summer-cup-2024',
        },
      })
    }

    return response.ok({
      status: 'OK',
      code: 200,
      paymentIntent,
      isUpdate,
    })
  }

  public async createFootyTalkIn2023PaymentIntent({ request, response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    let paymentIntent: Stripe.PaymentIntent
    let isUpdate: boolean = false

    if (request.input('paymentIntentId') != null) {
      paymentIntent = await stripeClient.paymentIntents.update(request.input('paymentIntentId'), {
        amount: request.input('amount'),
        currency: 'gbp',
        metadata: {
          fullName: request.input('form.fullName'),
          houseNameAndNumber: request.input('form.houseNameAndNumber'),
          city: request.input('form.city'),
          postcode: request.input('form.postcode'),
          emailAddress: request.input('form.emailAddress'),
          contactNumber: request.input('form.contactNumber'),
          bookingName: request.input('form.bookingName'),
          orderType: 'footy-talk-in-2023',
        },
      })

      isUpdate = true
    } else {
      paymentIntent = await stripeClient.paymentIntents.create({
        amount: request.input('amount'),
        currency: 'gbp',
        metadata: {
          fullName: request.input('form.fullName'),
          houseNameAndNumber: request.input('form.houseNameAndNumber'),
          city: request.input('form.city'),
          postcode: request.input('form.postcode'),
          emailAddress: request.input('form.emailAddress'),
          contactNumber: request.input('form.contactNumber'),
          bookingName: request.input('form.bookingName'),
          orderType: 'footy-talk-in-2023',
        },
      })
    }

    return response.ok({
      status: 'OK',
      code: 200,
      paymentIntent,
      isUpdate,
    })
  }

  public async getSummerCup2024Places({ response }: HttpContextContract) {
    const placesRemainingJson = await Database.from('config').where('key', 'summer_cup_2024_places_remaining').select('value').first()

    const placesRemaining = placesRemainingJson.value

    return response.ok({
      status: 'OK',
      code: 200,
      data: {
        placesRemaining,
      },
    })
  }

  public async createPresentation2023PaymentIntent({ request, response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    })

    let paymentIntent: Stripe.PaymentIntent
    let isUpdate: boolean = false

    if (request.input('paymentIntentId') != null) {
      paymentIntent = await stripeClient.paymentIntents.update(request.input('paymentIntentId'), {
        amount: request.input('amount'),
        currency: 'gbp',
        metadata: {
          childName: request.input('form.childName'),
          ageGroup: request.input('form.ageGroup'),
          teamName: request.input('form.teamName'),
          coachName: request.input('form.coachName'),
          ticketsRequired: request.input('form.ticketsRequired'),
          guestNames: request.input('form.guestNames'),
          emailAddress: request.input('form.emailAddress'),
          hasPlayerTicket: request.input('form.hasPlayerTicket'),
          orderType: 'presentation-2023',
        },
      })

      isUpdate = true
    } else {
      paymentIntent = await stripeClient.paymentIntents.create({
        amount: request.input('amount'),
        currency: 'gbp',
        metadata: {
          childName: request.input('form.childName'),
          ageGroup: request.input('form.ageGroup'),
          teamName: request.input('form.teamName'),
          coachName: request.input('form.coachName'),
          ticketsRequired: request.input('form.ticketsRequired'),
          guestNames: request.input('form.guestNames'),
          emailAddress: request.input('form.emailAddress'),
          hasPlayerTicket: request.input('form.hasPlayerTicket'),
          orderType: 'presentation-2023',
        },
      })
    }

    return response.ok({
      status: 'OK',
      code: 200,
      paymentIntent,
      isUpdate,
    })
  }
}

