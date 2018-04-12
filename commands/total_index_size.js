
const pg = require('../lib/pg')

const query = `
SELECT pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='i';
`

function run (appkit, args) {
  pg.database(appkit, args.app, args.database, function(err, db) {
    if(err) {
      return appkit.terminal.error(err)
    }

    pg.exec(db, query, function(err, data) {
      if(err) {
        appkit.terminal.error(err);
      } else {
        appkit.terminal.table(data);
      }
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
      }
    }

    appkit.args.command('pg:total-index-size', 'show the total size of all indexes in MB', require_options, run.bind(null, appkit))
      .command('pg:total_index_size', false, require_options, run.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}
