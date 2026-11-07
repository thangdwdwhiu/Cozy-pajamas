FROM node:22-alpine AS tooling
WORKDIR /app
COPY package*.json ./
RUN npm ci --cache /tmp/npm-cache
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

FROM tooling AS build
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup -S cozy && adduser -S cozy -G cozy && mkdir /app/uploads && chown cozy:cozy /app/uploads
COPY --from=build --chown=cozy:cozy /app/.next/standalone ./
COPY --from=build --chown=cozy:cozy /app/.next/static ./.next/static
COPY --from=build --chown=cozy:cozy /app/public ./public
COPY --from=build --chown=cozy:cozy /app/drizzle ./drizzle
USER cozy
EXPOSE 3000
CMD ["node","server.js"]
