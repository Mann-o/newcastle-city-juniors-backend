import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'players'

  public async up () {
    this.schema.alterTable(this.tableName, table => {
      table.string('latest_payment_notes').nullable();
    });
  }

  public async down () {
    this.schema.alterTable(this.tableName, table => {
      table.dropColumn('latest_payment_notes');
    });
  }
}
