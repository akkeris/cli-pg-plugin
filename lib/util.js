'use strict'


const pg = require('./pg.js')

function ensurePGStatStatement (db, callback) {
  let query = `
SELECT exists(
  SELECT 1 FROM pg_extension e LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname='pg_stat_statements'
) AS available`
  pg.exec(db, query, (err, res) => {
    if(err) {
      return callback(err, null)
    } else {
      if (res.filter((x) => x.available ) === 0) {
        callback(new Error(`pg_stat_statements extension need to be installed in the public schema first.

This extension is only available on Postgres versions 9.2 or greater. You can install it by running:
CREATE EXTENSION pg_stat_statements;
`))
      } else {
        callback(null)
      }
    }
  }, true)
  
}

module.exports = {
  ensurePGStatStatement: ensurePGStatStatement
}
