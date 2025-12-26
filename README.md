# LiveDrops - Streamer Token Launcher

Launch access tokens on Solana during live streams with Bags API integration. Gate viewer interactions (TTS, voting) by token holdings.

## Features

- **Wallet Authentication**: Secure signature-based login with session management
- **Token Launch v2**: Full Bags API integration for creating and launching tokens
- **Fee Sharing**: Configure 50/50 split between streamer and prize pool (customizable)
- **OBS Overlay**: Real-time browser source overlay (1920x1080) with WebSocket updates
- **Token Gating**: Require viewers to hold tokens for TTS messages and voting
- **Fee Claiming**: Claim accumulated trading fees from the dashboard

## Architecture

```
livedrops/
├── apps/
│   ├── api/          # Fastify backend (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Business logic (Bags API, Solana, sessions)
│   │   │   ├── middleware/  # Auth middleware
│   │   │   └── utils/       # Validation, sanitization
│   │   └── prisma/          # Database schema
│   └── web/          # React frontend (Vite + TypeScript)
│       └── src/
│           ├── pages/       # Route components
│           ├── components/  # UI components
│           ├── hooks/       # React hooks (auth, websocket)
│           └── lib/         # Utilities (API, Solana)
├── .env.example      # Environment template
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- A Solana wallet (Phantom, Solflare, etc.)
- Bags API key from [dev.bags.fm](https://dev.bags.fm)

### Local Development

1. **Clone and install dependencies**
```bash
git clone <repo-url>
cd livedrops
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
BAGS_API_KEY=your_bags_api_key_here
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
APP_ORIGIN=http://localhost:3000
PORT=3000
DATABASE_URL=file:./dev.db
NODE_ENV=development
```

3. **Initialize database**
```bash
npm run db:generate
npm run db:push
```

4. **Start development servers**
```bash
npm run dev
```

This starts:
- API server: http://localhost:3000
- Web dev server: http://localhost:5173 (proxies to API)

5. **Open the app**

Navigate to http://localhost:5173 and connect your wallet.

### Production Build

```bash
# Build web and API
npm run build

# Start production server
npm run start
```

The production server serves the built React app from the API server on port 3000.

## Replit Deployment

### Step 1: Import from GitHub

1. Create a new Replit
2. Choose "Import from GitHub"
3. Paste your repository URL

### Step 2: Configure Secrets

In the Replit Secrets tab, add:

| Key | Value | Required |
|-----|-------|----------|
| `BAGS_API_KEY` | Your Bags API key | ✅ |
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | ✅ |
| `APP_ORIGIN` | Your Replit URL (e.g., `https://livedrops.username.repl.co`) | ✅ |
| `DATABASE_URL` | `file:./prod.db` | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `SESSION_COOKIE_NAME` | `livedrops_session` | Optional |

### Step 3: Configure Replit

Create or update `.replit`:
```toml
run = "npm run start"
entrypoint = "apps/api/src/index.ts"

[nix]
channel = "stable-23_11"

[deployment]
run = ["sh", "-c", "npm run build && npm run start"]
build = ["sh", "-c", "npm install && npm run db:generate && npm run db:push"]
```

### Step 4: Deploy

Click "Run" or use the Deploy button.

## User Flows

### Creator Flow

1. **Connect Wallet**: Click "Connect Wallet" and sign the authentication message
2. **Create Drop**: Fill in token details (name, symbol, description, image URL)
3. **Launch Token**:
   - **Step 1**: Create Token Info → Generates tokenMint and metadata
   - **Step 2**: Create Fee Config → Sign transaction(s) to set up fee sharing
   - **Step 3**: Launch → Sign final transaction to launch on Bags
4. **Share URLs**: Copy the Viewer Page and OBS Overlay URLs
5. **Claim Fees**: Claim accumulated trading fees from the dashboard

### Viewer Flow

1. **Visit Viewer Page**: `/d/{slug}`
2. **Connect Wallet**: Required to interact
3. **Buy Tokens**: Link to Bags for purchasing
4. **Interact**: 
   - Submit TTS messages (if holding threshold)
   - Vote in polls (if holding threshold)

### OBS Setup

1. Add a **Browser Source** in OBS
2. Set URL to: `https://your-app.com/overlay/{slug}`
3. Set dimensions: **1920 x 1080**
4. Enable "Refresh browser when scene becomes active" (optional)

## API Endpoints

