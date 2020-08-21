let pg = require('pg')

      
async function credentials(appkit, app, dbAddon) {      
  let creds = await appkit.api.get(`/apps/${app}/addons/${dbAddon.id}/actions/roles`);
  if (!creds) {
    let task = appkit.terminal.task(`###===### Creating credentials for ${dbAddon.name} ${app}`);
    task.start();
    creds = [await appkit.api.post(null, `/apps/${app}/addons/${dbAddon.id}/actions/roles`)];
    if (creds.length === 0){
      task.end('error');
      throw `Could not create credentials in ${args.source}.`;
    }
    task.end('ok');
  }
  return creds[0];
}


async function find(appkit, appName, addonName) {
  let attachments = (await appkit.api.get(`/apps/${appName}/addon-attachments`)).filter(a => (a.addon_service && a.addon_service.name == 'alamo-postgresql') || (a.addon_service && a.addon_service.name == 'akkeris-postgresql') || (a.addon && a.addon.plan && a.addon.plan.name && a.addon.plan.name.startsWith('akkeris-postgresql')));
  let addons = (await appkit.api.get(`/apps/${appName}/addons`)).filter(a => a.addon_service.name == 'alamo-postgresql' || a.addon_service.name == 'akkeris-postgresql');

  if (addons.length === 0 && attachments.length === 0) {
    throw `No postgres addons (attached or owned) were found in ${appName}.`;
  }

  let addon;
  
  if (addonName) {
    attachments = attachments.filter((x) => x.name === addonName || x.id === addonName)
    addons = addons.filter((x) => x.name === addonName || x.id === addonName)
  }

  if (addons.length === 1) {
    addon = addons[0];
  } else if (attachments.length === 1){
    addon = attachments[0];
  } else {
    throw `No postgres addon found for ${appName} ${addonName}`;
  }

  let config = await appkit.api.get(`/apps/${appName}/config-vars`);
  let url, user, pass, host, port, dbName;
  for (let key in config){
    if (key === "DATABASE_URL" && /postgres:\/\/(.*):(.*)@(.*):(.*)\/(.*)/.test(config[key])){
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

function database(appkit, app, database, callback) {
  if(app) {
    appkit.api.get(`/apps/${app}/config-vars`, (err, data) => {
      if(err) {
        return callback(err);
      }
      if (database && data['OCT_VAULT_DB_' + database.replace(/-/g,'_').toUpperCase() + '_HOSTNAME']) {
        let conn = 'postgres://' + 
          data['OCT_VAULT_DB_' + database.replace(/-/g,'_').toUpperCase() + '_USERNAME'] + ':' +
          data['OCT_VAULT_DB_' + database.replace(/-/g,'_').toUpperCase() + '_PASSWORD'] + '@' +
          data['OCT_VAULT_DB_' + database.replace(/-/g,'_').toUpperCase() + '_HOSTNAME'] + ':' +
          data['OCT_VAULT_DB_' + database.replace(/-/g,'_').toUpperCase() + '_PORT'] + '/' +
          data['OCT_VAULT_DB_' + database.replace(/-/g,'_').toUpperCase() + '_RESOURCENAME'];
        let client = new pg.Client({connectionString:conn});
        client.connect()
        callback(null, client);
      } else if(data['DATABASE_URL']) {
        if(data['DATABASE_URL'].indexOf('[redacted]') !== -1) {
          find(appkit, app, database).then((dbAddon) => {
            credentials(appkit, app, dbAddon).then((creds) => {
              let [endpoint, host, port, db] = creds.Endpoint.match(/(.*):(.*)\/(.*)/);
              dbAddon.host = host;
              dbAddon.endpoint = endpoint;
              dbAddon.port = port;
              dbAddon.dbName = db;
              dbAddon.user = creds.Username;
              dbAddon.pass = creds.Password;
              dbAddon.url = `postgres://${dbAddon.user}:${dbAddon.pass}@${dbAddon.host}${dbAddon.port ? (':' + dbAddon.port) : ''}/${dbAddon.dbName}`;
              let client = new pg.Client({connectionString:`postgres://${dbAddon.user}:${dbAddon.pass}@${dbAddon.host}${dbAddon.port ? (':' + dbAddon.port) : ''}/${dbAddon.dbName}`})
              client.connect();
              callback(null, client);
            }).catch((e) => callback(e, null));
          }).catch((e) => callback(e, null));
        } else {
          let client = new pg.Client({connectionString:data['DATABASE_URL']});
          client.connect()
          callback(null, client);
        }
      } else {
        if(!database) {
          callback(new Error("No postgresql database was found"));
        } else {
          callback(new Error(`No such database exists, ${database}`))
        }
      }
    })
  } else if(database) {
    let client = new pg.Client({connectionString:database});
    client.connect()
    callback(null, client);
  } else if(process.env.DATABASE_URL) {
    let client = new pg.Client({connectionString:process.env.DATABASE_URL});
    client.connect()
    callback(null, client)
  } else {
    throw new Error('No app or database url specified.')
  }
}

async function dbAsync(appkit, app, db) {
  return new Promise((resolve, reject) => {
    try {
      database(appkit, app, db, (err, client) => {
        if(err) {
          reject(err)
        } else {
          resolve(client)
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}

async function execAsync(db, query, alive) {
  let res = await db.query(query)
  if(!alive) {
    db.end()
  }
  return res.rows
}

function exec(db, query, callback, alive) {
  db.query(query, (err, res) => {
    if(!alive) db.end()
    if(err) {
      return callback(err, null)
    } else {
      callback(null, res.rows)
    }
  })
}


module.exports = {
  credentials,
  find,
  dbAsync,
  execAsync,
  exec,
  database
}