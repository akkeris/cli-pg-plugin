
const common = require('../lib/common')

async function log_trails(appkit, args) {
  try {
    let pg = await common.find(appkit, args.app, args.database)
    if(pg.addon_service.name === 'akkeris-postgresql') {
      let data = await appkit.api.get(`/apps/${args.app}/addons/${pg.id}/actions/logs`)
      console.log(data.logs)
    } else {
      let data = await appkit.api.post(null, `/apps/${args.app}/addons/${pg.id}/actions/logs`)
      console.log(data.join('\n'))
    }
  } catch (err) {
    appkit.terminal.error(err)
  }
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
      },
      'all':{
        'demand':false,
        'boolean':true,
        'default':false,
        'description':'Show all available logs'
      }
    }

    appkit.args.command('pg:logs', 'show database logs', require_options, log_trails.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}