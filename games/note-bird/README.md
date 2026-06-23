# 音符小鸟归巢

面向儿童的 PartyKeys 36 MIDI 键盘亮灯教学小游戏原型。

## 运行

在本目录启动任意静态文件服务器，然后用支持 Web MIDI 的 Chrome 或 Edge 打开。

例如：

```bash
python3 -m http.server 4173
```

访问 `http://localhost:4173`。

## 输入

- MIDI：连接 PartyKeys 36 后点击“连接 MIDI”。
- 电脑键盘：`A S D F G H J K L` 对应 `C4 D4 E4 F4 G4 A4 B4 C5 D5`。
- 鼠标或触控：直接按屏幕下方琴键。

> 设备端亮灯使用标准 MIDI Note On/Off 反馈。若 PartyKeys 36 的灯光需要厂商 SysEx 协议，可在 `sendMidiLight()` 中替换消息格式。
