import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class ArchivePlayers2025 extends BaseSchema {
  protected tableName = 'players'

  public async up() {
    // First, create the archive table by copying the current players table structure and data
    await this.db.rawQuery(`
      CREATE TABLE players_archive_2025 AS
      SELECT * FROM players
    `)

    // Add any missing indexes and constraints to the archive table
    this.schema.alterTable('players_archive_2025', (table) => {
      // Add primary key constraint (SELECT * doesn't copy constraints)
      table.primary(['id'])

      // Add indexes for performance on the archive table
      table.index(['user_id'], 'players_archive_2025_user_id_index')
      table.index(['parent_id'], 'players_archive_2025_parent_id_index')
      table.index(['created_at'], 'players_archive_2025_created_at_index')
      table.index(['team'], 'players_archive_2025_team_index')
      table.index(['age_group'], 'players_archive_2025_age_group_index')
    })

    console.log(`Archived ${await this.db.from('players_archive_2025').count('* as total')} players to players_archive_2025`)
  }

  public async down() {
    // Drop the archive table
    this.schema.dropTableIfExists('players_archive_2025')
  }
}
