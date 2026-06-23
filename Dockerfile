# Dockerfile
FROM denoland/deno:alpine

WORKDIR /app
# 复制所有文件到容器
COPY . /app

# 添加 entrypoint 并安装 curl & ca-certificates (用于 https raw fetch)
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && apk add --no-cache curl ca-certificates

# 暴露端口（容器内部端口）
EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# 启动命令，允许网络与环境读取
#CMD ["run", "--allow-net", "--allow-env", "deno.ts"]
