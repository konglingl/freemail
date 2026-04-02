# Freemail - 临时邮箱服务

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/idinging/freemail)

一个基于 Cloudflare Workers + D1 + R2 构建的**开源临时邮箱服务**，支持邮件接收、发送、转发、用户管理等完整功能。

**当前版本：V5.0** - 全新 UI 设计，深色模式支持，优化用户管理页面的布局

`转发的地址需要在cloudflare Email Addresses中验证`

📖 **[一键部署指南](docs/yijianbushu.md)** | 📬 **[Resend 发件配置](docs/resend.md)** | 📚 **[API 文档](docs/api.md)**

## 📸 项目展示
### 体验地址： https://mailexhibit.dinging.top/

### 体验账号： guest
### 体验密码： guest
### 页面展示

#### 首页
![首页展示](./pic/light/shouye.png)

#### 所有邮箱
![所有邮箱](./pic/light/suoyouyouxiang.png)

#### 用户管理
![用户管理](./pic/light/yonghuguanli.png)

#### 单个邮箱登录
![单个邮箱登录](./pic/dange邮箱登录.png)

#### [浅色模式展示](docs/zhanshi-light.md) | [深色模式展示](docs/zhanshi-dark.md)

## 功能特性

| 类别 | 特性 |
|------|------|
| 📧 **邮箱管理** | 随机生成临时邮箱 · 多域名支持 · 置顶/收藏 · 历史记录 · 邮箱搜索 |
| 💌 **邮件功能** | 实时接收 · 自动刷新 · 验证码智能提取 · HTML/纯文本 · 邮件转发 |
| ✉️ **发件支持** | Resend API 集成 · 多域名密钥 · 批量发送 · 定时发送 · 发件记录 |
| 👥 **用户管理** | 三层权限模型 · 用户/邮箱分配 · 邮箱单点登录 · 登录权限控制 |
| 🎨 **现代界面** | 毛玻璃效果 · 响应式设计 · 移动端适配 · 列表/卡片视图 |
| ⚡ **技术架构** | Cloudflare Workers · D1 数据库 · R2 存储 · Email Routing |

> 💡 邮箱用户自行修改密码功能默认关闭，如需开启请将 `mailbox.html` 第 77-80 行取消注释。

## 版本历史

| 版本 | 主要更新 |
|------|----------|
| **V5.0** | 全新 UI · SVG 图标 · 深色模式 · 管理面板统计与布局优化 |
| **V4.8** | 单个邮箱转发 · 收藏功能 · 按状态筛选 |
| **V4.5** | 多域名 Resend 密钥配置 |
| **V4.0** | 邮箱地址单点登录 · 全局邮箱管理 · 邮箱搜索 |
| **V3.5** | 数据库优化 · R2 存储 EML · 移动端适配 |
| **V3.0** | 三层权限模型 · 用户管理后台 |
| **V2.0** | Resend 发件集成 · 邮箱置顶 |
| **V1.0** | 邮箱生成 · 邮件接收 · 验证码提取 |

## 部署配置

### 快速开始

1. **一键部署**：点击顶部按钮，按照 [部署指南](docs/yijianbushu.md) 完成配置
2. **配置邮件路由**（收件必需）：域名 → Email Routing → Catch-all → 绑定 Worker
3. **配置发件**（可选）：参考 [Resend 配置教程](docs/resend.md)

> 使用 Git 集成部署时，请在 Workers → Settings → Variables 中手动配置环境变量

### 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| TEMP_MAIL_DB | D1 数据库绑定 | 是 |
| MAIL_EML | R2 存储桶绑定 | 是 |
| MAIL_DOMAIN | 邮箱域名，多个用逗号分隔（兼容旧配置；运行时会过滤根域名） | 是 |
| ROOT_MAIL_ZONE | 根域名，例如 `example.com`；系统只允许其子域名作为邮箱后缀 | 建议 |
| ADMIN_PASSWORD | 严格管理员密码 | 是 |
| ADMIN_NAME | 严格管理员用户名（默认 `admin`） | 否 |
| JWT_TOKEN | JWT 签名密钥 | 是 |
| RESEND_API_KEY | Resend 发件密钥，支持多域名配置 | 否 |
| FORWARD_RULES | 邮件转发规则 | 否 |
| CF_ZONE_ID | Cloudflare Zone ID（手动新增邮箱后缀自动建 DNS 时需要） | 按需 |
| CF_API_TOKEN | Cloudflare API Token（请用 secret 配置，不要明文写入仓库） | 按需 |
| AUTO_ROTATION_ENABLED | 是否启用自动轮换域名（后续功能） | 否 |
| AUTO_DOMAIN_PREFIX | 自动轮换域名前缀（默认 `auto`） | 否 |

<details>
<summary><strong>RESEND_API_KEY 配置格式</strong></summary>

```bash
# 单密钥（向后兼容）
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxx"

# 键值对格式（推荐）
RESEND_API_KEY="domain1.com=re_key1,domain2.com=re_key2"

# JSON格式
RESEND_API_KEY='{"domain1.com":"re_key1","domain2.com":"re_key2"}'
```

系统会根据发件人域名自动选择对应的 API 密钥。
</details>

<details>
<summary><strong>FORWARD_RULES 配置格式</strong></summary>

规则按前缀匹配，`*` 为兜底规则。

⚠️ **重要**：转发目标邮箱必须在 Cloudflare 控制台中验证后才能使用：
1. 进入 Cloudflare 控制台 → 域名 → 电子邮件 → 电子邮件路由
2. 切换到「目标地址」选项卡
3. 点击「添加目标地址」，输入转发目标邮箱
4. 前往目标邮箱收取验证邮件并点击确认链接

![转发目标地址验证](pic/resend/zhuanfa.png)

