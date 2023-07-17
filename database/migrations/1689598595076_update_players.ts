import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'players'

  public async up () {
    this.schema.alterTable(this.tableName, table => {
      table.dropColumn('already_provided_verification');
    });
  }

  public async down () {
    this.schema.alterTable(this.tableName, table => {
      table.boolean('already_provided_verification').notNullable().defaultTo(false);
    });
  }
}
