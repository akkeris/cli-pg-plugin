'use strict'

const path = require('path')
const fs = require('fs')

let dir = path.join(__dirname, 'commands')

module.exports = {
  init:function(appkit) {
    fs.readdirSync(dir)
      .filter(f => path.extname(f) === '.js')
      .map(f => require('./commands/' + f).init(appkit))
  },
  update:function() {},
  'group':'pg',
  'help':'manage postgres databases',
  'primary':false
} 

