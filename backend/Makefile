PYTHON_BIN ?= python3.10

.PHONY: help up down rebuild logs ps test image-test setup-local reset-venv run-local

help:
	@echo "Targets:"
	@echo "  make up            - Start Docker services"
	@echo "  make down          - Stop Docker services"
	@echo "  make rebuild       - Rebuild and start Docker services"
	@echo "  make logs          - Follow Docker logs"
	@echo "  make ps            - Show Docker service status"
	@echo "  make test          - Run API smoke test against localhost:8000"
	@echo "  make setup-local   - Create venv (Python 3.10+) and install requirements"
	@echo "  make reset-venv    - Recreate .venv with Python 3.10+"
	@echo "  make run-local     - Run FastAPI locally (no Docker)"

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

test:
	python3 test.py

image-test:
	python3 image_translate_test.py

setup-local:
	$(PYTHON_BIN) --version
	$(PYTHON_BIN) -m venv .venv
	. .venv/bin/activate && pip install -r requirements.txt

reset-venv:
	rm -rf .venv
	$(MAKE) setup-local

run-local:
	. .venv/bin/activate && uvicorn app:app --reload --port 8000
