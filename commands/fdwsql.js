
const pg = require('../lib/pg')

const query = prefix => `
SELECT
  'CREATE FOREIGN TABLE '
  || quote_ident('${prefix}_' || c.relname)
  || '(' || array_to_string(array_agg(quote_ident(a.attname) || ' ' || t.typname), ', ') || ') '
  || ' SERVER ${prefix}_db OPTIONS'
  || ' (schema_name ''' || quote_ident(n.nspname) || ''', table_name ''' || quote_ident(c.relname) || ''');'
FROM
  pg_class     c,
  pg_attribute a,
  pg_type      t,
  pg_namespace n
WHERE
  a.attnum > 0
  AND a.attrelid = c.oid
  AND a.atttypid = t.oid
  AND n.oid = c.relnamespace
  AND c.relkind in ('r', 'v')
  AND n.nspname <> 'pg_catalog'
  AND n.nspname <> 'information_schema'
  AND n.nspname !~ '^pg_toast'
  AND pg_catalog.pg_table_is_visible(c.oid)
GROUP BY c.relname, n.nspname
ORDER BY c.relname;
`

function run (appkit, args) {
  const app = args.app
  const {prefix, database} = context.args

  let db = pg.database(appkit, app, database, function(err, db) {
    if(err) {
      return appkit.terminal.error(err);
    }
    console.log('CREATE EXTENSION IF NOT EXISTS postgres_fdw;')
    console.log(`DROP SERVER IF EXISTS ${prefix}_db;`)
    console.log(`CREATE SERVER ${prefix}_db
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (dbname '${db.database}', host '${db.host}');`)
    console.log(`CREATE USER MAPPING FOR CURRENT_USER
    SERVER ${prefix}_db
    OPTIONS (user '${db.user}', password '${db.password}');`)
    pg.psql.exec(db, query(prefix), (err, output) => {
      if(err) {
        return appkit.terminal.error(err)
      }
      output = output.split('\n').filter(l => /CREATE/.test(l)).join('\n')
      appkit.terminal.table(output)
      console.log()
    })
    
  })
}

module.exports = {
  init:function (appkit) {
    let require_options = {
      'app':{
        'alias':'a',
        'demand':false,
        'string':true,
        'description':'The app to act on.'
      },
      'database':{
        'alias':'d',
        'demand':false,
        'string':true,
        'description':'The postgresql URL of the database to pull statistics (postgres://user:pass@host:port/database format)'
      },
      'prefix':{
        'alias':'p',
        'demand':true,
        'string':true,
        'description':'The prefix for the install script'
      }
    }

    appkit.args.command('pg:fdwsql', 'generate fdw install sql for database', require_options, run.bind(null, appkit));
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}

