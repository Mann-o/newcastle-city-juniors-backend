import Env from '@ioc:Adonis/Core/Env'
import { MailConfig } from '@ioc:Adonis/Addons/Mail'

const mailConfig: MailConfig = {
  mailer: 'smtp',

  mailers: {
    smtp: {
      driver: 'smtp',
      host: Env.get('MAIL_HOST'),
      port: Env.get('MAIL_PORT'),
      auth: {
        user: Env.get('MAIL_USERNAME'),
        pass: Env.get('MAIL_PASSWORD'),
        type: 'login',
      },
    },
  },
}

export default mailConfig
