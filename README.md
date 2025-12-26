LiveDrops

LiveDrops is a web app for streamers and podcasters to launch Solana “access tokens” on Bags and run token-gated interactions during a live session. It includes a creator dashboard, a viewer interaction page, and an OBS-ready overlay that updates in real time.

Typical use cases:

Launch a token during a stream and direct viewers to buy on Bags.

Gate viewer actions (messages and votes) by token holdings.

Split protocol fees between the creator and a prize pool wallet.

Claim earned fees from the creator dashboard.

Key features

Wallet-based authentication: signature login with server-side sessions (no passwords).

Bags Token Launch v2 flow: create token metadata, configure fee sharing, launch via signed transactions.

Fee sharing: configure basis-point splits between the creator wallet and a prize pool wallet (defaults to 50/50).

Token gating: enforce minimum token holdings for viewer interactions.

OBS overlay: a 1920×1080 browser-source overlay with live updates via WebSockets.

Fee claiming: generate and submit fee-claim transactions from the dashboard.

How it works
Creator flow

Connect a wallet and sign a nonce to log in.

Create a Drop (token name, symbol, description, image, prize pool wallet, fee split, holding threshold).

Run the launch pipeline:

Create Token Info: creates token metadata and returns the token mint + metadata URL.

Create Fee Config: generates fee-sharing configuration transactions to sign and submit.

Launch: generates the launch transaction to sign and submit.

Share two links:

Viewer page: where viewers connect wallets and participate.

Overlay: used in OBS Browser Source to display live events.

Claim fees later from the dashboard (generates claim transactions for signing).

Viewer flow

Open the viewer page for a Drop.

Connect a wallet.

If holdings meet the threshold, submit:

a TTS message request (queued and broadcast to overlay),

and/or a vote (if a poll is active).

Project structure
livedrops/
├── apps/
│   ├── api/                 # Fastify backend (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/       # HTTP API routes
│   │   │   ├── services/     # Bags API, Solana, auth/session logic
│   │   │   ├── middleware/   # Auth middleware
│   │   │   └── utils/        # Validation, sanitization, helpers
│   │   └── prisma/           # Prisma schema + migrations
│   └── web/                 # React frontend (Vite + TypeScript)
│       └── src/
│           ├── pages/        # Route pages
│           ├── components/   # UI components
│           ├── hooks/        # Auth + websocket hooks
│           └── lib/          # API + Solana utilities
├── .env.example
└── README.md

Prerequisites

Node.js 20+

npm

A Solana wallet extension (Phantom, Solflare, etc.)

A Bags API key

Local development
1) Install dependencies
npm install

2) Configure environment
cp .env.example .env


Update .env with your values:

BAGS_API_KEY=your_bags_api_key_here
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
APP_ORIGIN=http://localhost:5173
PORT=3000
DATABASE_URL=file:./dev.db
NODE_ENV=development
SESSION_COOKIE_NAME=livedrops_session


Notes:

APP_ORIGIN must match the frontend origin for cookies and CORS.

Use a reliable RPC for mainnet if you expect traffic.

3) Initialize database
npm run db:generate
npm run db:push

4) Run the app
npm run dev


By default:

Web app: http://localhost:5173

API server: http://localhost:3000

Production build
npm run build
npm run start


The production server serves the built frontend from the API process.

OBS overlay setup

In OBS, add a Browser Source.

Set the URL to:

https://your-domain.com/overlay/<drop-slug>

Set the resolution to 1920×1080.

Optional: enable “Refresh browser when scene becomes active”.

API overview
Authentication

GET /api/auth/nonce?walletPubkey=...

POST /api/auth/verify

POST /api/auth/logout

GET /api/auth/me

Drops (authenticated)

GET /api/drops

GET /api/drops/:slug

POST /api/drops

POST /api/drops/:slug/create-token-info

POST /api/drops/:slug/create-fee-config

POST /api/drops/:slug/confirm-fee-config

POST /api/drops/:slug/create-launch-tx

POST /api/drops/:slug/confirm-launch

GET /api/drops/:slug/claimable

POST /api/drops/:slug/claim

POST /api/drops/:slug/confirm-claim

Viewer (public)

GET /api/viewer/:slug

POST /api/viewer/:slug/check-holding

POST /api/viewer/:slug/tts

POST /api/viewer/:slug/vote

Overlay (public)

GET /api/overlay/:slug

WS /ws/overlay/:slug

Health

GET /health

GET /health/detailed

Configuration
Fee split

Fee split is stored as basis points and must sum to 10,000:

streamerBps: 5000 = 50%

prizePoolBps: 5000 = 50%

Holding threshold

holderThresholdRaw is stored in base units (raw token amount). For a token with 6 decimals:

1 token = 1,000,000

1000 tokens = 1,000,000,000

If you change token decimals, you must ensure the UI and threshold units remain consistent.

Security notes

Use a dedicated streamer wallet. Do not use your main wallet.

No private keys are stored. All signing is done in the browser via the connected wallet.

Bags API key stays server-side. It is never exposed to the client.

Session tokens are hashed at rest. Cookies are httpOnly and sameSite=lax (and secure in production).

Rate limiting and input validation are enforced on authentication and viewer action routes. Viewer messages are sanitized and length-limited.

Troubleshooting
“Failed to create token info”

Confirm your Bags API key is valid.

Ensure the image URL (if used) is publicly accessible.

Check API logs for the Bags response body.

“Transaction failed”

Ensure the signing wallet has enough SOL for fees.

Confirm your RPC is healthy and on mainnet.

Check the transaction signature on a Solana explorer.

Overlay is not updating

Confirm the WebSocket endpoint is reachable.

Check browser console for CORS or mixed-content issues (http vs https).

Ensure the overlay URL uses the same domain as your server in production.

Test checklist

Creator can sign in with wallet signature.

Creator can create a drop and configure fee split + threshold.

Token info creation stores tokenMint and tokenMetadataUrl.

Fee config step returns tx(s), wallet signs, config is persisted.

Launch step returns tx, wallet signs, drop becomes LAUNCHED.

Viewer gating blocks actions below threshold and allows above threshold.

Overlay receives actions in real time.

Claim flow generates claim tx(s) and records claim signatures.

Production: https://livedrops.fun

License

MIT
