import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'config'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.string('key').notNullable();
      table.json('value').notNullable();
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName);
  }
}
