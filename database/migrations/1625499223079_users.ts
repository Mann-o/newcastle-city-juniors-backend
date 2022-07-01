import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class UsersSchema extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    this.schema.createTable(this.tableName, table => {
      table.increments('id').primary().index()
      table.string('email', 255).notNullable().unique().index()
      table.boolean('email_verified').notNullable().defaultTo(false)
      table.string('password', 180).notNullable()
      table.string('email_verification_token', 255).nullable()
      table.string('reset_password_token', 255).nullable()
      table.string('stripe_customer_id').notNullable()
      table.timestamp('last_logged_in', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
