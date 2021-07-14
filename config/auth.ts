import { AuthConfig } from '@ioc:Adonis/Addons/Auth'

const authConfig: AuthConfig = {
  guard: 'api',

  guards: {
    api: {
      driver: 'oat',

      tokenProvider: {
        type: 'api',
        driver: 'redis',
        redisConnection: 'local',
        foreignKey: 'user_id',
      },

      provider: {
        driver: 'database',
        identifierKey: 'id',
        uids: ['email'],
        usersTable: 'users',
      },
    },

    basic: {
      driver: 'basic',

      provider: {
        driver: 'database',
        identifierKey: 'id',
        uids: ['email'],
        usersTable: 'users',
      },
    },
  },
}

export default authConfig
