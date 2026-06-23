# Dockerfile
FROM denoland/deno:alpine

WORKDIR /app
# 复制所有文件到容器
COPY . /app

# 暴露端口（容器内部端口）
EXPOSE 8000

# 启动命令，允许网络与环境读取
CMD ["run", "--allow-net=api.groq.com:443", "--allow-env", "deno.ts"]
