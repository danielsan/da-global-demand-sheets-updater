# Introduction
This repo serves the purpose of hosting the node script that updates a Google Sheet with data from Redshift for the purpose of having Tableau read from the sheet to automatically update the data.

## Installation
Use the package manager [NPM](https://www.npmjs.com/get-npm) to install all the dependencies.
```bash
$ npm i
```

## Prereqs
Before being able to run the script, you need to make sure you have two JSON files in the `/config` folder. The two scripts are: `index.json` and `token.json`. `index.json` should contain all the config properties and credentials for Redshift, Google Sheets, and the Google API. `token.json` will contain the auth token to use with the Google API.

## Usage
To run the script simply run this command in your terminal:
```bash
$ node .
```
---
## Support
For any other questions or support while using this repo please reach out to the Data Analytics team at <data.analytics@everymundo.com>