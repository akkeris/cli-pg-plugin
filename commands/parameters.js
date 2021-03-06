

const pg = require('../lib/pg')

function run (appkit, args) {
  const query = `show all`
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

    appkit.args.command('pg:parameters', 'shows the server settings and runtime parameters', require_options, run.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}
