
const assert = require('assert')
const common = require('../lib/common')

async function replica_list (appkit, args) {
  try {
    let pg = await common.find(appkit, args.app, args.database)
    let call = pg.addon_service.name === 'akkeris-postgresql' ? appkit.api.get : appkit.api.post.bind(null, null)
    let data = await appkit.api.get(`/apps/${args.app}/addons/${pg.id}/actions/replica`)
    if(!data || data.length === 0) {
      console.log(appkit.terminal.markdown("###===### No replicas exist"))
    } else {
      appkit.terminal.vtable(data)
    }
  } catch (e) {
    return appkit.terminal.error(e)
  }
}

async function replica_create (appkit, args) {
  let task = appkit.terminal.task(`Creating **⬢ ${args.app}**${args.TYPE ? (" ^^^" + args.TYPE + "^^^") : ""}`);
  task.start();
  try {
    let pg = await common.find(appkit, args.app, args.database)
    let action = pg.addon_service.name === 'akkeris-postgresql' ? 'replica' : 'replica-create'
    let data = await appkit.api.put(null, `/apps/${args.app}/addons/${pg.id}/actions/${action}`)
    task.end('ok');
  } catch (err) {
    task.end('error')
    appkit.terminal.error(err);
  }
}

async function replica_destroy (appkit, args) {
  try {
    let pg = await common.find(appkit, args.app, args.database)
    let action = pg.addon_service.name === 'akkeris-postgresql' ? 'replica' : 'replica-destroy'
    let data = await appkit.api.delete(`/apps/${args.app}/addons/${pg.id}/actions/${action}`)
    delete data.Plan
    appkit.terminal.vtable(data)
  } catch (err) {
    appkit.terminal.error(err);
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

    appkit.args
      .command('pg:replicas', 'list database read replicas', require_options, replica_list.bind(null, appkit))
      .command('pg:replicas:create', 'create a new database read replica', require_options, replica_create.bind(null, appkit))
      .command('pg:replicas:destroy', 'destroy a database read replica', require_options, replica_destroy.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}