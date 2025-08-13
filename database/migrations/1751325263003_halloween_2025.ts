import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'halloween_2025'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary().index()
      table.string('full_name').notNullable();
      table.string('email_address').notNullable();
      table.string('contact_number').notNullable();
      table.integer('no_of_tickets').notNullable();
      table.integer('amount_paid').notNullable();
      table.boolean('gift_aid_opted_in').defaultTo(false);
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName);
  }
}
