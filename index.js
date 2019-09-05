const TelegramBot = require('node-telegram-bot-api');
const {
  google
} = require('googleapis');


function shortFormatDateRange(from, to) {
  const months = ['янв.', 'фев.', 'марта', 'апр.', 'майя', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'ноября', 'дек.'];

  const _from = {
    year: Number.parseInt(from.split('-')[0]),
    month: Number.parseInt(from.split('-')[1]),
    day: Number.parseInt(from.split('-')[2])
  };

  const _to = {
    year: Number.parseInt(to.split('-')[0]),
    month: Number.parseInt(to.split('-')[1]),
    day: Number.parseInt(to.split('-')[2])
  };

  if (_from.year == _to.year) {
    if (_from.month == _to.month) {
      return (_from.day + '-' + _to.day + ' ' + months[_from.month - 1] + ' ' + _from.year);
    } else {
      return (_from.day + ' ' + months[_from.month - 1] + '-' + _to.day + ' ' + months[_to.month - 1] + ' ' + _to.year);
    }
  }
  return (_from.day + ' ' + months[_from.month - 1] + ' ' + _from.year + ' - ' + _to.day + ' ' + months[_to.month - 1] + ' ' + _to.year);
}

const {
  TELEGRAM_BOT_TOKEN,
  GOOGLE_API_PRIVATE_KEY
} = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Seems like you forgot to pass Telegram Bot Token. I can not proceed...');
  process.exit(1);
}

if (!GOOGLE_API_PRIVATE_KEY) {
  console.error('Seems like you forgot to pass Google SpreadSheet Token. I can not proceed...');
  process.exit(1);
}

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

const spreadSheetId = '1bhqEnq00K6udjVmAb1iDRWSg2iyaN3idfeOXAXaxwnE';

const googleClient = new google.auth.JWT(
  keys.client_email,
  null,
  keys.private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

googleClient.authorize(function(err, tokens) {
  if (err) {
    console.log(err);
    return;
  } else {
    console.log('google spreadsheet connected');
    gsrun(googleClient);
  }
});


async function getTours(gsapi) {
  const opt = {
    spreadsheetId: spreadSheetId,
    range: 'Tours!A2:H'
  };
  let data = await gsapi.spreadsheets.values.get(opt);
  return data.data.values;
}


async function gsrun(googleClient) {
  const gsapi = google.sheets({
    version: 'v4',
    auth: googleClient
  });

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
    polling: true
  });

  bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    getTours(gsapi).then((resolve, reject) => {

      const buttons = resolve.map(tour => {
        return [tour[0] + '? - ' + tour[1] + ' [' + shortFormatDateRange(tour[2], tour[3]) + ']']
      });

      var tourId = Number.parseInt(msg.text.split("?")[0].trim());
      if (!isNaN(tourId)) {

        bot.sendMessage(
          chatId,
          'Выбран тур ' + tourId, {
            reply_markup: {
              keyboard: [
                [tourId + '! - указать что на даты тура мной также забронирован отпуск'],
                ['? - вернуться к списку туров'],
              ]
            }
          }
        );

      } else {
        bot.sendMessage(
          chatId,
          'Привет! Доступны следущие туры:', {
            reply_markup: {
              keyboard: buttons
            }
          }
        );
      }

      //console.log(JSON.stringify(buttons));
      //console.log(JSON.stringify(msg));


    });

  });

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

console.log('telegram bot started');

// for heroku, otherwise script would be unloaded
require('http').createServer().listen(process.env.PORT || 5000).on('request', function(req, res) {
  res.end('')
})
