const {google} = require('googleapis');
const { GOOGLE_API_PRIVATE_KEY } = process.env;

const keys = {
  "type": "service_account",
  "project_id": "mkbot-1567545195322",
  "private_key_id": "822100e70ea8e08c44070e91e102937b8c3e4a31",
  "private_key": GOOGLE_API_PRIVATE_KEY,
  "client_email": "mkbot-341@mkbot-1567545195322.iam.gserviceaccount.com",
  "client_id": "107404764638736410189",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/mkbot-341%40mkbot-1567545195322.iam.gserviceaccount.com"
};

console.log(keys.private_key);
const spreadSheetId ='1bhqEnq00K6udjVmAb1iDRWSg2iyaN3idfeOXAXaxwnE';

const client = new google.auth.JWT(
  keys.client_email,
  null,
  keys.private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

client.authorize(function(err, tokens){
  if(err){
    console.log(err);
    return;
  } else {
    console.log('connected');
    gsrun(client);
  }
});

async function gsrun(client){
  const gsapi = google.sheets({version:'v4', auth:client});
  const opt = {
    spreadsheetId: spreadSheetId,
    range: 'Tours!A2:G'
  };

  let data = await gsapi.spreadsheets.values.get(opt);
  let dataArray = data.data.values;

  console.log(dataArray);

  /*
  let newDataArray = dataArray.map(function(r){
    r.push(r[0] + '-'+r[1]);
    return r;
  })

  const updateOptions = {
    spreadsheetId: spreadSheetId,
    range: 'DataSheet!A2',
    valueInputOption: 'USER_ENTERED',
    resource: {values: newDataArray}
  };

  let response = await gsapi.spreadsheets.values.update(updateOptions);

  console.log(response);
  */
}
