import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import dotenv from 'dotenv';
import qrcode from 'qrcode-terminal';

dotenv.config();

console.log('Starting WhatsApp bot...');

const MY_GROUP_ID = process.env.MY_GROUP_ID;

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

// Parse relative time (5m, 2h, etc)
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

// Parse absolute date/time
function parseAbsoluteTime(dateStr: string, timeStr?: string): number | null {
    try {
        // Support formats:
        // DD-MM-YYYY HH:MM
        // DD/MM/YYYY HH:MM
        // YYYY-MM-DD HH:MM
        
        let dateTimeStr = dateStr;
        if (timeStr) {
            dateTimeStr = `${dateStr} ${timeStr}`;
        }
        
        // Try to parse various formats
        let targetDate: Date | null = null;
        
        // Format: DD-MM-YYYY HH:MM or DD/MM/YYYY HH:MM
        const dmyMatch = dateTimeStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})$/);
        if (dmyMatch) {
            const [, day, month, year, hour, minute] = dmyMatch;
            targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
        }
        
        // Format: YYYY-MM-DD HH:MM
        const ymdMatch = dateTimeStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})$/);
        if (ymdMatch) {
            const [, year, month, day, hour, minute] = ymdMatch;
            targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
        }
        
        // Format: Just date (DD-MM-YYYY), default to 9:00 AM
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
        
        // Don't allow past dates
        if (delay < 0) {
            return -1; // Special value for past dates
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
        
        // Try parsing as relative time first (5m, 2h, etc)
        delay = parseRelativeTime(parts[1]);
        
        if (delay) {
            // Relative time format
            reminderText = parts.slice(2).join(' ');
            timeDescription = parts[1];
        } else {
            // Try parsing as absolute date/time
            // Check if parts[2] looks like a time (HH:MM)
            if (parts[2] && parts[2].match(/^\d{1,2}:\d{2}$/)) {
                // Format: !remind DD-MM-YYYY HH:MM message
                delay = parseAbsoluteTime(parts[1], parts[2]);
                reminderText = parts.slice(3).join(' ');
                timeDescription = `${parts[1]} ${parts[2]}`;
            } else {
                // Format: !remind DD-MM-YYYY message (no time)
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
            await client.sendMessage(MY_GROUP_ID, `⏰ REMINDER: ${reminderText}`);
            console.log(`✅ Sent reminder`);
        }, delay);
        
        // Calculate actual time
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
