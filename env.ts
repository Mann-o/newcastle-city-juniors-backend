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
  STRIPE_WEBHOOK_SECRET: Env.schema.string(),
  STRIPE_PRICE_ID_SUBSCRIPTION_UPFRONT_MALE: Env.schema.string(),
  STRIPE_PRICE_ID_SUBSCRIPTION_UPFRONT_FEMALE: Env.schema.string(),
  STRIPE_PRICE_ID_SUBSCRIPTION_MALE_SINGLE_TEAM: Env.schema.string(),
  STRIPE_PRICE_ID_SUBSCRIPTION_FEMALE_SINGLE_TEAM: Env.schema.string(),
  STRIPE_PRICE_ID_SUBSCRIPTION_MALE_MULTI_TEAM: Env.schema.string(),
  STRIPE_PRICE_ID_SUBSCRIPTION_FEMALE_MULTI_TEAM: Env.schema.string(),
  STRIPE_PRICE_ID_UPFRONT_MALE_SINGLE_TEAM: Env.schema.string(),
  STRIPE_PRICE_ID_UPFRONT_FEMALE_SINGLE_TEAM: Env.schema.string(),
  STRIPE_PRICE_ID_UPFRONT_MALE_MULTI_TEAM: Env.schema.string(),
  STRIPE_PRICE_ID_UPFRONT_FEMALE_MULTI_TEAM: Env.schema.string(),

  SENTRY_DSN: Env.schema.string(),
  SENTRY_TRACES_SAMPLE_RATE: Env.schema.number(),

  S3_KEY: Env.schema.string(),
  S3_SECRET: Env.schema.string(),
  S3_REGION: Env.schema.string(),
  S3_BUCKET: Env.schema.string(),
  S3_ENDPOINT: Env.schema.string(),
})
