
const pg = require('../lib/pg')

function cred_list (appkit, args) {
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
    appkit.api.post(null, '/apps/' + args.app + '/addons/' + pg + '/actions/credentials', (err, data) => {

      if(err) {
        appkit.terminal.error(err)
      } else {
        if(!data) {
          console.log("No credentials exist.")
        } else {
          appkit.terminal.table(data)
        }
      }
    })
  })
}

function cred_create (appkit, args) {
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
    appkit.api.post(null, '/apps/' + args.app + '/addons/' + pg + '/actions/credentials-create', (err, data) => {
      if(err) {
        appkit.terminal.error(err)
      } else {
        delete data.Plan
        appkit.terminal.vtable(data)
      }
    })
  })
}

function cred_destroy (appkit, args) {
  console.assert(args.CREDENTIAL && args.CREDENTIAL !== '', 'No credential was provided to destroy.')
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
    appkit.api.post(JSON.stringify({"role":args.CREDENTIAL}), '/apps/' + args.app + '/addons/' + pg + '/actions/credentials-destroy', (err, data) => {
      if(err) {
        appkit.terminal.error(err)
      } else {
        delete data.Plan
        appkit.terminal.vtable(data)
      }
    })
  })
}


function cred_rotate (appkit, args) {
  console.assert(args.CREDENTIAL && args.CREDENTIAL !== '', 'No credential was provided to rotate.')
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
    appkit.api.post(JSON.stringify({"role":args.CREDENTIAL}), '/apps/' + args.app + '/addons/' + pg + '/actions/credentials-rotate', (err, data) => {
      if(err) {
        appkit.terminal.error(err)
      } else {
        delete data.Plan
        appkit.terminal.vtable(data)
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