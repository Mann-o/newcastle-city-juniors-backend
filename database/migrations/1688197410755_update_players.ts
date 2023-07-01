import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'players'

  public async up () {
    this.schema.alterTable(this.tableName, table => {
      table.dropIndex('user_id');
      table.dropIndex('parent_id');
    });

    this.schema.renameTable(this.tableName, 'players_archive_2023');
  }

  public async down () {
    this.schema.renameTable('players_archive_2023', this.tableName);

    this.schema.alterTable(this.tableName, table => {
      table.index(['user_id'], 'user_id');
      table.index(['parent_id'], 'parent_id');
    });
  }
}
