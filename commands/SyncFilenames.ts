import { BaseCommand } from '@adonisjs/core/build/standalone'
import Player from 'App/Models/Player'
import Drive from '@ioc:Adonis/Core/Drive'

export default class SyncFilenames extends BaseCommand {
  public static commandName = 'sync:filenames'
  public static description = 'Sync database filenames with actual storage files'
  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    this.logger.info('Syncing database filenames with actual storage files...')

    try {
      const spacesDriver = Drive.use('spaces')

      // Get all players with verification photos
      const players = await Player.query()
        .whereNotNull('identity_verification_photo')
        .orWhereNotNull('age_verification_photo')

      this.logger.info(`Found ${players.length} players with verification photos`)

      let fixedCount = 0

      for (const player of players) {
        let needsUpdate = false

        // Check identity verification photo
        if (player.identityVerificationPhoto) {
          const currentPath = `identity-verification-photos/${player.identityVerificationPhoto}`
          const exists = await spacesDriver.exists(currentPath)

          if (!exists) {
            // Try to find the file with "undefined" in the name
            const timestamp = player.identityVerificationPhoto.match(/(\d+)/)?.[1]
            if (timestamp) {
              const undefinedPath = `identity-verification-photos/${timestamp}_undefined`
              const undefinedExists = await spacesDriver.exists(undefinedPath)

              if (undefinedExists) {
                this.logger.info(`Found undefined file for player ${player.id}: ${undefinedPath}`)
                // Update database to point to actual file
                player.identityVerificationPhoto = `${timestamp}_undefined`
                needsUpdate = true
              } else {
                this.logger.info(`⚠️  No file found for player ${player.id} identity photo: ${currentPath}`)
              }
            }
          }
        }

        // Check age verification photo
        if (player.ageVerificationPhoto) {
          const currentPath = `age-verification-photos/${player.ageVerificationPhoto}`
          const exists = await spacesDriver.exists(currentPath)

          if (!exists) {
            // Try to find the file with "undefined" in the name
            const timestamp = player.ageVerificationPhoto.match(/(\d+)/)?.[1]
            if (timestamp) {
              const undefinedPath = `age-verification-photos/${timestamp}_undefined`
              const undefinedExists = await spacesDriver.exists(undefinedPath)

              if (undefinedExists) {
                this.logger.info(`Found undefined file for player ${player.id}: ${undefinedPath}`)
                // Update database to point to actual file
                player.ageVerificationPhoto = `${timestamp}_undefined`
                needsUpdate = true
              } else {
                this.logger.info(`⚠️  No file found for player ${player.id} age photo: ${currentPath}`)
              }
            }
          }
        }

        if (needsUpdate) {
          await player.save()
          fixedCount++
        }
      }

      this.logger.success(`✅ Synced ${fixedCount} player records with actual file locations`)

    } catch (error) {
      this.logger.error(`Failed to sync filenames: ${error.message}`)
      throw error
    }
  }
}
