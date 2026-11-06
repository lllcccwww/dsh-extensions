# DSH扩展（dsh-extensions）

一个设置入口，收着若干小功能。界面和「通用设置」同构：从上到下一行一项，左边标题加一句说明，右边控件；编辑器这类大控件整行铺开。目前两行：

## 安装

插件管理器 → 添加插件，粘贴下面的 Git 地址，装好后重启应用：

```
github:lllcccwww/dsh-extensions
```

开发时也可以把本地目录直接交给 `plugin_manager` 的 `install_bundle`（本仓库根目录就是插件包）。

| 配置项 | 做什么 |
|---|---|
| 全局 AGENTS.md | 直接编辑 `$DSH_HOME/AGENTS.md`（默认 `~/.dsh/AGENTS.md`）；只有输入框，停顿 0.7 秒自动保存，另有一行状态提示 |
| 回答完成通知 | 窗口最小化或不在前台时，回答结束发系统通知；点击恢复窗口并打开会话 |

「通用设置」里仍保留「回答完成通知」的快捷开关（与包内同一状态双向同步）。

## 为什么要合成一个包

平台对外暴露的 Slots 只有 `inject` / `register` / `entries` / `subscribe` / `getVersion`，**没有「声明新 slot」的入口**；`settings.section`、`settings.general.item` 这些 owner key 是内置包在编译期定的契约。因此「外壳包 + 独立子插件包」无法成立，子插件没有地方挂。可行的综合形态就是**一个包、多个 feature、一个分区内纵向配置行**。

代价要认：一个版本、一次安装、一个失败域。client 侧每一项套 `PanelBoundary`，一项崩了只影响那一项；host 侧每个 feature 的 `setup` 单独 try/catch。

## 结构

```
index.js                   host 聚合层：遍历 features 注册路由、执行 setup
client.js                  client 聚合层（单文件，因为模块加载器不支持相对导入）：
                           字典、共享组件、两个配置项组件、通用设置行
features/registry.js       feature 清单与顺序
features/instructions/     host：/dh/instructions/state|save
features/notify/           host：/dh/notify/focus + assets（focus-window.ps1、FocusNative.cs）
shared/paths.js            DSH_HOME / DSH_AGENTS_HOME 解析，与加载器一致
shared/http.js             readBody / sendJson
shared/fs.js               原子写入
test/host.test.mjs         聚合层自测（临时 DSH_HOME）
locale/{zh,en}.json        插件列表里的标题与描述
icon.svg                   插件图标
```

## 加一个新 feature

1. 建 `features/<id>/host.js`（可选），导出 `{ id, setup?, routes }`，路由统一挂 `/dh/<id>/...`。
2. 在 `features/registry.js` 里 import 并加入数组。
3. 在 `client.js` 里加一个配置项组件（结构：`dx-setting` > `settingHead(t, titleKey, descKey)` > 控件），并在 `DhExtensionsSection` 里用 `PanelBoundary` 追加一项。
4. 字典同时补 `zh` / `en`（键加 `<id>.` 前缀），面板用 `translator(props)` 取 `t`。
5. 在 `test/host.test.mjs` 里补路由断言。

往宿主已有设置页（如 `settings.general.item`）插行时，行标题后要用 `extensionBadge(t)` 带上「扩展」小徽标，让用户分得清内置项和扩展项；行组件还要自带 `<style>`，因为宿主页面不会挂载本包的分区组件。

配置项允许再分子项：`.dx-sub-list` 里每行 `.dx-sub-row`，左侧同样是「名称 + 描述」（`dx-sub-title` / `dx-sub-desc`），右侧放控件或只读取值（`dx-sub-value`）。通知页的「系统通知权限」「发送测试通知」就是子项；左侧的竖线表示层级，不再额外加卡片或缩进层级文案。

配置项组件收到的 props 只有 `{ t }`（`t` 已绑定本包命名空间），不要 `require` 任何 Harness Client 包。

## 迁移与回退

- 通知功能沿用原插件的 `localStorage` 键 `dsh.turn-notify.enabled`，开关状态无缝保留。
- 旧的 `dsh-answer-notify` 与 `@local/dsh-personalization` 已由本包取代；两个包同时启用会各监听一次 `api-session/status`，一轮回答弹两条通知，所以必须卸载旧包。
- 回退：`plugin_manager` 重新安装旧包并移除本包即可，数据（AGENTS.md 与开关）不受影响。

## 自测

```powershell
node test/host.test.mjs
```

覆盖：三个路由都已挂载、指令页的缺失/创建/摘要冲突/force/超限/方法不允许、共享根探测、通知页 GET 探针与 405。测试用 `DH_EXTENSIONS_NO_FOCUS_HELPER=1` 跳过 `csc.exe` 预编译。

## 已知边界

- 通知由页面内的 `Notification` API 发出，应用退出后不会通知。
- 编辑页的 65,536 字节是 `dsh-base` 给 `dsh-agent-instructions` 的默认 `maxBytes` 提示值；profile 改过预算时以加载器配置为准。
- 文件超过 1 MiB 时只读前 1 MiB，任何保存都会失败并在状态行报错。
- 自动保存与外部编辑冲突时，以编辑器中的文字为准（自动带 `force` 重试一次）；关闭设置面板时会对未保存的草稿补发一次 `keepalive` 请求。
- 本项目是 `link:` 安装：改 `client.js` 需重启应用才会加载新的 JS 模块；只改页面文案也要重启。
- 侧边栏账号菜单（设置 / 意见反馈 / 退出登录）无法注入自定义项：它由 `ui-settings-account` 的 `AccountMenu` 整体渲染，`settings.launcher` 在宿主里是 `kind: "single"`，组件内部也没有子槽；同时 `openSection(id)` 只传给 `settings.onboarding` 与外壳内部，普通插件无法让设置直接落到本分区。要改只能整套替换账号菜单，代价不可接受。


