// @ts-nocheck
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Mail from '@ioc:Adonis/Addons/Mail'
import Stripe from 'stripe'

export default class StripeController {
  public async getPresentation2021EventPaymentIntent({ response }: HttpContextContract) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION', '2020-08-27'),
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
      apiVersion: Env.get('STRIPE_API_VERSION', '2020-08-27'),
    })

    /**  */
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      ...request.body(),
    })

    response.send({
      id: session.id,
    })
  }

  public async handleCheckoutWebhook({ request, response }: HttpContextContract) {
    const { data, type } = request.body()

    if (type === 'checkout.session.completed') {
      console.log(request.body())
      if (data?.object?.metadata?.event === 'presentation-2021') {
        const email = data.object.customer_email
        const metadata = {
          ...data.object.metadata,
          total_cost: data.object.amount_total,
        }

        console.log({ email, metadata })

        // send email!
        Mail.send((message) => {
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
}
