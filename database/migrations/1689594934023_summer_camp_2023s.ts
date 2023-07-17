import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'summer_camp_2023_signups'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary().index()
      table.string('email_address').notNullable();
      table.string('club_name').notNullable();
      table.string('team_name').notNullable();
      table.string('age_group').notNullable();
      table.string('coach_name').notNullable();
      table.string('contact_number').notNullable();
      table.boolean('accepted_coach_qualification_agreement').notNullable().defaultTo(false);
      table.boolean('accepted_organiser_decision_agreement').notNullable().defaultTo(false);
      table.integer('amount_paid').notNullable();
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName);
  }
}
