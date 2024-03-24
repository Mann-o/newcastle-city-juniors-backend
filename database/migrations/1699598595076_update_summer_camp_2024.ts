import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'summer_cup_2024'

  public async up () {
    this.schema.alterTable(this.tableName, table => {
      table.string('tournament_entry').notNullable();
    });
  }

  public async down () {
    this.schema.alterTable(this.tableName, table => {
      table.dropColumn('tournament_entry');
    });
  }
}
