'use strict'

const { version } = require('./package.json')
const { createLogger } = require('@everymundo/simple-logr')
const logger = createLogger(version)

const handler = async (event) => {
  // Start here!
  logger.info({ event })
}

module.exports = { handler }
