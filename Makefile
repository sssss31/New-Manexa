# MANEXA — one-command workflows.

.PHONY: up down logs dev install setup migrate seed reset build lint typecheck

## Docker (fresh machine → full stack in one command)
up:            ## Build + start db, redis, migrate, app
	docker compose up --build
down:          ## Stop and remove containers
	docker compose down
logs:          ## Tail app logs
	docker compose logs -f app
seed-docker:   ## Load demo data into the compose Postgres (first run only)
	docker compose run --rm seed

## Local (host Node) workflows
install:       ## Install dependencies
	npm install
setup:         ## Generate client, apply migrations, seed
	npm run setup
dev:           ## Start the dev server
	npm run dev
build:         ## Production build
	npm run build
migrate:       ## Create/apply a dev migration
	npm run db:migrate
seed:          ## Seed the database
	npm run db:seed
reset:         ## Drop, re-migrate and re-seed
	npm run db:reset
lint:          ## ESLint
	npm run lint
typecheck:     ## Type check
	npm run typecheck
