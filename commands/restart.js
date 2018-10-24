

const assert = require('assert')
const common = require('../lib/common')

async function restart(appkit, args) {
  let task = appkit.terminal.task("Restarting database")
  task.start()
  try {
    let pg = await common.find(appkit, args.app, args.database)
    if(pg.addon_service.name === 'akkeris-postgresql') {
      await appkit.api.put(null, `/apps/${args.app}/addons/${pg.id}/actions/restart`)
    } else {
      await appkit.api.post(null, `/apps/${args.app}/addons/${pg.id}/actions/restart`)
    }
    task.end('ok')
  } catch (err) {
    task.end('error')
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
      }
    }

    appkit.args.command('pg:restart', 'restart postgres database', require_options, restart.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}