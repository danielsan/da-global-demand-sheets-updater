'use strict'

const { version } = require('./package.json')
const { createLogger } = require('@everymundo/simple-logr')
const logger = createLogger(version)
const fs = require('fs')
const readline = require('readline')
const { google } = require('googleapis')
const { Client } = require('pg')
let { redshiftConfig, googleSheetsConfig, googleApiCredentials } = process.env
const { spreadsheetId, sheetName } = JSON.parse(googleSheetsConfig)
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
const TOKEN_PATH = 'token.json'
let sheets
const valueInputOption = 'RAW'

const handler = async event => {
  logger.info({ event })
  const { data: auth, error } = await authorizeGoogle(googleApiCredentials)
  if (error) {
    console.log('Error authenticating: ' + error)
    return
  }
  console.log('Google Auth done');
  sheets = google.sheets({ version: 'v4', auth })
  try {
    await connectRedshift()
  } catch (e) {
    console.log(e)
    return
  }
  return
}

const authorizeGoogle = async credentials => {
  const {
    installed: {
      client_secret: clientSecret,
      client_id: clientId,
      redirect_uris: redirectUris
    }
  } = JSON.parse(credentials)
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUris[0])
  let token
  try {
    token = fs.readFileSync(TOKEN_PATH)
  } catch (e) {
    console.log('Error reading tokens: ' + e)
  }
  if (token) {
    oAuth2Client.setCredentials(JSON.parse(token))
    return {
      data: oAuth2Client,
      error: null
    }
  } else {
    const { data: newoAuth2Client, error } = await getNewToken(oAuth2Client)
    if (error) {
      return {
        data: null,
        error: `Error grabbing new token: ${error}`
      }
    } else {
      return {
        data: newoAuth2Client,
        error: null
      }
    }
  }
}

const getNewToken = async oAuth2Client => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  })
  console.log('Authorize this app by visiting this url:', authUrl)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.question('Enter the code from that page here: ', async code => {
    rl.close()
    let token
    try {
      const { tokens } = await oAuth2Client.getToken(code)
      token = tokens
    } catch (e) {
      return {
        data: null,
        error: `Error grabbing token: ${e}`
      }
    }
    oAuth2Client.setCredentials(token)
    try {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token))
      console.log('Token stored to', TOKEN_PATH)
      return {
        data: oAuth2Client,
        error: null
      }
    } catch (e) {
      return {
        data: null,
        error: `Error writing tokens to file: ${e}`
      }
    }
  })
}

const connectRedshift = async () => {
  redshiftConfig = JSON.parse(redshiftConfig)
  const client = new Client(redshiftConfig)
  await client.connect()
  console.log('connected at ' + new Date().toLocaleString())
  let res;
  try {
    res = await client.query('SELECT * FROM custom.vw_global_demand')
  } catch (e) {
    client.end()
    return console.log(`Query failed! ${e.stack}`)
  }
  console.log('query done at ' + new Date().toLocaleString())
  client.end()
  const rows = [['date', 'region', 'country', 'searches']]
  for (const row of res.rows) {
    rows.push([row.date, row.region, row.country, row.searches])
  }
  try {
    await setRows(rows)
  } catch (e) {
    return console.log(`Error setting rows: ${e}`)
  }
  return
}

const setRows = async rows => {
  const values = rows
  const resource = { values }
  let result
  try {
    result = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A:D`,
      valueInputOption,
      resource
    })
  } catch (e) {
    return console.log(`Error updating spreadsheet: ${e}`)
  }
  if (result) {
    return console.log(`${result.data.updatedCells} cells updated.`)
  }
}

module.exports = { handler }
