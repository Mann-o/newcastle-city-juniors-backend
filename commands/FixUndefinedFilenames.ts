import { BaseCommand } from '@adonisjs/core/build/standalone'
import Player from 'App/Models/Player'

export default class FixUndefinedFilenames extends BaseCommand {
  public static commandName = 'fix:undefined-filenames'
  public static description = 'Fix player records with undefined verification photo filenames'
  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    this.logger.info('Finding players with undefined verification photo filenames...')

    try {
      // Find players with undefined filenames
      const playersWithUndefinedFiles = await Player.query()
        .where(query => {
          query.where('identity_verification_photo', 'like', '%undefined%')
            .orWhere('age_verification_photo', 'like', '%undefined%')
        })

      this.logger.info(`Found ${playersWithUndefinedFiles.length} players with undefined filenames`)

      let fixedCount = 0

      for (const player of playersWithUndefinedFiles) {
        let needsUpdate = false

        // Fix identity verification photo filename
        if (player.identityVerificationPhoto && player.identityVerificationPhoto.includes('undefined')) {
          // Extract timestamp and replace undefined with proper filename
          const timestampMatch = player.identityVerificationPhoto.match(/(\d+)_undefined/)
          if (timestampMatch) {
            const timestamp = timestampMatch[1]
            player.identityVerificationPhoto = `${timestamp}_identity.jpg`
            needsUpdate = true
            this.logger.info(`Fixed identity photo for player ${player.id}: ${player.identityVerificationPhoto}`)
          }
        }

        // Fix age verification photo filename
        if (player.ageVerificationPhoto && player.ageVerificationPhoto.includes('undefined')) {
          // Extract timestamp and replace undefined with proper filename
          const timestampMatch = player.ageVerificationPhoto.match(/(\d+)_undefined/)
          if (timestampMatch) {
            const timestamp = timestampMatch[1]
            player.ageVerificationPhoto = `${timestamp}_age.jpg`
            needsUpdate = true
            this.logger.info(`Fixed age photo for player ${player.id}: ${player.ageVerificationPhoto}`)
          }
        }

        if (needsUpdate) {
          await player.save()
          fixedCount++
        }
      }

      this.logger.success(`✅ Fixed ${fixedCount} players with undefined filenames`)

      // Also check for temp files with undefined names
      this.logger.info('Note: You may also need to check for temporary files with undefined names in your storage.')
      this.logger.info('Consider running a manual cleanup of files containing "undefined" in temp-verification-photos directory.')

    } catch (error) {
      this.logger.error(`Failed to fix undefined filenames: ${error.message}`)
      throw error
    }
  }
}
