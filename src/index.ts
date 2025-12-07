/**
 * Gmail MCP Server (IMAP/SMTP)
 * 
 * MCP server for Gmail integration using IMAP and SMTP protocols
 */

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ImapClient } from './email/imap-client.js';
import { SmtpClient } from './email/smtp-client.js';
import { setupScheduler, type ScheduleConfig } from './scheduler.js';
import { GmailMCPError } from './utils/errors.js';

// Import tools
import {
  createListEmailsTool,
  handleListEmails,
} from './tools/list-emails.js';
import {
  createReadEmailTool,
  handleReadEmail,
} from './tools/read-email.js';
import {
  createSendEmailTool,
  handleSendEmail,
} from './tools/send-email.js';
import {
  createReplyEmailTool,
  handleReplyEmail,
} from './tools/reply-email.js';
import {
  createSearchEmailsTool,
  handleSearchEmails,
} from './tools/search-emails.js';
import {
  createMarkReadTool,
  handleMarkRead,
} from './tools/mark-read.js';

// Load environment variables
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const SCHEDULE_ENABLED = process.env.SCHEDULE_ENABLED === 'true';
const SCHEDULE_TIMES = process.env.SCHEDULE_TIMES
  ? process.env.SCHEDULE_TIMES.split(',').map(t => t.trim())
  : ['15:00', '19:00'];
const TIMEZONE = process.env.TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// Validate required environment variables
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error('❌ Missing required environment variables:');
  console.error('   - GMAIL_USER');
  console.error('   - GMAIL_APP_PASSWORD');
  console.error('\nPlease check your .env file and ensure all required variables are set.');
  console.error('\nTo get a Gmail App Password:');
  console.error('1. Go to https://myaccount.google.com/');
  console.error('2. Security > 2-Step Verification > App passwords');
  console.error('3. Generate a new app password for "Mail"');
  process.exit(1);
}

// Initialize email clients
let imapClient: ImapClient;
let smtpClient: SmtpClient;
let scheduledTasks: ReturnType<typeof setupScheduler> = [];

async function initializeEmailClients(): Promise<void> {
  try {
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      throw new Error('Gmail credentials not provided');
    }
    
    console.log('🔐 Initializing IMAP and SMTP clients...');
    
    // Initialize IMAP client
    imapClient = new ImapClient({
      user: GMAIL_USER,
      password: GMAIL_APP_PASSWORD,
    });
    
    await imapClient.connect();
    console.log('✅ IMAP client connected');
    
    // Initialize SMTP client
    smtpClient = new SmtpClient({
      user: GMAIL_USER,
      password: GMAIL_APP_PASSWORD,
    });
    
    await smtpClient.verify();
    console.log('✅ SMTP client verified');
    
    // Setup scheduler
    if (SCHEDULE_ENABLED) {
      const scheduleConfig: ScheduleConfig = {
        enabled: SCHEDULE_ENABLED,
        times: SCHEDULE_TIMES,
        timezone: TIMEZONE,
      };
      scheduledTasks = setupScheduler(imapClient, scheduleConfig);
    }
  } catch (error) {
    console.error('❌ Failed to initialize email clients:', error);
    process.exit(1);
  }
}

// Initialize MCP server
const server = new Server(
  {
    name: 'gmail-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (!imapClient || !smtpClient) {
    throw new Error('Email clients not initialized');
  }
  
  return {
    tools: [
      createListEmailsTool(imapClient),
      createReadEmailTool(),
      createSendEmailTool(),
      createReplyEmailTool(),
      createSearchEmailsTool(),
      createMarkReadTool(),
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!imapClient || !smtpClient) {
    throw new Error('Email clients not initialized');
  }
  
  try {
    switch (name) {
      case 'gmail_list_emails':
        return await handleListEmails(imapClient, args);
      
      case 'gmail_read_email':
        return await handleReadEmail(imapClient, args);
      
      case 'gmail_send_email':
        return await handleSendEmail(smtpClient, args);
      
      case 'gmail_reply_email':
        return await handleReplyEmail(imapClient, smtpClient, args);
      
      case 'gmail_search_emails':
        return await handleSearchEmails(imapClient, args);
      
      case 'gmail_mark_read':
        return await handleMarkRead(imapClient, args);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof GmailMCPError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error: ${error.message}\n\nCode: ${error.code}${error.statusCode ? `\nStatus: ${error.statusCode}` : ''}`,
          },
        ],
        isError: true,
      };
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error executing tool "${name}": ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  // Initialize email clients first
  await initializeEmailClients();
  
  // Use stdio transport for MCP
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('🚀 Gmail MCP Server started (IMAP/SMTP)');
  console.log('📧 Available tools:');
  console.log('   - gmail_list_emails');
  console.log('   - gmail_read_email');
  console.log('   - gmail_send_email');
  console.log('   - gmail_reply_email');
  console.log('   - gmail_search_emails');
  console.log('   - gmail_mark_read');
  
  if (SCHEDULE_ENABLED) {
    console.log(`\n⏰ Scheduled tasks enabled: ${SCHEDULE_TIMES.join(', ')} (${TIMEZONE})`);
  }
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    // Stop scheduled tasks
    if (scheduledTasks.length > 0) {
      scheduledTasks.forEach(task => task.stop());
    }
    // Disconnect clients
    if (imapClient) {
      await imapClient.disconnect();
    }
    if (smtpClient) {
      await smtpClient.close();
    }
    await server.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down...');
    // Stop scheduled tasks
    if (scheduledTasks.length > 0) {
      scheduledTasks.forEach(task => task.stop());
    }
    // Disconnect clients
    if (imapClient) {
      await imapClient.disconnect();
    }
    if (smtpClient) {
      await smtpClient.close();
    }
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
