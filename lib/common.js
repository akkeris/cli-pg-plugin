async function find(appkit, app, id_or_name) {
  let addons = await appkit.api.get(`/apps/${app}/addons`)
  let pg = null
  if(id_or_name) {
    pg = addons.filter((x) => ((x.id === id_or_name || x.name === id_or_name) && (x.addon_service.name === 'alamo-postgresql' || x.addon_service.name === 'akkeris-postgresql')))[0]
  } else {
    pg = addons.filter((x) => (x.addon_service.name === 'alamo-postgresql' || x.addon_service.name === 'akkeris-postgresql'))[0]
  }
  if(!pg) {
    throw new Error("A postgres database could not found.")
  }
  return pg
}

module.exports = {find}