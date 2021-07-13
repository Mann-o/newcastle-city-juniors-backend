import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class AlterPlayers extends BaseSchema {
  protected tableName = 'players'

  public async up() {
    this.schema.alterTable(this.tableName, table => {
      table.integer('age_group_id').unsigned().index()
      table.foreign('age_group_id').references('id').inTable('teams').onDelete('cascade')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, table => {
      table.dropForeign('age_group_id')
      table.dropIndex('age_group_id')
      table.dropColumn('age_group_id')
    })
  }
}
