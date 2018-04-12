
const pg = require('../lib/pg')

function backup_list (appkit, args) {
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
    appkit.api.post(null, '/apps/' + args.app + '/addons/' + pg + '/actions/backups', (err, data) => {
      if(err) {
        appkit.terminal.error(err)
      } else {
        appkit.terminal.table(data)
      }
    })
  })
}

function backup_capture (appkit, args) {
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
    appkit.api.post(null, '/apps/' + args.app + '/addons/' + pg + '/actions/backups-capture', (err, data) => {
      if(err || data.error) {
        appkit.terminal.error(err || data ? data.error : '')
      } else {
        appkit.terminal.vtable(data)
      }
    })
  })
}

function backup_restore (appkit, args) {
  console.assert(args.BACKUP && args.BACKUP !== '', 'A backup to restore was not specified.')
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
    appkit.api.post(JSON.stringify({"backup":args.BACKUP}), '/apps/' + args.app + '/addons/' + pg + '/actions/backups-restore', (err, data) => {
      if(err || data.error) {
        appkit.terminal.error(err || data ? data.error : '')
      } else {
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
      .command('pg:backups', 'list database backups', require_options, backup_list.bind(null, appkit))
      .command('pg:backups:capture', 'capture a new database backup', require_options, backup_capture.bind(null, appkit))
      .command('pg:backups:restore BACKUP', 'restore a backup (default latest) to a database', require_options, backup_restore.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}