# D2C Donation Platform

A comprehensive donation management platform that processes donations from multiple sources (WhatsApp, WhyDonate), applies fee calculations, converts currencies, and sends funds to TRON blockchain.

## Features

- **Multi-Source Donations**: Import from WhatsApp Business API and WhyDonate CSV
- **Fee Management**: Automatic 25% fee breakdown (10% debt, 10% operational, 5% transaction)
- **Currency Conversion**: EUR conversion via Stripe API, USDT purchase via Simplex
- **Blockchain Integration**: TRON network support for USDT (TRC20) transactions
- **Batch Processing**: Group donations and process in batches
- **Admin Dashboard**: Complete admin interface for managing campaigns, donations, and batches

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT
- **Job Queue**: Bull + Redis
- **Blockchain**: TronWeb for TRON network
- **APIs**: WhatsApp Business API, Stripe, Simplex

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- Redis >= 6.0
- npm >= 9.0.0

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd D2C
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env
# For the backend-specific env template, see backend/.env.example
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Create PostgreSQL database
createdb d2c_donations

# Run the schema
psql -d d2c_donations -f core.sql
```

5. Start Redis (required for job queue):
```bash
# On macOS with Homebrew
brew services start redis

# On Linux
sudo systemctl start redis

# On Windows, download and run Redis
```

6. Start the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Environment Variables

See `.env.example` for all required environment variables. Key variables:

- `DB_*`: PostgreSQL connection settings
- `JWT_SECRET`: Secret key for JWT tokens
- **WhatsApp API** (choose one):
  - `WHATSAPP_ACCOUNT_SID`: Account SID (for Twilio)
  - `WHATSAPP_AUTH_TOKEN`: Auth token/secret key (for Twilio)
  - `WHATSAPP_ACCESS_TOKEN`: Access token (for Facebook/Meta - legacy)
- `STRIPE_API_KEY`: Stripe API key for exchange rates
- `SIMPLEX_API_KEY`: Simplex API credentials
- `TRON_PRIVATE_KEY`: TRON wallet private key for sending transactions
- `REDIS_*`: Redis connection for job queue

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign details
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### Donations
- `GET /api/donations` - List donations
- `GET /api/donations/:id` - Get donation details
- `PUT /api/donations/:id` - Update donation
- `POST /api/donations/batch-create` - Create multiple donations

### WhatsApp
- `POST /api/whatsapp/scan` - Trigger WhatsApp scan
- `GET /api/whatsapp/scans` - List scan jobs
- `GET /api/whatsapp/scans/:id` - Get scan details
- `GET /api/whatsapp/chats` - List scanned chats

### WhyDonate
- `POST /api/whydonate/import` - Import CSV file

### Batches
- `GET /api/batches` - List batches
- `POST /api/batches` - Create batch
- `GET /api/batches/:id` - Get batch details
- `POST /api/batches/:id/process` - Process batch (convert to EUR)
- `POST /api/batches/:id/initiate-simplex` - Start Simplex purchase
- `POST /api/batches/:id/send-tron` - Send to TRON network

### Exchange Rates
- `GET /api/exchange-rates` - Get current rates
- `POST /api/exchange-rates/refresh` - Fetch from Stripe

### Admin
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/logs` - System logs

## Project Structure

```
D2C/
├── backend/
│   ├── src/             # Backend app logic (wrappers for existing src)
│   ├── public/          # API docs and templates
│   └── docs/            # Backend documentation
├── frontend/            # Next.js frontend scaffold
├── blockchain/          # Smart contract scaffolding
├── docker/              # Container definitions
├── monitoring/          # Observability placeholders
├── src/                 # Existing backend implementation
├── core.sql             # Database schema
├── endpoints.js         # API endpoint structure
└── package.json         # Root scripts
```

## Development

### Running in Development Mode

```bash
npm run dev
```

Uses nodemon for automatic server restart on file changes.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Fee Calculation

The system automatically calculates fees on donation creation:

- **Total Fee**: 25% of donation amount
  - **Debt Fee**: 10%
  - **Operational Fee**: 10%
  - **Transaction Fee**: 5%
- **Net Amount**: 75% of donation amount (after fees)

Fees are calculated in EUR after currency conversion.

## Batch Processing Flow

1. **Create Batch**: Select donations and create a batch
2. **Process**: Convert to EUR, calculate totals with fees
3. **Simplex Purchase**: Initiate USDT purchase via Simplex
4. **TRON Transfer**: Send USDT to TRON network
5. **Fee Allocation**: Distribute fees to designated accounts

## WhatsApp Integration

The platform integrates with WhatsApp Business API to:
- Scan chat messages for donation information
- Extract TRON wallet addresses
- Parse donation amounts and currencies
- Create campaigns automatically from chat data

## WhyDonate Integration

Import donations from WhyDonate by uploading CSV files:
- Automatic campaign matching or creation
- Fee calculation on import
- Batch processing support

## TRON Blockchain

- Uses TronWeb library for TRON network interaction
- Supports USDT (TRC20) token transfers
- Transaction confirmation monitoring
- Network fee calculation

## Security

- JWT-based authentication
- Password hashing with bcrypt
- Helmet.js for security headers
- Input validation with express-validator
- Environment variable protection

## License

ISC

## Support

For issues and questions, please contact the development team.
