'use strict'

const { version } = require('./package.json');
const { createLogger } = require('@everymundo/simple-logr');
const logger = createLogger(version);
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const { Client } = require('pg');
let { redshiftConfig, googleSheetsConfig, googleApiCredentials } = process.env;
const {spreadsheetId, sheetName} = JSON.parse(googleSheetsConfig);
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';
let sheets;
let valueInputOption = 'RAW';


const handler = async event => {
  logger.info({ event });
  authorizeGoogle(googleApiCredentials, auth => {
    sheets = google.sheets({ version: 'v4', auth});
    connectRedshift();
});
}

const authorizeGoogle = (credentials, callback) => {
  const { installed: {client_secret, client_id, redirect_uris} } = JSON.parse(credentials);
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getNewToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
  });
}

const getNewToken = (oAuth2Client, callback) => {
  const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
          if (err) return console.error('Error while trying to retrieve access token', err);
          oAuth2Client.setCredentials(token);
          // Save the token to file
          fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
              if (err) return console.error(err);
              console.log('Token stored to', TOKEN_PATH);
          });
          callback(oAuth2Client);
      });
  });
}

const connectRedshift = () => {
  redshiftConfig = JSON.parse(redshiftConfig);
  const client = new Client(redshiftConfig);
  client.connect().then(() => {
      console.log('connected at '+new Date().toLocaleString());
      client.query('SELECT * FROM custom.vw_global_demand')
          .then(res => {
              console.log("query done at "+new Date().toLocaleString());
              client.end();
              const rows = [['date','region','country','searches']];
              for(const row of res.rows){
                  rows.push([row.date, row.region, row.country, row.searches])
              }
              setRows(rows);
          })
          .catch(e => {
              console.log("query failed!");
              console.log(e.stack);
              client.end();
          })
      })
      .catch (error => {
      console.log(error)
  });
}

const setRows = rows => {
  let values = rows;
  const resource = { values };
  sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A:D`,
      valueInputOption,
      resource,
  }, (err, result) => {
      if (err) {
          console.log(`Error updating google sheet: ${err}`);
      } else {
          console.log(`${result.data.updatedCells} cells updated.`);
      }
  });
}

module.exports = { handler }
