# SNMP Dashboard Backend (Node.js)

A robust Node.js backend for SNMP network device monitoring with real-time data collection and RESTful API.

## Features

- **SNMP Data Collection**: Automated polling using net-snmp
- **SQLite Database**: Lightweight database with automatic schema creation
- **RESTful API**: Clean endpoints for device and data management
- **Scheduled Tasks**: Cron-based data collection with configurable intervals
- **Logging**: Winston-based logging with file and console output
- **Error Handling**: Comprehensive error handling and recovery
- **Health Monitoring**: System health and statistics endpoints

## Installation

1. **Install Node.js dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

2. **Configure environment**:
   \`\`\`bash
   cp .env.example .env

   # Edit .env with your settings

   \`\`\`

3. **Start the server**:
   \`\`\`bash

   # Development mode with auto-restart

   npm run dev

   # Production mode

   npm start
   \`\`\`

## API Endpoints

### Devices

- \`GET /api/devices\` - List all devices
- \`POST /api/devices\` - Add new device
- \`GET /api/devices/:id\` - Get device details
- \`PUT /api/devices/:id\` - Update device
- \`DELETE /api/devices/:id\` - Remove device

### Data

- \`GET /api/devices/:id/current\` - Get current device data
- \`GET /api/devices/:id/history\` - Get historical data
- \`GET /api/devices/:id/stats\` - Get device statistics

### Health

- \`GET /api/health\` - System health check
- \`GET /api/health/info\` - System information

## Configuration

Environment variables in \`.env\`:

\`\`\`env
NODE_ENV=development
PORT=1999
DATABASE_PATH=./data/snmp_data.db
SNMP_COMMUNITY=public
SNMP_PORT=161
SNMP_TIMEOUT=5000
SNMP_RETRIES=3
POLL_INTERVAL_SYSTEM=300000
POLL_INTERVAL_CPU=60000
POLL_INTERVAL_INTERFACES=120000
DATA_RETENTION_DAYS=30
LOG_LEVEL=info
\`\`\`

## Usage

1. Start the backend server
2. Add devices via POST /api/devices
3. Monitor data collection in logs
4. Access data via API endpoints
5. Frontend will automatically connect to backend

## Troubleshooting

- Check logs in \`./logs/\` directory
- Verify SNMP connectivity to devices
- Ensure database directory is writable
- Check firewall settings for SNMP port 161
