
const pg = require('../lib/pg')
const util = require('../lib/util')

function run (appkit, args) {
  pg.database(appkit, args.app, args.database, function(err, db) {
    if(err) {
      return appkit.terminal.error(err)
    }

    util.ensurePGStatStatement(db, (err) => {
      if(err) {
        return appkit.terminal.error(err)
      }

      if (args.reset) {
        pg.psql.exec(db, 'select pg_stat_statements_reset()', function() {})
        return
      }

      let truncatedQueryString = args.truncate
        ? 'CASE WHEN length(query) <= 40 THEN query ELSE substr(query, 0, 39) || \'…\' END'
        : 'query'

      let limit = 10
      if (args.num) {
        if (/^(\d+)$/.exec(args.num)) {
          limit = parseInt(args.num)
        } else {
          throw new Error(`Cannot parse num param value "${args.num}" to a number`)
        }
      }

      let query = `
SELECT interval '1 millisecond' * total_time AS total_exec_time,
to_char((total_time/sum(total_time) OVER()) * 100, 'FM90D0') || '%'  AS prop_exec_time,
to_char(calls, 'FM999G999G999G990') AS ncalls,
interval '1 millisecond' * (blk_read_time + blk_write_time) AS sync_io_time,
${truncatedQueryString} AS query
FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
ORDER BY total_time DESC
LIMIT ${limit}
`
      pg.exec(db, query, function(err, data) {
        if(err) {
          appkit.terminal.error(err);
        } else {
          appkit.terminal.table(data);
        }
      })
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
      'truncate':{
        'alias':'t',
        'demand':false,
        'boolean':true,
        'default':true,
        'description':'truncate query to 40 characters'
      },
      'reset':{
        'alias':'r',
        'demand':false,
        'boolean':true,
        'default':false,
        'description':'reset statistics gathered by pg_stat_statements'
      },
      'num':{
        'alias':'n',
        'demand':false,
        'number':true,
        'default':10,
        'description':'the number of queries to display (default: 10)'
      }
    }

    appkit.args.command('pg:outliers', 'show 10 queries that have longest execution time in aggregate', require_options, run.bind(null, appkit));
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}
