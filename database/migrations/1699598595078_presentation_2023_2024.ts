import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'presentation_2023_2024'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary().index();
      table.string('child_name').notNullable();
      table.string('age_group').notNullable();
      table.string('team_name').notNullable();
      table.string('coach_name').notNullable();
      table.integer('tickets_ordered').notNullable();
      table.string('guest_names').notNullable();
      table.string('email_address').notNullable();
      table.integer('amount_paid').notNullable();
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName);
  }
}
