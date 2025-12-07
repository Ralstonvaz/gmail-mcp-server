/**
 * Scheduled tasks for Gmail MCP Server
 */

import * as cron from 'node-cron';
import type { ImapClient } from './email/imap-client.js';
import { formatEmailList } from './utils/formatters.js';

export interface ScheduleConfig {
  enabled: boolean;
  times: string[]; // Format: "HH:mm" (e.g., "15:00", "19:00")
  timezone?: string;
}

/**
 * Parse time string (HH:mm) to cron expression
 */
function timeToCronExpression(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time format: ${time}. Expected format: HH:mm`);
  }
  return `${minutes} ${hours} * * *`; // Every day at HH:mm
}

/**
 * Fetch unread emails from last 24 hours
 */
async function fetchUnreadEmailsFromLast24Hours(imapClient: ImapClient): Promise<void> {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dateStr = yesterday.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).replace(/\s/g, '-');
    
    // IMAP search criteria: UNSEEN and SINCE date
    const searchCriteria = ['UNSEEN', ['SINCE', dateStr]];
    
    console.log(`\n📧 [${new Date().toISOString()}] Scheduled task: Fetching unread emails from last 24 hours...`);
    
    const emails = await imapClient.listEmails({
      searchCriteria,
      limit: 50,
    });
    
    if (emails.length === 0) {
      console.log(`✅ No unread emails found from the last 24 hours.`);
      return;
    }
    
    console.log(`\n📊 Summary: Found ${emails.length} unread email(s) from the last 24 hours:`);
    console.log(formatEmailList(emails));
    
    // Log structured data for potential auto-processing
    console.log(`\n📋 JSON Summary:`);
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      count: emails.length,
      emails: emails.map(email => ({
        uid: email.uid,
        subject: email.subject,
        from: email.from?.address,
        date: email.date?.toISOString(),
        unread: email.unread,
      })),
    }, null, 2));
    
    // TODO: Add auto-processing rules here
    // Example: Auto-categorize, auto-reply, auto-forward, etc.
    
  } catch (error) {
    console.error(`❌ Error in scheduled task:`, error);
  }
}

/**
 * Setup scheduled tasks
 */
export function setupScheduler(
  imapClient: ImapClient,
  config: ScheduleConfig
): cron.ScheduledTask[] {
  if (!config.enabled) {
    console.log('⏰ Scheduling is disabled. Set SCHEDULE_ENABLED=true to enable.');
    return [];
  }
  
  if (!config.times || config.times.length === 0) {
    console.log('⏰ No schedule times configured. Set SCHEDULE_TIMES in .env (e.g., "15:00,19:00").');
    return [];
  }
  
  const tasks: cron.ScheduledTask[] = [];
  const timezone = config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  
  for (const time of config.times) {
    try {
      const cronExpression = timeToCronExpression(time.trim());
      const task = cron.schedule(cronExpression, () => {
        fetchUnreadEmailsFromLast24Hours(imapClient);
      }, {
        scheduled: true,
        timezone,
      });
      
      tasks.push(task);
      console.log(`✅ Scheduled task registered: Daily at ${time.trim()} (${timezone})`);
    } catch (error) {
      console.error(`❌ Failed to register schedule for time "${time}":`, error);
    }
  }
  
  return tasks;
}

/**
 * Stop all scheduled tasks
 */
export function stopScheduler(tasks: cron.ScheduledTask[]): void {
  for (const task of tasks) {
    task.stop();
  }
  console.log('⏰ All scheduled tasks stopped.');
}
