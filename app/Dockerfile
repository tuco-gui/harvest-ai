# Build fora do VPS. Compilar Next.js consome de 1,5 a 3 GB de RAM em pico,
# e o VPS tem ~3,9 GB livres — construir lá pode derrubar Supabase e n8n.
# Aqui a gente constrói, publica a imagem, e o servidor só baixa e roda (~250 MB).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && cp -R node_modules /prod_modules && npm ci --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# As NEXT_PUBLIC_* entram no bundle do navegador, então precisam existir no build.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S next -u 1001
COPY --from=build /app/public ./public
COPY --from=build --chown=next:nodejs /app/.next/standalone ./
COPY --from=build --chown=next:nodejs /app/.next/static ./.next/static
USER next
EXPOSE 3000
CMD ["node", "server.js"]
