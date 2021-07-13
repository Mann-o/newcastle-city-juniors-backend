import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class UsersSchema extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    this.schema.createTable(this.tableName, table => {
      table.increments('id').primary().index()
      table.string('title', 255).notNullable()
      table.string('first_name', 255).notNullable()
      table.string('last_name', 255).notNullable()
      table.string('house_name_or_number', 255).notNullable()
      table.string('postcode', 255).notNullable()
      table.string('mobile_number', 255).notNullable()
      table.string('email', 255).notNullable().unique().index()
      table.boolean('email_verified').notNullable().defaultTo(false)
      table.string('email_verification_token', 255).nullable()
      table.boolean('gift_aid_consented').nullable().defaultTo(false)
      table.boolean('additional_parent_or_guardian').notNullable()
      table.string('alternate_title', 255).nullable()
      table.string('alternate_first_name', 255).nullable()
      table.string('alternate_last_name', 255).nullable()
      table.string('alternate_house_name_or_number', 255).nullable()
      table.string('alternate_postcode', 255).nullable()
      table.string('alternate_mobile_number', 255).nullable()
      table.string('alternate_email', 255).nullable().index()
      table.string('password', 180).notNullable()
      table.string('remember_me_token').nullable()
      table.boolean('accepted_code_of_conduct').nullable().defaultTo(false)
      table.string('stripe_customer_id').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.timestamp('last_logged_in', { useTz: true }).nullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
