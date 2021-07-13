import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Players extends BaseSchema {
  protected tableName = 'players'

  public async up() {
    this.schema.createTable(this.tableName, table => {
      table.increments('id').primary().index()
      table.integer('user_id').unsigned().index()
      table.foreign('user_id').references('id').inTable('users').onDelete('cascade')
      table.integer('team_id').unsigned().index()
      table.foreign('team_id').references('id').inTable('teams').onDelete('cascade')
      table.string('full_name', 255).notNullable()
      table.date('date_of_birth').notNullable()
      table.string('sex').notNullable()
      table.text('medical_conditions').nullable()
      table.boolean('media_consented').nullable().defaultTo(false)
      table.boolean('accepted_player_code_of_conduct').nullable().defaultTo(false)
      table.boolean('accepted_parent_code_of_conduct').nullable().defaultTo(false)
      table.boolean('accepted_declaration').nullable().defaultTo(false)
      table.string('membership_fee_option').notNullable()
      table.string('stripe_payment_intent_id').nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
