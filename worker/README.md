# Tri-Tender Worker

VPS-side worker that polls Supabase for queued tender jobs, processes them through TenderResponseOS, and writes results back.

## Setup on VPS

```bash
# 1. Copy worker directory to VPS
scp -r worker/ biddesk@your-vps:/home/biddesk/tri-tender-worker/

# 2. SSH into VPS
ssh biddesk@your-vps

# 3. Install dependencies
cd /home/biddesk/tri-tender-worker
npm install

# 4. Configure environment
cp .env.example .env
# Edit .env with your Supabase service role key and ANTHROPIC_API_KEY

# 5. Create logs directory
mkdir -p logs

# 6. Test single poll
node index.js

# 7. Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
```

## Architecture

```
Portal (Vercel) → Supabase (shared state) → Worker (VPS)
                                              ↓
                                      TenderResponseOS
```

The worker:
1. Polls `jobs` table via `claim_next_biddesk_job()`
2. Downloads tender files from Supabase Storage
3. Processes them in the TenderResponseOS workspace
4. Writes status updates to `jobs` + `job_events`
5. Uploads outputs to Supabase Storage
6. Creates next-phase jobs when eligible

## Job Types

| Phase | Job Type | Queue Class |
|-------|----------|-------------|
| 1 | tender_preflight | medium |
| 2 | tender_intake | medium |
| 3 | matrix_and_missing | medium |
| 4 | response_strategy | medium |
| 5 | draft_technical | heavy |
| 6 | qa_gate | medium |
| 7 | final_pack_generation | heavy |

## Commands

```bash
# Start continuous polling
pm2 start ecosystem.config.cjs

# Check status
pm2 status

# View logs
pm2 logs tri-tender-worker

# Stop
pm2 stop tri-tender-worker

# Single poll (debug)
node index.js

# Development mode (auto-restart on changes)
npm run dev -- --loop
```
