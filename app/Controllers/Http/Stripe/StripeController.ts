import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Mail from '@ioc:Adonis/Addons/Mail'
import Stripe from 'stripe'

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

    /**  */
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
}
