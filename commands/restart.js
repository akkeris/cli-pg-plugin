
const pg = require('../lib/pg')

function restart(appkit, args) {
  appkit.api.get('/apps/' + args.app + '/addons', (err, data) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    let pg = args.database ? args.database : data.filter((x) => x.addon_service.name === 'alamo-postgresql')[0]
    if(!pg) {
      return appkit.termial.error("Unable to find any postgres database")
    }
    if(pg.id) {
      pg = pg.id
    }
    appkit.api.post(null, '/apps/' + args.app + '/addons/' + pg + '/actions/restart', (err, data) => {
      if(err) {
        appkit.terminal.error(err)
      } else {
        console.log(data.join('\n'))
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
        'description':'The name of the postgres addon to use'
      }
    }

    appkit.args.command('pg:restart', 'restart postgres database', require_options, restart.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}