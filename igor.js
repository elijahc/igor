var _           = require('underscore');
var sys         = require('sys');
var optparse    = require('optparse');
var Bot         = require('ttapi');
var CleverBot   = require('./lib/cleverbot');

//TODO: find a way to get bot name from tt
var botname
var casino_on       = false;
var talked_to_last  = false;
var chat_timeout    = false;
var grind           = false;
var djs_on_deck     = [];
var timers          = [];
var users           = [];
var laptops         = ['linux', 'mac', 'pc', 'chrome' ]
var autobop         = false;
var mods            = {'4fe4db76aaa5cd0a6b000040':'Jamas'}
var sudoers         = {'4fb188d7aaa5cd0950000107': 'DJJarvis', '4e99db8d4fe7d059f7079f56':'ECHRIS', '4f9b0715aaa5cd2af40001e4':'A Tree'}
var creds
var current_song
var current_dj
var last_dj

var switches        = [
    ['-c', '--creds FILE', 'Credentials you want the bot to connect with'],
    ['-r', '--room FILE', 'Room to go too'],
    ['-v', '--verbose', 'verbose mode'],
]

var parser = new optparse.OptionParser(switches);

parser.on('room', function(name, value){
    room = require('./'+value)
})

parser.on('creds', function(name, value){
    creds = require('./'+value)
})

parser.on('verbose', function(name, value){
    bot.debug = true;
})

parser.parse(process.argv)

// Options that depend on cmd line args
var botname         = creds.name
var AUTH            = creds.AUTH
var USERID          = creds.USERID
var ROOMID          = room.ROOMID
var cbot_rgx        = new RegExp('@?'+botname+' ?(.+)?\\??')
var get_off_rgx     = new RegExp(botname+', you played your song,')

var CBot = new CleverBot;
var bot  = new Bot(AUTH, USERID, ROOMID)

//bot.debug = true

// ### BASIC Bot functionality ### //
bot.on('newsong', function(data){
    if ( data.room.metadata.current_dj != USERID ){

        // song is someone elses
        if ( autobop == true ){
            safe_wait = Math.random()*60000
            console.log('bopping in '+(safe_wait/1000)+' seconds')
            setTimeout(function(){console.log('bopping now'); bot.bop();}, safe_wait);
        } else if ( grind == true ){
            // grind mode is on, randomly vote
            if ( Math.round( Math.random() ) ){
                bot.bop();
            }
        }

    } else {
        //song is my song, skip it
        if (!grind) { bot.skip(); }
    }

});

bot.on( 'roomChanged', function(data) {
    // randomize laptop
    bot.modifyLaptop(laptops[Math.round(Math.random()*4)])
});

bot.on('speak', function(data){
    username=data.name;

    //We don't care what the bot says
    if (data.userid != USERID ) {

        if (data.text.match(/please type roll for a spot/g) ){
            setTimeout(function(order, data, pm){
                command(order, data, pm)
            }, Math.random()*10000, 'say roll', data, false )
        }

        if (data.text.match(get_off_rgx) ){
            setTimeout(function(){
                bot.remDj()
            }, Math.random()*3000 )
        }

        if (data.text.match(i_won_rgx)) {
            bot.addDj();
        }

        if ( data.userid != getUserByName('DJJarvis').userid ) {
            // If the bot doesn't get a command check if someone asked it a direct question
            if ( data.text.match(cbot_rgx) || talked_to_last === data.userid ) {
                var question;
                if (talked_to_last == data.userid) {
                    question = data.text;
                } else {
                    question = data.text.match(cbot_rgx)[1];
                    console.log('now talking to '+getUserById(data.userid).name)
                    talked_to_last = data.userid;
                }
                CBot.write(question, function callback(resp){
                    console.log(question, ' : ', resp['message'])
                    bot.speak(resp['message'])
                });
                if ( chat_timeout ) {
                    clearTimeout(chat_timeout);
                }
                chat_timeout = setTimeout(function(){console.log('talking timeout'); talked_to_last = false}, 45000)
            }
        }
    }
})

bot.on('pmmed', function(data){
    console.log(botname+' pmmed by '+ getUserById(data.senderid).name)
    //Expect name to be left out
    command(data.text, data, true)
});


// ### COMMANDS ### //
function command( order, data, pm ) {
    console.log( 'Command: '+order )

    if ( pm ) {
        userid = data.senderid
    } else {
        userid = data.userid
    }

    // SUDO level commands
    if ( _.has( sudoers, userid ) ){
        if (order.match(/^say (.+)/)) {
           words = order.match(/^say (.+)/)[1];
           bot.speak( words );
        }

        if (order.match(/^grind (on|off)$/)) {
            toggle = order.match(/grind (on|off)$/)[1]
            switch (toggle) {
                case 'on':
                    bot.addDj()
                    grind   = true;
                    break;
                case 'off':
                    bot.remDj();
                    grind   = false;
                    break;
            }
        }

    //  MOD level commands
    if ( _.has( mods, userid ) || _.has( sudoers, userid )) {
        if (order.match(/(^upboat|^awesome|^upvote|^kiss my ass|^dance)/)){
            if (!pm) {bot.speak('roger that'); }
            bot.bop();
        }

        if (order.match(/^downvote|^lame|^hate on this/)){
            if (!pm ) { bot.speak('this sucks'); }
            bot.vote('down');
        }

        if (order.match(/^pm (.+)/)) {
            com = order.match(/^pm (.+) "(.+)"/)
            bot.pm(com[2], getUserByName(com[1]).userid)
        }

        if (order.match(/^heart$/)) {
            bot.snag()
            bot.playlistAdd( current_song._id )
        }

        if (order.match(/^wingman/)){
            bot.bop();
            if ( !pm ) { bot.speak('I got your back bro'); }
            bot.addDj();
            autobop = true;
        }

        if (order.match(/^autobop|^kiss my ass/)){
            autobop==true;
            bot.bop();
        }

        if (order.match(/^get off$/)){
            if ( !pm ){ bot.speak('ok.... :('); }
            autobop = false;
            grind   = false;
            bot.remDj();
        }
    }
}

function getUserByName(name){
    for (index in users){
        if (users[index].name === name) {
            return users[index];
        }
    }
}

function getUserById(userId){
    for (index in users){
        if (users[index].userid === userId) {
            return users[index];
        }
    }
}
