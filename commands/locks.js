
const pg = require('../lib/pg')

function run (appkit, args) {
  pg.database(appkit, args.app, args.database, function(err, db) {
    if(err) {
      return appkit.terminal.error(err)
    }

    let truncatedQueryString = prefix => {
      let column = `${prefix}query`
      if (args.truncate) {
        return `CASE WHEN length(${column}) <= 40 THEN ${column} ELSE substr(${column}, 0, 39) || '…' END`
      } else {
        return column
      }
    }

    let query = `
  SELECT
    pg_stat_activity.usename as user,
    pg_stat_activity.pid,
    pg_class.relname,
    pg_locks.transactionid,
    pg_locks.granted,
    ${truncatedQueryString('pg_stat_activity.')} AS query_snippet,
    age(now(),pg_stat_activity.query_start) AS "age"
  FROM pg_stat_activity,pg_locks left
  OUTER JOIN pg_class
    ON (pg_locks.relation = pg_class.oid)
  WHERE pg_stat_activity.query <> '<insufficient privilege>'
    AND pg_locks.pid = pg_stat_activity.pid
    AND pg_locks.mode = 'ExclusiveLock'
    AND pg_stat_activity.pid <> pg_backend_pid() order by query_start;
  `

    pg.exec(db, query, function(err, data) {
      if(err) {
        appkit.terminal.error(err);
      } else {
        if(data.length === 0) {
          console.log(appkit.terminal.markdown('###===### No locks were found.'));
        } else {
          appkit.terminal.table(data.map((x) => {
            x.query_snippet = x.query_snippet.trim()
            return x;
          }));
        }
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
      },
      'truncate':{
        'alias':'t',
        'demand':false,
        'boolean':true,
        'default':true,
        'description':'truncate query to 40 characters'
      }
    }

    appkit.args.command('pg:locks', 'display queries with active locks', require_options, run.bind(null, appkit));
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}
