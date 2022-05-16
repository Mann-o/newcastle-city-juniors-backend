import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class UserRolesSchema extends BaseSchema {
  protected tableName = 'user_roles'

  public async up() {
    this.schema.createTable(this.tableName, table => {
      table.increments('id').primary().index()
      table.integer('user_id').unsigned().index()
      table.foreign('user_id').references('id').inTable('users').onDelete('cascade')
      table.integer('role_id').unsigned().index()
      table.foreign('role_id').references('id').inTable('roles').onDelete('cascade')
      table.timestamp('created_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
