import { BaseCommand } from '@adonisjs/core/build/standalone'
import { FileNamingService } from 'App/Services/FileNamingService'

export default class TestFileNaming extends BaseCommand {
  public static commandName = 'test:file-naming'
  public static description = 'Test the new file naming system'
  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    this.logger.info('🧪 Testing File Naming System')

    // Test examples with different names and scenarios
    const testCases = [
      { firstName: 'Liam', lastName: 'Potter', extension: 'jpg' },
      { firstName: 'John-Paul', lastName: "O'Connor", extension: 'jpeg' },
      { firstName: 'Mary Anne', lastName: 'Smith-Johnson', extension: 'png' },
      { firstName: 'José', lastName: 'García-López', extension: 'webp' },
      { firstName: 'A', lastName: 'B', extension: 'jpg' },
      { firstName: 'Very Long First Name', lastName: 'Very Long Last Name That Should Be Truncated', extension: 'jpg' }
    ]

    this.logger.info('\n📋 File Naming Examples:')
    
    for (const testCase of testCases) {
      const { firstName, lastName, extension } = testCase
      
      this.logger.info(`\n👤 Player: ${firstName} ${lastName}`)
      
      // Generate identity verification filename
      const identityFilename = FileNamingService.generateVerificationFilename(
        firstName, 
        lastName, 
        'IDENTITY', 
        extension
      )
      
      // Generate age verification filename  
      const ageFilename = FileNamingService.generateVerificationFilename(
        firstName, 
        lastName, 
        'AGE', 
        extension
      )
      
      // Generate temp versions
      const tempIdentityFilename = FileNamingService.generateTempVerificationFilename(
        firstName, 
        lastName, 
        'IDENTITY', 
        extension
      )
      
      this.logger.info(`  🆔 Identity: ${identityFilename}`)
      this.logger.info(`  🎂 Age: ${ageFilename}`)
      this.logger.info(`  📁 Temp Identity: ${tempIdentityFilename}`)
    }

    // Test the temp to final conversion
    this.logger.info('\n🔄 Testing Temp to Final Conversion:')
    const tempFilename = 'temp_LIAM-POTTER_IDENTITY-VERIFICATION_2025-08-05-16-45-00-123.jpg'
    const finalFilename = FileNamingService.getFinalFilenameFromTemp(tempFilename)
    this.logger.info(`  Temp: ${tempFilename}`)
    this.logger.info(`  Final: ${finalFilename}`)

    // Test timing differences
    this.logger.info('\n⏱️  Testing Uniqueness (multiple calls):')
    for (let i = 0; i < 3; i++) {
      const filename = FileNamingService.generateVerificationFilename('Test', 'User', 'IDENTITY', 'jpg')
      this.logger.info(`  Call ${i + 1}: ${filename}`)
      // Small delay to show timestamp differences
      await new Promise(resolve => setTimeout(resolve, 1))
    }

    this.logger.success('\n✅ File naming system test completed!')
  }
}
