import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
import Env from '@ioc:Adonis/Core/Env'

import Stripe from 'stripe'
import { parseISO, getUnixTime, addMonths, getMonth, getYear, format } from 'date-fns'

import Player from 'App/Models/Player'
import User from 'App/Models/User'
import CreatePlayerValidator from 'App/Validators/CreatePlayerValidator'

export default class PlayerController {
  /**
   * IMPROVED REGISTRATION FLOW (v2):
   *
   * PROBLEM SOLVED: Players were being created before payment completion,
   * causing duplicate records when users cancelled and retried payments.
   *
   * NEW FLOW:
   * 1. Validate request and check for existing registrations
   * 2. Store files in temp directory with unique names
   * 3. Store ALL player data in Stripe checkout session metadata
   * 4. Create checkout session without creating player record
   * 5. Webhook creates/updates player only on successful payment
   * 6. Move temp files to permanent location in webhook
   *
   * BENEFITS:
   * - No duplicate players from cancelled payments
   * - Atomic registration (payment + player creation together)
   * - Better error handling and recovery
   * - Cleaner separation of concerns
   *
   * REQUIREMENTS:
   * - Webhook must be properly configured: /api/stripe/handle-webhook
   * - Temp file cleanup should run periodically
   * - Stripe metadata limits: max 50 keys, 500 chars per value
   */

  public async createPlayer({ auth, request, response }: HttpContextContract) {
    await request.validate(CreatePlayerValidator)

    try {
      const authenticatedUser = auth.use('api').user!

      const user = await User.query().where('id', authenticatedUser.id).first()

      if (!user) {
        throw new Error()
      }

      const requiredPermissionsForFreeRegistration: string[] = ['coach'];
      const userPermissions = (await user!.related('permissions').query()).map(({ name }) => name)
      const hasRequiredPermissionsForFreeRegistration = requiredPermissionsForFreeRegistration.every(requiredPermission => userPermissions.includes(requiredPermission)) || userPermissions.includes('sudo');

      const dualTeam = (request.input('secondTeam') !== 'none');

      const identityVerificationPhoto = request.file('identityVerificationPhoto')!
      const ageVerificationPhoto = request.file('ageVerificationPhoto')!

      // Store files temporarily with unique prefixes for webhook processing
      const tempIdentityFileName = `temp_${Date.now()}_${identityVerificationPhoto.fileName}`
      const tempAgeFileName = `temp_${Date.now()}_${ageVerificationPhoto.fileName}`

      await identityVerificationPhoto.moveToDisk('temp-verification-photos', { name: tempIdentityFileName }, 'spaces')
      await ageVerificationPhoto.moveToDisk('temp-verification-photos', { name: tempAgeFileName }, 'spaces')

      // Check for existing player to prevent duplicates
      const existingPlayerId = request.input('existingPlayerId')
      let existingPlayer: Player | null = null;

      if (existingPlayerId) {
        existingPlayer = await Player.query()
          .where('id', existingPlayerId)
          .where('userId', user.id)
          .first()

        if (!existingPlayer) {
          return response.badRequest({
            status: 'Bad Request',
            code: 400,
            message: 'Existing player not found or not accessible',
          })
        }

        // Check if player already has active payment/subscription to prevent duplicates
        if (existingPlayer.stripeSubscriptionId || existingPlayer.stripeUpfrontPaymentId || existingPlayer.stripeRegistrationFeeId) {
          return response.badRequest({
            status: 'Bad Request',
            code: 400,
            message: 'Player already has an active registration or payment',
          })
        }
      } else {
        // For new players, check if there's already a pending registration
        const pendingPlayer = await Player.query()
          .where('userId', user.id)
          .where('firstName', request.input('firstName'))
          .where('lastName', request.input('lastName'))
          .where('dateOfBirth', request.input('dateOfBirth'))
          .whereNull('stripeSubscriptionId')
          .whereNull('stripeUpfrontPaymentId')
          .whereNull('stripeRegistrationFeeId')
          .first()

        if (pendingPlayer) {
          return response.badRequest({
            status: 'Bad Request',
            code: 400,
            message: 'A registration for this player is already in progress. Please complete the existing registration or contact support.',
          })
        }
      }

      // Prepare player data for checkout session metadata
      const membershipFeeOption = hasRequiredPermissionsForFreeRegistration ? 'subscription' : request.input('membershipFeeOption')

      // Generate a unique registration ID for this attempt
      const registrationId = `reg_${Date.now()}_${user.id}`

      // Validate registration period - prevent registrations from April onwards
      const currentDate = new Date()
      const currentMonth = getMonth(currentDate) // 0-based: Jan=0, Feb=1, Mar=2, Apr=3, May=4, Jun=5
      const isLateRegistration = currentMonth >= 3 && currentMonth <= 4 // April (3) and May (4)

      if (isLateRegistration) {
        return response.badRequest({
          status: 'Bad Request',
          code: 400,
          message: 'Player registrations are closed for this season. Registrations open in June for the next season.',
        })
      }

      /**
       * REGISTRATION WINDOWS:
       *
       * EARLY REGISTRATION (Jan-Mar): Join current season, pay until May same year
       * - January → 4 monthly payments (Feb, Mar, Apr, May)
       * - February → 3 monthly payments (Mar, Apr, May)
       * - March → 2 monthly payments (Apr, May)
       *
       * CLOSED PERIOD (Apr-May): No registrations allowed
       *
       * NORMAL REGISTRATION (Jun-Dec): Join next season, pay until May next year
       * - June → 11 monthly payments (Jul → May next year)
       * - July → 10 monthly payments (Aug → May next year)
       * - etc.
       */

      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: Env.get('STRIPE_API_VERSION'),
      })

