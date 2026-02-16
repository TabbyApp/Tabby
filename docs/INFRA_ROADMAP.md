# Infrastructure Roadmap

## Done ✅

- **Docker Compose (full stack)** – `docker compose up` runs DB + API
- **API binds 0.0.0.0** – Required for containers
- **`GET /health`** – Checks DB connectivity (returns 503 if DB down)
- **Postgres migrations** – `001_init.sql`, `npm run migrate`
- **Branch protection guide** – `docs/BRANCH_PROTECTION.md`
- **GitHub Actions CI** – Frontend build, server build, migrations against temp Postgres

## Next (priority order)

### 1. S3 for uploads (before prod)
Receipt images are stored on local disk. On ECS/Fargate:
- Local disk is ephemeral (redeploy = files gone)
- Multiple containers = different files per instance

**Solution:** S3 bucket for receipt images. Update `server/src/routes/transactions.ts` and `receipts.ts` to upload to S3 instead of disk; serve via presigned URLs or CloudFront.

### 2. RDS Postgres (prod DB)
- Create RDS Postgres instance
- Security group: allow inbound from ECS
- Set `DATABASE_URL` in ECS task (from Secrets Manager or SSM)

### 3. ECR + ECS/Fargate + ALB
- Push server image to ECR
- ECS cluster + task definition + service
- Application Load Balancer (stable URL, health checks on `/health`)

### 4. Secrets (Plaid, Twilio, JWT)
Use **AWS Secrets Manager** or **SSM Parameter Store** – not plaintext env files.

### 5. CI/CD deploy pipeline
On merge to `main`:
- Build Docker image → push to ECR
- Update ECS service
- Run migrations (one-off task or manual before deploy)

### 6. HTTPS + domain
- Route 53 + ACM certificate + ALB HTTPS listener

### 7. Observability
- CloudWatch logs for API
- Basic request logging
- `/health` already exists for load balancer health checks

### 8. Frontend (Vercel)
- Connect repo to Vercel
- Env var: `VITE_API_URL` → ALB domain in prod
- Preview deployments per PR
