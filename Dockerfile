FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:20-alpine

LABEL version="1.0"
LABEL description="X Bot"
LABEL author="DebugNinjaSlayer <8620373+DebugNinjaSlayer@users.noreply.github.com>"

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000

CMD [ "node", "dist/index.js" ]
