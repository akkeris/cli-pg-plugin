
const assert = require('assert')
const common = require('../lib/common')

async function replica_get (appkit, args) {
  try {
    const pg = await common.find(appkit, args.app, args.database)
    if(pg.state !== "provisioned") {
      throw new Error(`The database ${pg.name} is currently undergoing maintenance or replica changes. Try again later.`)
    }
    const plan_info = await appkit.api.get(`/addon-services/${pg.addon_service.name}/plans/${pg.plan.id}`)
    if(plan_info.attributes.database_replicas !== true) {
      throw new Error(`The ${pg.plan.name} addon:plan does not support replicas. Try upgrading to a plan that supports it.`)
    }
    let call = pg.addon_service.name === 'akkeris-postgresql' ? appkit.api.get : appkit.api.post.bind(null, null)
    let data = await appkit.api.get(`/apps/${args.app}/addons/${pg.id}/actions/replica`)
    if(!data || data.length === 0) {
      console.log(appkit.terminal.markdown("###===### No replicas exist"))
    } else if (data.description && (data.description.includes("Not Found") || data.description.includes("Service Unavailable Error"))) {
      console.log(appkit.terminal.markdown("###===### No replicas exist"))
    } else {
      console.log(appkit.terminal.markdown(`**postgres://${data.Username}@${data.Endpoint}**`));
    }
  } catch (e) {
    if(e.code === 503) {
      console.log(appkit.terminal.markdown("###===### No replicas exist"))
      return
    }
    return appkit.terminal.error(e)
  }
}

async function replica_create (appkit, args) {
  let task = appkit.terminal.task(`Creating **⬢ ${args.app}**${args.TYPE ? (" ^^^" + args.TYPE + "^^^") : ""}`)
  task.start();
  try {
    const pg = await common.find(appkit, args.app, args.database)
    if(pg.state !== "provisioned") {
      throw new Error("The database is currently undergoing maintenance or upgrades and is unable to undergo changes at this time.")
    }
    const plan_info = await appkit.api.get(`/addon-services/${pg.addon_service.name}/plans/${pg.plan.id}`)
    if(plan_info.attributes.database_replicas !== true) {
      throw new Error(`The ${pg.plan.name} addon:plan does not support replicas. Try upgrading to a plan that supports it.`)
    }
    let action = pg.addon_service.name === 'akkeris-postgresql' ? 'replica' : 'replica-create'
    let data = await appkit.api.put(null, `/apps/${args.app}/addons/${pg.id}/actions/${action}`)
    task.end('ok');
  } catch (err) {
    task.end('error')
    if(err.code === 503) {
      console.log(appkit.terminal.markdown("###===### A replica already exists for this database."))
      return
    }
    appkit.terminal.error(err);
  }
}

async function replica_destroy (appkit, args) {
  try {
    const pg = await common.find(appkit, args.app, args.database)
    if(pg.state !== "provisioned") {
      throw new Error("The database is currently undergoing maintenance or upgrades and is unable to undergo changes at this time.")
    }
    const plan_info = await appkit.api.get(`/addon-services/${pg.addon_service.name}/plans/${pg.plan.id}`)
    if(plan_info.attributes.database_replicas !== true) {
      throw new Error(`The ${pg.plan.name} addon:plan does not support replicas. Try upgrading to a plan that supports it.`)
    }
    let action = pg.addon_service.name === 'akkeris-postgresql' ? 'replica' : 'replica-destroy'
    await appkit.api.delete(`/apps/${args.app}/addons/${pg.id}/actions/${action}`)
    console.log(appkit.terminal.markdown("###===### The replica on this database was destroyed."))
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
      .command('pg:replicas', 'list database read replicas', require_options, replica_get.bind(null, appkit))
      .command('pg:replicas:create', 'create a new database read replica', require_options, replica_create.bind(null, appkit))
      .command('pg:replicas:destroy', 'destroy a database read replica', require_options, replica_destroy.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}