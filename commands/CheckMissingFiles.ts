import { BaseCommand } from '@adonisjs/core/build/standalone'
import Player from 'App/Models/Player'
import Drive from '@ioc:Adonis/Core/Drive'

export default class CheckMissingFiles extends BaseCommand {
  public static commandName = 'check:missing-files'
  public static description = 'Check for missing verification photos in DigitalOcean Spaces'
  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    this.logger.info('🔍 Checking for missing verification photos in DigitalOcean Spaces...')

    try {
      const spacesDriver = Drive.use('spaces')

      // Get all players with verification photos
      const players = await Player.query()
        .whereNotNull('identity_verification_photo')
        .orWhereNotNull('age_verification_photo')
        .orderBy('id', 'asc')

      this.logger.info(`📊 Found ${players.length} players with verification photos to check`)

      let totalFilesToCheck = 0
      let missingFiles = 0
      let foundFiles = 0
      let errorCount = 0
      const missingFileDetails: Array<{
        playerId: number
        playerName: string
        fileType: string
        filename: string
        expectedPath: string
        isTemp: boolean
      }> = []

      for (const player of players) {
        this.logger.info(`\n👤 Checking Player ${player.id}: ${player.firstName} ${player.lastName}`)
        
        // Check identity verification photo
        if (player.identityVerificationPhoto) {
          totalFilesToCheck++
          const result = await this.checkFile(
            player.identityVerificationPhoto,
            'identity-verification-photos',
            'Identity',
            spacesDriver
          )

          if (result.status === 'missing') {
            missingFiles++
            missingFileDetails.push({
              playerId: player.id,
              playerName: `${player.firstName} ${player.lastName}`,
              fileType: 'Identity Verification',
              filename: player.identityVerificationPhoto,
              expectedPath: result.expectedPath,
              isTemp: player.identityVerificationPhoto.startsWith('temp_')
            })
          } else if (result.status === 'found') {
            foundFiles++
          } else if (result.status === 'error') {
            errorCount++
          }
        }

        // Check age verification photo
        if (player.ageVerificationPhoto) {
          totalFilesToCheck++
          const result = await this.checkFile(
            player.ageVerificationPhoto,
            'age-verification-photos',
            'Age',
            spacesDriver
          )

          if (result.status === 'missing') {
            missingFiles++
            missingFileDetails.push({
              playerId: player.id,
              playerName: `${player.firstName} ${player.lastName}`,
              fileType: 'Age Verification',
              filename: player.ageVerificationPhoto,
              expectedPath: result.expectedPath,
              isTemp: player.ageVerificationPhoto.startsWith('temp_')
            })
          } else if (result.status === 'found') {
            foundFiles++
          } else if (result.status === 'error') {
            errorCount++
          }
        }
      }

      // Display comprehensive results
      this.logger.info('\n📋 MISSING FILES SUMMARY:')
      this.logger.info(`  • Total files checked: ${totalFilesToCheck}`)
      this.logger.info(`  • Files found: ${foundFiles}`)
      this.logger.info(`  • Files missing: ${missingFiles}`)
      this.logger.info(`  • Errors encountered: ${errorCount}`)

      if (missingFiles > 0) {
        this.logger.error(`\n❌ MISSING FILES REPORT:`)
        
        // Group by temp vs permanent files
        const tempFiles = missingFileDetails.filter(f => f.isTemp)
        const permanentFiles = missingFileDetails.filter(f => !f.isTemp)

        if (tempFiles.length > 0) {
          this.logger.error(`\n🗂️  TEMP FILES STILL REFERENCED (${tempFiles.length}):`)
          tempFiles.forEach(file => {
            this.logger.error(`  • Player ${file.playerId} (${file.playerName})`)
            this.logger.error(`    ${file.fileType}: ${file.filename}`)
            this.logger.error(`    Expected at: ${file.expectedPath}`)
          })
        }

        if (permanentFiles.length > 0) {
          this.logger.error(`\n📁 PERMANENT FILES MISSING (${permanentFiles.length}):`)
          permanentFiles.forEach(file => {
            this.logger.error(`  • Player ${file.playerId} (${file.playerName})`)
            this.logger.error(`    ${file.fileType}: ${file.filename}`)
            this.logger.error(`    Expected at: ${file.expectedPath}`)
          })
        }

        // Check for files in alternate locations
        this.logger.info('\n🔍 Checking for files in alternate locations...')
        await this.checkAlternateLocations(missingFileDetails, spacesDriver)

        this.logger.info('\n💡 RECOMMENDED ACTIONS:')
        if (tempFiles.length > 0) {
          this.logger.info('  • Run repair:temp-files command to fix temp file references')
        }
        if (permanentFiles.length > 0) {
          this.logger.info('  • Check DigitalOcean Spaces browser for missing permanent files')
          this.logger.info('  • Consider running a backup restore if files were accidentally deleted')
        }
      } else {
        this.logger.success(`✅ All verification photos found successfully!`)
      }

    } catch (error) {
      this.logger.error(`❌ Failed to check missing files: ${error.message}`)
      throw error
    }
  }

  private async checkFile(filename: string, expectedFolder: string, type: string, spacesDriver: any) {
    const expectedPath = `${expectedFolder}/${filename}`
    
    try {
      const exists = await spacesDriver.exists(expectedPath)
      
      if (exists) {
        this.logger.info(`  ✅ ${type}: Found at ${expectedPath}`)
        return { status: 'found', expectedPath }
      } else {
        this.logger.error(`  ❌ ${type}: Missing at ${expectedPath}`)
        return { status: 'missing', expectedPath }
      }
    } catch (error) {
      this.logger.error(`  💥 ${type}: Error checking ${expectedPath} - ${error.message}`)
      return { status: 'error', expectedPath, error: error.message }
    }
  }

  private async checkAlternateLocations(missingFiles: any[], spacesDriver: any) {
    const alternateLocations = [
      'temp-verification-photos',
      'identity-verification-photos', 
      'age-verification-photos'
    ]

    let foundInAlternate = 0

    for (const missing of missingFiles) {
      this.logger.info(`\n🔍 Searching for ${missing.filename} in alternate locations...`)
      
      for (const location of alternateLocations) {
        // Skip the expected location we already checked
        const expectedLocation = missing.isTemp ? 'temp-verification-photos' : 
          (missing.fileType.includes('Identity') ? 'identity-verification-photos' : 'age-verification-photos')
        
        if (location === expectedLocation) continue

        const alternatePath = `${location}/${missing.filename}`
        
        try {
          const exists = await spacesDriver.exists(alternatePath)
          if (exists) {
            this.logger.success(`  🎯 Found in alternate location: ${alternatePath}`)
            foundInAlternate++
            break
          }
        } catch (error) {
          // Silently continue - alternate location checks are exploratory
        }

        // Also try without temp_ prefix if this is a temp file
        if (missing.isTemp) {
          const filenameWithoutTemp = missing.filename.replace('temp_', '')
          const alternatePathWithoutTemp = `${location}/${filenameWithoutTemp}`
          
          try {
            const exists = await spacesDriver.exists(alternatePathWithoutTemp)
            if (exists) {
              this.logger.success(`  🎯 Found without temp_ prefix: ${alternatePathWithoutTemp}`)
              foundInAlternate++
              break
            }
          } catch (error) {
            // Silently continue
          }
        }
      }
    }

    if (foundInAlternate > 0) {
      this.logger.info(`\n🎯 Found ${foundInAlternate} files in alternate locations`)
      this.logger.info('💡 Consider running repair commands to move these files to correct locations')
    }
  }
}
