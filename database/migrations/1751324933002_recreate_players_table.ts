import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class RecreatePlayersTable extends BaseSchema {
  protected tableName = 'players'

  public async up() {
    // Drop the current players table (data is safely archived)
    this.schema.dropTable(this.tableName)

    // Recreate the players table with the same structure
    this.schema.createTable(this.tableName, table => {
      // Primary key and relationships
      table.increments('id').primary().index()
      table.integer('user_id').unsigned().index()
      table.foreign('user_id').references('id').inTable('users').onDelete('cascade')
      table.integer('parent_id').unsigned().index()
      table.foreign('parent_id').references('id').inTable('parents').onDelete('cascade')

      // Player basic information
      table.string('first_name', 255).notNullable()
      table.string('middle_names', 255).nullable()
      table.string('last_name', 255).notNullable()
      table.date('date_of_birth').notNullable()
      table.string('sex').notNullable()
      table.text('medical_conditions').nullable()

      // Consent and acceptance fields
      table.boolean('media_consented').nullable().defaultTo(false)
      table.boolean('accepted_code_of_conduct').nullable().defaultTo(false)
      table.boolean('accepted_declaration').nullable().defaultTo(false)
      table.boolean('gift_aid_declaration_accepted').notNullable().defaultTo(true)

      // Team and membership information
      table.string('age_group').nullable()
      table.string('team').nullable()
      table.string('second_team').nullable()
      table.string('membership_fee_option').notNullable()
      table.integer('payment_date').nullable()

      // File storage fields
      table.string('identity_verification_photo').nullable()
      table.string('age_verification_photo').nullable()

      // Stripe payment tracking
      table.string('stripe_subscription_id').nullable()
      table.string('stripe_registration_fee_id').nullable()
      table.string('stripe_upfront_payment_id').nullable()

      // Status fields
      table.boolean('active').defaultTo(false)
      table.boolean('wgs_registered').notNullable().defaultTo(false)

      // Timestamps
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })

    console.log('Created fresh players table with same structure as archived version')
  }

  public async down() {
    // This is a destructive operation, so we'll be very careful in the rollback
    // Drop the new empty table
    this.schema.dropTable(this.tableName)

    // Recreate the players table from the archive
    await this.db.rawQuery(`
      CREATE TABLE players AS
      SELECT * FROM players_archive_2025
    `)

    // Restore the foreign key constraints and indexes
    this.schema.alterTable(this.tableName, (table) => {
      table.primary(['id'])
      table.index(['user_id'])
      table.index(['parent_id'])
      table.foreign('user_id').references('id').inTable('users').onDelete('cascade')
      table.foreign('parent_id').references('id').inTable('parents').onDelete('cascade')
    })

    console.log('Restored players table from archive')
  }
}
