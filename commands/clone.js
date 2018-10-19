const pg = require('../lib/pg'),
      util = require('util'),
      exec = require('child_process').exec,
      url = require('url');

      
async function getCredentials(appkit, app, dbAddon){
  const post = util.promisify(appkit.api.post);
        
  let creds = await post(null, `/apps/${app}/addons/${dbAddon.id}/actions/credentials`);
  if (!creds) {
    let task = appkit.terminal.task(`###===### Creating credentials for ${dbAddon.name} ${app}`);
    task.start();
    creds = [await post(null, `/apps/${app}/addons/${dbAddon.id}/actions/credentials-create`)];
    if (creds.length === 0){
      task.end('error');
      throw `Could not create credentials in ${args.source}.`;
    }
    task.end('ok');
  }
  return creds;
}

async function getPostgresAddon(appkit, appName, addonName) {
  let get = util.promisify(appkit.api.get);
  let attachments = (await get(`/apps/${appName}/addon-attachments`)).filter(a => a.addon_service.name == 'alamo-postgresql' || a.addon_service.name == 'akkeris-postgresql');
  let addons = (await get(`/apps/${appName}/addons`)).filter(a => a.addon_service.name == 'alamo-postgresql' || a.addon_service.name == 'akkeris-postgresql');

  if (addons.length === 0 && attachments.length === 0) {
    throw `No postgres addons (attached or owned) were found in ${appName}.`;
  }

  let addon;
  
  if (addonName) {
    attachments = attachments.filter((x) => x.name === addonName)
    addons = addons.filter((x) => x.name === addonName)
  }

  if (addons.length === 1) {
    addon = addons[0];
  } else if (attachments.length === 1){
    addon = attachments[0];
  } else {
    throw `No postgres addon found for ${appName} ${addonName}`;
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

  if (!url) {
    throw 'Cannot find db URL in config for ' + appName;
  }

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

function getCommandArgsFromUri(targetUri) {
  let uri = url.parse(targetUri);
  let options = '';
  options += uri.hostname ? ` -h ${uri.hostname}` : '';
  options += uri.port ? ` -p ${uri.port}` : '';
  options += uri.username ? ` -U ${uri.username}` : '';
  options += uri.pathname ? ` -d ${uri.pathname.substring(1)}` : '';
  return options;
}


function getEnvArgsFromUri(targetUri) {
  let uri = url.parse(targetUri);
  let options = '';
  options += uri.password ? ` PGPASSWORD="${uri.password}"` : '';
  return options;
}


async function copy(appkit, args){
  try {
    const sourceAddon = await getPostgresAddon(appkit, args.source),
          targetAddon = await getPostgresAddon(appkit, args.target);

    if(sourceAddon.pass === '[redacted]') {
      let sourceCreds = await getCredentials(appkit, args.source, sourceAddon);
      [endpoint, host, port, db] = sourceCreds[0].Endpoint.match(/(.*):(.*)\/(.*)/);
      sourceAddon.host = host;
      sourceAddon.endpoint = endpoint;
      sourceAddon.port = port;
      sourceAddon.dbName = db;
      sourceAddon.user = sourceCreds[0].Username,
      sourceAddon.pass = sourceCreds[0].Password;

    }
    if(targetAddon.pass === '[redacted]') {
      throw new Error('Cannot copy database to target as its a protected database.')
    }

    console.log(appkit.terminal.markdown(`###===### Pulling **${args.source}/${sourceAddon.name}** -> ^^${args.target}/${targetAddon.name}^^`));
    let child = exec(`env PGPASSWORD="${sourceAddon.pass}" pg_dump --verbose -F c -x -O -c -d ${sourceAddon.dbName} -h ${sourceAddon.host} -p ${sourceAddon.port} -U ${sourceAddon.user} | env PGPASSWORD="${targetAddon.pass}" pg_restore --verbose --no-acl --no-owner -d ${targetAddon.dbName} -h ${targetAddon.host} -p ${targetAddon.port} -U ${targetAddon.user}`);
    child.stderr.on('data', (e) => process.stderr.write(e))
    child.stdout.on('data', (e) => process.stdout.write(e))
    child.on('exit', (code) => console.log(appkit.terminal.markdown('###===### Pull complete')))
    child.on('error', (err) => appkit.terminal.error(err))
  } catch (err) {
    appkit.terminal.error(err);
  }
}

async function pull(appkit, args){
  try {
    const sourceApp = args.app,
          targetUri = args.TARGET,
          sourceAddon = await getPostgresAddon(appkit, sourceApp, args.source),
          sourceCreds = await getCredentials(appkit, sourceApp, sourceAddon);
    let [endpoint, host, port, db] = sourceCreds[0].Endpoint.match(/(.*):(.*)\/(.*)/),
    user = sourceCreds[0].Username,
    pass = sourceCreds[0].Password;

    console.log(appkit.terminal.markdown(`###===### Pulling **${sourceAddon.name}** -> ^^${targetUri}^^`));

    let child = exec(`env PGPASSWORD="${pass}" pg_dump --verbose -F c -x -O -c -d ${db} -h ${host} -p ${port} -U ${user} | env${getEnvArgsFromUri(targetUri)} pg_restore --verbose --no-acl --no-owner ${getCommandArgsFromUri(targetUri)}`);
    child.stderr.on('data', (e) => process.stderr.write(e))
    child.stdout.on('data', (e) => process.stdout.write(e))
    child.on('exit', (code) => console.log(appkit.terminal.markdown('###===### Pull complete')))
    child.on('error', (err) => appkit.terminal.error(err))
  } catch (err) {
    appkit.terminal.error(err);
  }
}

module.exports = {
    init: function (appkit) {
      let copyOptions = {
        'source': {
          'alias': 's',
          'demand': true,
          'string': true,
          'description': 'The source app to copy the database from'
        },
        'target': {
          'alias': 't',
          'demand': true,
          'string': true,
          'description': 'The target app to copy database to (note existing database will be dropped)'
        }
      }
      let pullOptions = {
        'app': {
          'alias': 'a',
          'demand': true,
          'string': true,
          'description': 'The source app to pull the database from'
        },
        'source':{
          'alias': 's',
          'demand': false,
          'string': true,
          'description': 'The name of the postgres source database, if more than one is available.'
        }
      }

      appkit.args
        .command('pg:pull TARGET', 'pull an akkeris database to the TARGET postgres database (e.g. postgres://localhost/mydb).', pullOptions, pull.bind(null, appkit))
        .command('pg:copy', 'copy an akkeris database to another akkeris database', copyOptions, copy.bind(null, appkit))
    },
    update: function() {},
    'group':'pg',
    'help':'manage postgres databases',
    'primary':false
  }

