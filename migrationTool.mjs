import * as fs from 'fs/promises'
import * as path from 'path'
import * as process from 'process'
import {authenticate} from '@google-cloud/local-auth'
import {google} from 'googleapis'
import {graphClient} from './auth.mjs'
import { createHash } from 'crypto'
 
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

// initalize token
const goClient = await authorize();

// initialize drive client
const drive = google.drive({version: 'v3', auth: goClient});


//APAGAR POSTERIORMENTE**********
// Realizando a chamada de método do endpoint files com um request body incluindo "orderBy":
// (
//   await drive.files.list({
//   orderBy: 'name'
//   })
// ).data.files
// Paginação de dados!
// await drive.files.list({
//   pageToken: //prox. token 
// });


// let callFile = await drive.files.get({
//     alt: 'media',
//     fileId: '1dVtNYgzYrzLRGwnG_Xn-UAdnW3x1oqLH'
// },{responseType: 'arraybuffer'})



// const buffer = new Buffer.from(callFile.data);

//await graphClient.api('users/suporte02@grupounus.com.br/drive/root:/teste_arquivo7.exe:/content').put(buffer);
//********************************** */

// OD user and Sharepoint ID - MANUALLY SPECIFIED
const user = "suporte02@grupounus.com.br";
const sharepointId = 'unusholding.sharepoint.com,20458ae6-e65e-440a-8730-0ab4c7426b84,aeef9a9b-d2b5-4d4b-bde7-703fe986f4b7';

// getting the GD username to use it on the backup folder name
const userCall = await drive.about.get({fields: 'user'});
const username = userCall.data.user.emailAddress.slice(0, userCall.data.user.emailAddress.indexOf('@'));

// returns a list with only user-created files, and its necessary fields
async function createList(id){
  const list = await drive.files.list({
    q: 'trashed = false and \''+ `${id}` +'\' in parents',
    includeItemsFromAllDrives: false,
    fields: 'files(mimeType,id,name,owners)'
  });
  return list;
}

// receives a files owners list and returns true if user is within
function isUserOwner(owners){
  let isOwner;
  for(let i = 0; i < owners.length; i++){
    isOwner = userCall.data.user.emailAddress == owners[i].emailAddress;
    if(isOwner == true){
      break;
    }
  }
  return isOwner;
}


// **************************
// TODO: DATA PAGINATION
// **************************
// PROBLEM: How could i handle the owner's files that are within another person's folder?
// ANSWER: Erase ownership verification for folders, so files within may be checked for ownership as well. Migrate only files with
// the given owners. Migrate to Sharepoint.

// this could have been a switch case...
// no it couldn't! too many conditionals.
async function migrationLoop(call, currentFolder){ // call refers to the GD list, and currentFolder refers to the current drive folder id
  for(let i = 0; i < call.data.files.length; i++){

      if(call.data.files[i].mimeType == 'application/vnd.google-apps.folder'){     //if it's a folder:
        //create folder in OD
        const response = await graphClient.api(`sites/${sharepointId}/drive/items/${currentFolder}/children`).post({
          name: `${call.data.files[i].name}`,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        });

        //RECURSIVELY search folder while synced in GD and OD
        await migrationLoop(await createList(call.data.files[i].id), response.id);

      } else if(call.data.files[i].mimeType == 'application/vnd.google-apps.spreadsheet' && isUserOwner(call.data.files[i].owners)){ //else if it's a spreadsheet, export it
          const docCall = await drive.files.export({
            fileId: call.data.files[i].id,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }, {responseType: 'arraybuffer'});
          const gdDocBuffer = new Buffer.from(docCall.data);
          await graphClient.api(`sites/${sharepointId}/drive/items/${currentFolder}:/${call.data.files[i].name}.xlsx:/content`)
          .put(gdDocBuffer);


      } else if(call.data.files[i].mimeType == 'application/vnd.google-apps.document' && isUserOwner(call.data.files[i].owners)){ //else if it's a gdoc, export it
        const docCall = await drive.files.export({
          fileId: call.data.files[i].id,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }, {responseType: 'arraybuffer'});
        const gdDocBuffer = new Buffer.from(docCall.data);
        await graphClient.api(`sites/${sharepointId}/drive/items/${currentFolder}:/${call.data.files[i].name}.docx:/content`)
        .put(gdDocBuffer);

      } else if(isUserOwner(call.data.files[i].owners)) {  //else if it's a generic file from the user, get it
          try{
            const callFile = await drive.files.get({
                alt: 'media',
                fileId: `${call.data.files[i].id}`
            },{responseType: 'arraybuffer'});
            const gdBuffer = new Buffer.from(callFile.data);
            await graphClient.api(`sites/${sharepointId}/drive/items/${currentFolder}:/${call.data.files[i].name}:/content`)
            .put(gdBuffer);
        } catch(error){ // error handling: if the file is of incompatible format or the exporting/importing fails, warn about file, then continue
            console.log('ERRO: A migração será continuada, e o arquivo \"' + `${call.data.files[i].name}` + '\" não será importado.');
            continue;
        }
      }
   }
}

// const gdDriveRootList = await createList('root');
// const backupFolderId = (await graphClient.api(`sites/${sharepointId}/drive/items/root/children`).post({
//   name: `backup_${username}`,
//   folder: {},
//   '@microsoft.graph.conflictBehavior': 'rename'
// })).id;
// migrationLoop(gdDriveRootList, backupFolderId);

// ********************************************************

// 14Y-FLzRJqQBYQ0lf6_-WxPoDtIkNgLsL


await drive.files.create({
  requestBody:{
    data: ''
  }
});

