
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

async function wait(timeInMills) {
  return new Promise((resolve, reject) => setTimeout(resolve, timeInMills))
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

async function wait_on_addon(appkit, args, addon, loading_message) {
  let loader = appkit.terminal.loading(loading_message)
  try {
    loader.start()
    let state = ''
    for(let i=0; i < 1000; i++) {
      if(i === 999) {
        throw new Error('It seems this addon is taking too long to complete its task, you should contact your system administrator to see if everything is alright.')
      }
      addon = await appkit.api.get(`/apps/${args.app}/addons/${addon.id}`)
      if(addon.state !== 'provisioning') {
        loader.end()
        return addon;
      } else if (addon.state_description && addon.state_description !== '' && addon.state_description !== state) {
        loader.end()
        loader = appkit.terminal.loading(`${loading_message} (${addon.state_description})`)
        loader.start()
      }
      await wait(5000)
    }
  } catch (e) {
    loader.end()
    throw e
  }
}

async function backup_restore (appkit, args) {  
  let maintenance_ran = false;
  let loader = null
  try {
    assert.ok(args.BACKUP && args.BACKUP !== '', 'A backup to restore was not specified.')
    let pg = await common.find(appkit, args.app, args.database)
    if(args.confirm !== args.BACKUP) {
      let confirm = await new Promise((resolve, reject) => { appkit.terminal.confirm(`\n ~~▸~~    WARNING: This will restore ${args.BACKUP} on database **+ ${pg.name}** attached to ${args.app}.\n ~~▸~~    Any app attached to it will experience downtime during the restore\n ~~▸~~    To proceed, type !!${args.BACKUP}!! or re-run this command with !!--confirm ${args.BACKUP}!!\n`, (a) => resolve(a)) });
      if(confirm !== args.BACKUP) {
        appkit.terminal.soft_error(`Confirmation did not match !!${args.BACKUP}!!. Retore aborted.`);
        return
      }
    }
    let action = pg.addon_service.name === 'akkeris-postgresql' ? `backups/${args.BACKUP}` : 'backups-restore'
    let payload = pg.addon_service.name === 'akkeris-postgresql' ? null : JSON.stringify({"backup":args.BACKUP})
    let method = pg.addon_service.name === 'akkeris-postgresql' ? appkit.api.put : appkit.api.post

    loader = appkit.terminal.loading(appkit.terminal.markdown(`\n###===### Placing app ~~${args.app}~~ into maintenance mode.`));
    loader.start()
    await appkit.api.patch(JSON.stringify({"maintenance":true}), `/apps/${args.app}`)
    maintenance_ran = true
    loader.end()
    loader = appkit.terminal.loading(appkit.terminal.markdown(`\n###===### Starting restore on ~~${args.app}~~ for ~~${pg.name}~~`));
    loader.start()
    await method(payload, `/apps/${args.app}/addons/${pg.id}/actions/${action}`)
    loader.end()
    await wait_on_addon(appkit, args, pg, appkit.terminal.markdown(`###===### Waiting for database to be restored on ~~${args.app}~~ for ~~${pg.name}~~`));
    console.log(appkit.terminal.markdown(`###===### Database ~~${pg.name}~~ was successfully restored to ${args.BACKUP}.\n`));
  } catch (e) {
    if(loader) {
      loader.end()
    }
    return appkit.terminal.error(e)
  } finally {
    if(maintenance_ran) {
      await appkit.api.patch(JSON.stringify({"maintenance":false}), `/apps/${args.app}`)
    }
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
    let require_restore_options = JSON.parse(JSON.stringify(require_options))
    require_restore_options.confirm = {
      'alias':'c',
      'demand':false,
      'string':true,
      'description':'Confirm the action via the command line, the value should be the backup name'
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