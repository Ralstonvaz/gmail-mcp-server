# Gmail MCP Server (IMAP/SMTP)

A Model Context Protocol (MCP) server that provides Claude with tools to interact with Gmail using IMAP (for reading) and SMTP (for sending) protocols. No Google Cloud Console or OAuth required - just Gmail app passwords. Features include reading emails, sending emails, replying to threads, searching, and scheduled email processing.

## Features

- 📧 **Email Management**: List, read, send, reply, and search emails using IMAP/SMTP
- 🔍 **IMAP Search**: Advanced email search using IMAP search criteria
- ⏰ **Scheduled Tasks**: Automatically fetch and process unread emails at specified times (default: 3pm and 7pm)
- 🔐 **Simple Authentication**: Uses Gmail App Passwords (no OAuth2 setup required)
- 🛡️ **Error Handling**: Comprehensive error handling with retry logic
- 📊 **Dual Format**: Returns both human-readable text summaries and structured JSON data
- 🔒 **Secure**: Uses TLS/SSL for all connections

## Prerequisites

- Node.js 18+ and npm
- Gmail account with 2-Step Verification enabled
- Gmail App Password (see setup instructions below)

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd gmail-mcp-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

## Gmail App Password Setup

### Step 1: Enable 2-Step Verification

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", click "2-Step Verification"
3. Follow the prompts to enable 2-Step Verification

### Step 2: Generate App Password

