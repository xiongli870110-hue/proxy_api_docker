# Proxy API Docker

一个基于 Deno 的轻量级 API 代理服务，以 Docker 容器方式运行。该项目允许你轻松代理 HTTP 请求到上游 API 服务，同时保持完整的请求和响应控制。

## 功能特性

- 🚀 **高性能代理**：使用 Deno 运行时，提供快速的请求转发
- 🔄 **灵活的重定向处理**：不自动跟随重定向，将上游的 3xx 状态码原样返回给客户端
- 🐳 **Docker 化**：开箱即用的 Docker 支持，基于轻量级的 Alpine 镜像
- 🔐 **HTTPS 支持**：完整支持 HTTPS 请求转发
- ⚙️ **环境变量配置**：通过环境变量灵活配置目标主机和协议
- 🛡️ **安全验证**：支持 SHA256 校验确保下载文件的完整性
- 📝 **动态代码加载**：支持从远程 URL 动态下载和更新 deno.ts，无需重新构建镜像

## 项目结构

```
proxy_api_docker/
├── Dockerfile              # Docker 镜像构建配置
├── deno.ts                 # 主代理应用源代码
├── entrypoint.sh           # 容器启动脚本
└── README.md               # 项目文档
```

## 快速开始

### 1. 构建 Docker 镜像

```bash
docker build -t proxy-api:latest .
```

### 2. 运行容器

**基础运行**（代理到 api.groq.com）：

```bash
docker run -p 8000:8000 proxy-api:latest
```

**代理到自定义主机**：

```bash
docker run -p 8000:8000 \
  -e DENO_TARGET_HOST=api.example.com \
  -e DENO_TARGET_PROTOCOL=https \
  proxy-api:latest
```

**使用动态代码加载**：

```bash
docker run -p 8000:8000 \
  -e DENOTS_RAW_URL=https://raw.githubusercontent.com/your-org/repo/main/deno.ts \
  -e DENOTS_SHA256=abc123def456... \
  -e DENO_TARGET_HOST=api.example.com \
  proxy-api:latest
```

### 3. 测试代理

```bash
curl -i http://localhost:8000/openapi/deployments
```

## 环境变量配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `DENO_TARGET_HOST` | `api.groq.com` | 上游 API 服务的主机名 |
| `DENO_TARGET_PROTOCOL` | `https` | 上游 API 服务的协议（`http` 或 `https`） |
| `DENOTS_RAW_URL` | `https://raw.githubusercontent.com/xiongli870110-hue/proxy_api_docker/main/deno.ts` | 动态加载 deno.ts 的远程 URL |
| `DENOTS_SHA256` | 空（可选） | 期望的 SHA256 校验值，用于验证下载的文件 |

## 工作流程

### 启动流程

1. **启动容器** → 执行 `entrypoint.sh`
2. **下载代码** → 从 `DENOTS_RAW_URL` 下载最新的 `deno.ts`
3. **校验完整性** → 如果设置了 `DENOTS_SHA256`，验证文件哈希值
4. **启动服务** → 执行 `deno run --allow-net --allow-env deno.ts`
5. **监听端口** → 在 `0.0.0.0:8000` 上等待请求

### 代理流程

1. **接收请求** → 收到客户端的 HTTP 请求
2. **构建目标 URL** → 结合环境变量和请求路径生成上游 URL
3. **转发请求** → 将请求转发到上游服务（不自动跟随重定向）
4. **返回响应** → 原样返回上游响应（包括 3xx 重定向）

## 请求转发示例

### 例子 1：简单的 GET 请求

**客户端请求：**
```
GET /openapi/deployments HTTP/1.1
Host: localhost:8000
```

**转发到上游：**
```
GET /openapi/deployments HTTP/1.1
Host: api.groq.com
```

### 例子 2：带查询参数的请求

**客户端请求：**
```
GET /path?key=value HTTP/1.1
Host: localhost:8000
```

**转发到上游：**
```
GET /path?key=value HTTP/1.1
Host: api.groq.com
```

### 例子 3：POST 请求

**客户端请求：**
```
POST /api/chat HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{"message": "Hello"}
```

**转发到上游：**
```
POST /api/chat HTTP/1.1
Host: api.groq.com
Content-Type: application/json

{"message": "Hello"}
```

### 例子 4：重定向处理

**上游返回重定向：**
```
HTTP/1.1 301 Moved Permanently
Location: https://api.groq.com/new-path
```

**返回给客户端：**
```
HTTP/1.1 301 Moved Permanently
Location: https://api.groq.com/new-path
```

> ✅ 客户端会收到重定向响应，由客户端决定是否跟随

## 技术细节

### Deno 代理实现

**核心特性：**

- **请求头处理**：
  - 自动设置 `Host` 头为上游目标主机
  - 保留所有其他请求头（用户认证、Content-Type 等）
  - 删除 hop-by-hop 头（Connection、Keep-Alive、Transfer-Encoding、Upgrade）

- **请求体处理**：
  - 支持 GET、HEAD（无请求体）
  - 支持 POST、PUT、PATCH、DELETE（有请求体）
  - 请求体被缓存到内存（适合中等大小的请求）

- **重定向策略**：
  - 使用 `redirect: "manual"` 禁用自动重定向
  - 上游的所有 3xx 响应原样返回给客户端

