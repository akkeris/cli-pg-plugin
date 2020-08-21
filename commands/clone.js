const pg = require('../lib/pg'),
      util = require('util'),
      exec = require('child_process').exec,
      url = require('url');


function getCommandArgsFromUri(targetUri) {
  let uri = new URL(targetUri);
  let options = '';
  options += uri.hostname ? ` -h ${uri.hostname}` : '';
  options += uri.port ? ` -p ${uri.port}` : '';
  options += uri.username ? ` -U ${uri.username}` : '';
  options += uri.pathname ? ` -d ${uri.pathname.substring(1)}` : '';
  return options;
}


function getEnvArgsFromUri(targetUri) {
  let uri = new URL(targetUri);
  let options = '';
  options += uri.password ? ` PGPASSWORD="${uri.password}"` : '';
  return options;
}


async function copy(appkit, args){
  try {
    const sourceAddon = await pg.find(appkit, args.source),
          targetAddon = await pg.find(appkit, args.target);
    
    if(sourceAddon.pass === '[redacted]' || sourceAddon.pass === '' || sourceAddon.pass === 'redacted') {
      let sourceCreds = await pg.credentials(appkit, args.source, sourceAddon);
      let [endpoint, host, port, db] = sourceCreds.Endpoint.match(/(.*):(.*)\/(.*)/);
      sourceAddon.host = host;
      sourceAddon.endpoint = endpoint;
      sourceAddon.port = port;
      sourceAddon.dbName = db;
      sourceAddon.user = sourceCreds.Username;
      sourceAddon.pass = sourceCreds.Password;
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
          sourceAddon = await pg.find(appkit, sourceApp, args.source);
    if(sourceAddon.pass === '[redacted]' || sourceAddon.pass === '' || sourceAddon.pass === 'redacted') {
      const sourceCreds = await pg.credentials(appkit, sourceApp, sourceAddon);
      let [endpoint, host, port, db] = sourceCreds.Endpoint.match(/(.*):(.*)\/(.*)/);
      sourceAddon.host = host;
      sourceAddon.endpoint = endpoint;
      sourceAddon.port = port;
      sourceAddon.dbName = db;
      sourceAddon.user = sourceCreds.Username;
      sourceAddon.pass = sourceCreds.Password;
    }

    console.log(appkit.terminal.markdown(`###===### Pulling **${sourceAddon.name}** -> ^^${targetUri}^^`));

    let child = exec(`env PGPASSWORD="${sourceAddon.pass}" pg_dump --verbose -F c -x -O -c -d ${sourceAddon.dbName} -h ${sourceAddon.host} -p ${sourceAddon.port} -U ${sourceAddon.user} | env${getEnvArgsFromUri(targetUri)} pg_restore --verbose --no-acl --no-owner ${getCommandArgsFromUri(targetUri)}`);
    child.stderr.on('data', (e) => process.stderr.write(e))
    child.stdout.on('data', (e) => process.stdout.write(e))
    child.on('exit', (code) => {
      if(code === 0) {
        console.log(appkit.terminal.markdown('###===### Pull complete'));
      } else {
        console.log(appkit.terminal.markdown('###===### Pull failed'));
      }
    });
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

