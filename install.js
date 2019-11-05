const proc = require('child_process')
const isWindows = process.platform === 'win32'
proc.spawnSync('npm', ['install'], {cwd:__dirname, env:process.env, stdio:'ignore', shell: isWindows || undefined})