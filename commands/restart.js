

const assert = require('assert')
const common = require('../lib/common')

async function restart(appkit, args) {
  let task = appkit.terminal.task("Restarting database")
  task.start()
  try {
    let pg = await common.find(appkit, args.app, args.ADDON_ID_OR_NAME)
    if(pg.state !== "provisioned") {
      throw new Error("The database is currently undergoing maintenance, upgrades or is otherwise unavailable to be restarted.")
    }
    let plan_info = await appkit.api.get(`/addon-services/${pg.addon_service.name}/plans/${pg.plan.id}`)
    if(plan_info.attributes.restartable !== true) {
      throw new Error(`The ${pg.plan.name} addon:plan does not support restarting instances. Try upgrading to a plan that supports it.`)
    }
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
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      }
    }

    appkit.args.command('pg:restart [ADDON_ID_OR_NAME]', 'Restarts a dedicated postgres database', require_options, restart.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}