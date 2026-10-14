# SeaweedFS

SeaweedFS is started by `../docker-compose.yml` with its authenticated S3 endpoint
on port 8333 and master on port 9333. `s3.json` contains local-development
credentials matching `apps/api/.env.example`; use separate secrets outside local
development. The API creates the private `puffinpal-receipts` bucket on first use.
