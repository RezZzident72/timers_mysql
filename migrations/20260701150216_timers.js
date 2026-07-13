/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("timers", (table) => {
    table.increments("id").primary();
    table.string("description", 255).notNullable();
    table.boolean("isActive").defaultTo(true);
    table.bigInteger("start").notNullable();
    table.bigInteger("end").defaultTo(null);
    table.string("progress");
    table.string("duration");
    table.uuid("userId").unsigned().references("id").inTable("users").notNullable().onDelete("CASCADE");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("timers");
};
