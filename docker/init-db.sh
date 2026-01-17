#!/bin/sh
psql -d "$POSTGRES_DB" -f /app/core.sql
