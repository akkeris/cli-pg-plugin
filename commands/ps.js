const pg = require('../lib/pg')

async function run (appkit, args) {
  try {
    let db = await pg.dbAsync(appkit, args.app, args.database);
    let truncatedQueryString = prefix => {
      let column = `${prefix}query`
      if (args.truncate) {
        return `CASE WHEN length(${column}) <= 40 THEN ${column} ELSE substr(${column}, 0, 39) || '…' END`
      } else {
        return column
      }
    };

    const query = `
      SELECT 
        pid,
        datname as database,
        usename as user,
        client_addr as ip_address,
        backend_start as start,
        state_change as last_change,
        waiting,
        ${truncatedQueryString('pg_stat_activity.')} as query
      from pg_stat_activity where state='active'
    `;
    try {
      appkit.terminal.table(
        (await pg.execAsync(db, query))
          .map((x) => ({query:x.query.trim(), ...x})));
    } catch (e) {
      // incase the first query fails, retry it without 
      // the waiting column, its unavailable in pg10.
      appkit.terminal.table(
        (await pg.execAsync(db, query.replace('waiting,', '\'N/A\' as waiting,')))
          .map((x) => ({query:x.query.trim(), ...x})));
    }
  } catch (err) {
    return appkit.terminal.error(err);
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
        'description':'The postgresql URL of the database to pull statistics (postgres://user:pass@host:port/database format)'
      },
      'truncate':{
        'alias':'t',
        'demand':false,
        'boolean':true,
        'default':true,
        'description':'truncate query to 40 characters'
      }
    }

    appkit.args.command('pg:ps', 'display all active/running queries', require_options, run.bind(null, appkit));
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
}
