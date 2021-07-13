import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class AlterPlayers extends BaseSchema {
  protected tableName = 'players'

  public async up() {
    this.schema.alterTable(this.tableName, table => {
      table.dropForeign('age_group_id')
      table.foreign('age_group_id').references('id').inTable('age_groups').onDelete('cascade')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, table => {
      table.dropForeign('age_group_id')
      table.foreign('age_group_id').references('id').inTable('teams').onDelete('cascade')
    })
  }
}