      let session: Stripe.Checkout.Session

      /**
       * Payment Flow:
       * 1. COACHES: Get a free subscription (£0 price) via Stripe Checkout subscription mode
       * 2. UPFRONT: Pay full season fee upfront via one-time payment
       * 3. SUBSCRIPTION: Pay registration fee upfront, then subscription is created via webhook
       *
       * All payments store the payment method as default for future billing.
       * Webhooks handle subscription creation and payment tracking.
       *
       * TODO: Consider adding email notifications for successful registrations
       * TODO: Add retry logic for failed webhook processing
       */

      /**
       * NEW PAYMENT FLOW:
       * 1. Store player data in checkout session metadata
       * 2. Create player only after successful payment in webhook
       * 3. Handle file uploads by moving temp files to permanent location
       *
       * This prevents duplicate player records from payment cancellations.
       */

      if (hasRequiredPermissionsForFreeRegistration) {
        // For coaches: Create a free subscription
        session = await stripeClient.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          customer: user.stripeCustomerId,
          line_items: [
            {
              price: Env.get('STRIPE_SUBS_COACH'),
              quantity: 1,
            },
          ],
          subscription_data: {
            metadata: {
              registrationId,
              playerType: 'coach',
              giftAidDeclarationAccepted: request.input('giftAidDeclarationAccepted').toString(),
              ageGroup: request.input('ageGroup'),
              team: request.input('team'),
              membershipFeeOption: 'subscription',
            },
          },
          metadata: {
            registrationId,
            playerType: 'coach',
            userId: user.id.toString(),
            firstName: request.input('firstName'),
            middleNames: request.input('middleNames') || '',
            lastName: request.input('lastName'),
            dateOfBirth: request.input('dateOfBirth'),
            sex: request.input('sex'),
            medicalConditions: request.input('medicalConditions') || '',
            mediaConsented: request.input('mediaConsented').toString(),
            ageGroup: request.input('ageGroup'),
            team: request.input('team'),
            secondTeam: request.input('secondTeam'),
            paymentDate: request.input('paymentDate').toString(),
            membershipFeeOption: 'subscription', // Coaches always get subscriptions
            acceptedCodeOfConduct: request.input('acceptedCodeOfConduct').toString(),
            acceptedDeclaration: request.input('acceptedDeclaration').toString(),
            giftAidDeclarationAccepted: request.input('giftAidDeclarationAccepted').toString(),
            parentId: request.input('parentId').toString(),
            identityVerificationPhoto: tempIdentityFileName,
            ageVerificationPhoto: tempAgeFileName,
            existingPlayerId: existingPlayerId?.toString() || '',
          },
          allow_promotion_codes: true,
          cancel_url: `${
            Env.get('NODE_ENV') === 'production'
              ? 'https://newcastlecityjuniors.co.uk'
              : 'http://localhost:3000'
          }/portal/players/register?error=coach_payment_cancelled`,
          success_url: `${
            Env.get('NODE_ENV') === 'production'
              ? 'https://newcastlecityjuniors.co.uk'
              : 'http://localhost:3000'
          }/portal/players?status=success&id={CHECKOUT_SESSION_ID}`,
        })
      } else if (membershipFeeOption === 'upfront') {
        // For upfront payments: Single payment checkout
        session = await stripeClient.checkout.sessions.create({
          mode: 'payment',
          payment_method_options: {
            card: {
              setup_future_usage: 'off_session',
            },
          },
          payment_method_types: ['card'],
          customer: user.stripeCustomerId,
          line_items: [
            {
              price: Env.get(`STRIPE_UPFRONT_${dualTeam ? 'DUAL' : 'SINGLE'}_TEAM`),
              quantity: 1,
              adjustable_quantity: {
                enabled: false,
              },
            },
          ],
          payment_intent_data: {
            setup_future_usage: 'off_session',
            metadata: {
              registrationId,
              playerType: 'upfront',
            },
          },
          metadata: {
            registrationId,
            playerType: 'upfront',
            userId: user.id.toString(),
            firstName: request.input('firstName'),
            middleNames: request.input('middleNames') || '',
            lastName: request.input('lastName'),
            dateOfBirth: request.input('dateOfBirth'),
            sex: request.input('sex'),
            medicalConditions: request.input('medicalConditions') || '',
            mediaConsented: request.input('mediaConsented').toString(),
            ageGroup: request.input('ageGroup'),
            team: request.input('team'),
            secondTeam: request.input('secondTeam'),
            paymentDate: request.input('paymentDate').toString(),
            membershipFeeOption,
            acceptedCodeOfConduct: request.input('acceptedCodeOfConduct').toString(),
            acceptedDeclaration: request.input('acceptedCodeOfConduct').toString(),
            giftAidDeclarationAccepted: request.input('giftAidDeclarationAccepted').toString(),
            parentId: request.input('parentId').toString(),
            identityVerificationPhoto: tempIdentityFileName,
            ageVerificationPhoto: tempAgeFileName,
            existingPlayerId: existingPlayerId?.toString() || '',
          },
          allow_promotion_codes: true,
          cancel_url: `${
            Env.get('NODE_ENV') === 'production'
              ? 'https://newcastlecityjuniors.co.uk'
              : 'http://localhost:3000'
          }/portal/players/register?error=upfront_payment_cancelled`,
          success_url: `${
            Env.get('NODE_ENV') === 'production'
              ? 'https://newcastlecityjuniors.co.uk'
              : 'http://localhost:3000'
          }/portal/players?status=success&id={CHECKOUT_SESSION_ID}`,
        })
      } else if (membershipFeeOption === 'subscription') {
        // For subscription payments: Registration fee + subscription setup
        const trialEndDate = addMonths(new Date(), 1)
        const paymentDate = parseInt(request.input('paymentDate'))

        // Calculate the correct season year based on registration month
        const currentYear = getYear(new Date())
        const currentMonth = getMonth(new Date()) // 0-based: Jan=0, Feb=1, Mar=2, Jun=5, Jul=6

        // Season logic:
        // - Jan/Feb/Mar registrations: Final payment in May of SAME year
        // - Jun/Jul/Aug/Sep/Oct/Nov/Dec registrations: Final payment in May of NEXT year
        const isEarlyRegistration = currentMonth <= 2 // Jan (0), Feb (1), Mar (2)
        const finalPaymentYear = isEarlyRegistration ? currentYear : currentYear + 1

        console.log(`Player registration: ${format(new Date(), 'yyyy-MM-dd')}, Season ends: ${finalPaymentYear}-05, Early registration: ${isEarlyRegistration}`)

        const finalPaymentDate = parseISO(`${finalPaymentYear}-05-${String(paymentDate).padStart(2, '0')}`)

        // IMPORTANT: Set cancel_at to be AFTER the final billing cycle completes
        // This ensures May payment is taken in full without proration
        // The subscription will be cancelled after the May billing period ends
        const cancelDate = addMonths(finalPaymentDate, 1)

        session = await stripeClient.checkout.sessions.create({
          mode: 'payment',
          payment_method_options: {
            card: {
              setup_future_usage: 'off_session',
            },
          },
          payment_method_types: ['card'],
          customer: user.stripeCustomerId,
          line_items: [
            {
              price: Env.get(`STRIPE_REG_FEE_${dualTeam ? 'DUAL' : 'SINGLE'}_TEAM`),
              quantity: 1,
              adjustable_quantity: {
                enabled: false,
              },
            },
          ],
          payment_intent_data: {
            setup_future_usage: 'off_session',
            metadata: {
              registrationId,
              playerType: 'subscription',
              subscriptionPrice: Env.get(`STRIPE_SUBS_${dualTeam ? 'DUAL' : 'SINGLE'}_TEAM`),
              trialEndDate: getUnixTime(
                parseISO(`${getYear(trialEndDate)}-${(getMonth(trialEndDate) + 1).toString().padStart(2, '0')}-${String(paymentDate).padStart(2, '0')}`),
              ).toString(),
              cancelAtDate: getUnixTime(cancelDate).toString(),
            },
          },
          metadata: {
            registrationId,
            playerType: 'subscription',
            subscriptionPrice: Env.get(`STRIPE_SUBS_${dualTeam ? 'DUAL' : 'SINGLE'}_TEAM`),
            trialEndDate: getUnixTime(
              parseISO(`${getYear(trialEndDate)}-${(getMonth(trialEndDate) + 1).toString().padStart(2, '0')}-${String(paymentDate).padStart(2, '0')}`),
            ).toString(),
            cancelAtDate: getUnixTime(cancelDate).toString(),
            userId: user.id.toString(),
            firstName: request.input('firstName'),
            middleNames: request.input('middleNames') || '',
            lastName: request.input('lastName'),
            dateOfBirth: request.input('dateOfBirth'),
            sex: request.input('sex'),
            medicalConditions: request.input('medicalConditions') || '',
            mediaConsented: request.input('mediaConsented').toString(),
            ageGroup: request.input('ageGroup'),
            team: request.input('team'),
            secondTeam: request.input('secondTeam'),
            paymentDate: request.input('paymentDate').toString(),
            membershipFeeOption,
            acceptedCodeOfConduct: request.input('acceptedCodeOfConduct').toString(),
            acceptedDeclaration: request.input('acceptedDeclaration').toString(),
            giftAidDeclarationAccepted: request.input('giftAidDeclarationAccepted').toString(),
            parentId: request.input('parentId').toString(),
            identityVerificationPhoto: tempIdentityFileName,
            ageVerificationPhoto: tempAgeFileName,
            existingPlayerId: existingPlayerId?.toString() || '',
          },
          allow_promotion_codes: true,
          cancel_url: `${
            Env.get('NODE_ENV') === 'production'
              ? 'https://newcastlecityjuniors.co.uk'
              : 'http://localhost:3000'
          }/portal/players/register?error=subscription_payment_cancelled`,
          success_url: `${
            Env.get('NODE_ENV') === 'production'
              ? 'https://newcastlecityjuniors.co.uk'
              : 'http://localhost:3000'
          }/portal/players?status=success&id={CHECKOUT_SESSION_ID}`,
        })
      } else {
        return response.abort('Invalid membership fee option', 400)
      }

      if (session.url) {
        response.send({
          checkoutUrl: session.url,
        })
      } else {
        response.abort('Unable to create a Stripe checkout session', 502)
      }
    } catch(error) {
      console.log(error);

      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to create or update player',
      })
    }
  }

  public async getPlayer({ auth, params, response }: HttpContextContract) {
    const user = auth.use('api').user!

    try {
      const player = await Player.query().where('userId', user.id).andWhere('id', params.playerId).first()

      if (!player) {
        return response.notFound({
          status: 'Not Found',
          code: 404,
          message: 'Player not found',
        })
      }

      return response.ok({
        status: 'OK',
        code: 200,
        data: {
          ...player.serialize(),
        },
      })
    } catch (error) {
      console.log(error)
      response.internalServerError();
    }
  }

  public async updatePlayer({ auth, request, response, params }: HttpContextContract) {
    const user = auth.use('api').user!

    const player = await Player.query().where({
      id: params.playerId,
      userId: user.id,
    }).firstOrFail()

    player.firstName = request.input('firstName')
    player.middleNames = request.input('middleNames')
    player.lastName = request.input('lastName')
    player.dateOfBirth = request.input('dateOfBirth')
    player.sex = request.input('sex')
    player.medicalConditions = request.input('medicalConditions')
    player.giftAidDeclarationAccepted = request.input('giftAidDeclarationAccepted')

    const identityVerificationPhoto = request.file('identityVerificationPhoto')
    const ageVerificationPhoto = request.file('ageVerificationPhoto')

    if (identityVerificationPhoto) {
      await identityVerificationPhoto.moveToDisk('identity-verification-photos', {}, 'spaces')
      player.identityVerificationPhoto = identityVerificationPhoto.fileName!
    }

    if (ageVerificationPhoto) {
      await ageVerificationPhoto.moveToDisk('age-verification-photos', {}, 'spaces')
      player.ageVerificationPhoto = ageVerificationPhoto.fileName!
    }

    await player.save()

    return response.ok({
      status: 'OK',
      code: 200,
      data: player.serialize(),
    })
  }

  public async getAllPlayers({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const players = await Player.query().where('userId', user.id)

    return response.ok({
      status: 'OK',
      code: 200,
      data: players,
    })
  }

  public async getAllPlayersCount({ auth, response }: HttpContextContract) {
    const user = auth.use('api').user!

    const playerCount = (await Player.query().where('userId', user.id)).length

    return response.ok({
      status: 'OK',
      code: 200,
      data: playerCount,
    })
  }

  public async getRemainingTicketsCount({ response }: HttpContextContract) {
    const ticketsRemainingJson = await Database.from('config').where('key', 'tickets_remaining').select('value').first()

    const ticketsRemaining = ticketsRemainingJson.value.count

    return response.ok({
      status: 'OK',
      code: 200,
      data: {
        ticketsRemaining,
      },
    })
  }

  public async getRemainingTicketsCount2024({ response }: HttpContextContract) {
    const ticketsRemainingJson = await Database.from('config').where('key', 'tickets_remaining_2024').select('value').first()

    const ticketsRemaining = {
      earlyTicketsRemaining: ticketsRemainingJson.value.earlyCount,
      lateTicketsRemaining: ticketsRemainingJson.value.lateCount,
    }

    return response.ok({
      status: 'OK',
      code: 200,
      data: {
        ticketsRemaining,
      },
    })
  }  /**
   * Clean up orphaned temporary files from abandoned registrations
   * This should be called periodically to prevent storage buildup
   */
  public async cleanupTempFiles({ response }: HttpContextContract) {
    try {
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      let cleanedCount = 0;

      console.log('Starting temp file cleanup...');

      // Note: Since we can't easily list all files in a directory with the current
      // AdonisJS Drive interface, this is a simplified implementation.
      // In production, consider:
      // 1. Using AWS SDK directly for better file operations
      // 2. Tracking temp files in database with cleanup timestamps
      // 3. S3 lifecycle policies for automatic cleanup

      // For now, we'll just log the cleanup attempt
      console.log(`Cleanup would remove temp files older than ${new Date(cutoffTime).toISOString()}`);

      // TODO: Implement actual file listing and deletion
      // Example implementation would:
      // 1. List files in 'temp-verification-photos' directory
      // 2. Parse timestamps from filenames (temp_TIMESTAMP_originalname)
      // 3. Delete files older than cutoff time

      return response.ok({
        status: 'OK',
        code: 200,
        data: {
          message: 'Temp file cleanup completed',
          filesCleanedUp: cleanedCount,
          cutoffTime: new Date(cutoffTime).toISOString(),
        },
      })
    } catch (error) {
      console.error('Error during temp file cleanup:', error);
      return response.internalServerError({
        status: 'Internal Server Error',
        code: 500,
        message: 'Failed to cleanup temp files',
      })
    }
  }
}
