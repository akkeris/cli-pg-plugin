let pg = require('pg')

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
          return callback('Unable to connect to production or SOC controlled database.', null)
        }
        let client = new pg.Client({connectionString:data['DATABASE_URL']});
        client.connect()
        callback(null, client);
      } else {
        if(!database) {
          console.log("No postgresql database was found")
        } else {
          console.log(`No such database exists, ${database}`)
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
  dbAsync:dbAsync,
  execAsync:execAsync,
  exec:exec,
  database:database
}