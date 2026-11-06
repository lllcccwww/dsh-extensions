# dsh-extensions 开发说明

面向维护者；面向用户的说明在 `README.md`。

## 这是什么

DSH（DeepSeek Harness）的一个本地 bundle：向设置面板注册「DSH扩展」分区，承载若干 feature；同时向「通用设置」插入通知快捷开关。仓库根目录就是插件包（`package.json` 在此），通过 `link:` 装进 `~/.dsh/profiles/<profile>`。

## 平台约束（决定了架构，不要重试）

- 插件不能声明新的 slot。对外只有 `inject` / `register` / `entries` / `subscribe` / `getVersion`；`settings.section`、`settings.general.item` 这些 owner key 由内置包在编译期定义。因此做不了「外壳包 + 独立子插件包」，只能**一个包内多个 feature**。
- 账号菜单（设置 / 意见反馈 / 退出登录）无法插入自定义项：它由 `ui-settings-account` 的 `AccountMenu` 整体渲染，`settings.launcher` 是 `kind: "single"` 且组件内部无子槽；`openSection(id)` 只传给 `settings.onboarding` 与设置外壳内部。要改只能整套替换账号菜单，代价不可接受。
- Client 模块加载器不支持相对导入，`client.js` 必须是单文件；React 从模块表取。不要 `require` 任何 `@deepseek-ai` Client 包，控件自己写。
- 一个版本、一次安装、一个失败域：client 每项套 `PanelBoundary`，host 每个 feature 的 `setup` 单独 try/catch。

## 结构

```
index.js                   host 聚合层：遍历 features 注册路由、执行 setup
client.js                  client 聚合层（单文件）：字典、行组件、两个配置项、通用设置行
features/registry.js       feature 清单与激活顺序
features/instructions/     host：/dh/instructions/state | /save
features/notify/           host：/dh/notify/focus + assets（focus-window.ps1、FocusNative.cs）
shared/paths.js            DSH_HOME / DSH_AGENTS_HOME 解析，与 dsh-home-paths 一致
shared/http.js             readBody / sendJson
shared/fs.js               原子写入
test/host.test.mjs         聚合层自测（临时 DSH_HOME）
locale/{zh,en}.json        插件列表里的标题与描述
```

## 新增一个 feature

1. host：`features/<id>/host.js` 默认导出 `{ id, setup?(ctx), routes: [{ path, handler }] }`，路由统一挂 `/dh/<id>/...`。
2. 注册：在 `features/registry.js` 里 import 并加入数组，顺序即激活顺序。
3. client：在 `client.js` 加配置项组件（`dx-setting` > `settingHead(t, titleKey, descKey)` > 控件），在 `DhExtensionsSection` 里用 `PanelBoundary` 追加一项。
4. 文案：`zh` / `en` 同步补齐，键统一加 `<id>.` 前缀；组件内用 `translator(props)` 取 `t`。
5. 测试：在 `test/host.test.mjs` 补路由与状态码断言。

## UI 约定

- 每行统一「左侧名称 + 一句描述，右侧控件」；大控件（如编辑器）在名称下方整行铺开。
- 分隔线只属于顶层配置项。子项用 `.dx-sub-list` / `.dx-sub-row`，层级靠父项标题、12px 缩进和更小的字号表达，**子项之间不加线、不加卡片**。
- 往宿主已有设置页插行时：组件必须自带 `<style>`（宿主页面不会挂载本包的分区组件），行标题后加 `extensionBadge(t)`。
- 文案克制：一行说明，不写长段落；状态信息并入描述或右侧取值。
- 颜色、圆角、边框只用 `--dsw-alias-*` token，字面颜色只用于图标。

## 文件与保存

- 只读写 `$DSH_HOME/AGENTS.md`（默认 `~/.dsh/AGENTS.md`）；路径解析必须与加载器一致：`$DSH_HOME` 优先，其次 `~/.dsh`。
- 写入用原子替换（同目录临时文件 + rename，失败回退原地写）。
- 大小上限与加载器一致（1 MiB）；超限拒绝保存并在状态行报错。
- 编辑器没有保存按钮：700ms 防抖自动保存；409 冲突时以编辑器内容为准，带 `force` 重试一次；关闭设置面板时对未保存草稿补发一次 `keepalive` 请求。

## 测试与验证

```powershell
node --check client.js
node test/host.test.mjs
```

测试使用临时 `DSH_HOME`；`DH_EXTENSIONS_NO_FOCUS_HELPER=1` 跳过 `csc.exe` 预编译。UI 改动要刷新页面后在「设置 → DSH扩展」实际检查；无法验证渲染时明确说明，不要仅凭安装成功就宣称样子正确。

## 安装与发布

- 本地：`plugin_manager` 的 `install_bundle` 指向本目录；这是 `link:` 安装，改 `client.js` 或 host 代码后必须重启应用才会加载新的 JS 模块。
- 发布：`main` 推送到 <https://github.com/lllcccwww/dsh-extensions>，用户用 `github:lllcccwww/dsh-extensions` 安装。
- 改 `package.json` 的名称会同时影响 `cordis.patch.yml` 的 `name` 与 `client.js` 的模块 id，需要重新安装 profile。

## 兼容与迁移

- 通知开关沿用 `localStorage` 键 `dsh.turn-notify.enabled`，不要改。
- 与 `dsh-answer-notify` 共存会各监听一次 `api-session/status`，一轮回答弹两条通知；迁移时先卸载旧包。
- 模块 id 前缀 `dh-` 与路由前缀 `/dh/` 是既有约定，改动会导致已安装 profile 失配，非必要不动。
