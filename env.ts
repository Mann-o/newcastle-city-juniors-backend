import Env from '@ioc:Adonis/Core/Env'

export default Env.rules({
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),

  NODE_ENV: Env.schema.enum(['development', 'production'] as const),

  APP_NAME: Env.schema.string(),
  APP_KEY: Env.schema.string(),
  APP_KEY_WEB: Env.schema.string(),

  CACHE_VIEWS: Env.schema.boolean(),

  DB_CONNECTION: Env.schema.string(),
  PG_HOST: Env.schema.string({ format: 'host' }),
  PG_PORT: Env.schema.number(),
  PG_USER: Env.schema.string(),
  PG_PASSWORD: Env.schema.string.optional(),
  PG_DB_NAME: Env.schema.string(),

  REDIS_CONNECTION: Env.schema.enum(['local'] as const),
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),

  MAIL_HOST: Env.schema.string({ format: 'host' }),
  MAIL_USERNAME: Env.schema.string({ format: 'email' }),
  MAIL_PASSWORD: Env.schema.string(),
  MAIL_PORT: Env.schema.number(),

  STRIPE_API_SECRET: Env.schema.string(),
})