- **错误处理**：
  - 捕获网络错误、读取错误等
  - 返回 502 Bad Gateway 错误

### 启动脚本特性

**entrypoint.sh 的职责：**

1. **动态代码加载**：
   - 从 `DENOTS_RAW_URL` 下载最新的 `deno.ts`
   - 支持灰度发布：更新代理逻辑而无需重新构建镜像

2. **安全校验**：
   - 可选的 SHA256 校验机制
   - 防止意外的文件篡改

3. **原子操作**：
   - 使用临时文件确保替换的原子性
   - 临时文件在 EXIT 时自动清理

4. **可靠启动**：
   - 使用 `set -euo pipefail` 确保任何错误都会导致脚本退出
   - 使用 `exec` 执行 deno，确保容器正确处理信号

## Docker 镜像详情

### 基础镜像

```dockerfile
FROM denoland/deno:alpine
```

- **Deno 官方镜像**：基于 Alpine Linux，体积小，运行快
- **预安装依赖**：deno runtime 已配置

### 依赖

```dockerfile
RUN apk add --no-cache curl ca-certificates
```

- **curl**：用于下载远程代码
- **ca-certificates**：用于 HTTPS 验证

### 暴露端口

```dockerfile
EXPOSE 8000
```

- 代理服务在容器内部监听 `0.0.0.0:8000`

## 使用场景

### 场景 1：API 聚合网关

将多个上游 API 聚合到一个统一的入口：

```bash
# 代理到 Groq API
docker run -p 8000:8000 \
  -e DENO_TARGET_HOST=api.groq.com \
  proxy-api:latest
```

### 场景 2：灰度发布

更新代理逻辑而无需重启容器：

```bash
# 更新代码到 GitHub
git push origin main

# 重启容器时自动加载最新代码
docker restart proxy-api-container
```

### 场景 3：请求日志和分析

修改 `deno.ts` 添加日志功能：

```typescript
console.log(`[${new Date().toISOString()}] ${method} ${targetUrl}`);
```

提交到 GitHub，容器下次启动时自动更新。

### 场景 4：请求修改和转换

在 `deno.ts` 中添加自定义逻辑：

```typescript
// 添加自定义 header
headers.set("X-Custom-Header", "value");

// 修改请求体
// body = modifyBody(body);
```

## 常见问题

### Q: 为什么不自动跟随重定向？

**A:** 这个设计使代理更加透明和灵活。客户端可以根据自己的需求决定是否跟随重定向，而不是由代理决定。这特别适用于需要跟踪重定向链的情况。

### Q: 如何处理大文件上传？

**A:** 当前实现将整个请求体缓存到内存中。如果需要处理大文件，建议修改 `deno.ts` 使用流式处理（使用 `ReadableStream` 而不是 `arrayBuffer()`）。

### Q: 如何���证代理正常工作？

**A:** 查看容器日志：

```bash
docker logs proxy-api-container
```

应该看到类似的输出：
```
Downloading deno.ts from: https://raw.githubusercontent.com/xiongli870110-hue/proxy_api_docker/main/deno.ts
Updated /app/deno.ts
Listening on http://0.0.0.0:8000
```

### Q: 如何设置 SHA256 校验？

**A:** 先计算文件的哈希值，然后在运行容器时指定：

```bash
# 计算哈希值
sha256sum deno.ts

# 运行容器时指定
docker run -p 8000:8000 \
  -e DENOTS_SHA256=abc123def456... \
  proxy-api:latest
```

### Q: 支持 HTTP/2 吗？

**A:** 当前使用的 Deno `fetch` API 支持 HTTP/2，但主要取决于上游服务器的支持。

## 开发和定制

### 修改代理逻辑

编辑 `deno.ts` 文件，例如添加请求日志：

```typescript
Deno.serve({ hostname: "0.0.0.0", port: 8000 }, async (request) => {
  try {
    const incoming = new URL(request.url);
    console.log(`[${new Date().toISOString()}] ${request.method} ${incoming.pathname}`);
    // ... rest of the code
  }
});
```

### 本地测试

使用 Deno 在本地直接运行：

```bash
# 设置环境变量并运行
DENO_TARGET_HOST=api.example.com \
DENO_TARGET_PROTOCOL=https \
deno run --allow-net --allow-env deno.ts
```

### 构建自定义镜像

修改 `Dockerfile` 或 `entrypoint.sh` 后，重新构建：

```bash
docker build -t proxy-api:custom .
```

## 部署建议

### 生产环境

1. **设置 SHA256 校验**：确保每次加载的代码都是预期的版本
2. **使用镜像标签**：使用具体的版本标签而不是 `latest`
3. **配置网络策略**：限制容器只能访问必要的外部主机
4. **监控和日志**：收集容器日志并监控性能
5. **健康检查**：添加健康检查以确保代理正常运行

### 示例：Docker Compose

```yaml
version: '3.8'

services:
  proxy:
    build: .
    ports:
      - "8000:8000"
    environment:
      DENO_TARGET_HOST: api.groq.com
      DENO_TARGET_PROTOCOL: https
      DENOTS_SHA256: abc123def456...
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 许可证

此项目采用 MIT 许可证。详见项目文件。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关链接

- [Deno 官方文档](https://docs.deno.com/)
- [Docker 文档](https://docs.docker.com/)
- [Alpine Linux](https://alpinelinux.org/)
