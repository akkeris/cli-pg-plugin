const pg = require('../lib/pg'),
      util = require('util'),
      exec = util.promisify(require('child_process').exec);

function getCloneCommand(sourceCreds, targetAddon){
  const targetUrl = targetAddon.config_vars.DATABASE_URL,
        [endpoint, host, port, db] = sourceCreds.Endpoint.match(/(.*):(.*)\/(.*)/),
        user = sourceCreds.Username,
        pass = sourceCreds.Password;

  return `PGPASSWORD="${pass}" pg_dump -xOc -d ${db} -h ${host} -p ${port} -U ${user} | psql ${targetUrl}\n\n`;
}
      
async function getCredentials(appkit, app, dbAddon){
  const post = util.promisify(appkit.api.post);
        
  let creds = await post(null, `/apps/${app}/addons/${dbAddon.id}/actions/credentials`);
  if (!creds){
    let task = appkit.terminal.task('###===### Cannot find any credentials for source database. Attempting to create some.');
    task.start();

    creds = await post(null, '/apps/' + app + '/addons/' + dbAddon.name + '/actions/credentials-create');
    if (creds.length == 0){
      task.end('error');
      throw `Could not create credentials in ${args.source}.`;
    }

    task.end('ok');
  }
    
  return creds;
}

async function getPostgresAddon(appkit, appName, addonName) {
  let get = util.promisify(appkit.api.get);
  let attachments = (await get(`/apps/${appName}/addon-attachments`)).filter(a => a.addon_service.name == 'alamo-postgresql');
  let addons = (await get(`/apps/${appName}/addons`)).filter(a => a.addon_service.name == 'alamo-postgresql');

  if (addons.length === 0 && attachments.length === 0)
    throw `No postgres addons (attached or owned) were found in ${appName}.`;

  let addon;
  if (addons.length == 1) {
    addon = addons[0];
  } 
  else if (attachments.length == 1){
    addon = attachments[0];
  }
  else {
    throw `No unique postgres addon found for app ${appName}. If there are multiple you must provide the addon name.`;
  }

  let config = await get(`/apps/${appName}/config-vars`);

  let url, user, pass, host, port, dbName;
  for (let key in config){
    if (/postgres:\/\/(.*):(.*)@(.*):(.*)\/(.*)/.test(config[key])){
      if (url) 
        throw 'Multiple config vars found that look like postgres URLs in ' + appName;

      [url, user, pass, host, port, dbName] = config[key].match(/postgres:\/\/(.*):(.*)@(.*):(.*)\/(.*)/);
    }
  }

  if (!url)
    throw 'Cannot find db URL in config for ' + appName;

  return {
    id: addon.id,
    name: addon.name,
    plan: addon.plan.name,
    url,
    host,
    port,
    user,
    pass,
    dbName
  };
}

async function createAddon(appkit, app, plan){
  const task = appkit.terminal.task(`\n###===### Provisioning addon for plan ~~${plan}~~ and attaching it to ~~${app}~~`);
  task.start();
  const addon = await util.promisify(appkit.api.post)(JSON.stringify({plan}), '/apps/' + app + '/addons')
  task.end('ok');
  console.log(appkit.terminal.markdown(`###===### Addon ~~${addon.name}~~ provisioned.\n`));
  return addon;
}

async function destroyAddon(appkit, app, addon){
  const task = appkit.terminal.task(`\n###===### Destroying addon ~~${addon.name}~~ in app ~~${app}~~`);
  task.start();
  await util.promisify(appkit.api.delete)('/apps/' + app + '/addons/' + addon.name);
  task.end('ok');
  console.log(appkit.terminal.markdown(`###===### Successfully removed ~~${addon.name}~~ from ~~${app}~~`));
}

async function runClone(sourceCreds, targetAddon){
  console.log('target:')
  console.dir(targetAddon)
  const command = getCloneCommand(sourceCreds, targetAddon);

  console.log("Running command:");
  console.log(command);

  const res = await exec(command);

  console.log('Result: ');
  console.dir(res);
}

