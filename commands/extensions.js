
const pg = require('../lib/pg')

function run (appkit, args) {
  pg.database(appkit, args.app, args.database, function(err, db) {
    if(err) {
      return appkit.terminal.error(err)
    }

    let query = `
SELECT * FROM pg_available_extensions
`

    pg.exec(db, query, function(err, data) {
      if(err) {
        return appkit.terminal.error(err);
      } else {
        return appkit.terminal.table(data);
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
        'description':'The postgresql URL of the database to pull statistics (postgres://user:pass@host:port/database format, or use env DATABASE_URL'
      }
    }

    appkit.args.command('pg:extensions', 'list available and installed extensions', require_options, run.bind(null, appkit));
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}