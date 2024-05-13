import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'presentation_2023_2024'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.setNullable('child_name');
    })
  }

  public async down () {
    this.raw('UPDATE presentation_2023_2024 SET child_name = "UNKNOWN" WHERE child_name IS NULL').then(() => {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropNullable('child_name')
      })
    })
  }
}
