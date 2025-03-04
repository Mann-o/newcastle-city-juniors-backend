import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'summer_cup_2025_signups'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary().index()
      table.string('club_name').notNullable();
      table.string('team_name').notNullable();
      table.string('ability_level').notNullable();
      table.string('tournament_entry').notNullable();
      table.string('coach_name').notNullable();
      table.string('contact_number').notNullable();
      table.string('email_address').notNullable();
      table.boolean('accepted_next_years_age_group_agreement').notNullable().defaultTo(false);
      table.boolean('accepted_coach_qualification_agreement').notNullable().defaultTo(false);
      table.boolean('accepted_organiser_decision_agreement').notNullable().defaultTo(false);
      table.integer('amount_paid').notNullable();
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName);
  }
}
