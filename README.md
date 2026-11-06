# DH扩展包（dsh-extensions）

一个设置入口，收着若干小功能。目前两页：

| 页 | 做什么 |
|---|---|
| 全局 AGENTS.md | 直接编辑 `$DSH_HOME/AGENTS.md`（默认 `~/.dsh/AGENTS.md`），也就是每个会话都会加载的用户全局指令 |
| 回答完成通知 | 窗口最小化或不在前台时，回答结束发系统通知；点击恢复窗口并打开会话 |

「通用设置」里仍保留「回答完成通知」的快捷开关（与包内同一状态双向同步）。

## 为什么要合成一个包

平台对外暴露的 Slots 只有 `inject` / `register` / `entries` / `subscribe` / `getVersion`，**没有「声明新 slot」的入口**；`settings.section`、`settings.general.item` 这些 owner key 是内置包在编译期定的契约。因此「外壳包 + 独立子插件包」无法成立，子插件没有地方挂。可行的综合形态就是**一个包、多个 feature、一个分区内分页**。

代价要认：一个版本、一次安装、一个失败域。client 侧每页套 `PanelBoundary`，一页崩了只影响那一页；host 侧每个 feature 的 `setup` 单独 try/catch。

## 结构

```
index.js                   host 聚合层：遍历 features 注册路由、执行 setup
client.js                  client 聚合层（单文件，因为模块加载器不支持相对导入）：
                           字典、共享组件、两个面板、分页壳、通用设置行
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
3. 在 `client.js` 里加面板组件，并把 `{ id, titleKey, Panel }` 放进 `FEATURES`。
4. 字典同时补 `zh` / `en`（键加 `<id>.` 前缀），面板用 `translator(props)` 取 `t`。
5. 在 `test/host.test.mjs` 里补路由断言。

面板收到的 props 只有 `{ t }`（`t` 已绑定本包命名空间），不要 `require` 任何 Harness Client 包。

## 迁移与回退

- 通知功能沿用原插件的 `localStorage` 键 `dsh.turn-notify.enabled`，开关状态无缝保留。
- 页签选择存在 `dsh.dh-extensions.tab`。
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
- 文件超过 1 MiB 时只读前 1 MiB 并禁止在本编辑器保存。
- 本项目是 `link:` 安装：改 `client.js` 需重启应用才会加载新的 JS 模块；只改页面文案也要重启。
