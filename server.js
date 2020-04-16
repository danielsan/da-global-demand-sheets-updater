const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const { Client } = require('pg');
const {redshiftConfig, googleSheetsConfig, googleApiCredentials} = require('./config');
const {spreadsheetId, sheetName} = googleSheetsConfig;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'config/token.json';
let sheets;
let valueInputOption = 'RAW';

function authorizeGoogle(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function getNewToken(oAuth2Client, callback) {
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

function connectRedshift() {
    const client = new Client(redshiftConfig);
    client.connect().then(() => {
        console.log('connected at '+new Date().toLocaleString());
        client.query('SELECT * FROM custom.vw_global_demand WHERE date >= CURRENT_DATE -3 LIMIT 20')
            .then(res => {
                console.log("query done at "+new Date().toLocaleString());
                console.log(res.rows);
                client.end();
                const rows = [['date','region','country','searches']];
                for(row of res.rows){
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

function setRows(rows) {
    let values = rows;
    const resource = { values };
    sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A:D`,
        valueInputOption,
        resource,
    }, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            console.log(`${result.data.updatedCells} cells updated.`);
        }
    });
}

authorizeGoogle(googleApiCredentials, authorization => {
    sheets = google.sheets({ version: 'v4', authorization });
    connectRedshift();
});