# WhatsApp Chat Exporter Query Module
## Node.js Integration for D2C Platform

This module provides Node.js integration with the [WhatsApp-Chat-Exporter](https://github.com/KnugiHK/WhatsApp-Chat-Exporter) Python tool to query and parse WhatsApp chats for the D2C donation platform.

## Features

- ✅ Parse exported WhatsApp chat files (.txt format)
- ✅ Query messages from exported JSON files
- ✅ Extract donation information (wallet addresses + amounts)
- ✅ Filter by phone number, date range, text search
- ✅ Integrate with D2C database to store donations
- ✅ Process WhatsApp database files (msgstore.db)

## Installation

```bash
cd whatsapp-chat-exporter
npm install
```

### Prerequisites

Install the Python WhatsApp Chat Exporter:

```bash
pip install whatsapp-chat-exporter
```

## Usage

### Parse Exported Chat File

```javascript
const WhatsAppQueryService = require('../src/services/WhatsAppQueryService');

// Parse exported .txt file
const messages = await WhatsAppQueryService.parseExportedFile(
  './path/to/exported_chat.txt',
  '+1234567890' // optional phone number filter
);
```

### Query Messages from JSON

```javascript
// Query messages with filters
const messages = await WhatsAppQueryService.queryMessages(
  './whatsapp-export/result.json',
  {
    phoneNumber: '+1234567890',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    searchText: 'donation',
    limit: 100,
    sortBy: 'date',
    sortOrder: 'desc'
  }
);
```

### Extract Donations

```javascript
// Extract donations from file and store in database
const donations = await WhatsAppQueryService.extractDonationsFromFile(
  './path/to/exported_chat.txt',
  {
    phoneNumber: '+1234567890',
    storeInDatabase: true,
    campaignId: 'campaign-uuid'
  }
);
```

### Process WhatsApp Database

```javascript
// Process msgstore.db file
const result = await WhatsAppQueryService.processDatabase(
  './msgstore.db',
  {
    platform: 'android', // or 'ios'
    keyFile: './key', // for encrypted backups
    mediaDir: './WhatsApp',
    phoneNumber: '+1234567890',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    storeInDatabase: true,
    campaignId: 'campaign-uuid'
  }
);
```

## API Endpoints

### POST /api/whatsapp/parse-exported

Parse an exported WhatsApp chat file (.txt format).

**Request Body:**
```json
{
  "filePath": "./path/to/chat.txt",
  "phoneNumber": "+1234567890" // optional
}
```

### POST /api/whatsapp/query

Query messages from exported JSON file.

**Request Body:**
```json
{
  "jsonPath": "./whatsapp-export/result.json",
  "query": {
    "phoneNumber": "+1234567890",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "searchText": "donation",
    "limit": 100
  }
}
```

### POST /api/whatsapp/extract-donations-file

Extract donations from exported file.

**Request Body:**
```json
{
  "filePath": "./path/to/chat.txt",
  "phoneNumber": "+1234567890",
  "storeInDatabase": true,
  "campaignId": "campaign-uuid"
}
```

### POST /api/whatsapp/process-database

Process WhatsApp database file (msgstore.db).

**Request Body:**
```json
{
  "dbPath": "./msgstore.db",
  "platform": "android",
  "keyFile": "./key", // for encrypted backups
  "mediaDir": "./WhatsApp",
  "phoneNumber": "+1234567890",
  "storeInDatabase": true,
  "campaignId": "campaign-uuid"
}
```

## Module Structure

```
whatsapp-chat-exporter/
├── index.js              # Main entry point
├── src/
│   ├── ChatParser.js     # Parse exported .txt files
│   └── QueryService.js   # Query JSON exports
└── package.json
```

## Integration with D2C

The module integrates with:

- `WhatsAppService` - Existing WhatsApp service
- `Donation` model - Store extracted donations
- `Campaign` model - Associate donations with campaigns
- `FeeCalculator` - Calculate fees on donations
- `CurrencyConverter` - Convert currencies to EUR

## Notes

- The Python `whatsapp-chat-exporter` tool must be installed separately
- Exported files should be in standard WhatsApp export format (.txt)
- JSON exports should be from `wtsexporter -j` command
- Database files require appropriate decryption keys for encrypted backups

## License

MIT
