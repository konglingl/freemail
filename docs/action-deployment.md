# 🚀 Cloudflare Workers 自动部署指南

本项目已提供 GitHub Actions 自动部署到 Cloudflare Workers 的工作流。

## 必填 Secrets

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## 常用 Variables / Secrets

- `NAME`
- `D1_DATABASE_ID`
- `D1_DB_NAME`
- `R2_BUCKET_NAME`
- `ADMIN_NAME`
- `ADMIN_PASSWORD`
- `JWT_TOKEN`
- `MAIL_DOMAIN`
- `ROOT_MAIL_ZONE`
- `CF_ZONE_ID`
- `AUTO_ROTATION_ENABLED`
- `AUTO_DOMAIN_PREFIX`

## 域名池相关说明

如果你启用了本仓库新增的域名池 / 自动轮换功能，还建议额外配置：

- `ROOT_MAIL_ZONE`：根域名，例如 `example.com`
- `CF_ZONE_ID`：Cloudflare Zone ID
- `CF_API_TOKEN`：需具备 DNS 编辑权限
- `AUTO_ROTATION_ENABLED`：是否启用自动轮换
- `AUTO_DOMAIN_PREFIX`：auto 域名前缀

## 触发方式

- 推送到 `master`
- 在 GitHub Actions 页面手动运行
