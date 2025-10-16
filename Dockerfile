# 构建阶段
FROM --platform=$BUILDPLATFORM node:18-alpine as build-stage

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建生产环境版本
RUN npm run build

# 生产环境阶段
FROM --platform=$TARGETPLATFORM nginx:alpine as production-stage

# 复制构建产物到 Nginx 目录
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 80 端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]