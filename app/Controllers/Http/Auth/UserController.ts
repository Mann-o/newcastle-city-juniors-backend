import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import InvalidCredentialsException from '@ioc:Adonis/Core/HttpExceptionHandler'
import Env from '@ioc:Adonis/Core/Env'
import Mail from '@ioc:Adonis/Addons/Mail'
import { cuid } from '@ioc:Adonis/Core/Helpers'

import { DateTime } from 'luxon'
import Stripe from 'stripe'

import User from 'App/Models/User'
import CreateUserValidator from 'App/Validators/CreateUserValidator'
import VerifyEmailValidator from 'App/Validators/VerifyEmailValidator'
import ResetPasswordValidator from 'App/Validators/ResetPasswordValidator'
import CancelResetPasswordValidator from 'App/Validators/CancelResetPasswordValidator'
import CannotVerifyEmailException from 'App/Exceptions/CannotVerifyEmailException'
import EmailNotVerifiedException from 'App/Exceptions/EmailNotVerifiedException'

export default class UserController {
  public async register({ request, response }: HttpContextContract) {
    await request.validate(CreateUserValidator)

    try {
      const stripeClient = new Stripe(Env.get('STRIPE_API_SECRET', null), {
        apiVersion: '2020-08-27',
      })

      const { id } = await stripeClient.customers.create({
        address: {
          line1: request.input('houseNameOrNumber'),
          postal_code: request.input('postcode'),
        },
        email: request.input('email').toLowerCase(),
        name: `${request.input('firstName')} ${request.input('lastName')}`,
        phone: request.input('mobileNumber'),
      })

      const user = await User.create({
        ...request.except(['passwordConfirmation', 'emailConfirmation']),
        email: request.input('email').toLowerCase(),
        stripeCustomerId: id,
        emailVerificationToken: cuid(),
      })

      Mail.send(message => {
        message
          .from('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
          .to(user.email.toLowerCase())
          .subject('Verify email address')
          .htmlView('emails/email-verification', { user })
      })

      return response.ok({
        status: 'OK',
        code: 200,
        message: 'Registration successful',
      })
    } catch (error) {
      console.log(error)
      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to register user',
      })
    }
  }

  public async login({ auth, request, response }: HttpContextContract) {
    const email = request.input('email')
    const password = request.input('password')

    if (email !== null && password !== null) {
      try {
        const user = await User.query().whereRaw('lower(email) = ?', email.toLowerCase()).first()

        if (!user) {
          throw InvalidCredentialsException
        }

        if (!user.emailVerified) {
          throw new EmailNotVerifiedException('Email address not verified', 401, 'E_CANNOT_VERIFY_EMAIL')
        }

        const token = await auth.use('api').attempt(email, password, {
          expiresIn: '7days',
        })

        user.lastLoggedIn = DateTime.now()
        user.resetPasswordToken = null
        await user.save()

        return response.ok({
          status: 'OK',
          code: 200,
          message: 'Login successful',
          data: {
            token,
          },
        })
      } catch (error) {
        return response.unauthorized({
          status: 'Unauthorized',
          code: 401,
          message:
            error instanceof EmailNotVerifiedException
              ? 'Email address not verified - you must verify your email address before accessing the NCJ Portal.'
              : 'Invalid login credentials, please try again.',
        })
      }
    }
  }

  public async verifyEmail({ request, response }: HttpContextContract) {
    await request.validate(VerifyEmailValidator)

    const email = request.input('email').toLowerCase()
    const verificationToken = request.input('verificationToken')

    try {
      const user = await User.query()
        .where('email_verified', false)
        .andWhereRaw('lower(email) = ?', email)
        .andWhere('email_verification_token', verificationToken)
        .first()

      if (!user) {
        throw new CannotVerifyEmailException('Unable to verify email address', 400, 'E_CANNOT_VERIFY_EMAIL')
      }

      user.emailVerified = true
      user.emailVerificationToken = null
      user.save()

      return response.ok({
        status: 'OK',
        code: 200,
        message: 'Email verification successful',
      })
    } catch (error) {
      console.log(error)
      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to verify email address',
      })
    }
  }

  public async getAuthenticatedUser({ auth, response }: HttpContextContract) {
    try {
      const authenticatedUser = auth.use('api').user!
      const user = await User.query().where('id', authenticatedUser.id).preload('players')

      return response.ok({
        status: 'OK',
        code: 200,
        data: {
          user,
        },
      })
    } catch {
      return response.unauthorized({
        status: 'Unauthorized',
        code: 401,
        message: 'Unable to fetch user when not authenticated',
      })
    }
  }

  public async logout({ auth, response }: HttpContextContract) {
    try {
      await auth.use('api').revoke()

      return response.ok({
        status: 'OK',
        code: 200,
        message: 'Logout successful',
      })
    } catch {
      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to logout',
      })
    }
  }

  public async startResetPassword({ request, response }: HttpContextContract) {
    try {
      const email = request.input('email').toLowerCase()

      const user = await User.query().whereRaw('lower(email) = ?', email).first()

      if (!user) {
        return response.ok({
          status: 'OK',
          code: 200,
          message: 'Reset password request received',
        })
      }

      user.resetPasswordToken = cuid()
      await user.save()

      Mail.send(message => {
        message
          .from('info@newcastlecityjuniors.co.uk', 'Newcastle City Juniors')
          .to(user.email.toLowerCase())
          .subject('Reset password')
          .htmlView('emails/reset-password', { user })
      })

      return response.ok({
        status: 'OK',
        code: 200,
        message: 'Reset password request received',
      })
    } catch (error) {
      console.log(error)
      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to begin reset password process',
      })
    }
  }

  public async cancelResetPassword({ request, response }: HttpContextContract) {
    await request.validate(CancelResetPasswordValidator)

    const email = request.input('email').toLowerCase()
    const resetToken = request.input('resetToken')

    try {
      const user = await User.query().whereRaw('lower(email) = ?', email).andWhere('reset_password_token', resetToken).first()

      if (!user) {
        return response.notFound({
          status: 'Not Found',
          code: 404,
          message: 'User not found',
        })
      }

      user.resetPasswordToken = null
      await user.save()

      return response.ok({
        status: 'OK',
        code: 200,
        message: 'Password reset request cancelled successfully',
      })
    } catch (error) {
      console.log(error)
      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to cancel reset password process',
      })
    }
  }

  public async finishResetPassword({ request, response }: HttpContextContract) {
    await request.validate(ResetPasswordValidator)

    const email = request.input('email').toLowerCase()
    const resetToken = request.input('resetToken')
    const newPassword = request.input('newPassword')

    try {
      const user = await User.query().whereRaw('lower(email) = ?', email).andWhere('reset_password_token', resetToken).first()

      if (!user) {
        return response.notFound({
          status: 'Not Found',
          code: 404,
          message: 'User not found',
        })
      }

      user.resetPasswordToken = null
      user.password = newPassword
      await user.save()

      return response.ok({
        status: 'OK',
        code: 200,
        message: 'Password reset successfully',
      })
    } catch (error) {
      console.log(error)
      return response.badRequest({
        status: 'Bad Request',
        code: 400,
        message: 'Unable to begin reset password process',
      })
    }
  }
}