```bash
# 键值对格式
FORWARD_RULES="vip=a@example.com,news=b@example.com,*=fallback@example.com"

# JSON格式
FORWARD_RULES='[{"prefix":"vip","email":"a@example.com"},{"prefix":"*","email":"fallback@example.com"}]'

# 禁用转发
FORWARD_RULES="" 或 "disabled" 或 "none"
```
</details>

## 自动部署

- GitHub Actions 自动部署说明：`docs/action-deployment.md`
- 已提供工作流：
  - `.github/workflows/deploy-cloudflare.yml`
  - `.github/workflows/sync-upstream.yml`

## 域名池 / 自动轮换说明

### 核心规则

- 系统运行时会优先使用 D1 中的 `mail_domains` 域名池
- `MAIL_DOMAIN` 仅作为兼容旧部署的初始种子/回退来源
- 根域名（`ROOT_MAIL_ZONE`）不会作为邮箱后缀发放
- 只允许其子域名作为邮箱后缀
- 手动添加的域名默认长期保留
- auto 域名可随机轮换或指定 label 轮换

### 管理 API（严格管理员）

- `GET /api/admin/mail-domains`
- `POST /api/admin/mail-domains/manual`
- `POST /api/admin/mail-domains/rotate-random`
- `POST /api/admin/mail-domains/rotate-custom`
- `POST /api/admin/mail-domains/restore-dns`
- `POST /api/admin/mail-domains/remove-dns`

#### 示例

```bash
# 查看域名池
curl -H "Cookie: iding-session=<token>" https://your.domain/api/admin/mail-domains

# 手动新增长期域名（输入 label）
curl -X POST https://your.domain/api/admin/mail-domains/manual \
  -H "Content-Type: application/json" \
  -H "Cookie: iding-session=<token>" \
  -d '{"label":"aa"}'

# 随机轮换 auto 域名
curl -X POST https://your.domain/api/admin/mail-domains/rotate-random \
  -H "Cookie: iding-session=<token>"

# 指定 label 轮换 auto 域名
curl -X POST https://your.domain/api/admin/mail-domains/rotate-custom \
  -H "Content-Type: application/json" \
  -H "Cookie: iding-session=<token>" \
  -d '{"label":"hello123"}'

# 临时恢复 retired auto 域名 DNS（60 分钟）
curl -X POST https://your.domain/api/admin/mail-domains/restore-dns \
  -H "Content-Type: application/json" \
  -H "Cookie: iding-session=<token>" \
  -d '{"domain":"auto04031234ab.example.com","durationMinutes":60}'

# 移除 retired auto 域名 DNS
curl -X POST https://your.domain/api/admin/mail-domains/remove-dns \
  -H "Content-Type: application/json" \
  -H "Cookie: iding-session=<token>" \
  -d '{"domain":"auto04031234ab.example.com"}'
```

### Cloudflare 相关配置

如需手动添加域名时自动创建 MX/SPF，需额外配置：

- `ROOT_MAIL_ZONE`
- `CF_ZONE_ID`
- `CF_API_TOKEN`（建议使用 `wrangler secret put CF_API_TOKEN`）

### 自动轮换

- `AUTO_ROTATION_ENABLED=true` 时，Worker cron 会按 `wrangler.toml` 中的计划自动执行轮换
- 目前默认 cron 为每小时一次：`0 * * * *`

## 故障排除

<details>
<summary><strong>常见问题</strong></summary>

1. **邮件接收不到**：检查 Email Routing 配置、MX 记录、`MAIL_DOMAIN` / `ROOT_MAIL_ZONE` 配置，以及对应二级域名 DNS 是否已创建
2. **数据库连接错误**：确认 D1 绑定名为 `TEMP_MAIL_DB`，检查 database_id
3. **登录问题**：确认 ADMIN_PASSWORD 和 JWT_TOKEN 已设置，清除浏览器缓存
4. **界面显示异常**：检查静态资源路径，查看浏览器控制台错误
5. **手动新增域名失败**：确认已配置 `CF_ZONE_ID`，并已通过 `wrangler secret put CF_API_TOKEN` 写入 Cloudflare Token
</details>

<details>
<summary><strong>调试技巧</strong></summary>

```bash
# 本地调试
wrangler dev

# 查看实时日志
wrangler tail

# 检查数据库
wrangler d1 execute TEMP_MAIL_DB --command "SELECT * FROM mailboxes LIMIT 10"
```
</details>

## 注意事项

- **静态资源缓存**：更新后在 Cloudflare 控制台 Purge Everything，浏览器强制刷新
- **R2/D1 费用**：有免费额度限制，建议定期清理过期邮件
- **安全**：生产环境务必修改默认的 `ADMIN_PASSWORD` 和 `JWT_TOKEN`

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=idinging/freemail&type=Date)](https://www.star-history.com/#idinging/freemail&Date)

## 联系方式

- 微信：`iYear1213`

## Buy me a coffee

如果你觉得本项目对你有帮助，欢迎赞赏支持：

<p align="left">
  <img src="pic/alipay.jpg" alt="支付宝赞赏码" height="400" />
  <img src="pic/weichat.jpg" alt="微信赞赏码" height="400" />
</p>

## 许可证

Apache-2.0 license

## 本仓库维护说明（konglingl）

- 当前正式维护仓库为 `konglingl/freemail`。
- Cloudflare 线上变更以本仓库 `master` 为准，不再使用历史 `mailfree` 分支线。
- 本机 Git 提交/推送身份固定为 `konglingl <272122676+konglingl@users.noreply.github.com>`。
- 若后续通过 Wrangler 本地部署，请优先从 `master` 分支操作，并在推送前后保持 GitHub / 本地 / Cloudflare 三方一致。

