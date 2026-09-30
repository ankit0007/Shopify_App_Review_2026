FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV npm_config_update_notifier=false

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 app \
  && useradd --system --uid 1001 --gid app app

COPY --from=build --chown=app:app /app/package*.json ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/build ./build
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/app ./app
COPY --from=build --chown=app:app /app/extensions/review-widgets/assets/review-widgets.css ./extensions/review-widgets/assets/review-widgets.css
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/tsconfig.json ./tsconfig.json

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start"]
