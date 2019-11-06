process.env.NTBA_FIX_319 = 1;

const ReloadDataCacheSec = 5;

const TelegramBot = require('node-telegram-bot-api');
const GoogleSpreadSheet = require('google-spreadsheet');
const {promisify} = require('util');

const { TELEGRAM_BOT_TOKEN, GOOGLE_API_TOKEN, GOOGLE_SPREADSHEET_ID} = process.env;

if (!GOOGLE_API_TOKEN) {
  console.error('Seems like you forgot to pass Google SpreadSheet Token. I can not proceed...');
  process.exit(1);
}

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Seems like you forgot to pass Telegram Bot Token. I can not proceed...');
  process.exit(1);
}

async function getAvailableGroups(){
  const groupsSheet = googleSheetsInfo.worksheets.filter(sheet => {return sheet.title === 'Groups'})[0];
  const groups = await promisify(groupsSheet.getRows)({offset:1, query : 'disabled != 1'});

  return groups.reduce(function(map,obj){
    map[obj.id] = {'title': obj.title, 'description': obj.description};
    return map;
  },{});
}

async function addNewGroup(group){
  const groupsSheet = googleSheetsInfo.worksheets.filter(sheet => {return sheet.title === 'Groups'})[0];
  await promisify(groupsSheet.addRow)(group);
  console.log("new group recoded:" + JSON.stringify(group));
}



var availableGroups = null;
var googleSheetsInfo = null;

async function accessSpreadSheet(){
  const doc = new GoogleSpreadSheet(GOOGLE_SPREADSHEET_ID);
  await promisify(doc.useServiceAccountAuth)(JSON.parse(GOOGLE_API_TOKEN));
  googleSheetsInfo = await promisify(doc.getInfo)();

  availableGroups = await getAvailableGroups();

  startTelegramBot(TELEGRAM_BOT_TOKEN);
}

async function bookUser(bot, groupId, reply2message, user) {
  const bookingsSheet = googleSheetsInfo.worksheets.filter(sheet => {return sheet.title === 'Bookings'})[0];

  const booking = {
		groupId : groupId,
		userId : user.id,
		firstName : user.first_name,
		lastName : user.last_name
	};

  const bookings = await promisify(bookingsSheet.getRows)({offset:1});

  var existingBooking = bookings.filter(b=>b.userid==booking.userId && b.groupid==booking.groupId)[0];

  if(existingBooking == undefined) {
  	await promisify(bookingsSheet.addRow)(booking);
    bot.sendMessage(groupId,"записал тебя в участники", {reply_to_message_id:reply2message, reply_markup: {hide_keyboard: true}});
  } else {
    bot.sendMessage(groupId,"ты уже в участниках", {reply_to_message_id:reply2message, reply_markup: {hide_keyboard: true}});
  }
};

async function unbookUser(bot, groupId, reply2message, user) {
  const bookingsSheet = googleSheetsInfo.worksheets.filter(sheet => {return sheet.title === 'Bookings'})[0];

  const bookings = await promisify(bookingsSheet.getRows)({offset:1});

  var existingBooking = bookings.filter(b=>b.userid==user.id && b.groupid == groupId)[0];

  if(existingBooking == undefined) {
    bot.sendMessage(groupId,"тебя нет в участниках", {reply_to_message_id:reply2message, reply_markup: {hide_keyboard: true}});
  } else {
    existingBooking.del();
    bot.sendMessage(groupId,"удалил тебя из участников", {reply_to_message_id:reply2message, reply_markup: {hide_keyboard: true}});
  }
};

var lastCacheTime = Date.now();

function startTelegramBot(token) {
  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
    polling: true
  });

  bot.on('message', async (msg) => {

    if((Date.now()-lastCacheTime)/1000 > ReloadDataCacheSec){
      console.log('updating data cache ('+(Date.now()-lastCacheTime)/1000+'sec)');
      availableGroups = await getAvailableGroups();
      lastCacheTime = Date.now();
    }

    if (msg.chat != undefined && msg.chat.type != undefined) {

      if(msg.chat.type == 'group' || msg.chat.type == 'supergroup') {
        // group or supergroup

        if(!Object.keys(availableGroups).includes(msg.chat.id.toString())){

          console.log(msg);

          const group = {
            Id : msg.chat.id.toString(),
            Title : msg.chat.title,
            disabled : 0
          }

          availableGroups[group.Id] = group;
          await addNewGroup(group);
          availableGroups = await getAvailableGroups();

          console.log("current groups:" + JSON.stringify(Object.keys(availableGroups)));
        }
	      
        if(msg.text == '+' || msg.text == '+1') {
          bookUser(bot,msg.chat.id.toString(),msg.message_id, msg.from);
        }

        if(msg.text == '-' || msg.text == '-1') {
          unbookUser(bot,msg.chat.id.toString(),msg.message_id, msg.from);
        }
        console.log(msg);
      }

      if(msg.chat.type == 'bot_command' || msg.chat.type == 'private') {
        if(msg.text == '/groups') {

          const bookingsSheet = googleSheetsInfo.worksheets.filter(sheet => {return sheet.title === 'Bookings'})[0];
          const bookings = await promisify(bookingsSheet.getRows)({offset:1});

          Object.keys(availableGroups).forEach(async function (current){
            try {
              const inviteLink = await bot.exportChatInviteLink(current);
              if (inviteLink != '') {
                  var participants = "";
                  bookings.filter(booking=> booking.groupid == current).forEach(function(booking, index){
                    participants += (index+1).toString()+') <a href="tg://user?id='+booking.userid+'">'+booking.firstname+' '+booking.lastname+'</a>\n';
                  });
		  
		  var groupDescription = 'Группа: <a href="'+inviteLink+'">' + availableGroups[current].title + '</a>\n';
		  
		  if(availableGroups[current].description){
		    groupDescription += availableGroups[current].description+'\n';
		  }
		      
		  if(participants){
		    groupDescription += 'Участники:\n' + participants;
		  } else {
		    groupDescription += '(Пока нет участников)';
		  }
		  
		  console.log(JSON.stringify(availableGroups[current]));
		      
                  bot.sendMessage(msg.chat.id, groupDescription, {parse_mode: 'HTML', reply_markup: {hide_keyboard: true}});
              }
            } catch (e){console.log(current+':'+e);};
          });
        }
      }
    }
  });

  console.log('telegram bot started');

  // for heroku, otherwise script would be unloaded
  require('http').createServer().listen(process.env.PORT || 5000).on('request', function(req, res) {
    res.end('')
  });
}

accessSpreadSheet();
