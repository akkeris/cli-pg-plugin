async function find(appkit, app, id_or_name) {
  let addons = await appkit.api.get(`/apps/${app}/addons`)
  let pg = null
  if(id_or_name) {
    pg = addons.filter((x) => ((x.id === id_or_name || x.name === id_or_name) && (x.addon_service.name === 'alamo-postgresql' || x.addon_service.name === 'akkeris-postgresql')))[0]
  } else {
    pg = addons.filter((x) => (x.addon_service.name === 'alamo-postgresql' || x.addon_service.name === 'akkeris-postgresql'))[0]
  }
  if(!pg) {
    let attachments = await appkit.api.get(`/apps/${app}/addon-attachments`)
    let pg = null
    if(id_or_name) {
      pg = attachments.filter((x) => ((x.id === id_or_name || x.name === id_or_name) && (x.addon_service.name === 'alamo-postgresql' || x.addon_service.name === 'akkeris-postgresql')))[0]
    } else {
      pg = attachments.filter((x) => (x.addon.plan.name.startsWith('akkeris-postgresql')))[0]
    }
    if(!pg) {
      throw new Error("A postgres database could not found.")
    } else {
      throw new Error(appkit.terminal.markdown(`The database on this app is not owned by **${app}**. Try re-running the command on the owner app ***${pg.addon.app.name}***`))
    }
  }
  return pg
}

module.exports = {find}