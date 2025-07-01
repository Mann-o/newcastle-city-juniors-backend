import { BaseCommand } from '@adonisjs/core/build/standalone'
import StripeTransactionService from 'App/Services/StripeTransactionService'
import Stripe from 'stripe'
import Env from '@ioc:Adonis/Core/Env'
import Player from 'App/Models/Player'
import User from 'App/Models/User'
import { DateTime } from 'luxon'

export default class BackfillRecentStripeData extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'backfill:stripe'

  /**
   * Command description is displayed in the "help" output
   */
  public static description = 'Backfill missed Stripe transactions and player data from June 30th 2025 onwards'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    this.logger.info('Starting backfill of recent Stripe data (June 30th 2025 onwards)...')

    try {
      const stripe = new Stripe(Env.get('STRIPE_API_SECRET'), {
        apiVersion: Env.get('STRIPE_API_VERSION'),
      })

      const stripeTransactionService = new StripeTransactionService()

      // June 30th 2025, 00:00:00 UTC
      const cutoffDate = DateTime.fromISO('2025-06-30T00:00:00Z')
      const cutoffTimestamp = Math.floor(cutoffDate.toSeconds())

      this.logger.info(`Fetching Stripe data from ${cutoffDate.toISO()} onwards...`)

      let processedCheckoutSessions = 0
      let processedSubscriptions = 0
      let processedPayments = 0
      let createdPlayers = 0

      // 1. Process checkout sessions (these contain player registration data)
      this.logger.info('\n=== Processing Checkout Sessions ===')
      
      for await (const session of stripe.checkout.sessions.list({
        limit: 100,
        created: { gte: cutoffTimestamp },
        expand: ['data.payment_intent', 'data.subscription'],
      })) {
        try {
          // Only process completed sessions with registration metadata
          if (session.payment_status === 'paid' && session.metadata?.registrationId && session.metadata?.playerType) {
            this.logger.info(`Processing checkout session: ${session.id}`)
            
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
            }

            if (!playerData.userId || !playerData.firstName || !playerData.lastName) {
              this.logger.warning(`Skipping session ${session.id} - invalid player data`)
              continue
            }

            // Check if user exists
            const user = await User.find(playerData.userId)
            if (!user) {
              this.logger.warning(`Skipping session ${session.id} - user ${playerData.userId} not found`)
              continue
            }

            let player: Player | null = null

            // Check if player already exists
            if (playerData.existingPlayerId) {
              player = await Player.find(parseInt(playerData.existingPlayerId))
              if (player) {
                this.logger.info(`  Updating existing player: ${player.id}`)
                // Update existing player
                player.firstName = playerData.firstName
                player.middleNames = playerData.middleNames
                player.lastName = playerData.lastName
                player.dateOfBirth = DateTime.fromISO(playerData.dateOfBirth)
                player.sex = playerData.sex
                player.medicalConditions = playerData.medicalConditions
                player.mediaConsented = playerData.mediaConsented
                player.ageGroup = playerData.ageGroup
                player.team = playerData.team
                player.secondTeam = playerData.secondTeam
                player.paymentDate = playerData.paymentDate
                player.membershipFeeOption = playerData.membershipFeeOption
                player.acceptedCodeOfConduct = playerData.acceptedCodeOfConduct
                player.acceptedDeclaration = playerData.acceptedDeclaration
                player.giftAidDeclarationAccepted = playerData.giftAidDeclarationAccepted
                player.parentId = playerData.parentId
                await player.save()
              }
            } else {
              // Check if player already exists by user and name combination
              player = await Player.query()
                .where('user_id', playerData.userId)
                .where('first_name', playerData.firstName)
                .where('last_name', playerData.lastName)
                .first()

              if (!player) {
                // Create new player
                this.logger.info(`  Creating new player: ${playerData.firstName} ${playerData.lastName}`)
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
                  identityVerificationPhoto: playerData.identityVerificationPhoto,
                  ageVerificationPhoto: playerData.ageVerificationPhoto,
                })
                createdPlayers++
              } else {
                this.logger.info(`  Player already exists: ${player.id}`)
              }
            }

            if (!player) {
              this.logger.warning(`Skipping session ${session.id} - could not find or create player`)
              continue
            }

            // Process payment data based on player type
            const playerType = session.metadata.playerType

            switch (playerType) {
              case 'coach':
                if (session.subscription) {
                  player.stripeSubscriptionId = session.subscription as string
                  await player.save()

                  // Store subscription
                  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
                  await stripeTransactionService.storeSubscription(subscription, player.id, session.id)
                  processedSubscriptions++
                }
                break

              case 'upfront':
                if (session.payment_intent) {
                  player.stripeUpfrontPaymentId = session.payment_intent as string
                  await player.save()

                  // Store upfront payment
                  const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string)
                  
                  // Merge metadata for gift aid tracking
                  const mergedMetadata = {
                    ...paymentIntent.metadata,
                    ...session.metadata,
                    giftAidDeclarationAccepted: session.metadata?.giftAidDeclarationAccepted || 'false',
                  }
                  paymentIntent.metadata = mergedMetadata

                  await stripeTransactionService.storePayment(paymentIntent, 'upfront_payment', player.id, undefined, session.id)
                  processedPayments++
                }
                break

              case 'subscription':
                // Store registration fee
                if (session.payment_intent) {
                  player.stripeRegistrationFeeId = session.payment_intent as string

                  const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string)
                  
                  // Merge metadata for gift aid tracking
                  const mergedMetadata = {
                    ...paymentIntent.metadata,
                    ...session.metadata,
                    giftAidDeclarationAccepted: session.metadata?.giftAidDeclarationAccepted || 'false',
                  }
                  paymentIntent.metadata = mergedMetadata

                  await stripeTransactionService.storePayment(paymentIntent, 'registration_fee', player.id, undefined, session.id)
                  processedPayments++
                }

                // Handle subscription creation (some might have been created later)
                const subscriptionPrice = session.metadata?.subscriptionPrice
                const trialEndDate = session.metadata?.trialEndDate ? parseInt(session.metadata.trialEndDate) : null
                const cancelAtDate = session.metadata?.cancelAtDate ? parseInt(session.metadata.cancelAtDate) : null

                if (subscriptionPrice && trialEndDate && cancelAtDate && !player.stripeSubscriptionId) {
                  // Check if subscription already exists for this customer
                  const existingSubscriptions = await stripe.subscriptions.list({
                    customer: user.stripeCustomerId,
                    price: subscriptionPrice,
                    limit: 1,
                  })

                  if (existingSubscriptions.data.length > 0) {
                    const subscription = existingSubscriptions.data[0]
                    player.stripeSubscriptionId = subscription.id
                    await stripeTransactionService.storeSubscription(subscription, player.id, session.id)
                    processedSubscriptions++
                  }
                }

                await player.save()
                break
            }

            processedCheckoutSessions++
          }
        } catch (error) {
          this.logger.error(`Failed to process checkout session ${session.id}:`, error.message)
        }
      }

      // 2. Process any additional subscriptions not captured above
      this.logger.info('\n=== Processing Additional Subscriptions ===')
      
      for await (const subscription of stripe.subscriptions.list({
        limit: 100,
        created: { gte: cutoffTimestamp },
      })) {
        try {
          // Find player by subscription ID
          let player = await Player.query()
            .where('stripe_subscription_id', subscription.id)
            .first()

          if (!player) {
            // Try to find by customer
            const user = await User.query()
              .where('stripe_customer_id', subscription.customer as string)
              .first()

            if (user) {
              player = await Player.query()
                .where('user_id', user.id)
                .first()
            }
          }

          await stripeTransactionService.storeSubscription(subscription, player?.id)
          processedSubscriptions++
        } catch (error) {
          this.logger.error(`Failed to process subscription ${subscription.id}:`, error.message)
        }
      }

      // 3. Process additional payment intents
      this.logger.info('\n=== Processing Additional Payment Intents ===')
      
      for await (const payment of stripe.paymentIntents.list({
        limit: 100,
        created: { gte: cutoffTimestamp },
      })) {
        try {
          // Skip if already processed via checkout sessions
          if (payment.metadata?.registrationId && payment.metadata?.playerType) {
            continue
          }

          // Determine payment type
          let type: 'registration_fee' | 'upfront_payment' | 'monthly_payment' = 'monthly_payment'
          let playerId: number | undefined

          if (payment.metadata?.playerType === 'upfront') {
            type = 'upfront_payment'
          } else if (payment.metadata?.playerType === 'subscription') {
            type = 'registration_fee'
          }

          // Try to find associated player
          if (payment.metadata?.playerId) {
            playerId = parseInt(payment.metadata.playerId)
          } else {
            const player = await Player.query()
              .where(query => {
                query.where('stripe_upfront_payment_id', payment.id)
                  .orWhere('stripe_registration_fee_id', payment.id)
              })
              .first()
            playerId = player?.id
          }

          await stripeTransactionService.storePayment(payment, type, playerId)
          processedPayments++
        } catch (error) {
          this.logger.error(`Failed to process payment intent ${payment.id}:`, error.message)
        }
      }

      // 4. Process invoices for monthly subscription payments
      this.logger.info('\n=== Processing Invoices ===')
      
      for await (const invoice of stripe.invoices.list({
        limit: 100,
        created: { gte: cutoffTimestamp },
        status: 'paid',
      })) {
        try {
          const subscriptionId = (invoice as any).subscription
          if (subscriptionId) {
            const player = await Player.query()
              .where('stripe_subscription_id', subscriptionId as string)
              .first()

            await stripeTransactionService.storePayment(
              invoice,
              'monthly_payment',
              player?.id,
              subscriptionId as string,
              invoice.id
            )
            processedPayments++
          }
        } catch (error) {
          this.logger.error(`Failed to process invoice ${invoice.id}:`, error.message)
        }
      }

      // Summary
      this.logger.info('\n=== Backfill Summary ===')
      this.logger.success(`✓ Processed ${processedCheckoutSessions} checkout sessions`)
      this.logger.success(`✓ Created ${createdPlayers} new players`)
      this.logger.success(`✓ Processed ${processedSubscriptions} subscriptions`)
      this.logger.success(`✓ Processed ${processedPayments} payments`)
      this.logger.success('Backfill completed successfully!')

    } catch (error) {
      this.logger.error('Failed to backfill Stripe data:', error.message)
      this.logger.error(error.stack)
      process.exit(1)
    }
  }
}
