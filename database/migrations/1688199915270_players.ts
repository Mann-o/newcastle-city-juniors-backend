import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Players extends BaseSchema {
  protected tableName = 'players'

  public async up() {
    this.schema.createTable(this.tableName, table => {
      table.increments('id').primary().index()
      table.integer('user_id').unsigned().index()
      table.foreign('user_id').references('id').inTable('users').onDelete('cascade')
      table.integer('parent_id').unsigned().index()
      table.foreign('parent_id').references('id').inTable('parents').onDelete('cascade')
      table.string('first_name', 255).notNullable()
      table.string('middle_names', 255).nullable()
      table.string('last_name', 255).notNullable()
      table.date('date_of_birth').notNullable()
      table.string('sex').notNullable()
      table.text('medical_conditions').nullable()
      table.boolean('media_consented').nullable().defaultTo(false)
      table.boolean('accepted_code_of_conduct').nullable().defaultTo(false)
      table.boolean('accepted_declaration').nullable().defaultTo(false)
      table.string('age_group').nullable()
      table.string('team').nullable()
      table.string('second_team').nullable()
      table.string('membership_fee_option').notNullable()
      table.integer('payment_date').nullable()
      table.boolean('already_provided_verification').notNullable().defaultTo(false)
      table.string('identity_verification_photo').nullable()
      table.string('age_verification_photo').nullable()
      table.string('stripe_subscription_id').nullable()
      table.boolean('wgs_registered').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
