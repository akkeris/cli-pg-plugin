const proc = require('child_process')
proc.spawnSync('npm', ['install'], {cwd:__dirname, env:process.env, stdio:'ignore'})