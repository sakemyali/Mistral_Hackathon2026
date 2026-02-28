PYTHON_BIN ?= python3.10

.PHONY: help up down rebuild logs ps main main-forever setup-local reset-venv run-local

help:
	@echo "Targets:"
	@echo "  make up            - Start Docker services"
	@echo "  make down          - Stop Docker services"
	@echo "  make rebuild       - Rebuild and start Docker services"
	@echo "  make logs          - Follow Docker logs"
	@echo "  make ps            - Show Docker service status"
	@echo "  make main          - Copy .env.example to .env, then run main.py"
	@echo "  make main-forever  - Copy .env.example to .env, then run main.py forever"
	@echo "  make setup-local   - Create venv (Python 3.10+) and install requirements"
	@echo "  make reset-venv    - Recreate .venv with Python 3.10+"
	@echo "  make run-local     - Copy .env.example to .env, then run FastAPI locally"

up:
	docker compose up

down:
	docker compose down

rebuild:
	docker compose up --build

logs:
	docker compose logs -f

ps:
	docker compose ps

main:
	cp .env.example .env
	python3 main.py --config request_config.json

main-forever:
	cp .env.example .env
	python3 main.py --config request_config.json --forever --interval-sec 2

setup-local:
	$(PYTHON_BIN) --version
	$(PYTHON_BIN) -m venv .venv
	. .venv/bin/activate && pip install -r requirements.txt

reset-venv:
	rm -rf .venv
	$(MAKE) setup-local

run-local:
	cp .env.example .env
	. .venv/bin/activate && uvicorn app:app --reload --port 8000
