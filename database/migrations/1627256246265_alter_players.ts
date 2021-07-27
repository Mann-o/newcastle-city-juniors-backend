import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class AlterPlayers extends BaseSchema {
  protected tableName = 'players'

  public async up() {
    this.schema.alterTable(this.tableName, table => {
      table.string('stripe_subscription_id').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, table => {
      table.dropColumn('stripe_subscription_id')
    })
  }
}
