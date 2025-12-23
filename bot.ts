import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import dotenv from 'dotenv';
import qrcode from 'qrcode-terminal';

dotenv.config();

console.log('Starting WhatsApp bot...');

const MY_GROUP_ID = process.env.MY_GROUP_ID;
const MY_PHONE_NUMBER = process.env.MY_PHONE_NUMBER;

if (!MY_GROUP_ID || !MY_PHONE_NUMBER) {
    console.error('❌ Missing environment variables! Check your .env file.');
    console.error('Required: MY_GROUP_ID and MY_PHONE_NUMBER');
    process.exit(1);
}


const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

client.on('qr', (qr) => {
    console.log('QR Code:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('✅ Authenticated');
});

client.on('ready', () => {
    console.log('✅ Bot is ready!');
});

function parseRelativeTime(timeStr: string): number | null {
    const match = timeStr.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    if (unit === 's') return value * 1000;
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    if (unit === 'd') return value * 24 * 60 * 60 * 1000;
    return null;
}

function parseAbsoluteTime(dateStr: string, timeStr?: string): number | null {
    try {
        let dateTimeStr = dateStr;
        if (timeStr) {
            dateTimeStr = `${dateStr} ${timeStr}`;
        }
        
        let targetDate: Date | null = null;
        
        const dmyMatch = dateTimeStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})$/);
        if (dmyMatch) {
            const [, day, month, year, hour, minute] = dmyMatch;
            targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
        }
        
        const ymdMatch = dateTimeStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})$/);
        if (ymdMatch) {
            const [, year, month, day, hour, minute] = ymdMatch;
            targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
        }
        
        const dateOnlyMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (dateOnlyMatch && !timeStr) {
            const [, day, month, year] = dateOnlyMatch;
            targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 9, 0);
        }
        
        if (!targetDate || isNaN(targetDate.getTime())) {
            return null;
        }
        
        const now = new Date();
        const delay = targetDate.getTime() - now.getTime();
        
        if (delay < 0) {
            return -1; 
        }
        
        return delay;
    } catch (error) {
        return null;
    }
}

client.on('message_create', async (msg) => {
    if (msg.from !== MY_GROUP_ID) {
        return;
    }
    
    console.log('---');
    console.log('Body:', msg.body);
    
    if (!msg.body.startsWith('!')) {
        console.log('⏭️ Not a command');
        return;
    }
    
    console.log(`🤖 Processing command: ${msg.body}`);
    
    if (msg.body === '!ping') {
        await msg.reply('pong! 🏓');
        console.log('✅ Replied with pong');
    }
    
    if (msg.body.startsWith('!remind')) {
        const parts = msg.body.split(' ');
        
        if (parts.length < 3) {
            await msg.reply(
                '❌ Usage:\n' +
                '*Relative time:* !remind 5m message\n' +
                '*Absolute time:* !remind 25-12-2024 10:30 message\n' +
                '*Just date:* !remind 25-12-2024 message (defaults to 9 AM)\n\n' +
                'Time units: s, m, h, d\n' +
                'Date formats: DD-MM-YYYY or DD/MM/YYYY'
            );
            return;
        }
        
        let delay: number | null = null;
        let reminderText: string;
        let timeDescription: string;
        
        delay = parseRelativeTime(parts[1]);
        
        if (delay) {
            reminderText = parts.slice(2).join(' ');
            timeDescription = parts[1];
        } else {

            if (parts[2] && parts[2].match(/^\d{1,2}:\d{2}$/)) {
                delay = parseAbsoluteTime(parts[1], parts[2]);
                reminderText = parts.slice(3).join(' ');
                timeDescription = `${parts[1]} ${parts[2]}`;
            } else {
                delay = parseAbsoluteTime(parts[1]);
                reminderText = parts.slice(2).join(' ');
                timeDescription = `${parts[1]} at 9:00 AM`;
            }
        }
        
        if (!delay) {
            await msg.reply('❌ Invalid time/date format. Examples:\n!remind 5m message\n!remind 25-12-2024 10:30 message');
            return;
        }
        
        if (delay === -1) {
            await msg.reply('❌ Cannot set reminder in the past!');
            return;
        }
        
        if (!reminderText.trim()) {
            await msg.reply('❌ Reminder message cannot be empty!');
            return;
        }
        
        await msg.reply(`✅ Reminder set for ${timeDescription}: "${reminderText}"`);
        
        setTimeout(async () => {
            await client.sendMessage(MY_PHONE_NUMBER, `⏰ REMINDER: ${reminderText}`);
            console.log(`✅ Sent reminder to phone`);
        }, delay);
        
        const targetTime = new Date(Date.now() + delay);
        console.log(`⏰ Reminder scheduled: ${reminderText} at ${targetTime.toLocaleString()}`);
    }
    
    if (msg.body === '!help') {
        await msg.reply(
            '🤖 *Personal Bot Commands*\n\n' +
            '!ping - Test if bot is working\n\n' +
            '!remind - Set a reminder\n' +
            '  *Relative time:*\n' +
            '  !remind 30s test\n' +
            '  !remind 5m drink water\n' +
            '  !remind 2h meeting prep\n' +
            '  !remind 1d call mom\n\n' +
            '  *Absolute date/time:*\n' +
            '  !remind 25-12-2024 10:30 Christmas party\n' +
            '  !remind 25/12/2024 14:00 event\n' +
            '  !remind 31-12-2024 New Year (defaults 9 AM)\n\n' +
            '!help - Show this message'
        );
    }
});

client.initialize();
