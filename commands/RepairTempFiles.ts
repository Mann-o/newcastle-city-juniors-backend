import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Player from 'App/Models/Player'
import Drive from '@ioc:Adonis/Core/Drive'

export default class RepairTempFiles extends BaseCommand {
  public static commandName = 'repair:temp-files'
  public static description = 'Repair temp files by moving them to correct locations and updating database'
  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.boolean({ description: 'Show what would be changed without making actual changes' })
  public dryRun: boolean = false

  public async run() {
    this.logger.info('🔧 Repairing temp file issues...')

    if (this.dryRun) {
      this.logger.info('🔍 DRY RUN MODE - No changes will be made')
    }

    try {
      const spacesDriver = Drive.use('spaces')

      // Find players with temp filenames still in database
      const playersWithTempFiles = await Player.query()
        .where('identity_verification_photo', 'like', 'temp_%')
        .orWhere('age_verification_photo', 'like', 'temp_%')

      this.logger.info(`📊 Found ${playersWithTempFiles.length} players with temp filenames in database`)

      let repairedCount = 0
      let errorCount = 0

      for (const player of playersWithTempFiles) {
        this.logger.info(`\n👤 Processing Player ${player.id}: ${player.firstName} ${player.lastName}`)
        
        let playerNeedsUpdate = false

        // Handle identity verification photo
        if (player.identityVerificationPhoto && player.identityVerificationPhoto.startsWith('temp_')) {
          const result = await this.repairFile(
            player.identityVerificationPhoto,
            'identity-verification-photos',
            'Identity',
            spacesDriver,
            this.dryRun
          )
          
          if (result.success) {
            if (!this.dryRun) {
              player.identityVerificationPhoto = result.finalFilename
              playerNeedsUpdate = true
            }
            repairedCount++
          } else {
            errorCount++
          }
        }

        // Handle age verification photo
        if (player.ageVerificationPhoto && player.ageVerificationPhoto.startsWith('temp_')) {
          const result = await this.repairFile(
            player.ageVerificationPhoto,
            'age-verification-photos',
            'Age',
            spacesDriver,
            this.dryRun
          )
          
          if (result.success) {
            if (!this.dryRun) {
              player.ageVerificationPhoto = result.finalFilename
              playerNeedsUpdate = true
            }
            repairedCount++
          } else {
            errorCount++
          }
        }

        // Save player if updated
        if (playerNeedsUpdate && !this.dryRun) {
          await player.save()
          this.logger.info(`  💾 Updated player database record`)
        }
      }

      // Also check for files that are in temp folder but don't have temp_ prefix
      this.logger.info('\n🔍 Checking for misnamed files in temp folder...')
      
      const playersToCheck = await Player.query()
        .whereNotNull('identity_verification_photo')
        .orWhereNotNull('age_verification_photo')
        .limit(50) // Limit to avoid overwhelming the system

      let misnameRepairCount = 0

      for (const player of playersToCheck) {
        if (player.identityVerificationPhoto && !player.identityVerificationPhoto.startsWith('temp_')) {
          const tempPath = `temp-verification-photos/${player.identityVerificationPhoto}`
          const finalPath = `identity-verification-photos/${player.identityVerificationPhoto}`
          
          try {
            const inTemp = await spacesDriver.exists(tempPath)
            const inFinal = await spacesDriver.exists(finalPath)
            
            if (inTemp && !inFinal) {
              this.logger.info(`  🔄 Moving misnamed file: ${tempPath} → ${finalPath}`)
              
              if (!this.dryRun) {
                const fileContent = await spacesDriver.get(tempPath)
                await spacesDriver.put(finalPath, fileContent)
                await spacesDriver.delete(tempPath)
              }
              
              misnameRepairCount++
            }
          } catch (error) {
            this.logger.error(`  ❌ Error repairing misnamed file for player ${player.id}:`, error.message)
          }
        }

        if (player.ageVerificationPhoto && !player.ageVerificationPhoto.startsWith('temp_')) {
          const tempPath = `temp-verification-photos/${player.ageVerificationPhoto}`
          const finalPath = `age-verification-photos/${player.ageVerificationPhoto}`
          
          try {
            const inTemp = await spacesDriver.exists(tempPath)
            const inFinal = await spacesDriver.exists(finalPath)
            
            if (inTemp && !inFinal) {
              this.logger.info(`  🔄 Moving misnamed file: ${tempPath} → ${finalPath}`)
              
              if (!this.dryRun) {
                const fileContent = await spacesDriver.get(tempPath)
                await spacesDriver.put(finalPath, fileContent)
                await spacesDriver.delete(tempPath)
              }
              
              misnameRepairCount++
            }
          } catch (error) {
            this.logger.error(`  ❌ Error repairing misnamed file for player ${player.id}:`, error.message)
          }
        }
      }

      this.logger.info('\n📋 REPAIR SUMMARY:')
      this.logger.info(`  • Temp filename repairs: ${repairedCount}`)
      this.logger.info(`  • Misnamed file repairs: ${misnameRepairCount}`)
      this.logger.info(`  • Errors encountered: ${errorCount}`)
      
      if (this.dryRun) {
        this.logger.info('\n💡 To apply these changes, run: node ace repair:temp-files')
      } else {
        this.logger.success(`✅ Repair completed successfully!`)
      }

    } catch (error) {
      this.logger.error(`❌ Failed to repair temp files: ${error.message}`)
      throw error
    }
  }

  private async repairFile(filename: string, targetFolder: string, type: string, spacesDriver: any, dryRun: boolean) {
    const tempPath = `temp-verification-photos/${filename}`
    const finalFilename = filename.replace('temp_', '')
    const finalPath = `${targetFolder}/${finalFilename}`
    
    try {
      // Check if temp file exists
      const tempExists = await spacesDriver.exists(tempPath)
      if (!tempExists) {
        // Try without temp_ prefix
        const altTempPath = `temp-verification-photos/${finalFilename}`
        const altExists = await spacesDriver.exists(altTempPath)
        
        if (altExists) {
          this.logger.info(`  🔄 ${type}: Found file without temp_ prefix, moving: ${altTempPath} → ${finalPath}`)
          
          if (!dryRun) {
            const fileContent = await spacesDriver.get(altTempPath)
            await spacesDriver.put(finalPath, fileContent)
            await spacesDriver.delete(altTempPath)
          }
          
          return { success: true, finalFilename }
        } else {
          this.logger.error(`  ❌ ${type}: File not found in temp folder: ${tempPath}`)
          return { success: false, finalFilename: filename }
        }
      }
      
      // Check if final file already exists
      const finalExists = await spacesDriver.exists(finalPath)
      if (finalExists) {
        this.logger.info(`  ✅ ${type}: Final file already exists, cleaning up temp: ${tempPath}`)
        
        if (!dryRun) {
          await spacesDriver.delete(tempPath)
        }
        
        return { success: true, finalFilename }
      }
      
      // Move the file
      this.logger.info(`  📁 ${type}: Moving file: ${tempPath} → ${finalPath}`)
      
      if (!dryRun) {
        const fileContent = await spacesDriver.get(tempPath)
        await spacesDriver.put(finalPath, fileContent)
        await spacesDriver.delete(tempPath)
      }
      
      return { success: true, finalFilename }
      
    } catch (error) {
      this.logger.error(`  💥 ${type}: Error repairing file - ${error.message}`)
      return { success: false, finalFilename: filename }
    }
  }
}
