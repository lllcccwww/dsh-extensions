# dsh-extensions 开发说明

面向维护者；面向用户的说明在 `README.md`。

## 这是什么

DSH（DeepSeek Harness）的一个本地 bundle：向设置面板注册「DSH扩展」分区，承载若干 feature。所有扩展入口和配置都只放在这个分区里，不往宿主设置页插入行或开关。仓库根目录就是插件包（`package.json` 在此），通过 `link:` 装进 `~/.dsh/profiles/<profile>`。

## 平台约束（决定了架构，不要重试）

- 插件不能声明新的 slot。对外只有 `inject` / `register` / `entries` / `subscribe` / `getVersion`；`settings.section` 由内置包在编译期定义，本包只注册这一个分区。因此做不了「外壳包 + 独立子插件包」，只能**一个包内多个 feature**。
- 账号菜单（设置 / 意见反馈 / 退出登录）无法插入自定义项：它由 `ui-settings-account` 的 `AccountMenu` 整体渲染，`settings.launcher` 是 `kind: "single"` 且组件内部无子槽；`openSection(id)` 只传给 `settings.onboarding` 与设置外壳内部。要改只能整套替换账号菜单，代价不可接受。
- Client 模块加载器不支持相对导入，`client.js` 必须是单文件；React 从模块表取。不要 `require` 任何 `@deepseek-ai` Client 包，控件自己写。
- 一个版本、一次安装、一个失败域：client 每项套 `PanelBoundary`，host 每个 feature 的 `setup` 单独 try/catch。
- 沙箱标识（`S-1-4-*`）每个工作区不同，**不要写死**；它来自工作区根目录的 ACL。`icacls` 加不了这个标识（报 “No mapping between account names and security IDs”），`Set-Acl` 在受保护 DACL 上会因 `SeSecurityPrivilege` 失败；DACL 用文件系统安全 API（`FileSystemInfo.GetAccessControl/SetAccessControl`，PowerShell 7 走 `FileSystemAclExtensions`），低完整性标签仍用 `icacls /setintegritylevel`。
- 带中文的 `.ps1` 必须存成 **UTF-8 with BOM**：Windows PowerShell 5.1 没有 BOM 会按 ANSI 读，中文变乱码、脚本直接解析失败。测试里有首字节断言；用编辑工具改过这类脚本后要确认 BOM 还在。

## 结构

