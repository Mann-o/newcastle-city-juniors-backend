import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Mail from '@ioc:Adonis/Addons/Mail'

import QRService from 'App/Services/QRService'

import Stripe from 'stripe'

export default class StripeCheckoutCompleteController {
  public async handleCheckoutCompleteHook({ request, response }: HttpContextContract) {
    const { type, data } = request.body()

    if (type && type === 'checkout.session.completed') {
      const {
        object: { id: checkoutId },
      } = data

      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: Env.get('STRIPE_API_VERSION'),
      })

      const checkout = await stripeClient.checkout.sessions.retrieve(checkoutId, {
        expand: ['line_items'],
      })

      if (checkout?.line_items?.data.find(({ description }) => description.includes('Presentation'))) {
        const qr = new QRService()
        const qrcode = await qr.generateQRCode(`
          Player Name: ${checkout.metadata?.presentationTicketPlayerName ?? 'Unknown'}

          Age Group: ${checkout.metadata?.presentationTicketAgeGroup.toUpperCase() ?? 'Unknown'}

          Visitor Tickets: ${
            checkout.line_items?.data.reduce((visitorCount, lineItem) => {
              if (lineItem.description === 'Presentation 2022 - Visitor Ticket') {
                visitorCount += lineItem?.quantity ?? 0
              }

              return visitorCount
            }, 0) ?? 0
          }

          Player Tickets: ${
            checkout.line_items?.data.reduce((visitorCount, lineItem) => {
              if (lineItem.description === 'Presentation 2022 - Player Ticket') {
                visitorCount += lineItem?.quantity ?? 0
              }

              return visitorCount
            }, 0) ?? 0
          }

          Email: ${checkout.customer_details!.email!}

          Validation: https://api.newcastlecityjuniors.co.uk/api/v1/helpers/validate-presentation-ticket?checkoutId=${checkout.id}
        `)

        Mail.send(message => {
          message.embedData(Buffer.from(qrcode.split(',')[1], 'base64'), `${checkoutId}-qrcode`, {
            filename: `${checkoutId}-qrcode.png`,
            contentType: 'image/png',
          })

          message
            .from('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
            .to(checkout.customer_details!.email!)
            .subject('Your NCJ Presentation Tickets')
            .htmlView('emails/presentation-2022', { checkoutId })
        })

        return response.ok({ status: 'success' })
      }

      response.ok({ status: 'success' })
    }

    response.ok({
      status: 'success',
      message: 'Request was received successfully but not processed',
    })
  }
}
