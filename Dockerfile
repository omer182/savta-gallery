# syntax=docker/dockerfile:1

# Debian slim, not Alpine: better-sqlite3 and sharp both ship prebuilt binaries
# for glibc. On musl they would compile from source at install time, or fail.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A dummy secret: lib/session.ts throws without one, and Next evaluates modules
# while collecting page data. Never used to sign anything — the real value
# arrives from the environment at runtime.
ENV SESSION_SECRET=build-time-placeholder-not-used-at-runtime
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm run build:scripts

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# The standalone server binds to localhost by default, which is unreachable
# from outside the container.
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/data

# Run as a non-root user that owns /data, so the bind mount is writable.
RUN groupadd -g 1001 savta && useradd -u 1001 -g savta -m savta

COPY --from=builder --chown=savta:savta /app/.next/standalone ./
COPY --from=builder --chown=savta:savta /app/.next/static ./.next/static
COPY --from=builder --chown=savta:savta /app/public ./public

# The CLI tooling: migrations run on every start, the importer is invoked by
# hand from the Portainer console. Bundled to .mjs because the standalone
# output contains no tsx and no TypeScript.
COPY --from=builder --chown=savta:savta /app/dist/scripts ./dist/scripts
COPY --from=builder --chown=savta:savta /app/db/migrations ./db/migrations
COPY --chown=savta:savta docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

RUN mkdir -p /data && chown -R savta:savta /data
USER savta

EXPOSE 3000
VOLUME ["/data"]

# Node 22 has global fetch, so no curl or wget needs installing.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
