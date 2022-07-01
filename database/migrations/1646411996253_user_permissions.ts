import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class UserPermissionsSchema extends BaseSchema {
  protected tableName = 'user_permissions'

  public async up() {
    this.schema.createTable(this.tableName, table => {
      table.increments('id').primary().index()
      table.integer('user_id').unsigned().index()
      table.foreign('user_id').references('id').inTable('users').onDelete('cascade')
      table.integer('permission_id').unsigned().index()
      table.foreign('permission_id').references('id').inTable('permissions').onDelete('cascade')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
