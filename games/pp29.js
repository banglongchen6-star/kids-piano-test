// PopuPiano 29 控灯适配器（component 0x03；0x1E 上传调色板 + 0x20 全量亮灯）
// 用法：PP29.attach(midiAccess) 或 PP29.setOuts(outputs)；再用 set/clear/allOff/lightRGB
// 注：0x20 每次发送全部 29 个灯的状态，对“未列出即熄灭/增量”两种固件行为都安全。
window.PP29 = {
  COMP: 0x03, N: 29,
  outs: [],
  lit: {},                       // lamp(0-28) -> 调色板槽位
  attach(access){
    const all = [...access.outputs.values()];
    this.outs = all.filter(o => /popupiano|partykey/i.test(o.name || ''));
    if (!this.outs.length) this.outs = all;
    this.palette();
    return this.outs;
  },
  setOuts(list){ this.outs = list || []; this.palette(); },
  _send(payload){ this.outs.forEach(o => { try { o.send([0xF0, this.COMP, ...payload, 0xF7]); } catch (e) {} }); },
  // 默认 7 色调色板写入槽 1..7
  palette(){
    const P = [[127,0,0],[127,127,0],[0,127,0],[0,127,127],[0,0,127],[80,0,127],[127,127,127]];
    const f = []; P.forEach(c => f.push(c[0], c[1], c[2]));
    this._send([0x1E, P.length, 1, ...f]);
  },
  flush(){
    const f = []; for (let i = 0; i < this.N; i++) f.push(i, this.lit[i] || 0);
    this._send([0x20, this.N, ...f]);
  },
  set(lamp, slot){ if (lamp < 0 || lamp >= this.N) return; this.lit[lamp] = slot || 3; this.flush(); },
  clear(lamp){ delete this.lit[lamp]; this.flush(); },
  setMany(lamps, slot){ lamps.forEach(l => { if (l >= 0 && l < this.N) this.lit[l] = slot || 3; }); this.flush(); },
  allOff(){ this.lit = {}; this.flush(); },
  // 动态 RGB：把颜色写进 1 号槽再点亮 lamps（用于按和弦/分数自定义颜色，8bit→7bit）
  lightRGB(lamps, rgb){
    const r = Math.min(127, rgb[0] >> 1), g = Math.min(127, rgb[1] >> 1), b = Math.min(127, rgb[2] >> 1);
    this._send([0x1E, 1, 1, r, g, b]);
    this.lit = {}; lamps.forEach(l => { if (l >= 0 && l < this.N) this.lit[l] = 1; });
    this.flush();
  }
};
