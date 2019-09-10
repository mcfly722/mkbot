const TelegramGroupId = -382659045;
const GoogleSpreadSheetId = '1bhqEnq00K6udjVmAb1iDRWSg2iyaN3idfeOXAXaxwnE';
const ReloadDataCacheSec = 5;


const TelegramBot = require('node-telegram-bot-api');
const GoogleSpreadSheet = require('google-spreadsheet');
const {promisify} = require('util');

const { TELEGRAM_BOT_TOKEN, GOOGLE_API_PRIVATE_KEY } = process.env;

var creds = require('./googleCredentials.json');
creds.private_key = GOOGLE_API_PRIVATE_KEY;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Seems like you forgot to pass Telegram Bot Token. I can not proceed...');
  process.exit(1);
}

if (!GOOGLE_API_PRIVATE_KEY) {
  console.error('Seems like you forgot to pass Google SpreadSheet Token. I can not proceed...');
  process.exit(1);
}

var availableTours = null;
var googleSheetsInfo = null;

async function accessSpreadSheet(){
  const doc = new GoogleSpreadSheet(GoogleSpreadSheetId);
  await promisify(doc.useServiceAccountAuth)(creds);
  googleSheetsInfo = await promisify(doc.getInfo)();

  availableTours = await getAvailableTours();

  startTelegramBot(TELEGRAM_BOT_TOKEN, TelegramGroupId);
}

async function getAvailableTours(){
  const toursSheet = googleSheetsInfo.worksheets.filter(sheet => {return sheet.title === 'Tours'})[0];
  const bookingsSheet = googleSheetsInfo.worksheets.filter(sheet => {return sheet.title === 'Bookings'})[0];

  const tours = await promisify(toursSheet.getRows)({offset:1, query : 'disabled != 1'});
  const bookings = await promisify(bookingsSheet.getRows)({offset:1});

  lastCacheTime = Date.now();

  return tours.map(
    function(tour)
    {
      tour['bookings'] = bookings.filter(booking=>booking.tourid==tour.id);
      return tour;
    }
  );
}

async function bookTour(bot, chatId,  tourId ,userId, firstName, lastName){
  const bookingsSheet = googleSheetsInfo.worksheets.filter(sheet => {return sheet.title === 'Bookings'})[0];

  const booking = {
    tourId : tourId,
    userId : userId,
    firstName : firstName,
    lastName : lastName
  }

  await promisify(bookingsSheet.addRow)(booking);

  var tour = availableTours.filter(tour=>tour.id==tourId)[0];
  console.log(JSON.stringify(tour, null, 4));

  bot.sendMessage(chatId,"Вы успешно присоединились к туру '"+tour.displayname+"'", {reply_markup: {hide_keyboard: true}});
  bot.sendMessage(TelegramGroupId, booking.firstName + ' ' + booking.lastName + " присоединился к туру '"+tour.displayname+"'", {reply_markup: {hide_keyboard: true}});

}

async function unbookTour(bot, chatId, tourId, userId){
  var tour = availableTours.filter(tour=>tour.id==tourId)[0];
  var booking = tour.bookings.filter(booking=>booking.userid==userId)[0];
  booking.del();

  bot.sendMessage(chatId, "Ваша бронь тура '"+tour.displayname+"' успешно отменена", {reply_markup: {hide_keyboard: true}});
  bot.sendMessage(TelegramGroupId, booking.firstname + ' ' + booking.lastname + " отменил свое участие в туре '"+tour.displayname+"'", {reply_markup: {hide_keyboard: true}});
}


accessSpreadSheet();

var lastCacheTime = Date.now();

function startTelegramBot(token, groupId) {

  const bot = new TelegramBot(token, {
    polling: true
  });

  bot.sendMessage(TelegramGroupId, 'я снова online', {reply_markup: {hide_keyboard: true}});

  bot.on('message', async (msg) => {


    if(msg.chat.id == groupId) {
      // chat message
      if(msg.text.charAt(0) == '/') {
        bot.sendMessage(msg.chat.id, 'Unknown command: '+msg.text);
        console.log(JSON.stringify(msg,null,4));
      }
    } else {
      // personal message

      if((Date.now()-lastCacheTime)/1000 > ReloadDataCacheSec){
        console.log('updating data cache ('+(Date.now()-lastCacheTime)/1000+'sec)');
        availableTours = await getAvailableTours();
        lastCacheTime = Date.now();
      }

      switch (true){
        case /^\x2ftours/.test(msg.text):
          showAvailableTours(bot, msg.chat.id);
          break;
        case /^\x2finvite/.test(msg.text):
          console.log(JSON.stringify(msg,null,4));
          break;
        case /^\x2f[0-9]+book/.test(msg.text):
            await bookTour(bot, msg.chat.id, msg.text.match(/\d+/g)[0], msg.from.id, msg.from.first_name, msg.from.last_name);
            availableTours = await getAvailableTours();
            break;
        case /^\x2f[0-9]+unbook/.test(msg.text):
            await unbookTour(bot, msg.chat.id, msg.text.match(/\d+/g)[0], msg.from.id);
            availableTours = await getAvailableTours();
            break;
        case /^\x2f[0-9]+/.test(msg.text):
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


function showTour(bot, chatId,  tourId){
  var tour = availableTours.filter(tour=>tour.id==tourId)[0];

  var msg = 'тур с номером '+tourId+' не найден';
  if (tour != undefined) {
    msg = JSON.stringify(tour,null,4);
  }

  bot.sendMessage(
    chatId,
    msg, {
      reply_markup: {
        keyboard: [
          ['/'+tourId+'book - для данного тура я уже забранировал отпуск'],
          ['/'+tourId+'unbook - отменить свое участие в туре'],
          ['/tours - к списку туров']
        ]
      }
    }
  );
}

async function showAvailableTours(bot, chatId){
  const buttons = availableTours.map(tour => {
      return ['/'+tour.id + ' - ' + tour.displayname + ' [' + shortFormatDateRange(tour.from, tour.to) + ']  ' + tour.bookings.length+'/'+tour.peoplerequired+' чел.']
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
