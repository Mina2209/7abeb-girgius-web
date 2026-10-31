FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

FROM node:22-bookworm-slim AS production

RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice fonts-kacst fonts-dejavu poppler-utils openssl fontconfig \
  && rm -rf /var/lib/apt/lists/*

# Arabic shaping fix: decks declare cs="Times New Roman" for Arabic text.
# Install Tajawal (OFL, also embedded in the decks) and alias exactly that one
# family to it so LibreOffice shapes Arabic correctly. See fonts/*.conf.
COPY fonts/Tajawal-Regular.ttf fonts/Tajawal-Bold.ttf fonts/OFL.txt /usr/share/fonts/truetype/tajawal/
COPY fonts/90-tajawal-times-new-roman.conf /etc/fonts/conf.d/
RUN fc-cache -f

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma
COPY index.js ./
COPY controllers ./controllers/
COPY middleware ./middleware/
COPY routes ./routes/
COPY services ./services/
COPY utils ./utils/

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "index.js"]
