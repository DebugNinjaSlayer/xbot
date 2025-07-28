FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

FROM node:20-alpine

LABEL version="1.0"
LABEL description="X Bot"
LABEL author="DebugNinjaSlayer <8620373+DebugNinjaSlayer@users.noreply.github.com>"

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000

CMD [ "node", "dist/index.js" ]
