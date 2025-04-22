import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'players'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('gift_aid_declaration_accepted').notNullable().defaultTo(true)
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('gift_aid_declaration_accepted')
    })
  }
}
