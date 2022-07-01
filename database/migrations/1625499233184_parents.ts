import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class UsersSchema extends BaseSchema {
  protected tableName = 'parents'

  public async up() {
    this.schema.createTable(this.tableName, table => {
      table.increments('id').primary().index()
      table.integer('user_id').unsigned().index()
      table.foreign('user_id').references('id').inTable('users').onDelete('cascade')
      table.string('title', 255).notNullable()
      table.string('other_title', 255).nullable()
      table.string('first_name', 255).notNullable()
      table.string('middle_names', 255).nullable()
      table.string('last_name', 255).notNullable()
      table.date('date_of_birth').notNullable()
      table.string('email', 255).notNullable().unique().index()
      table.string('address_line_one', 255).notNullable()
      table.string('address_line_two', 255).nullable()
      table.string('address_line_three', 255).nullable()
      table.string('address_line_four', 255).nullable()
      table.string('address_line_five', 255).nullable()
      table.string('postal_code', 255).notNullable()
      table.string('mobile_number', 255).notNullable()
      table.boolean('accepted_code_of_conduct').nullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
