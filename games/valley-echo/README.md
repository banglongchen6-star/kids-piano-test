# 山谷回音

儿童向音乐听辨游戏原型，采用固定 3:2 平板横屏舞台。

## 运行

在项目目录启动任意静态文件服务器，例如：

```bash
python3 -m http.server 4173
```

然后打开 `http://localhost:4173`。

## 输入

- 低幼模式：点击 6 个彩色打击垫，或按数字 `1–6`
- 钢琴模式：点击琴键；电脑键盘使用 `Z–M` 与 `Q–U` 两排映射两个八度
- MIDI：点击右上角 MIDI 按钮连接设备
- PartyKeys：优先选择名称包含 PartyKeys 的 MIDI 输出设备，支持出题提示、按键反馈、答对流光、答错柔和白光及每题清灯

## 结构

- `index.html`：分层游戏 UI
- `styles.css`：视觉、布局与动效
- `app.js`：题目、声音、判定、键盘和 MIDI/PartyKeys
- `assets/valley-reference.png`：用户提供的核心视觉参考
