import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
import Env from '@ioc:Adonis/Core/Env'
import Mail from '@ioc:Adonis/Addons/Mail'
import { DateTime } from 'luxon'

import Stripe from 'stripe'
import Player from 'App/Models/Player'
import User from 'App/Models/User'
import StripeTransactionService from 'App/Services/StripeTransactionService'
import { FileNamingService } from 'App/Services/FileNamingService'

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
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      case 'charge.succeeded':
        await this.handleChargeSucceeded(event.data.object);
        break;
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

  public async handleSummerCup2024PaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    await Database
      .insertQuery()
      .table('summer_cup_2024_signups')
      .insert({
        club_name: paymentIntent.metadata.clubName,
        team_name: paymentIntent.metadata.teamName,
        ability_level: paymentIntent.metadata.abilityLevel,
        tournament_entry: paymentIntent.metadata.tournamentEntry,
        coach_name: paymentIntent.metadata.coachName,
        contact_number: paymentIntent.metadata.contactNumber,
        email_address: paymentIntent.metadata.emailAddress,
        accepted_next_years_age_group_agreement: paymentIntent.metadata.acceptedNextYearsAgeGroupAgreement,
        accepted_coach_qualification_agreement: paymentIntent.metadata.acceptedCoachQualificationAgreement,
        accepted_organiser_decision_agreement: paymentIntent.metadata.acceptedOrganiserDecisionAgreement,
        amount_paid: paymentIntent.amount_received,
      });

    const currentPlacesRemainingJson = await Database.from('config').where('key', 'summer_cup_2024_places_remaining').select('value').first()
    const currentPlacesRemaining = currentPlacesRemainingJson.value

    currentPlacesRemaining[paymentIntent.metadata.tournamentEntry] -= 1

    await Database.from('config').where('key', 'summer_cup_2024_places_remaining').update('value', JSON.stringify(currentPlacesRemaining))

    await Mail.send(message => {
      message
        .from('info@newcastlecityjuniors.co.uk')
        .to('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
        .subject('New Summer Cup 2024 Signup')
        .html(`
          <h1>New Summer Cup 2024 Signup</h1>
          <p>The following summer cup registration has been received and paid:</p>
          <ul>
            <li><strong>Club Name:</strong> ${paymentIntent.metadata.clubName}</li>
            <li><strong>Team Name:</strong> ${paymentIntent.metadata.teamName}</li>
            <li><strong>Ability Level:</strong> ${paymentIntent.metadata.abilityLevel}</li>
            <li><strong>Tournament Entry:</strong> ${paymentIntent.metadata.tournamentEntry}</li>
            <li><strong>Coach Name:</strong> ${paymentIntent.metadata.coachName}</li>
            <li><strong>Contact Number:</strong> ${paymentIntent.metadata.contactNumber}</li>
            <li><strong>Email Address:</strong> ${paymentIntent.metadata.emailAddress}</li>
            <li><strong>Accepted Next Year's Age Group Agreement:</strong> ${paymentIntent.metadata.acceptedNextYearsAgeGroupAgreement}</li>
            <li><strong>Accepted Coach Qualification Agreement:</strong> ${paymentIntent.metadata.acceptedCoachQualificationAgreement}</li>
            <li><strong>Accepted Organiser Decision Agreement:</strong> ${paymentIntent.metadata.acceptedOrganiserDecisionAgreement}</li>
            <li><strong>Amount Paid:</strong> £${(paymentIntent.amount_received / 100).toFixed(2)}</li>
          </ul>
        `);
    });
  }

  public async handleSummerCup2025PaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    await Database
      .insertQuery()
      .table('summer_cup_2025_signups')
      .insert({
        club_name: paymentIntent.metadata.clubName,
        team_name: paymentIntent.metadata.teamName,
        ability_level: paymentIntent.metadata.abilityLevel,
        tournament_entry: paymentIntent.metadata.tournamentEntry,
        coach_name: paymentIntent.metadata.coachName,
        contact_number: paymentIntent.metadata.contactNumber,
        email_address: paymentIntent.metadata.emailAddress,
        accepted_next_years_age_group_agreement: paymentIntent.metadata.acceptedNextYearsAgeGroupAgreement,
        accepted_coach_qualification_agreement: paymentIntent.metadata.acceptedCoachQualificationAgreement,
        accepted_organiser_decision_agreement: paymentIntent.metadata.acceptedOrganiserDecisionAgreement,
        amount_paid: paymentIntent.amount_received,
      });

    const currentPlacesRemainingJson = await Database.from('config').where('key', 'summer_cup_2025_places_remaining').select('value').first()
    const currentPlacesRemaining = currentPlacesRemainingJson.value

    currentPlacesRemaining[paymentIntent.metadata.tournamentEntry] -= 1

    await Database.from('config').where('key', 'summer_cup_2025_places_remaining').update('value', JSON.stringify(currentPlacesRemaining))

    await Mail.send(message => {
      message
        .from('info@newcastlecityjuniors.co.uk')
        .to('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
        .subject('New Summer Cup 2025 Signup')
        .html(`
          <h1>New Summer Cup 2025 Signup</h1>
          <p>The following summer cup registration has been received and paid:</p>
          <ul>
            <li><strong>Club Name:</strong> ${paymentIntent.metadata.clubName}</li>
            <li><strong>Team Name:</strong> ${paymentIntent.metadata.teamName}</li>
            <li><strong>Ability Level:</strong> ${paymentIntent.metadata.abilityLevel}</li>
            <li><strong>Tournament Entry:</strong> ${paymentIntent.metadata.tournamentEntry}</li>
            <li><strong>Coach Name:</strong> ${paymentIntent.metadata.coachName}</li>
            <li><strong>Contact Number:</strong> ${paymentIntent.metadata.contactNumber}</li>
            <li><strong>Email Address:</strong> ${paymentIntent.metadata.emailAddress}</li>
            <li><strong>Accepted Next Year's Age Group Agreement:</strong> ${paymentIntent.metadata.acceptedNextYearsAgeGroupAgreement}</li>
            <li><strong>Accepted Coach Qualification Agreement:</strong> ${paymentIntent.metadata.acceptedCoachQualificationAgreement}</li>
            <li><strong>Accepted Organiser Decision Agreement:</strong> ${paymentIntent.metadata.acceptedOrganiserDecisionAgreement}</li>
            <li><strong>Amount Paid:</strong> £${(paymentIntent.amount_received / 100).toFixed(2)}</li>
          </ul>
        `);
    });

    await Mail.send(message => {
      message
        .from('info@newcastlecityjuniors.co.uk')
        .to(paymentIntent.metadata.emailAddress, paymentIntent.metadata.coachName)
        .subject('NCJ Summer Cup 2025 - Signup Confirmation')
        .html(`
          <h1>Summer Cup 2025</h1>
          <p>Thank you for registering ${paymentIntent.metadata.teamName} (${paymentIntent.metadata.clubName}) to the Newcastle City Juniors Summer Cup 2025.</p>
          <p>We can confirm that your payment of £${(paymentIntent.amount_received / 100).toFixed(2)} was successful and your registration has been passed to the club. A representative from the club will be in touch in due course.</p>
          <p>If you have any questions in the meantime, please contact us by email here: <a href="mailto:info@newcastlecityjuniors.co.uk">info@newcastlecityjuniors.co.uk</a></p>
          <p>Thank you for your support, and we look forward to seeing you at the tournament.</p>
          <p>Kind regards,<br />Newcastle City Juniors</p>
        `);
    });
  }

  public async handleFootyTalkIn2023PaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    });

    const postcode = await this.getBillingDetailsFromPaymentIntent(paymentIntent, stripeClient);

    await Database
      .insertQuery()
      .table('footy_talk_in_signups')
      .insert({
        full_name: paymentIntent.metadata.fullName,
        house_name_and_number: paymentIntent.metadata.houseNameAndNumber,
        city: paymentIntent.metadata.city,
        postcode: postcode,
        email_address: paymentIntent.metadata.emailAddress,
        contact_number: paymentIntent.metadata.contactNumber,
        booking_name: paymentIntent.metadata.bookingName,
        amount_paid: paymentIntent.amount_received,
      });

      await Mail.send(message => {
        message
          .from('info@newcastlecityjuniors.co.uk')
          .to('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
          .subject('New Footy Talk-In Signup')
          .html(`
            <h1>New Footy Talk-In 2023 Signup</h1>
            <p>The following summer camp registration has been received and paid:</p>
            <ul>
              <li><strong>Email Address:</strong> ${paymentIntent.metadata.emailAddress}</li>
              <li><strong>House Name/No:</strong> ${paymentIntent.metadata.houseNameAndNumber}</li>
              <li><strong>City:</strong> ${paymentIntent.metadata.city}</li>
              <li><strong>Postcode:</strong> ${postcode || 'Not provided'}</li>
              <li><strong>Email Address:</strong> ${paymentIntent.metadata.emailAddress}</li>
              <li><strong>Contact Number:</strong> ${paymentIntent.metadata.contactNumber}</li>
              <li><strong>Booking Name:</strong> ${paymentIntent.metadata.bookingName}</li>
              <li><strong>Amount Paid:</strong> £${(paymentIntent.amount_received / 100).toFixed(2)}</li>
            </ul>
          `);
      });
  }

  public async handleFootyTalkIn2024PaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    });

    const postcode = await this.getBillingDetailsFromPaymentIntent(paymentIntent, stripeClient);

    await Database
      .insertQuery()
      .table('footy_talk_in_signups_2024')
      .insert({
        full_name: paymentIntent.metadata.fullName,
        house_name_and_number: paymentIntent.metadata.houseNameAndNumber,
        city: paymentIntent.metadata.city,
        postcode: postcode,
        email_address: paymentIntent.metadata.emailAddress,
        contact_number: paymentIntent.metadata.contactNumber,
        booking_name: paymentIntent.metadata.bookingName,
        amount_paid: paymentIntent.amount_received,
      });

      await Mail.send(message => {
        message
          .from('info@newcastlecityjuniors.co.uk')
          .to('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
          .subject('New Footy Talk-In Signup')
          .html(`
            <h1>New Footy Talk-In 2024 Signup</h1>
            <p>The following footy talk-in registration has been received and paid:</p>
            <ul>
              <li><strong>Email Address:</strong> ${paymentIntent.metadata.emailAddress}</li>
              <li><strong>House Name/No:</strong> ${paymentIntent.metadata.houseNameAndNumber}</li>
              <li><strong>City:</strong> ${paymentIntent.metadata.city}</li>
              <li><strong>Postcode:</strong> ${postcode || 'Not provided'}</li>
              <li><strong>Email Address:</strong> ${paymentIntent.metadata.emailAddress}</li>
              <li><strong>Contact Number:</strong> ${paymentIntent.metadata.contactNumber}</li>
              <li><strong>Booking Name:</strong> ${paymentIntent.metadata.bookingName}</li>
              <li><strong>Amount Paid:</strong> £${(paymentIntent.amount_received / 100).toFixed(2)}</li>
            </ul>
          `);
      });
  }

  public async handleFootyTalkIn2025PaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    });

    const postcode = await this.getBillingDetailsFromPaymentIntent(paymentIntent, stripeClient);

    await Database
      .insertQuery()
      .table('footy_talk_in_signups_2025')
      .insert({
        full_name: paymentIntent.metadata.fullName,
        house_name_and_number: paymentIntent.metadata.houseNameAndNumber,
        city: paymentIntent.metadata.city,
        postcode: postcode,
        email_address: paymentIntent.metadata.emailAddress,
        contact_number: paymentIntent.metadata.contactNumber,
        ticket_option: paymentIntent.metadata.ticketOption,
        amount_paid: paymentIntent.amount_received,
      });

    await Mail.send(message => {
      message
        .from('info@newcastlecityjuniors.co.uk')
        .to('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
        .subject('New Footy Talk-In Signup')
        .html(`
          <h1>New Footy Talk-In 2025 Signup</h1>
          <p>The following footy talk-in registration has been received and paid:</p>
          <ul>
            <li><strong>Email Address:</strong> ${paymentIntent.metadata.emailAddress}</li>
            <li><strong>House Name/No:</strong> ${paymentIntent.metadata.houseNameAndNumber}</li>
            <li><strong>City:</strong> ${paymentIntent.metadata.city}</li>
            <li><strong>Postcode:</strong> ${postcode || 'Not provided'}</li>
            <li><strong>Contact Number:</strong> ${paymentIntent.metadata.contactNumber}</li>
            <li><strong>Ticket Option:</strong> ${paymentIntent.metadata.ticketOption}</li>
            <li><strong>Amount Paid:</strong> £${(paymentIntent.amount_received / 100).toFixed(2)}</li>
          </ul>
        `);
    });
  }

  public async handleFootyTalkIn2025KeeganPaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
      apiVersion: Env.get('STRIPE_API_VERSION'),
    });

    const postcode = await this.getBillingDetailsFromPaymentIntent(paymentIntent, stripeClient);

    await Database
      .insertQuery()
      .table('footy_talk_in_signups_2025_keegan')
      .insert({
        full_name: paymentIntent.metadata.fullName,
        house_name_and_number: paymentIntent.metadata.houseNameAndNumber,
        city: paymentIntent.metadata.city,
        postcode: postcode,
        email_address: paymentIntent.metadata.emailAddress,
        contact_number: paymentIntent.metadata.contactNumber,
        ticket_option: paymentIntent.metadata.ticketOption,
        amount_paid: paymentIntent.amount_received,
      });

    await Mail.send(message => {
      message
        .from('info@newcastlecityjuniors.co.uk')
        .to('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
        .subject('New Footy Talk-In Signup')
        .html(`
          <h1>New Footy Talk-In 2025 (Keegan) Signup</h1>
          <p>The following footy talk-in registration has been received and paid:</p>
          <ul>
            <li><strong>Email Address:</strong> ${paymentIntent.metadata.emailAddress}</li>
            <li><strong>House Name/No:</strong> ${paymentIntent.metadata.houseNameAndNumber}</li>
            <li><strong>City:</strong> ${paymentIntent.metadata.city}</li>
            <li><strong>Postcode:</strong> ${postcode || 'Not provided'}</li>
            <li><strong>Contact Number:</strong> ${paymentIntent.metadata.contactNumber}</li>
            <li><strong>Ticket Option:</strong> ${paymentIntent.metadata.ticketOption}</li>
            <li><strong>Amount Paid:</strong> £${(paymentIntent.amount_received / 100).toFixed(2)}</li>
          </ul>
        `);
    });
  }

  public async handlePresentation2023PaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    await Database
      .insertQuery()
      .table('presentation_2023_2024')
      .insert({
        child_name: paymentIntent.metadata.childName,
        age_group: paymentIntent.metadata.ageGroup,
        team_name: paymentIntent.metadata.teamName,
        coach_name: paymentIntent.metadata.coachName,
        tickets_ordered: parseInt(paymentIntent.metadata.ticketsRequired, 10),
        guest_names: paymentIntent.metadata.guestNames,
        email_address: paymentIntent.metadata.emailAddress,
        amount_paid: (paymentIntent.amount_received / 100),
      });

      // Get the number of tickets ordered
      const ticketsOrdered = (paymentIntent.metadata.hasPlayerTicket === 'true')
        ? parseInt(paymentIntent.metadata.ticketsRequired, 10)
        : parseInt(paymentIntent.metadata.ticketsRequired, 10) + 1;

      // Get current tickets_remaining count from the 'config' table
      const ticketsRemainingJson = await Database
        .from('config')
        .where('key', 'tickets_remaining')
        .select('value')
        .first();

      const ticketsRemaining = ticketsRemainingJson.value.count;

      // Update tickets_remaining in the 'config' table to be X less than the current value
      await Database
        .from('config')
        .where('key', 'tickets_remaining')
        .update('value', JSON.stringify({ count: ticketsRemaining - ticketsOrdered }));

    const normalisedTeamName = (paymentIntent.metadata.teamName.charAt(0).toUpperCase() + paymentIntent.metadata.teamName.slice(1)).replace(/-/g, ' ');

    await Mail.send(message => {
      message
        .from('info@newcastlecityjuniors.co.uk')
        .to(paymentIntent.metadata.emailAddress)
        .subject('Your tickets to the NCJ Presentation (2023-2024 Season)')
        .htmlView('emails/presentation-2023', {
          playerName: paymentIntent.metadata.childName,
          teamName: normalisedTeamName,
          coachName: paymentIntent.metadata.coachName,
          guestNames: paymentIntent.metadata.guestNames,
          guestQuantity: paymentIntent.metadata.ticketsRequired,
          guestCost: (paymentIntent.amount_received / 100).toFixed(2),
        })
    });
  }

  public async handlePresentation2024PaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    await Database
      .insertQuery()
      .table('presentation_2024_2025')
      .insert({
        child_name: paymentIntent.metadata.childName,
        age_group: paymentIntent.metadata.ageGroup,
        team_name: paymentIntent.metadata.teamName,
        coach_name: paymentIntent.metadata.coachName,
        tickets_ordered: (paymentIntent.metadata.needsPlayerTicket === 'true')
          ? parseInt(paymentIntent.metadata.ticketsRequired ?? '0', 10) + 1
          : parseInt(paymentIntent.metadata.ticketsRequired ?? '0', 10),
        includes_player_ticket: paymentIntent.metadata.needsPlayerTicket === 'true',
        guest_names: paymentIntent.metadata.guestNames,
        email_address: paymentIntent.metadata.emailAddress,
        amount_paid: (paymentIntent.amount_received / 100),
        session: paymentIntent.metadata.session,
      });

      // Get the number of tickets ordered
      const ticketsOrdered = (paymentIntent.metadata.needsPlayerTicket === 'true')
        ? parseInt(paymentIntent.metadata.ticketsRequired ?? '0', 10) + 1
        : parseInt(paymentIntent.metadata.ticketsRequired ?? '0', 10);

      // Get current tickets_remaining count from the 'config' table
      const ticketsRemainingJson = await Database
        .from('config')
        .where('key', 'tickets_remaining_2024')
        .select('value')
        .first();

      const ticketsRemaining = ticketsRemainingJson.value;

      // Update tickets_remaining in the 'config' table to be X less than the current value
      await Database
        .from('config')
        .where('key', 'tickets_remaining_2024')
        .update('value', JSON.stringify({
          ...((paymentIntent.metadata.session === 'early') && {
            earlyCount: ticketsRemaining.earlyCount - ticketsOrdered,
            lateCount: ticketsRemaining.lateCount,
          }),
          ...((paymentIntent.metadata.session === 'late') && {
            earlyCount: ticketsRemaining.earlyCount,
            lateCount: ticketsRemaining.lateCount - ticketsOrdered,
          }),
        }));

    const normalisedTeamName = (paymentIntent.metadata.teamName.charAt(0).toUpperCase() + paymentIntent.metadata.teamName.slice(1)).replace(/-/g, ' ');

    await Mail.send(message => {
      message
        .from('info@newcastlecityjuniors.co.uk')
        .to(paymentIntent.metadata.emailAddress)
        .subject('Your tickets to the NCJ Presentation (2024-2025 Season)')
        .htmlView('emails/presentation-2024', {
          playerName: paymentIntent.metadata.childName,
          teamName: normalisedTeamName,
          coachName: paymentIntent.metadata.coachName,
          guestNames: paymentIntent.metadata.guestNames,
          ticketsOrdered,
          guestQuantity: paymentIntent.metadata.ticketsRequired,
          guestCost: (paymentIntent.amount_received / 100).toFixed(2),
          session: paymentIntent.metadata.session.toUpperCase(),
        });
    });
  }

  public async handleHalloween2025PaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    await Database
      .insertQuery()
      .table('halloween_2025')
      .insert({
        no_of_tickets: paymentIntent.metadata.ticketsRequired,
        full_name: paymentIntent.metadata.fullName,
        email_address: paymentIntent.metadata.emailAddress,
        contact_number: paymentIntent.metadata.contactNumber,
        amount_paid: (paymentIntent.amount_received / 100),
        gift_aid_opted_in: paymentIntent.metadata.giftAidOptedIn === 'true',
      });

    await Mail.send(message => {
      message
        .from('info@newcastlecityjuniors.co.uk')
        .to(paymentIntent.metadata.emailAddress)
        .subject('Your tickets to the NCJ Halloween Party 2025')
        .htmlView('emails/halloween-2025', {
          fullName: paymentIntent.metadata.fullName,
          contactNumber: paymentIntent.metadata.contactNumber,
          noOfTickets: paymentIntent.metadata.ticketsRequired,
          amountPaid: (paymentIntent.amount_received / 100).toFixed(2),
        });
    });

    await Mail.send(message => {
      message
        .from('info@newcastlecityjuniors.co.uk')
        .to('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
        .subject('New ticket(s) ordered for Halloween Party 2025')
        .html(`
          <h1>New Halloween Party 2025 Ticket Order</h1>
          <p>The following ticket(s) have been purchased:</p>
          <ul>
            <li><strong>Full Name:</strong> ${paymentIntent.metadata.fullName}</li>
            <li><strong>Email Address:</strong> ${paymentIntent.metadata.emailAddress}</li>
            <li><strong>Contact Number:</strong> ${paymentIntent.metadata.contactNumber}</li>
            <li><strong>No. of Tickets:</strong> ${paymentIntent.metadata.ticketsRequired}</li>
            <li><strong>Amount Paid:</strong> £${(paymentIntent.amount_received / 100).toFixed(2)}</li>
          </ul>
        `);
    });
  }

  public async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    try {
      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: Env.get('STRIPE_API_VERSION'),
      });

      const registrationId = session.metadata?.registrationId;
      const playerType = session.metadata?.playerType;

      if (!registrationId || !playerType) {
        console.log('Missing registration metadata in checkout session');
        return;
      }

      // Extract player data from session metadata
      const playerData = {
        userId: parseInt(session.metadata?.userId || '0'),
        firstName: session.metadata?.firstName || '',
        middleNames: session.metadata?.middleNames || '',
        lastName: session.metadata?.lastName || '',
        dateOfBirth: session.metadata?.dateOfBirth || '',
        sex: session.metadata?.sex || '',
        medicalConditions: session.metadata?.medicalConditions || '',
        mediaConsented: session.metadata?.mediaConsented === 'true',
        ageGroup: session.metadata?.ageGroup || '',
        team: session.metadata?.team || '',
        secondTeam: session.metadata?.secondTeam || '',
        paymentDate: parseInt(session.metadata?.paymentDate || '15'),
        membershipFeeOption: session.metadata?.membershipFeeOption || '',
        acceptedCodeOfConduct: session.metadata?.acceptedCodeOfConduct === 'true',
        acceptedDeclaration: session.metadata?.acceptedDeclaration === 'true',
        giftAidDeclarationAccepted: session.metadata?.giftAidDeclarationAccepted === 'true',
        parentId: parseInt(session.metadata?.parentId || '0'),
        identityVerificationPhoto: session.metadata?.identityVerificationPhoto || '',
        ageVerificationPhoto: session.metadata?.ageVerificationPhoto || '',
        existingPlayerId: session.metadata?.existingPlayerId || '',
      };

      if (!playerData.userId || !playerData.firstName || !playerData.lastName) {
        console.error('Invalid player data in session metadata:', playerData);
        return;
      }

      const user = await User.findOrFail(playerData.userId);

      // Move temp files to permanent locations using helper method
      const finalIdentityFileName = await this.moveVerificationFile(
        playerData.identityVerificationPhoto,
        'identity-verification-photos'
      );
      const finalAgeFileName = await this.moveVerificationFile(
        playerData.ageVerificationPhoto,
        'age-verification-photos'
      );

      // Run cleanup for orphaned temp files (async, don't wait for completion)
      this.cleanupOrphanedTempFiles(24).catch(error => {
        console.error('Background cleanup failed:', error);
      });

      let player: Player;

      // Check if this is updating an existing player or creating a new one
      if (playerData.existingPlayerId) {
        player = await Player.findOrFail(parseInt(playerData.existingPlayerId));

        // Update existing player with new data
        player.firstName = playerData.firstName;
        player.middleNames = playerData.middleNames;
        player.lastName = playerData.lastName;
        player.dateOfBirth = DateTime.fromISO(playerData.dateOfBirth);
        player.sex = playerData.sex;
        player.medicalConditions = playerData.medicalConditions;
        player.mediaConsented = playerData.mediaConsented;
        player.ageGroup = playerData.ageGroup;
        player.team = playerData.team;
        player.secondTeam = playerData.secondTeam;
        player.paymentDate = playerData.paymentDate;
        player.membershipFeeOption = playerData.membershipFeeOption;
        player.acceptedCodeOfConduct = playerData.acceptedCodeOfConduct;
        player.acceptedDeclaration = playerData.acceptedDeclaration;
        player.giftAidDeclarationAccepted = playerData.giftAidDeclarationAccepted;
        player.parentId = playerData.parentId;
        player.identityVerificationPhoto = finalIdentityFileName;
        player.ageVerificationPhoto = finalAgeFileName;

        await player.save();
      } else {
        // Create new player
        player = await Player.create({
          userId: playerData.userId,
          firstName: playerData.firstName,
          middleNames: playerData.middleNames,
          lastName: playerData.lastName,
          dateOfBirth: DateTime.fromISO(playerData.dateOfBirth),
          sex: playerData.sex,
          medicalConditions: playerData.medicalConditions,
          mediaConsented: playerData.mediaConsented,
          ageGroup: playerData.ageGroup,
          team: playerData.team,
          secondTeam: playerData.secondTeam,
          paymentDate: playerData.paymentDate,
          membershipFeeOption: playerData.membershipFeeOption,
          acceptedCodeOfConduct: playerData.acceptedCodeOfConduct,
          acceptedDeclaration: playerData.acceptedDeclaration,
          giftAidDeclarationAccepted: playerData.giftAidDeclarationAccepted,
          parentId: playerData.parentId,
          identityVerificationPhoto: finalIdentityFileName,
          ageVerificationPhoto: finalAgeFileName,
        });
      }

      console.log(`Player ${playerData.existingPlayerId ? 'updated' : 'created'}: ${player.id} - ${player.firstName} ${player.lastName}`);

      // Store transaction data in our database for faster future queries
      const transactionService = new StripeTransactionService();

      // Set the payment method as default for future payments
      if (session.payment_method_types?.includes('card') && session.customer) {
        const paymentMethods = await stripeClient.paymentMethods.list({
          customer: session.customer as string,
          type: 'card',
        });

        // Get the most recent payment method (likely the one just used)
        const latestPaymentMethod = paymentMethods.data[0];
        if (latestPaymentMethod) {
          await stripeClient.customers.update(session.customer as string, {
            invoice_settings: {
              default_payment_method: latestPaymentMethod.id,
            },
          });
        }
      }

      switch (playerType) {
        case 'coach':
          // For coaches, subscription is already created by Stripe Checkout
          if (session.subscription) {
            player.stripeSubscriptionId = session.subscription as string;
            await player.save();

            // Store subscription in our database
            const subscription = await stripeClient.subscriptions.retrieve(session.subscription as string);
            await transactionService.storeSubscription(subscription, player.id, session.id);
          }
          break;

        case 'upfront':
          // For upfront payments, store the payment intent ID
          if (session.payment_intent) {
            player.stripeUpfrontPaymentId = session.payment_intent as string;
            await player.save();

            // Store upfront payment in our database with merged metadata
            const paymentIntent = await stripeClient.paymentIntents.retrieve(session.payment_intent as string);

            // Merge session metadata (contains gift aid) with payment intent metadata
            const mergedMetadata = {
              ...paymentIntent.metadata,
              ...session.metadata,
              giftAidDeclarationAccepted: session.metadata?.giftAidDeclarationAccepted || 'false',
            };

            // Temporarily store merged metadata on payment intent for storePayment method
            paymentIntent.metadata = mergedMetadata;

            await transactionService.storePayment(paymentIntent, 'upfront_payment', player.id, undefined, session.id);
          }
          break;

        case 'subscription':
          // Store the registration fee payment intent ID
          if (session.payment_intent) {
            player.stripeRegistrationFeeId = session.payment_intent as string;

            // Store registration fee payment in our database with merged metadata
            const paymentIntent = await stripeClient.paymentIntents.retrieve(session.payment_intent as string);

            // Merge session metadata (contains gift aid) with payment intent metadata
            const mergedMetadata = {
              ...paymentIntent.metadata,
              ...session.metadata,
              giftAidDeclarationAccepted: session.metadata?.giftAidDeclarationAccepted || 'false',
            };

            // Temporarily store merged metadata on payment intent for storePayment method
            paymentIntent.metadata = mergedMetadata;

            await transactionService.storePayment(paymentIntent, 'registration_fee', player.id, undefined, session.id);
          }

          // For subscription players, create the subscription after registration fee payment
          const subscriptionPrice = session.metadata?.subscriptionPrice;
          const trialEndDate = session.metadata?.trialEndDate ? parseInt(session.metadata.trialEndDate) : null;
          const cancelAtDate = session.metadata?.cancelAtDate ? parseInt(session.metadata.cancelAtDate) : null;

          if (subscriptionPrice && trialEndDate && cancelAtDate) {
            // Get default payment method for the customer
            let defaultPaymentMethod: string | undefined;
            if (user.stripeCustomerId) {
              const customer = await stripeClient.customers.retrieve(user.stripeCustomerId) as Stripe.Customer;
              defaultPaymentMethod = typeof customer.invoice_settings?.default_payment_method === 'string'
                ? customer.invoice_settings.default_payment_method
                : undefined;
            }

            /**
             * ANTI-PRORATION STRATEGY:
             *
             * To ensure May payment is taken in full without proration:
             * 1. Set cancel_at to AFTER the final billing period (June 15th, not May 15th)
             * 2. Use proration_behavior: 'none' to disable all proration
             * 3. Disable automatic_tax to prevent billing complications
             *
             * This ensures:
             * - Monthly payments: July 15 → May 15 (all full amounts)
             * - Final payment: May 15, 2026 (full month)
             * - Cancellation: June 15, 2026 (after May billing cycle ends)
             */

            // Create subscription with explicit anti-proration settings
            const subscription = await stripeClient.subscriptions.create({
              customer: user.stripeCustomerId,
              trial_end: trialEndDate,
              cancel_at: cancelAtDate,
              items: [{
                price: subscriptionPrice,
                // Ensure no quantity adjustments or proration
              }],
              // Critical: Prevent all proration
              proration_behavior: 'none',
              // Disable automatic tax to prevent complications
              automatic_tax: {
                enabled: false,
              },
              // Include gift aid and other important metadata from session
              metadata: {
                giftAidDeclarationAccepted: session.metadata?.giftAidDeclarationAccepted || 'false',
                registrationId: session.metadata?.registrationId || '',
                playerType: 'subscription',
                ageGroup: session.metadata?.ageGroup || '',
                team: session.metadata?.team || '',
                membershipFeeOption: 'subscription',
              },
              ...(defaultPaymentMethod && { default_payment_method: defaultPaymentMethod }),
            });

            player.stripeSubscriptionId = subscription.id;

            // Store subscription in our database
            await transactionService.storeSubscription(subscription, player.id, session.id);

            // Log subscription creation for debugging
            console.log(`Created subscription ${subscription.id} for player ${player.id}:`, {
              trialEnd: new Date(trialEndDate * 1000).toISOString(),
              cancelAt: new Date(cancelAtDate * 1000).toISOString(),
              prorationBehavior: 'none'
            });
          }

          await player.save();
          break;

        default:
          console.log(`Unknown player type: ${playerType}`);
      }

      console.log(`Successfully processed checkout for player ${player.id} (${playerType})`);

      // Update any existing transaction records with the player ID
      // This fixes the race condition where payment_intent.succeeded fires before player creation
      if (session.payment_intent) {
        await transactionService.updateTransactionWithPlayerId(session.payment_intent as string, player.id);
      }

      // Also update subscription transaction if it exists
      if (session.subscription) {
        await transactionService.updateTransactionWithPlayerId(session.subscription as string, player.id);
      }

    } catch (error) {
      console.error('Error processing checkout session completed:', error);
    }
  }

  /**
   * Handle payment_intent.succeeded events
   * This covers both special events (summer camp, etc.) and player registrations
   */
  public async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const transactionService = new StripeTransactionService();

    // Check if this is a special event type (summer camp, tournaments, etc.)
    const orderType = paymentIntent.metadata?.orderType;

    if (orderType) {
      // Handle special event types
      switch (orderType) {
        case 'summer-camp-2023':
          await this.handleSummerCamp2023PaymentIntentSucceeded(paymentIntent);
          break;
        case 'summer-cup-2024':
          await this.handleSummerCup2024PaymentIntentSucceeded(paymentIntent);
          break;
        case 'summer-cup-2025':
          await this.handleSummerCup2025PaymentIntentSucceeded(paymentIntent);
          break;
        case 'footy-talk-in-2023':
          await this.handleFootyTalkIn2023PaymentIntentSucceeded(paymentIntent);
          break;
        case 'footy-talk-in-2024':
          await this.handleFootyTalkIn2024PaymentIntentSucceeded(paymentIntent);
          break;
        case 'footy-talk-in-2025':
          await this.handleFootyTalkIn2025PaymentIntentSucceeded(paymentIntent);
          break;
        case 'footy-talk-in-2025-keegan':
          await this.handleFootyTalkIn2025KeeganPaymentIntentSucceeded(paymentIntent);
          break;
        case 'presentation-2023':
          await this.handlePresentation2023PaymentIntentSucceeded(paymentIntent);
          break;
        case 'presentation-2024':
          await this.handlePresentation2024PaymentIntentSucceeded(paymentIntent);
          break;
        case 'halloween-2025':
          await this.handleHalloween2025PaymentIntentSucceeded(paymentIntent);
          break;
        default:
          console.log(`Unhandled payment intent order type: ${orderType}`);
      }
    } else {
      // Check if this is a player registration payment that will be handled by checkout.session.completed
      const registrationId = paymentIntent.metadata?.registrationId;
      const playerType = paymentIntent.metadata?.playerType;

      if (registrationId && (playerType === 'upfront' || playerType === 'subscription' || playerType === 'coach')) {
        console.log(`Skipping player registration payment intent ${paymentIntent.id} - will be handled by checkout.session.completed`);
        return;
      }

      // This might be a standalone payment or other standard payment
      console.log(`Payment intent succeeded without orderType: ${paymentIntent.id}`);

      // Try to determine payment type from metadata
      let transactionType: 'registration_fee' | 'upfront_payment' | 'monthly_payment' = 'monthly_payment';

      if (playerType === 'upfront') {
        transactionType = 'upfront_payment';
      } else if (playerType === 'subscription') {
        transactionType = 'registration_fee';
      }

      // Store this payment in our database
      try {
        await transactionService.storePayment(paymentIntent, transactionType);
        console.log(`Stored payment intent: ${paymentIntent.id} as ${transactionType}`);
      } catch (error) {
        console.error(`Failed to store payment intent ${paymentIntent.id}:`, error);
      }
    }
  }

  /**
   * Handle invoice.payment_succeeded events
   * This captures monthly subscription payments
   */
  public async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    const transactionService = new StripeTransactionService();

    try {
      // Find the player associated with this subscription
      const subscriptionId = (invoice as any).subscription;

      if (!subscriptionId) {
        console.log(`Invoice ${invoice.id} has no associated subscription`);
        return;
      }

      const player = await Player.query()
        .where('stripe_subscription_id', subscriptionId)
        .first();

      const playerId = player?.id;

      // Store the invoice payment as a monthly payment
      await transactionService.storePayment(
        invoice,
        'monthly_payment',
        playerId,
        subscriptionId,
        invoice.id // Use invoice ID as webhook event ID
      );

      console.log(`Stored monthly payment: Invoice ${invoice.id} for subscription ${subscriptionId}`);
    } catch (error) {
      console.error(`Failed to store invoice payment ${invoice.id}:`, error);
    }
  }

  /**
   * Handle customer.subscription.updated events
   * This tracks subscription status changes, cancellations, etc.
   */
  public async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const transactionService = new StripeTransactionService();

    try {
      // Find the player associated with this subscription
      const player = await Player.query()
        .where('stripe_subscription_id', subscription.id)
        .first();

      // Update the subscription record in our database
      await transactionService.storeSubscription(subscription, player?.id);

      console.log(`Updated subscription: ${subscription.id} - Status: ${subscription.status}`);
    } catch (error) {
      console.error(`Failed to update subscription ${subscription.id}:`, error);
    }
  }

  /**
   * Handle customer.subscription.deleted events
   * This tracks when subscriptions are cancelled/deleted
   */
  public async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const transactionService = new StripeTransactionService();

    try {
      // Find the player associated with this subscription
      const player = await Player.query()
        .where('stripe_subscription_id', subscription.id)
        .first();

      // Update the subscription record to reflect deletion
      await transactionService.storeSubscription(subscription, player?.id);

      console.log(`Subscription deleted: ${subscription.id}`);
    } catch (error) {
      console.error(`Failed to handle subscription deletion ${subscription.id}:`, error);
    }
  }

  /**
   * Handle charge.succeeded events
   * This provides additional coverage for successful payments
   */
  public async handleChargeSucceeded(charge: Stripe.Charge) {
    // Note: Most charges are already handled via payment_intent.succeeded
    // This handler provides backup coverage and handles direct charges

    const transactionService = new StripeTransactionService();

    try {
      // Only process if this charge doesn't have a payment intent (direct charge)
      if (!charge.payment_intent) {
        await transactionService.storePayment(charge, 'monthly_payment');
        console.log(`Stored direct charge: ${charge.id}`);
      } else {
        console.log(`Charge ${charge.id} already handled via payment intent ${charge.payment_intent}`);
      }
    } catch (error) {
      console.error(`Failed to store charge ${charge.id}:`, error);
    }
  }

  /**
   * Helper method to safely extract billing details from PaymentIntent
   * In newer Stripe API versions, charges may not be expanded by default
   */
  private async getBillingDetailsFromPaymentIntent(paymentIntent: Stripe.PaymentIntent, stripeClient: Stripe): Promise<string | null> {
    try {
      // Get from latest_charge
      if (paymentIntent.latest_charge && typeof paymentIntent.latest_charge === 'string') {
        const charge = await stripeClient.charges.retrieve(paymentIntent.latest_charge);
        return charge.billing_details?.address?.postal_code || null;
      }

      return null;
    } catch (error) {
      console.error('Error extracting billing details:', error);
      return null;
    }
  }

  /**
   * Helper method to safely move temp verification files to permanent storage
   * @param tempFileName - The temporary file name (with temp_ prefix)
   * @param targetDirectory - Target directory ('identity-verification-photos' or 'age-verification-photos')
   * @returns The final filename (without temp_ prefix) or the original temp filename if moving fails
   */
  private async moveVerificationFile(tempFileName: string, targetDirectory: string): Promise<string> {
    const Drive = (await import('@ioc:Adonis/Core/Drive')).default;
    const finalFileName = FileNamingService.getFinalFilenameFromTemp(tempFileName);

    try {
      const spacesDriver = Drive.use('spaces');
      const tempFilePath = `temp-verification-photos/${tempFileName}`;
      const finalFilePath = `${targetDirectory}/${finalFileName}`;

      // Check if temp file exists
      const tempExists = await spacesDriver.exists(tempFilePath);
      if (!tempExists) {
        console.warn(`Temp file not found: ${tempFilePath}`);
        return tempFileName; // Return original temp filename as fallback
      }

      // Copy file to permanent location
      const fileContent = await spacesDriver.get(tempFilePath);
      await spacesDriver.put(finalFilePath, fileContent);

      // Delete temp file
      await spacesDriver.delete(tempFilePath);

      console.log(`Successfully moved file: ${tempFilePath} → ${finalFilePath}`);
      return finalFileName;

    } catch (error) {
      console.error(`Failed to move file ${tempFileName} to ${targetDirectory}:`, error);
      return tempFileName; // Return original temp filename as fallback
    }
  }

  /**
   * Cleanup orphaned temp files older than specified hours
   * Note: This is a simplified cleanup - in production you might want to use
   * a more sophisticated approach with object listing and filtering
   * @param maxAgeHours - Maximum age in hours before files are considered orphaned
   */
  private async cleanupOrphanedTempFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      // Note: Manual cleanup implementation
      // Since we can't easily list files with the current driver interface,
      // this method serves as a placeholder for future implementation
      // You could implement this using:
      // 1. AWS SDK directly for more advanced operations
      // 2. A scheduled job that tracks temp files in database
      // 3. S3 lifecycle policies for automatic cleanup

      console.log(`Cleanup initiated for temp files older than ${maxAgeHours} hours`);

      // TODO: Implement actual file listing and cleanup logic
      // For now, this is a no-op that logs the intention

    } catch (error) {
      console.error('Error during temp file cleanup:', error);
    }
  }
}
