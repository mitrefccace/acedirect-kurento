require('dotenv').config();

const base = {
  username: process.env.MYSQL_USERNAME || "username",
  password: process.env.MYSQL_PASSWORD || "password",
  database: process.env.MYSQL_DATABASE || "databasename",
  host:     process.env.MYSQL_DATABASE_HOST || "FQDN",
  dialect:  "mysql"
}

module.exports = {
  "development": base,
  "test": base,
  "production": base
}

