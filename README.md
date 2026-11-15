# 工作区对话信号灯 / Workspace Status Light

A factory-style stack light for the DeepSeek Harness Web UI: it merges the state of every conversation in the workspace into one light, and sounds a buzzer when a conversation is blocked on you.

把 Harness 里所有对话的状态做成一座工厂三色指示灯，悬浮在窗口右下角；有对话被提问 / 授权 / 计划审阅打断时亮红灯并蜂鸣。

<img width="141" height="389" alt="PixPin_2026-11-15_15-33-05" src="https://github.com/user-attachments/assets/8ccf47e2-35af-46c7-b15e-3fd2de4faa1b" /><img width="112" height="382" alt="PixPin_2026-11-15_15-46-34" src="https://github.com/user-attachments/assets/959032ab-1679-4511-9921-a872579c4c24" /> https://github.com/user-attachments/assets/67405f66-87c3-471b-b92a-735012a75f86




| 灯 | 含义 | 声音 |
| --- | --- | --- |
| 红灯 | 至少有一个对话在等你：提问、授权（高权限操作）、计划审阅 | 单一频率（≈2.1 kHz）持续蜂鸣 1 秒、停 0.6 秒，循环 |
| 黄灯 | 有对话正在运行（没有在等你的） | 无声 |
| 绿灯 | 全部空闲 | 无声 |

多个对话合并规则：**等待 > 运行 > 空闲**，任何一个对话被中断（提问 / 授权）就整体显示红灯并响蜂鸣器。

外观按参考图绘制：白色顶盖、红/黄/绿三层皱纹透镜、6 mm 白色隔环、56 mm 白色灯体（无铭牌、无文字）；只取图片里的灯头部分，不含立柱、万向节与底板。比例取自参考图（透镜 50×36、隔环 6、灯体 56）。

## 安装 / Install

本仓库是一个 Harness 插件包：`package.json` 声明了 `dsh.bundle.patch` → `cordis.patch.yml`，具备该清单才能被 `dsh plugin add` 安装；也可以直接把本目录作为插件包加进 Harness 的插件管理器。

- 需要 Harness 的 **Web GUI**：浏览器半注册在 `shell.overlay` 槽位，Host 半提供 `/_dsh/status-light/state.json` 快照。
- 无第三方依赖，不需要构建步骤（`index.js` 为 Host 半，`client.js` 为浏览器半）。
- 浏览器要求一次用户手势才允许出声：点一下页面任意处即可解锁；解锁前红灯只闪不响。

## 使用

- 悬停信号塔：显示每个对话的标题与等待原因。
- 左键或右键点击信号塔：打开「信号灯设置」面板，里面是蜂鸣器静音开关、音量滑块（0–100%，松手试听）、**信号塔大小滑块（16–160 px）** 和试听按钮；点面板外面或按 Esc 关闭。
- 设置记在浏览器 `localStorage`（`dsh.status-light.muted`、`dsh.status-light.volume`、`dsh.status-light.size`）。
- 进入空闲时绿灯先闪 3 下（亮 1.2 s、灭 0.5 s），然后转为常亮。
- **有对话从“运行中”变为空闲时**会短促提示两声：`0.3 s 响 / 0.1 s 停 / 0.3 s 响`，停 0.3 s 后再重复一次（共 4 声，约 1.7 秒）；即使其他对话仍在运行（黄灯）也会响。静音时同红灯一样不出声。
- `/_dsh/status-light/probe` 是只读诊断端点：列出每个活动会话的待审批数与 `userQuestions` 投影，排查“该响没响”时用。

## 结构

- `index.js`：Host 半。等待状态取自三处：会话日志里**未配对的 `approval/asked`**（工具审批、沙箱升权——只要人类还在等就是待定）、`userQuestions` 会话投影的 `active`（定时提问、计划审阅）、`ask_user_question` 工具的执行窗口（阻塞提问）；再用 `sessionController.list()` 汇总运行状态，在 `/_dsh/status-light/state.json` 上提供只读快照。
- `client.js`：浏览器半。注册到 `shell.overlay` 槽位，轮询上面的快照，用 SVG 画信号塔并用 Web Audio 合成蜂鸣器音；右键（或左键）信号塔弹出设置面板。
- `locale/en.json`、`locale/zh.json`：插件管理器里显示的标题与说明。
- `icon.svg`：插件管理器使用的图标；`assets/icon.png` 是市场卡片用的位图图标，由 `tools/make-icon.py` 生成。
- `submission/YunJianFengYin__dsh-status-light.yml`：提交到 awesome-dsh-plugin 列表的条目文件（放到该仓库的 `data/plugins/` 下）。
- `cordis.patch.yml`：插件装载补丁（`dsh.bundle.patch` 指向它）。

## 说明

- 状态快照只包含会话标题、等待类型与运行标志，不出本机。
- 蜂鸣器由 Web Audio 实时合成：固定 ≈2.1 kHz 方波过 3.2 kHz 低通，音量由滑块映射到增益，不依赖任何音频文件。
- 红灯**随蜂鸣同步闪烁**：响的 1 秒亮、静音的 0.6 秒灭（静音时仍按这个节奏闪，只是不出声）。
- 红灯对应“代理正卡在等你”：提问卡片关闭、你作答、或前台等待超时后，代理会继续干活，灯也随之回到黄/绿；这之后如果卡片还留着可补答，那属于“不再挡路”的提问。

## License

[GNU General Public License v3.0 only](LICENSE) © 2026 YunJianFengYin

本插件以 GPL-3.0（仅版本 3，不含“或更高版本”条款）发布。若要改为 `GPL-3.0-or-later`，把 `package.json` 的 `license` 字段与本节文案一并改掉即可。
