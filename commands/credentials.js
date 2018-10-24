
const assert = require('assert')
const common = require('../lib/common')

async function cred_list (appkit, args) {
  try {
    let pg = await common.find(appkit, args.app, args.database)
    let caller = pg.addon_service.name === 'akkeris-postgresql' ? appkit.api.get : appkit.api.post.bind(null, null)
    let uri = pg.addon_service.name === 'akkeris-postgresql' ? `/apps/${args.app}/addons/${pg.id}/actions/roles` : `/apps/${args.app}/addons/${pg.id}/actions/credentials`
    let data = await caller(uri)
    if(!data || data.length === 0) {
      console.log(appkit.terminal.markdown("###===### No credentials exist"))
    } else {
      data = data.map((x) => {
        delete x.Plan
        return x
      })
      appkit.terminal.table(data)
    }
  } catch (err) {
    appkit.terminal.error(err);
  }
}

async function cred_create (appkit, args) {
  try {
    let pg = await common.find(appkit, args.app, args.database)
    let action = pg.addon_service.name === 'akkeris-postgresql' ? 'roles' : 'credentials-create'
    let data = await appkit.api.post(null, `/apps/${args.app}/addons/${pg.id}/actions/${action}`)
    delete data.Plan
    appkit.terminal.vtable(data)
  } catch (err) {
    appkit.terminal.error(err);
  }
}

async function cred_destroy (appkit, args) {
  try {
    assert.ok(args.CREDENTIAL && args.CREDENTIAL !== '', 'No credential was provided to destroy.')
    let pg = await common.find(appkit, args.app, args.database)
    let data = null
    if (pg.addon_service.name === 'akkeris-postgresql') {
      data = await appkit.api.delete(null, `/apps/${args.app}/addons/${pg.id}/actions/roles/${args.CREDENTIAL}`)
    } else {
      data = await appkit.api.post(JSON.stringify({"role":args.CREDENTIAL}), `/apps/${args.app}/addons/${pg.id}/actions/credentials-destroy`)
    }
    delete data.Plan
    appkit.terminal.vtable(data)
  } catch (err) {
    appkit.terminal.error(err);
  }
}


async function cred_rotate (appkit, args) {
  try {
    assert.ok(args.CREDENTIAL && args.CREDENTIAL !== '', 'No credential was provided to rotate.')
    let pg = await common.find(appkit, args.app, args.database)
    let data = null
    if (pg.addon_service.name === 'akkeris-postgresql') {
      data = await appkit.api.put(null, `/apps/${args.app}/addons/${pg.id}/actions/roles/${args.CREDENTIAL}`)
    } else {
      data = await appkit.api.post(JSON.stringify({"role":args.CREDENTIAL}), `/apps/${args.app}/addons/${pg.id}/actions/roles/${args.CREDENTIAL}`)
    }
    delete data.Plan
    appkit.terminal.vtable(data)
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
      }
    }

    appkit.args
      .command('pg:credentials', 'list database credentials', require_options, cred_list.bind(null, appkit))
      .command('pg:credentials:create', 'create a new database read only user', require_options, cred_create.bind(null, appkit))
      .command('pg:credentials:destroy CREDENTIAL', 'destroy a database read only user', require_options, cred_destroy.bind(null, appkit))
      .command('pg:credentials:rotate CREDENTIAL', 'rotate a database read only users password', require_options, cred_rotate.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}