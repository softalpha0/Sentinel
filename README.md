# Risk Sentinel

**A leaderless AI swarm that trades Solana memecoins — built on Tashi.**

Four specialized agents coordinate peer-to-peer over FoxMQ, Tashi's MQTT 5.0 broker built on Vertex P2P BFT consensus. Agents pay each other in XLM on Stellar for every token analyzed. The swarm sells its intelligence as a paid API — no subscriptions, no API keys.

**Live:** [sentinel-production-d008.up.railway.app](https://sentinel-production-d008.up.railway.app)

---

## Architecture

```
Scanner ──(0.1 XLM)──▶ Risk ×2 ──▶ Consensus ──▶ Execution
           Stellar               Byzantine        Jupiter swap
           testnet               quorum 8s        or paper trade
```

| Agent | Role |
|---|---|
| **Scanner** | Polls DexScreener every 60s. Filters by liquidity, volume, age, buy pressure. Pays risk agents 0.1 XLM per analysis. |
| **Risk ×2** | Verifies Stellar payment, runs RugCheck.xyz, scores token 0–100 across 6 dimensions independently. |
| **Consensus** | Byzantine quorum — 8s window, majority vote required. One hard-fail blocks the trade entirely. |
| **Execution** | Executes Jupiter swap on BUY decision. Monitors positions with TP/SL. Sends Telegram alerts. |

All agents communicate over **FoxMQ** — Tashi's MQTT 5.0 broker built on Vertex P2P BFT consensus. No coordinator. No single point of failure.

---

## Tashi / Vertex P2P

The entire swarm runs on FoxMQ, which uses Vertex consensus to order every message between agents. This means:

- Message ordering is guaranteed across all agents
- Agents can't be fed conflicting data
- The swarm stays Byzantine fault tolerant even if nodes drop

---

## Stellar Micropayments

Every token analysis is paid for in real XLM on Stellar testnet. The Scanner sends 0.1 XLM to each Risk agent's address before publishing a candidate. Risk agents verify the payment on Horizon before processing. No payment — no analysis.

This is agent-to-agent economic enforcement with no human in the loop.

---

## x402 Paid API

The swarm sells its intelligence through a pay-per-call API using the x402 protocol.

| Endpoint | Price | Description |
|---|---|---|
| `GET /rug-check` | 0.02 XLM | Full rug safety report — mint authority, freeze, holder concentration |
| `GET /score` | 0.01 XLM | Composite 0–100 score across 6 dimensions |
| `GET /scan` | 0.05 XLM | Full market scan — all passing pairs with scores |
| `POST /mpp/session` | prepay budget | Multi-call session — pay once, call until budget is spent |

**How to use:** Send XLM to the producer address, pass the transaction hash as `X-Payment` header, get data back. No account needed.

---

## Stack

- **Tashi** — Vertex P2P BFT consensus (via FoxMQ)
- **FoxMQ** — MQTT 5.0 broker on Vertex consensus
- **Stellar** — Agent-to-agent micropayments (testnet XLM)
- **x402 Protocol** — Pay-per-call API
- **Solana** — Target chain for memecoin trading
- **Jupiter** — DEX aggregator for swaps
- **RugCheck.xyz** — On-chain rug risk analysis
- **DexScreener** — Real-time pair discovery
- **OpenServ** — Original agent framework

---

## Deployment

Four services on Railway:

| Service | Role |
|---|---|
| `sentinel-production-d008` | Next.js frontend + live swarm dashboard |
| `empowering-surprise` | Express API server (x402 endpoints) |
| `cooperative-smile` | FoxMQ broker (Vertex P2P node) |
| `lively-unity` | Swarm agents (scanner + risk×2 + consensus + execution) |

---

## Running Locally

```bash
git clone https://github.com/softalpha0/Sentinel
cd Sentinel
npm install
cp .env.example .env  # fill in your keys
```

Start the FoxMQ broker:
```bash
npm run foxmq:start
```

Start the swarm:
```bash
npm run swarm
```

Start the API server:
```bash
npm start
```

Start the frontend:
```bash
cd frontend && npm install && npm run dev
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `FOXMQ_URL` | FoxMQ broker URL (default: `mqtt://127.0.0.1:1883`) |
| `STELLAR_PUBLIC_KEY` | Stellar wallet public key |
| `STELLAR_SECRET_KEY` | Stellar wallet secret key |
| `STELLAR_NETWORK` | `testnet` or `mainnet` |
| `WALLET_PRIVATE_KEY` | Solana wallet private key (base58) |
| `SOLANA_RPC_URL` | Solana RPC endpoint |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for trade alerts |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for trade alerts |
| `PAPER_TRADING` | `true` to disable real trades (default: `true`) |
| `MIN_COMPOSITE_SCORE` | Minimum score to pass risk filter (default: `60`) |