1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Or navigate: Google Account > Security > 2-Step Verification > App passwords
2. Select "Mail" as the app
3. Select "Other (Custom name)" as the device
4. Enter "MCP Server" as the name
5. Click "Generate"
6. **Copy the 16-character password** (you'll only see it once!)

The app password will look like: `abcd efgh ijkl mnop` (spaces are optional)

## Configuration

1. **Create a `.env` file** in the project root:

```env
# Gmail IMAP/SMTP Credentials
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop

# Scheduling Configuration
SCHEDULE_ENABLED=true
SCHEDULE_TIMES=15:00,19:00
TIMEZONE=Europe/Berlin
```

2. **Fill in your credentials:**
   - `GMAIL_USER`: Your Gmail email address
   - `GMAIL_APP_PASSWORD`: The 16-character app password you generated
   - `SCHEDULE_TIMES`: Comma-separated times in HH:mm format (24-hour)
   - `TIMEZONE`: Your timezone (e.g., "America/New_York", "Europe/London", "Asia/Tokyo")

## Usage

### Development Mode

Run in development mode with hot reload:

```bash
npm run dev
```

### Production Mode

Build and run:

```bash
npm run build
npm start
```

### Type Checking

Check TypeScript types without building:

```bash
npm run type-check
```

## MCP Tools

The server provides the following tools for Claude:

### Read-Only Tools

- **`gmail_list_emails`**: List recent emails with optional filters (unread, sender, date range, etc.)
- **`gmail_read_email`**: Read full email content by IMAP UID
- **`gmail_search_emails`**: Search emails using IMAP search criteria

### Write Tools

- **`gmail_send_email`**: Send a new email with optional CC, BCC, HTML body, and attachments
- **`gmail_reply_email`**: Reply to a specific email thread
- **`gmail_mark_read`**: Mark one or more emails as read

## IMAP Search Criteria

The `gmail_search_emails` and `gmail_list_emails` tools support IMAP search criteria:

### Common Criteria

- `["UNSEEN"]` - Unread emails
- `["SEEN"]` - Read emails
- `["FROM", "example@gmail.com"]` - Emails from specific sender
- `["TO", "example@gmail.com"]` - Emails to specific recipient
- `["SUBJECT", "meeting"]` - Emails with "meeting" in subject
- `["SINCE", "01-Jan-2024"]` - Emails since a date (DD-MMM-YYYY)
- `["BEFORE", "31-Dec-2024"]` - Emails before a date
- `["ALL"]` - All emails

### Combining Criteria

You can combine multiple criteria:
- `["UNSEEN", "FROM", "boss@company.com"]` - Unread emails from boss
- `["SINCE", "01-Jan-2024", "SUBJECT", "urgent"]` - Emails since Jan 1 with "urgent" in subject

### Date Format

Dates should be in `DD-MMM-YYYY` format (e.g., "01-Jan-2024", "15-Dec-2023").

## Scheduled Tasks

The server can automatically fetch and process unread emails at specified times. By default, it runs at 3pm (15:00) and 7pm (19:00) daily.

### Configuration

Set in `.env`:

```env
SCHEDULE_ENABLED=true
SCHEDULE_TIMES=15:00,19:00
TIMEZONE=Europe/Berlin
```

### Customization

You can customize the schedule times in the `.env` file. Times should be in `HH:mm` format (24-hour):

```env
SCHEDULE_TIMES=09:00,12:00,18:00,21:00
```

To disable scheduling:

```env
SCHEDULE_ENABLED=false
```

### Scheduled Task Behavior

When a scheduled task runs, it:
1. Fetches unread emails from the last 24 hours using IMAP
2. Logs a summary to the console
3. Outputs structured JSON data for potential auto-processing

You can extend the scheduler in `src/scheduler.ts` to add custom auto-processing rules (e.g., auto-categorize, auto-reply, auto-forward).

## Error Handling

The server includes comprehensive error handling:

- **Authentication Errors**: Clear messages with setup instructions
- **Connection Errors**: Automatic retry with exponential backoff
- **Validation Errors**: Detailed field-level error messages
- **Not Found Errors**: Specific resource identification

## IMAP/SMTP Configuration

The server uses the following Gmail server settings:

- **IMAP**: `imap.gmail.com:993` (SSL/TLS)
- **SMTP**: `smtp.gmail.com:587` (TLS)

These are configured automatically and should work with any Gmail account that has 2-Step Verification and an App Password enabled.

## Troubleshooting

### "IMAP connection error" or "SMTP verification failed"

- Verify your `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env`
- Ensure you're using an App Password (not your regular Gmail password)
- Check that 2-Step Verification is enabled on your Google account
- Verify the App Password was generated for "Mail"

### "Authentication failed"

- Make sure you're using the 16-character App Password (not your regular password)
- Regenerate the App Password if needed
- Ensure there are no extra spaces in the `.env` file

### "Email not found" error

- Verify the UID exists in the specified mailbox
- Check that you're using the correct mailbox name (default is "INBOX")
- UIDs are mailbox-specific and may change if emails are moved

### Scheduled tasks not running

- Verify `SCHEDULE_ENABLED=true` in `.env`
- Check that `SCHEDULE_TIMES` is in correct format (`HH:mm`)
- Ensure the server is running continuously (not just for a single request)
- Verify `TIMEZONE` is set correctly (use IANA timezone names)

### Connection timeouts

- Check your internet connection
- Verify Gmail IMAP/SMTP access is not blocked by your firewall
- Some networks may block IMAP/SMTP ports - consider using a VPN or different network

## Project Structure

```
gmail-mcp-server/
├── src/
│   ├── index.ts              # MCP server initialization
│   ├── email/
│   │   ├── imap-client.ts    # IMAP connection for reading
│   │   ├── smtp-client.ts    # SMTP connection for sending
│   │   └── types.ts          # TypeScript interfaces
│   ├── tools/
│   │   ├── list-emails.ts    # List emails tool
│   │   ├── read-email.ts     # Read email tool
│   │   ├── send-email.ts     # Send email tool
│   │   ├── reply-email.ts    # Reply tool
│   │   ├── search-emails.ts  # Search tool
│   │   └── mark-read.ts      # Mark as read tool
│   ├── scheduler.ts          # Cron job configuration
│   └── utils/
│       ├── errors.ts         # Error handling
│       └── formatters.ts    # Response formatting
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Differences from Gmail API Version

This IMAP/SMTP version:

- ✅ **No OAuth2 setup required** - Just use App Passwords
- ✅ **No Google Cloud Console** - No project creation needed
- ✅ **Simpler authentication** - Username and App Password only
- ✅ **Direct protocol access** - Uses standard email protocols
- ⚠️ **No drafts management** - IMAP/SMTP doesn't support drafts as easily
- ⚠️ **Different search syntax** - Uses IMAP search criteria instead of Gmail search

## Security Notes

- **Never commit `.env` file** to version control (it's in `.gitignore`)
- **Keep your App Password secure** - it provides access to your Gmail account
- **Use environment-specific credentials** for development, staging, and production
- **Regenerate App Passwords** if they are ever compromised
- **App Passwords are account-specific** - each user needs their own

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or feature requests, please open an issue on the repository.