### Authentication
- `GET /api/auth/nonce?walletPubkey=...` - Get sign message
- `POST /api/auth/verify` - Verify signature, create session
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/me` - Get current user

### Drops (Authenticated)
- `GET /api/drops` - List user's drops
- `GET /api/drops/:slug` - Get drop details
- `POST /api/drops` - Create new drop
- `POST /api/drops/:slug/create-token-info` - Step 1: Create token
- `POST /api/drops/:slug/create-fee-config` - Step 2: Get config transactions
- `POST /api/drops/:slug/confirm-fee-config` - Confirm config created
- `POST /api/drops/:slug/create-launch-tx` - Step 3: Get launch transaction
- `POST /api/drops/:slug/confirm-launch` - Confirm launched
- `GET /api/drops/:slug/claimable` - Get claimable positions
- `POST /api/drops/:slug/claim` - Get claim transactions
- `POST /api/drops/:slug/confirm-claim` - Record successful claim

### Viewer (Public)
- `GET /api/viewer/:slug` - Get drop info for viewers
- `POST /api/viewer/:slug/check-holding` - Check token balance
- `POST /api/viewer/:slug/tts` - Submit TTS message
- `POST /api/viewer/:slug/vote` - Submit vote

### Overlay (Public)
- `GET /api/overlay/:slug` - Get overlay data
- `WS /ws/overlay/:slug` - WebSocket for real-time updates

### Health
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check

## Security

### ⚠️ Important Security Notes

1. **Use a Dedicated Wallet**: Do NOT use your main wallet for streaming. Create a dedicated "streamer wallet" with only the SOL needed for launches.

2. **Prize Pool Wallet**: Similarly, use a dedicated wallet for the prize pool.

3. **Private Keys**: This application NEVER stores or requests private keys. All signing happens in your browser wallet (Phantom/Solflare).

4. **API Key**: The Bags API key is only used server-side and never exposed to clients.

### Session Security

- Sessions are stored in SQLite with hashed tokens
- Cookies are httpOnly, secure (in production), and sameSite=lax
- Sessions expire after 7 days
- Signature verification uses tweetnacl

### Rate Limiting

- Login endpoints: 10 requests per minute per IP
- Action endpoints: 20 requests per minute per wallet/IP
- Bags API: Built-in backoff on 429 responses

### Input Validation

- All wallet addresses validated as valid base58 PublicKeys
- TTS messages sanitized (URL removal, profanity filter, length limits)
- Zod schemas for all API inputs

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BAGS_API_KEY` | Bags API key (required) | - |
| `SOLANA_RPC_URL` | Solana RPC endpoint | - |
| `APP_ORIGIN` | Public URL of the app | - |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `NODE_ENV` | Environment | `development` |
| `SESSION_COOKIE_NAME` | Cookie name | `livedrops_session` |
| `SESSION_EXPIRY_HOURS` | Session lifetime | `168` (7 days) |
| `TOKEN_BALANCE_CACHE_SECONDS` | Balance cache TTL | `15` |
| `MAX_TTS_MESSAGE_LENGTH` | Max TTS length | `200` |

### Fee Configuration

Default fee split is 50/50 between streamer and prize pool. This is configurable when creating a drop:
- `streamerBps`: Streamer's percentage in basis points (5000 = 50%)
- `prizePoolBps`: Prize pool's percentage in basis points (5000 = 50%)
- Total must equal 10000 (100%)

### Holder Threshold

Configure the minimum token balance required for interactions:
- `holderThresholdRaw`: Raw token amount in base units
- For a token with 6 decimals: `1000000` = 1 token

## Database

SQLite is used for simplicity and single-file deployment. Tables:

- **User**: Wallet addresses
- **Session**: Active sessions with hashed tokens
- **Drop**: Token launches with status tracking
- **Action**: TTS messages and votes
- **Claim**: Fee claim records
- **Poll**: Active polls for voting

## Troubleshooting

### "Failed to create token info"
- Check that your Bags API key is valid
- Ensure image URL is accessible

### "Transaction failed"
- Make sure you have enough SOL for transaction fees
- Check that you're on mainnet (not devnet)

### WebSocket not connecting
- Verify the APP_ORIGIN matches your actual domain
- Check for CORS issues in browser console

### Session expired
- Clear cookies and reconnect wallet
- Check SESSION_EXPIRY_HOURS setting

## Testing Checklist

- [ ] Creator can login with wallet signature
- [ ] Creator can create a drop with all fields
- [ ] Creator can click "Create Token Info" and it stores tokenMint
- [ ] Creator can click "Create Fee Config", sign tx(s), and it stores configKey
- [ ] Creator can click "Launch", sign tx, and status becomes LAUNCHED
- [ ] Viewer page enforces holding threshold correctly
- [ ] Overlay updates in real time when viewer submits TTS
- [ ] Poll votes update in real time on overlay
- [ ] Creator can generate and submit claim transactions

## License

MIT

## Support

For issues with the Bags API, visit [dev.bags.fm](https://dev.bags.fm).

For issues with this application, open a GitHub issue.