//
// Command implementations
//

async function listAddons(appkit, args){
  try {
    let source = args.source;
    let target = args.target;
    let sourceAddon = await getPostgresAddon(appkit, source);
    let targetAddon = await getPostgresAddon(appkit, target);

    console.log(`Postgres addon for app ${source} is ${sourceAddon.id} (${sourceAddon.name}).`);
    console.log(`  URL: ${sourceAddon.url}`);
    appkit.terminal.print(null, sourceAddon);
    console.log(`Postgres addon for app ${target} is ${targetAddon.id} (${targetAddon.name}).`);
    console.log(`  URL: ${targetAddon.url}`);
    appkit.terminal.print(null, targetAddon);
    return [sourceAddon, targetAddon];
  }
  catch (err) {
    appkit.terminal.error(err);
  }
}

async function generateCommand(appkit, args){
  try {
    const sourceApp = args.source,
          targetApp = args.target,
          sourceAddon = await getPostgresAddon(appkit, sourceApp),
          sourceCreds = await getCredentials(appkit, sourceApp, sourceAddon),
          targetAddon = await getPostgresAddon(appkit, targetApp);

    console.log('\n\n' + getCloneCommand(sourceAddon, targetAddon) + '\n\n');    
  }
  catch (err) {
    appkit.terminal.error(err);
  }
}

async function clone(appkit, args){
  try {
    const ask = util.promisify(appkit.terminal.question),
          sourceApp = args.source, 
          targetApp = args.target,
          sourceAddon = await getPostgresAddon(appkit, sourceApp),
          targetAddon = await getPostgresAddon(appkit, targetApp),
          sourceCreds = await getCredentials(appkit, sourceApp, sourceAddon);

    let message = "\n";
    message += "Are you sure you want to do the following?\n";
    message += `1. Destroy the database ~~${targetAddon.name}~~ in ~~${targetApp}~~\n`;
    message += `2. Create a new database in ~~${targetApp}~~ with plan ~~${targetAddon.plan}~~\n`;
    message += `3. Copy the database at ~~${sourceAddon.name}~~ in ~~${sourceApp}~~ to the new database in ~~${targetApp}~~\n\n`;
    message += `[y/N] `;

    let answer = await ask(appkit.terminal.markdown(message));
    if (answer.toLowerCase() != 'y'){
      console.log('Maybe for the best...');
      return;
    }

    console.log('\nYou asked for it!');
    
    try {
      await destroyAddon(appkit, targetApp, targetAddon);
    }
    catch (error){
      appkit.terminal.error(error);
      let answer = await ask(`No existing addon could be destroyed. Continue anyway? [y/N]? `);
      if (answer.toLowerCase() != 'y'){
        console.log('Exiting.');
        return;
      }
    }

    let newDb = await createAddon(appkit, targetApp, targetAddon.plan);
    let ran = await runClone(sourceCreds[0], newDb);    
  }
  catch (err) {
    appkit.terminal.error(err);
  }
}

module.exports = {
    init: function (appkit) {
      let requireOptions = {
        'source': {
          'alias': 's',
          'demand': true,
          'string': true,
          'description': 'The source app or postgres addon to use'
        },
        'target': {
          'alias': 't',
          'demand': true,
          'string': true,
          'description': 'The target app or postgres addon to use'
        }
      }

      appkit.args
        .command('pg:clone', 'clone the target database from the source database', requireOptions, clone.bind(null, appkit))
        .command('pg:clone:list', 'list database addon for each given database', requireOptions, listAddons.bind(null, appkit))
        .command('pg:clone:command', 'generate a clone command to run in the terminal', requireOptions, generateCommand.bind(null, appkit));
    },
    update: function() {},
    'group':'pg',
    'help':'manage postgres databases',
    'primary':false
  }

