import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
import Env from '@ioc:Adonis/Core/Env'
import Mail from '@ioc:Adonis/Addons/Mail'

import Stripe from 'stripe'

export default class StripeCheckoutCompleteController {
  public async handleStripeWebhook({ request, response }: HttpContextContract) {
    const webhookSecret = Env.get('STRIPE_WEBHOOK_SECRET');
    const webhookSignature = request.header('stripe-signature');

    let event

    try {
      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: Env.get('STRIPE_API_VERSION'),
      });

      event = stripeClient.webhooks.constructEvent(
        request.raw() as string,
        webhookSignature as string,
        webhookSecret
      );
    } catch {
      return response.badRequest({
        code: 400,
        status: 'Bad Request',
        message: 'Invalid Stripe webhook signature',
      });
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        switch (event.data.object?.metadata?.orderType) {
          case 'summer-camp-2023':
            await this.handleSummerCamp2023PaymentIntentSucceeded(event.data.object);
            break;
          default:
            console.log(`Unhandled payment intent order type: ${event.data.object.metadata.orderType}`);
        }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return response.ok({
      code: 200,
      status: 'OK',
      message: 'Webhook handled successfully',
    });
  }

  public async handleSummerCamp2023PaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    await Database
      .insertQuery()
      .table('summer_camp_2023_signups')
      .insert({
        email_address: paymentIntent.metadata.emailAddress,
        club_name: paymentIntent.metadata.clubName,
        team_name: paymentIntent.metadata.teamName,
        age_group: paymentIntent.metadata.ageGroup,
        coach_name: paymentIntent.metadata.coachName,
        contact_number: paymentIntent.metadata.contactNumber,
        accepted_coach_qualification_agreement: paymentIntent.metadata.acceptedCoachQualificationAgreement,
        accepted_organiser_decision_agreement: paymentIntent.metadata.acceptedOrganiserDecisionAgreement,
        amount_paid: paymentIntent.amount_received,
      });

    await Mail.send(message => {
      message
        .from('info@newcastlecityjuniors.co.uk')
        .to('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
        .subject('New Summer Camp 2023 Signup')
        .html(`
          <h1>New Summer Camp 2023 Signup</h1>
          <p>The following summer camp registration has been received and paid:</p>
          <ul>
            <li><strong>Email Address:</strong> ${paymentIntent.metadata.emailAddress}</li>
            <li><strong>Club Name:</strong> ${paymentIntent.metadata.clubName}</li>
            <li><strong>Team Name:</strong> ${paymentIntent.metadata.teamName}</li>
            <li><strong>Age Group:</strong> ${paymentIntent.metadata.ageGroup}</li>
            <li><strong>Coach Name:</strong> ${paymentIntent.metadata.coachName}</li>
            <li><strong>Contact Number:</strong> ${paymentIntent.metadata.contactNumber}</li>
            <li><strong>Accepted Coach Qualification Agreement:</strong> ${paymentIntent.metadata.acceptedCoachQualificationAgreement}</li>
            <li><strong>Accepted Organiser Decision Agreement:</strong> ${paymentIntent.metadata.acceptedOrganiserDecisionAgreement}</li>
            <li><strong>Amount Paid:</strong> £${(paymentIntent.amount_received / 100).toFixed(2)}</li>
          </ul>
        `);
    });
  }
}