```
index.js                   host 聚合层：遍历 features 注册路由、执行 setup
client.js                  client 聚合层（单文件）：字典、行组件、各 feature 的配置项
features/registry.js       feature 清单与激活顺序
features/instructions/     host：/dh/instructions/state | /save
features/notify/           host：/dh/notify/focus + assets（focus-window.ps1、FocusNative.cs）
features/sandbox/          host：/dh/sandbox/repair + assets（open-repair.ps1 启动器、repair-sandbox-acl.ps1 提权修复；全量核对用内联 C# 编译，逐对象循环只在有对象缺权限时跑）
features/compat/           host：/dh/compat/report（自检版本要求、bundle 补丁、host/client 入口、前后端路由契约）
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

## UI 规则

这些规则来自返工，按此实现可少走一轮。

- **一条纵列，不要 Tabs**：分区就是一列配置行，从上到下排列；不要分页、不要页签外壳。
- **行结构统一**：左侧「名称 + 一行描述」，右侧控件；编辑器这类大控件在名称下方整行铺开。
- **一项一个控件**：开关、按钮各自成项。多个动作不要并排塞进行尾，也不要做成说明行里的文字链接。
- **子项承载控件**：需要多个控件时拆子项——父项只留名称与描述，每个子项负责一个控件。用 `.dx-sub-list` / `.dx-sub-row`，缩进 12px、标题小一号。
- **分隔线只属于顶层配置项**：子项之间只用间距和缩进，不加线、不加竖线、不加卡片；否则会被读成新的配置项边界。
- **不套外壳**：除输入控件自身的边框，不再包一层卡片、底色或圆角容器。
- **文案克制**：不写分区介绍、长段落、可折叠说明；状态信息写进描述或作为右侧取值，一行说完。
- **浮层要留白**：计数、保存状态等浮层放进输入框内部时，给输入框补对应方向的内边距，浮层设 `pointer-events: none`。
- **配置只进本分区**：所有入口和配置只加在「DSH扩展」分区里，不要往宿主设置页（如 `settings.general.item`）插入行、开关或徽标；宿主页面有自己的排布和文案，插进去既重复又难保持一致。工作区右键菜单是唯一例外，因为它承载的是「某个工作区」的上下文，设置页没有这个上下文：分区里的「工作区菜单」父项下有两个子项开关，`修复沙箱权限`（`order` 250，Windows 专属，定位 200 与删除 300 之间）和 `归档全部会话`（`order` 260）。两个菜单项各自跟随对应的开关注册；`归档全部会话` 仅在还有未归档的已有会话（不含「新会话」空草稿）时出现，直接通过 `workspaces` 服务批量归档。不要据此再往别处加入口。
- **只用主题 token**：颜色、边框、圆角用 `--dsw-alias-*`，字面颜色只用于图标。

## 实现规则

- **状态存 code，文案后置**：权限、模式等状态存枚举（如 `granted | denied | default | unsupported`），本地化只发生在渲染时；不要用翻译后的字符串比较或做判断。
- **编辑类配置自动保存**：700ms 防抖，不提供保存/重载按钮；同一时刻只允许一个写入（布尔标记）；响应返回时若草稿已被继续修改，不要覆盖用户输入，只更新已保存状态；409 冲突出 `force` 重试一次，以编辑器内容为准；面板卸载时对未保存草稿补发 `keepalive` 请求。
- **失败必须可见**：保存、读取失败在状态行给出原因，不要静默吞掉。
- **文件边界**：只写 `$DSH_HOME/AGENTS.md`；原子替换（临时文件 + rename，失败回退原地写）；上限与加载器一致（1 MiB）。
- **不要拿 UI 文案当协议**：前后端契约用稳定的 code、路径、字段名，文案只供展示。
- **不要给本包加 `engines.dsh`**：DSH 会在启动时按它跳过整个 bundle，自检面板也就无法打开。兼容性由 `features/compat` 的只读报告呈现；用户需要 DSH 代为拦截时再显式加。
- **`dsh.client.inject` 不是可解析的 npm 依赖**：它标识客户端模块图里的包名，部分由应用自身提供，profile 里不一定装；不要用 `require.resolve` 判断它是否存在，只校验数组形状。

## 测试与验证

```powershell
node --check client.js
node test/host.test.mjs
```

测试使用临时 `DSH_HOME`；`DH_EXTENSIONS_NO_FOCUS_HELPER=1` 跳过 `csc.exe` 预编译，`DH_EXTENSIONS_NO_SANDBOX_LAUNCH=1` 阻止测试弹 UAC，`DH_EXTENSIONS_RUNTIME_VERSION` 固定自检用的 DSH 版本，避免依赖本机 profile。UI 改动刷新页面后在「设置 → DSH扩展」实际检查；无法验证渲染时明确说明，不要凭安装成功就宣称样式正确。

工作区菜单项不在设置分区里，注册后要重启应用，并在任意工作区的「…」菜单确认它出现；修复脚本可先用 `-Check`（启动器）和 `-DryRun`（提权脚本）验证读取与统计，这两档都不改权限。

## 安装与发布

- 本地：`plugin_manager` 的 `install_bundle` 指向本目录；`link:` 安装下改 `client.js` 或 host 代码后必须完全退出应用（含托盘进程）再启动。只刷新页面只更新 client，host 仍是旧代码（新 route 会 404）。
- **换路径或重装**：同名包已安装时 `install_bundle` 会返回 `already-installed`，必须先 `remove_bundle` 再 `install_bundle`，否则链接仍指向旧路径。
- 发布：`main` 推送到 <https://github.com/lllcccwww/dsh-extensions>，用户用 `github:lllcccwww/dsh-extensions` 安装。
- 改 `package.json` 名称会同时影响 `cordis.patch.yml` 的 `name` 与 `client.js` 的模块 id，需要重新安装 profile。

## 兼容与迁移

- 通知开关沿用 `localStorage` 键 `dsh.turn-notify.enabled`，不要改。
- 工作区菜单开关沿用 `localStorage` 键 `dsh.workspace-repair.enabled`，默认开启；它只控制菜单贡献是否注册，不影响修复能力。
- 工作区归档开关使用 `localStorage` 键 `dsh.workspace-archive.enabled`，默认开启；它只控制菜单贡献是否注册，不影响归档能力。
- 与 `dsh-answer-notify` 共存会各监听一次 `api-session/status`，一轮回答弹两条通知；迁移时先卸载旧包。
- 模块 id 前缀 `dh-` 与路由前缀 `/dh/` 是既有约定，改动会导致已安装 profile 失配，非必要不动。
- 兼容性报告是只读协议：路由 `/dh/compat/report`，顶层 `status` / `runtimeVersion` / `groups`，每条 issue 的 `code` / `level` 稳定；文案只在 `client.js` 的 `compat.*` 键里。

## 提交

提交前先 `git status`：确认没有临时脚本、编辑器残留、空文件；`node --check` 与 host 测试通过后再提交。
