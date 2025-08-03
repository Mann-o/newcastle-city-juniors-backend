import { BaseCommand } from '@adonisjs/core/build/standalone'
import Player from 'App/Models/Player'
import Drive from '@ioc:Adonis/Core/Drive'

export default class DiagnoseTempFiles extends BaseCommand {
  public static commandName = 'diagnose:temp-files'
  public static description = 'Diagnose temp file issues and provide solutions'
  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    this.logger.info('🔍 Diagnosing temp file issues...')

    try {
      const spacesDriver = Drive.use('spaces')

      // Check players with temp filenames in database
      const playersWithTempFiles = await Player.query()
        .where('identity_verification_photo', 'like', 'temp_%')
        .orWhere('age_verification_photo', 'like', 'temp_%')

      this.logger.info(`📊 Found ${playersWithTempFiles.length} players with temp filenames in database`)

      // Check for files without temp_ prefix in temp folder
      const playersWithRegularFilenamesInTemp = await Player.query()
        .where('identity_verification_photo', 'not like', 'temp_%')
        .whereNotNull('identity_verification_photo')
        .orWhere('age_verification_photo', 'not like', 'temp_%')
        .whereNotNull('age_verification_photo')

      this.logger.info(`📊 Checking ${playersWithRegularFilenamesInTemp.length} players with regular filenames...`)

      let missingFiles = 0
      let filesInWrongLocation = 0

      for (const player of playersWithTempFiles) {
        this.logger.info(`\n👤 Player ${player.id}: ${player.firstName} ${player.lastName}`)
        
        // Check identity verification photo
        if (player.identityVerificationPhoto) {
          await this.checkFile(
            player.identityVerificationPhoto,
            'identity-verification-photos',
            'Identity',
            spacesDriver
          )
        }

        // Check age verification photo  
        if (player.ageVerificationPhoto) {
          await this.checkFile(
            player.ageVerificationPhoto,
            'age-verification-photos', 
            'Age',
            spacesDriver
          )
        }
      }

      // Check for files that might be in temp folder but without temp_ prefix
      this.logger.info('\n🔍 Checking for files that might be misnamed in temp folder...')
      
      for (const player of playersWithRegularFilenamesInTemp.slice(0, 10)) { // Check first 10 to avoid overwhelming output
        if (player.identityVerificationPhoto) {
          const tempPath = `temp-verification-photos/${player.identityVerificationPhoto}`
          const normalPath = `identity-verification-photos/${player.identityVerificationPhoto}`
          
          try {
            const inTemp = await spacesDriver.exists(tempPath)
            const inNormal = await spacesDriver.exists(normalPath)
            
            if (inTemp && !inNormal) {
              this.logger.warning(`🚨 Player ${player.id} identity photo found in temp folder without temp_ prefix: ${tempPath}`)
              filesInWrongLocation++
            }
          } catch (error) {
            this.logger.error(`Error checking file locations for player ${player.id}:`, error.message)
          }
        }

        if (player.ageVerificationPhoto) {
          const tempPath = `temp-verification-photos/${player.ageVerificationPhoto}`
          const normalPath = `age-verification-photos/${player.ageVerificationPhoto}`
          
          try {
            const inTemp = await spacesDriver.exists(tempPath)
            const inNormal = await spacesDriver.exists(normalPath)
            
            if (inTemp && !inNormal) {
              this.logger.warning(`🚨 Player ${player.id} age photo found in temp folder without temp_ prefix: ${tempPath}`)
              filesInWrongLocation++
            }
          } catch (error) {
            this.logger.error(`Error checking file locations for player ${player.id}:`, error.message)
          }
        }
      }

      this.logger.info('\n📋 DIAGNOSIS SUMMARY:')
      this.logger.info(`  • Players with temp filenames in DB: ${playersWithTempFiles.length}`)
      this.logger.info(`  • Files found in wrong location: ${filesInWrongLocation}`)
      this.logger.info(`  • Missing files: ${missingFiles}`)

      if (playersWithTempFiles.length > 0) {
        this.logger.info('\n💡 RECOMMENDED ACTIONS:')
        this.logger.info('  1. Run the enhanced webhook with better logging to see exact errors')
        this.logger.info('  2. Consider running a repair command to move misplaced files')
        this.logger.info('  3. Check DigitalOcean Spaces logs for any access/permission issues')
      }

    } catch (error) {
      this.logger.error(`❌ Failed to diagnose temp files: ${error.message}`)
      throw error
    }
  }

  private async checkFile(filename: string, targetFolder: string, type: string, spacesDriver: any) {
    const tempPath = `temp-verification-photos/${filename}`
    const finalPath = `${targetFolder}/${filename.replace('temp_', '')}`
    
    try {
      const tempExists = await spacesDriver.exists(tempPath)
      const finalExists = await spacesDriver.exists(finalPath)
      
      if (tempExists && !finalExists) {
        this.logger.info(`  📁 ${type}: FOUND in temp folder (${tempPath})`)
        return 'temp'
      } else if (!tempExists && finalExists) {
        this.logger.info(`  ✅ ${type}: Already moved to final location (${finalPath})`)
        return 'moved'
      } else if (tempExists && finalExists) {
        this.logger.warning(`  ⚠️  ${type}: EXISTS in BOTH locations - temp file should be cleaned up`)
        return 'both'
      } else {
        this.logger.error(`  ❌ ${type}: NOT FOUND in either location`)
        return 'missing'
      }
    } catch (error) {
      this.logger.error(`  💥 ${type}: Error checking file - ${error.message}`)
      return 'error'
    }
  }
}
