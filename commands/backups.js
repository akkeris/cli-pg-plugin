
const assert = require('assert')
const common = require('../lib/common')

async function backup_list (appkit, args) {
  try {
    let pg = await common.find(appkit, args.app, args.database)
    let call = pg.addon_service.name === 'akkeris-postgresql' ? appkit.api.get : appkit.api.post.bind(null, null)
    appkit.terminal.table((await call(`/apps/${args.app}/addons/${pg.id}/actions/backups`))
      .sort((a, b) => (new Date(a.created_at).getTime()) > (new Date(b.created_at).getTime()) ? 1 : -1))
  } catch (e) {
    return appkit.terminal.error(e)
  }
}

async function backup_capture (appkit, args) {
  try {
    let pg = await common.find(appkit, args.app, args.database)
    let action = pg.addon_service.name === 'akkeris-postgresql' ? 'backups' : 'backups-capture'
    appkit.terminal.vtable(await appkit.api.post(null, `/apps/${args.app}/addons/${pg.id}/actions/${action}`))
  } catch (e) {
    return appkit.terminal.error(e)
  }
}

async function backup_restore (appkit, args) {  
  try {
    assert.ok(args.BACKUP && args.BACKUP !== '', 'A backup to restore was not specified.')
    let pg = await common.find(appkit, args.app, args.database)
    let action = pg.addon_service.name === 'akkeris-postgresql' ? `backups/${args.BACKUP}` : 'backups-restore'
    let payload = pg.addon_service.name === 'akkeris-postgresql' ? null : JSON.stringify({"backup":args.BACKUP})
    let method = pg.addon_service.name === 'akkeris-postgresql' ? appkit.api.put : appkit.api.post
    appkit.terminal.vtable(await method(payload, `/apps/${args.app}/addons/${pg.id}/actions/${action}`))
  } catch (e) {
    return appkit.terminal.error(e)
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
      .command('pg:backups', 'list database backups', require_options, backup_list.bind(null, appkit))
      .command('pg:backups:capture', 'capture a new database backup', require_options, backup_capture.bind(null, appkit))
      .command('pg:backups:restore BACKUP', 'restore a backup (default latest) to a database', require_options, backup_restore.bind(null, appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}