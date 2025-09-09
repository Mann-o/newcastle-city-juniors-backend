import { BaseCommand } from '@adonisjs/core/build/standalone'

export default class TestSeasonMonths extends BaseCommand {
  public static commandName = 'test:season-months'
  public static description = 'Test the season months calculation for the subscription status'
  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    this.logger.info('🧪 Testing Season Months Calculation')

    // Simulate the logic from the updated getSubsStatusForTeam method
    const now = new Date()
    const currentMonth = now.getMonth() + 1 // 1-12
    const currentYear = now.getFullYear()
    
    // Determine season year based on current month
    let seasonStartYear = currentYear
    if (currentMonth >= 1 && currentMonth <= 5) {
      seasonStartYear = currentYear - 1 // We're in Jan-May, so season started previous year
    }
    
    // Generate season months array (July to May)
    const seasonMonths: Array<{
      month: number;
      year: number;
      name: string;
      key: string;
    }> = []
    
    for (let i = 0; i < 11; i++) {
      const monthIndex = (6 + i) % 12 // July = 6, wraps to May = 4
      const year = monthIndex >= 6 ? seasonStartYear : seasonStartYear + 1
      seasonMonths.push({
        month: monthIndex + 1, // Convert to 1-12
        year: year,
        name: new Date(year, monthIndex, 1).toLocaleString('default', { month: 'long' }),
        key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`
      })
    }

    this.logger.info(`\n📅 Current Date: ${now.toDateString()}`)
    this.logger.info(`🏆 Season: ${seasonStartYear}/${seasonStartYear + 1}`)
    this.logger.info(`\n📋 Season Months (July to May):`)
    
    seasonMonths.forEach((month, index) => {
      const isCurrent = month.month === currentMonth && month.year === currentYear
      const marker = isCurrent ? ' 👈 CURRENT' : ''
      this.logger.info(`  ${index + 1}. ${month.name} ${month.year} (${month.key})${marker}`)
    })

    // Simulate some example monthly payment data
    this.logger.info(`\n💰 Example Monthly Payment Statuses:`)
    
    const exampleStatuses = [
      { status: 'paid', reason: 'Registration fee (includes first month)', amount: 85.00 },
      { status: 'paid', reason: 'Payment successful', amount: 45.00 },
      { status: 'paid', reason: 'Payment successful', amount: 45.00, refunded: 10.00 },
      { status: 'failed', reason: 'Card declined - insufficient funds', amount: 0 },
      { status: 'pending', reason: 'Payment due 5th October 2025', amount: null },
      { status: 'overdue', reason: 'Payment overdue since 5th November 2025', amount: 0 },
      { status: 'N/A', reason: 'Player not yet registered', amount: null }
    ]

    exampleStatuses.forEach((example, index) => {
      const month = seasonMonths[index]
      if (!month) return
      
      let statusIcon = '❌'
      if (example.status === 'paid') statusIcon = '✅'
      else if (example.status === 'pending') statusIcon = '⏳'
      else if (example.status === 'overdue') statusIcon = '⚠️'
      else if (example.status === 'N/A') statusIcon = '➖'

      let amountText = ''
      if (example.amount !== null) {
        amountText = ` - £${example.amount.toFixed(2)}`
        if (example.refunded) {
          amountText += ` (£${example.refunded.toFixed(2)} refunded)`
        }
      }

      this.logger.info(`  ${statusIcon} ${month.name} ${month.year}: ${example.reason}${amountText}`)
    })

    this.logger.success('\n✅ Season months calculation test completed!')
  }
}