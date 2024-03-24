import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'summer_cup_2024_signups'

  public async up () {
    this.schema.alterTable(this.tableName, table => {
      table.dropColumn('age_group');
    });
  }

  public async down () {
    this.schema.alterTable(this.tableName, table => {
      table.string('age_group').notNullable();
    });
  }
}
