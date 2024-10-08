import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'footy_talk_in_signups_2024'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary().index()
      table.string('full_name').notNullable();
      table.string('house_name_and_number').notNullable();
      table.string('city').notNullable();
      table.string('postcode').notNullable();
      table.string('email_address').notNullable();
      table.string('contact_number').notNullable();
      table.string('booking_name').notNullable();
      table.integer('amount_paid').notNullable();
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName);
  }
}
