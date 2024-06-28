import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'players'

  public async up () {
    this.schema.alterTable(this.tableName, table => {
      table.boolean('active').defaultTo(false);
      table.string('stripe_registration_fee_id').nullable()
      table.string('stripe_upfront_payment_id').nullable()
    });
  }

  public async down () {
    this.schema.alterTable(this.tableName, table => {
      table.dropColumn('active');
      table.dropColumn('stripe_registration_fee_id');
      table.dropColumn('stripe_upfront_payment_id');
    });
  }
}
