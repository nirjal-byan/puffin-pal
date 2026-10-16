.PHONY: build.packages database.seed install lint lint.fix prisma.format prisma.generate prisma.migrate.dev prisma.migrate.deploy prisma.reset run run.api run.web run.worker services.start services.stop typecheck dev services.up services.down db.generate db.sync db.plan db.migrate db.verify api.dev

build.packages:
	@printf "\033[0;32m>>> Building packages\033[0m\n"
	pnpm build:packages

database.seed:
	@printf "\033[0;32m>>> Seeding the database\033[0m\n"
	cd apps/api && pnpm run database:seed

install:
	@printf "\033[0;32m>>> Installing dependencies\033[0m\n"
	pnpm install

lint:
	@printf "\033[0;32m>>> Linting all apps\033[0m\n"
	pnpm run lint

lint.fix:
	@printf "\033[0;32m>>> Linting and fixing all apps\033[0m\n"
	pnpm run lint:fix

prisma.format:
	@printf "\033[0;32m>>> Formatting Prisma files\033[0m\n"
	cd apps/api && pnpm run prisma:format

prisma.generate:
	@printf "\033[0;32m>>> Generating Prisma contract\033[0m\n"
	cd apps/api && pnpm run prisma:generate

prisma.migrate.dev:
	@printf "\033[0;32m>>> Planning and applying development migrations\033[0m\n"
	cd apps/api && pnpm run prisma:migrate:dev

prisma.migrate.deploy:
	@printf "\033[0;32m>>> Deploying existing migrations\033[0m\n"
	cd apps/api && pnpm run prisma:migrate:deploy

prisma.reset:
	@printf "\033[0;32m>>> Resetting the local database\033[0m\n"
	cd apps/api && pnpm run prisma:reset

run:
	@printf "\033[0;32m>>> Starting all apps in parallel\033[0m\n"
	pnpm run dev

run.api:
	@printf "\033[0;32m>>> Starting API app\033[0m\n"
	pnpm run dev --filter @puffinpal/api

run.web:
	@printf "\033[0;32m>>> Starting Web app\033[0m\n"
	pnpm run dev --filter @puffinpal/web

run.worker:
	@printf "\033[0;32m>>> Starting invoice export worker\033[0m\n"
	cd apps/api && pnpm run dev:worker

services.start:
	@printf "\033[0;32m>>> Starting local services\033[0m\n"
	cd services && docker compose -p puffinpal up -d

services.stop:
	@printf "\033[0;32m>>> Stopping local services\033[0m\n"
	cd services && docker compose -p puffinpal down

typecheck:
	@printf "\033[0;32m>>> Running type checks\033[0m\n"
	pnpm run typecheck

# Compatibility with the previous PuffinPal targets.
dev: run
services.up: services.start
services.down: services.stop
db.generate: prisma.generate
db.sync:
	cd apps/api && pnpm run prisma:sync
db.plan:
	cd apps/api && pnpm run prisma:plan
db.migrate:
	cd apps/api && pnpm exec prisma db migrate --advance-ref db
db.verify:
	cd apps/api && pnpm run prisma:verify
api.dev: run.api
