import { DateTime } from 'luxon'

export class FileNamingService {
  /**
   * Generate a unique, descriptive filename for verification photos
   * Format: PLAYER-NAME_VERIFICATION-TYPE_REGISTRATION-DATE-AND-TIME.extension
   * Example: LIAM-POTTER_AGE-VERIFICATION_2025-08-05-16-45-00.jpg
   */
  public static generateVerificationFilename(
    firstName: string,
    lastName: string,
    verificationType: 'IDENTITY' | 'AGE',
    fileExtension: string
  ): string {
    // Clean and format player name
    const cleanFirstName = this.cleanNameForFilename(firstName)
    const cleanLastName = this.cleanNameForFilename(lastName)
    const playerName = `${cleanFirstName}-${cleanLastName}`
    
    // Format verification type
    const verificationTypeFormatted = `${verificationType}-VERIFICATION`
    
    // Generate timestamp in the requested format
    const now = DateTime.now()
    const timestamp = now.toFormat('yyyy-MM-dd-HH-mm-ss')
    
    // Add microseconds to ensure uniqueness even if called multiple times rapidly
    const microseconds = now.toMillis().toString().slice(-3)
    const uniqueTimestamp = `${timestamp}-${microseconds}`
    
    // Ensure extension starts with dot
    const extension = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`
    
    return `${playerName}_${verificationTypeFormatted}_${uniqueTimestamp}${extension}`
  }

  /**
   * Clean a name to be filename-safe
   * - Convert to uppercase
   * - Replace spaces and special characters with hyphens
   * - Remove multiple consecutive hyphens
   * - Remove leading/trailing hyphens
   */
  private static cleanNameForFilename(name: string): string {
    return name
      .toUpperCase()
      .trim()
      // Replace spaces and common special characters with hyphens
      .replace(/[\s\-_\.\'\"]+/g, '-')
      // Remove any characters that aren't letters, numbers, or hyphens
      .replace(/[^A-Z0-9\-]/g, '')
      // Remove multiple consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Limit length to prevent extremely long filenames
      .substring(0, 20)
  }

  /**
   * Generate temporary filename with the same format but temp_ prefix
   */
  public static generateTempVerificationFilename(
    firstName: string,
    lastName: string,
    verificationType: 'IDENTITY' | 'AGE',
    fileExtension: string
  ): string {
    const finalFilename = this.generateVerificationFilename(firstName, lastName, verificationType, fileExtension)
    return `temp_${finalFilename}`
  }

  /**
   * Extract final filename from temp filename by removing temp_ prefix
   */
  public static getFinalFilenameFromTemp(tempFilename: string): string {
    if (tempFilename.startsWith('temp_')) {
      return tempFilename.substring(5) // Remove 'temp_' prefix
    }
    return tempFilename
  }

  /**
   * Generate a unique filename for non-verification files (fallback)
   */
  public static generateUniqueFilename(originalFilename: string): string {
    const now = DateTime.now()
    const timestamp = now.toFormat('yyyy-MM-dd-HH-mm-ss')
    const microseconds = now.toMillis().toString().slice(-3)
    
    // Extract extension from original filename
    const extensionMatch = originalFilename.match(/\.([^.]+)$/)
    const extension = extensionMatch ? extensionMatch[0] : '.jpg'
    
    return `FILE_${timestamp}-${microseconds}${extension}`
  }
}
