const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
let spreadsheetId;
let sheetName;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';
let auth;
let sheets;
let valueInputOption = 'RAW';

fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content), authorization => {
        auth = authorization;
        sheets = google.sheets({ version: 'v4', auth });
        // listRows();
        setRows();
    });
});

fs.readFile('spreadsheet.json', (err, content) => {
    if (err) return console.log('Error loading spreadsheet config:', err);
    ({spreadsheetId, sheetName} = JSON.parse(content));
});


function authorize(credentials, callback) {
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

function listRows() {
    sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:B`,
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const rows = res.data.values;
        if (rows.length) {
            console.log('A, B')
            rows.map((row) => {
                console.log(`${row[0]}, ${row[1]}`);
            });
        } else {
            console.log('No data found.');
        }
    });
}

function setRows() {
    let values = [
        [
            'newA1', 'newA2'
        ]
    ];
    const resource = { values };
    sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'A:B',
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