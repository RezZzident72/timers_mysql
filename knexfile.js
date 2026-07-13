require("dotenv").config();

const connectionString = process.env.DATABASE_URL || {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432,
};

module.exports = {
  development: {
    client: "postgresql",
    connection: connectionString,
    migrations: {
      directory: "./migrations",
    },
  },
  production: {
    client: "postgresql",
    connection: {
      connectionString: typeof connectionString === "string" ? connectionString : undefined,
      ...(typeof connectionString === "object" ? connectionString : {}),
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: "./migrations",
    },
  },
};
