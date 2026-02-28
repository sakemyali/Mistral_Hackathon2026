.PHONY: help main

help:
	@echo "Targets:"
	@echo "  make main  - Run main.py using request_config.json"

main:
	@if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi
	. .venv/bin/activate && python3 main.py --config request_config.json
