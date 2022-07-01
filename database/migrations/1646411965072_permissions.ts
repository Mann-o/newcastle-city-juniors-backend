import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class PermissionsSchema extends BaseSchema {
  protected tableName = 'permissions'

  public async up() {
    this.schema.createTable(this.tableName, table => {
      table.increments('id').primary().index()
      table.string('name', 255).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
