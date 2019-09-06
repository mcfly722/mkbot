const TelegramGroupId = -382659045;
const GoogleSpreadSheetId = '1bhqEnq00K6udjVmAb1iDRWSg2iyaN3idfeOXAXaxwnE';

const TelegramBot = require('node-telegram-bot-api');
const GoogleSpreadSheet = require('google-spreadsheet');
const {promisify} = require('util');

const { TELEGRAM_BOT_TOKEN, GOOGLE_API_PRIVATE_KEY } = process.env;

var creds = require('./googleCredentials.json');
creds.private_key = GOOGLE_API_PRIVATE_KEY;


//const { google } = require('googleapis');


if (!TELEGRAM_BOT_TOKEN) {
  console.error('Seems like you forgot to pass Telegram Bot Token. I can not proceed...');
  process.exit(1);
}

if (!GOOGLE_API_PRIVATE_KEY) {
  console.error('Seems like you forgot to pass Google SpreadSheet Token. I can not proceed...');
  process.exit(1);
}


async function accessSpreadSheet(){
  const doc = new GoogleSpreadSheet(GoogleSpreadSheetId);
  await promisify(doc.useServiceAccountAuth)(creds);
  const info = await promisify(doc.getInfo)();

  var toursSheet = info.worksheets.filter(sheet => {return sheet.title === 'Tours'})[0];
  var bookingSheet = info.worksheets.filter(sheet => {return sheet.title === 'Bookings'})[0];

  startTelegramBot(toursSheet, bookingSheet);
}

accessSpreadSheet();




function startTelegramBot(toursSheet, bookingSheet) {

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
    polling: true
  });

  bot.on('message', (msg) => {

    if(msg.chat.id == TelegramGroupId) {
      // chat message
      if(msg.text.charAt(0) == '/') {
        bot.sendMessage(msg.chat.id, 'Unknown command: '+msg.text);
        console.log(JSON.stringify(msg,null,4));
      }
    } else {
      // personal message

      switch (true){
        case /^\x2ftours/.test(msg.text):
          showAvailableTours(bot, msg.chat.id, toursSheet);
          break;
        case /^\x2finvite/.test(msg.text):
          console.log(JSON.stringify(msg,null,4));
          break;
        case /^\x2f[0-9]+\x3f/.test(msg.text):
          showTour(bot, msg.chat.id, msg.text.match(/\d+/g)[0]);
          break;
        default:
          bot.sendMessage(msg.chat.id,'список доступных команд можно посмотреть набрав /',{reply_markup: {hide_keyboard: true}});
      }
    }
  });

  console.log('telegram bot started');

  // for heroku, otherwise script would be unloaded
  require('http').createServer().listen(process.env.PORT || 5000).on('request', function(req, res) {
    res.end('')
  });

}

async function showTour(bot, chatId, tourId){
  bot.sendMessage(
    chatId,
    'info about tour#'+tourId, {
      reply_markup: {
        keyboard: []
      }
    }
  );
}

async function showAvailableTours(bot, chatId, toursSheet){
  const tours = await promisify(toursSheet.getRows)({offset:1});

  const buttons = tours.map(tour => {
      return ['/'+tour.id + '? - ' + tour.displayname + ' [' + shortFormatDateRange(tour.from, tour.to) + ']']
  });

  bot.sendMessage(
    chatId,
    'доступны следущие туры:', {
      reply_markup: {
        keyboard: buttons
      }
    }
  );

}

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
