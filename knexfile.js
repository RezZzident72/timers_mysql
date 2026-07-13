require("dotenv").config();

const connection = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: true,
};

module.exports = {
  development: {
    client: "postgresql",
    connection: connection,
    migrations: {
      directory: "./migrations",
    },
  },
  production: {
    client: "postgresql",
    connection: connection,
    migrations: {
      directory: "./migrations",
    },
  },
};
