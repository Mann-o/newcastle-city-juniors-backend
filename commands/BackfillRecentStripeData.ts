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

            // Handle file moving for verification photos (similar to webhook handler)
            if (playerData.identityVerificationPhoto || playerData.ageVerificationPhoto) {
              try {
                let finalIdentityFileName = playerData.identityVerificationPhoto
                let finalAgeFileName = playerData.ageVerificationPhoto

                if (playerData.identityVerificationPhoto) {
                  finalIdentityFileName = await this.moveVerificationFile(
                    playerData.identityVerificationPhoto,
                    'identity-verification-photos'
                  )
                }

                if (playerData.ageVerificationPhoto) {
                  finalAgeFileName = await this.moveVerificationFile(
                    playerData.ageVerificationPhoto,
                    'age-verification-photos'
                  )
                }

                // Update player with final file names
                player.identityVerificationPhoto = finalIdentityFileName
                player.ageVerificationPhoto = finalAgeFileName
                await player.save()

                this.logger.info(`  Processed verification files for player ${player.id}`)
              } catch (error) {
                this.logger.warning(`Failed to process verification files for player ${player.id}:`, error.message)
              }
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
                .orderBy('created_at', 'desc')
                .first()

              if (player && !player.stripeSubscriptionId) {
                player.stripeSubscriptionId = subscription.id
                await player.save()
                this.logger.info(`  Linked subscription ${subscription.id} to player ${player.id}`)
              }
            }
          }

          // Always store/update subscription transaction
          await stripeTransactionService.storeSubscription(subscription, player?.id)
          processedSubscriptions++
          this.logger.info(`  Stored subscription: ${subscription.id} (Status: ${subscription.status})`)
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
          this.logger.info(`  Checking payment intent: ${payment.id} (Status: ${payment.status})`)

          // Skip if already processed via checkout sessions
          if (payment.metadata?.registrationId && payment.metadata?.playerType) {
            this.logger.info(`    Skipping - already processed via checkout session`)
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

            // If no player found by payment ID, try to find by customer
            if (!playerId && payment.customer) {
              const user = await User.query()
                .where('stripe_customer_id', payment.customer as string)
                .first()
              if (user) {
                const customerPlayer = await Player.query()
                  .where('user_id', user.id)
                  .orderBy('created_at', 'desc')
                  .first()
                playerId = customerPlayer?.id
              }
            }
          }

          await stripeTransactionService.storePayment(payment, type, playerId)
          processedPayments++
          this.logger.info(`    Stored payment: ${payment.id} as ${type} (Player: ${playerId || 'unlinked'})`)
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
          this.logger.info(`  Checking invoice: ${invoice.id}`)
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
            this.logger.info(`    Stored invoice: ${invoice.id} (Player: ${player?.id || 'unlinked'})`)
          } else {
            this.logger.info(`    Skipping invoice ${invoice.id} - no subscription`)
          }
        } catch (error) {
          this.logger.error(`Failed to process invoice ${invoice.id}:`, error.message)
        }
      }

      // 5. Process charges that might not have been captured above
      this.logger.info('\n=== Processing Additional Charges ===')

      for await (const charge of stripe.charges.list({
        limit: 100,
        created: { gte: cutoffTimestamp },
      })) {
        try {
          // Skip if this charge has a payment intent (already processed above)
          if (charge.payment_intent) {
            continue
          }

          this.logger.info(`  Processing direct charge: ${charge.id}`)

          // Try to find associated player via customer
          let playerId: number | undefined
          if (charge.customer) {
            const user = await User.query()
              .where('stripe_customer_id', charge.customer as string)
              .first()
            if (user) {
              const player = await Player.query()
                .where('user_id', user.id)
                .orderBy('created_at', 'desc')
                .first()
              playerId = player?.id
            }
          }

          await stripeTransactionService.storePayment(charge, 'monthly_payment', playerId)
          processedPayments++
          this.logger.info(`    Stored charge: ${charge.id} (Player: ${playerId || 'unlinked'})`)
        } catch (error) {
          this.logger.error(`Failed to process charge ${charge.id}:`, error.message)
        }
      }

      // 6. Final cleanup and linking
      this.logger.info('\n=== Final Cleanup and Validation ===')

      // Get all users with stripe_customer_id for linking
      const usersWithStripeIds = await User.query()
        .whereNotNull('stripe_customer_id')
        .select(['id', 'stripe_customer_id'])

      for (const user of usersWithStripeIds) {
        const player = await Player.query()
          .where('user_id', user.id)
          .orderBy('created_at', 'desc')
          .first()

        if (player) {
          this.logger.info(`  Validated user ${user.id} → player ${player.id} → stripe customer ${user.stripeCustomerId}`)
        }
      }

      // Summary
      this.logger.info('\n=== Backfill Summary ===')
      this.logger.success(`✓ Processed ${processedCheckoutSessions} checkout sessions`)
      this.logger.success(`✓ Created ${createdPlayers} new players`)
      this.logger.success(`✓ Processed ${processedSubscriptions} subscriptions`)
      this.logger.success(`✓ Processed ${processedPayments} payments`)
      this.logger.success('Backfill completed successfully!')

      // Final validation
      this.logger.info('\n=== Final Validation ===')
      const totalPlayers = await Player.query().count('* as total')

      this.logger.info(`Database now contains:`)
      this.logger.info(`  - ${totalPlayers[0].$extras.total} players`)

    } catch (error) {
      this.logger.error('Failed to backfill Stripe data:', error.message)
      this.logger.error(error.stack)
      process.exit(1)
    }
  }

  /**
   * Helper method to safely move temp verification files to permanent storage
   * @param tempFileName - The temporary file name (with temp_ prefix)
   * @param targetDirectory - Target directory ('identity-verification-photos' or 'age-verification-photos')
   * @returns The final filename (without temp_ prefix) or the original temp filename if moving fails
   */
  private async moveVerificationFile(tempFileName: string, targetDirectory: string): Promise<string> {
    if (!tempFileName) return ''

    const Drive = (await import('@ioc:Adonis/Core/Drive')).default
    const finalFileName = tempFileName.replace('temp_', '')

    try {
      const spacesDriver = Drive.use('spaces')
      const tempFilePath = `temp-verification-photos/${tempFileName}`
      const finalFilePath = `${targetDirectory}/${finalFileName}`

      // Check if temp file exists
      const tempExists = await spacesDriver.exists(tempFilePath)
      if (!tempExists) {
        this.logger.warning(`Temp file not found: ${tempFilePath}`)
        return tempFileName // Return original temp filename as fallback
      }

      // Copy file to permanent location
      const fileContent = await spacesDriver.get(tempFilePath)
      await spacesDriver.put(finalFilePath, fileContent)

      // Delete temp file
      await spacesDriver.delete(tempFilePath)

      this.logger.info(`    Successfully moved file: ${tempFilePath} → ${finalFilePath}`)
      return finalFileName

    } catch (error) {
      this.logger.error(`    Failed to move file ${tempFileName} to ${targetDirectory}:`, error.message)
      return tempFileName // Return original temp filename as fallback
    }
  }
}
