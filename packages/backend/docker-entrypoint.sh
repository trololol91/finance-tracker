#!/bin/sh
set -e

# Fix ownership of bind-mounted data directories.
# The host may have created these as a different user; chown ensures the
# nestjs process (uid 1001) can write to them regardless.
chown -R nestjs:nodejs /data/scraper-plugins

exec su-exec nestjs dumb-init -- "$@"
