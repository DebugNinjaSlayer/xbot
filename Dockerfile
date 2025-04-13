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

# 设置环境变量 (如果需要，例如 .env 文件中的变量)
# 推荐使用 Docker Compose 或 Kubernetes Secrets 来管理敏感信息
# ENV NODE_ENV=production
# ENV MY_API_KEY=your_api_key

EXPOSE 3000

CMD [ "node", "dist/index.js" ]
