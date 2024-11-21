import * as process from 'process'
import * as gapi from 'googleapis'
import * as fs from 'node:fs/promises';
import * as path from 'path';

const CLIENT_CRENTIALS = path.join(process.cwd(), "credentials.json");
const credentialsFile = JSON.parse(await fs.readFile(CLIENT_CRENTIALS, {encoding: 'utf-8'}));


const oauth2Client = new gapi.google.auth.OAuth2(
    credentialsFile.web.client_id,
    credentialsFile.web.client_secret,
    'http://localhost:3000/oauth2callback'
  );
  
  // generate a url that asks permissions for Blogger and Google Calendar scopes
  const scopes = [
    'https://www.googleapis.com/auth/drive'
  ];
  
  const url = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: 'offline',
  
    // If you only need one scope, you can pass it as a string
    scope: scopes
  });

  console.log(url);
