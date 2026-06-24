// 控灯适配器 —— 现已切换为 PartyKeys 36 协议
// 厂商头 05 30 7F7F 2000；进 LED 模式 0x0F 01；逐键 RGB 0x15（每通道 0-255 拆两个 7bit）；清灯 0x71；36 键(灯号 0-35 = MIDI-48)
// 仍以全局名 PP29 暴露同一套 API（set/clear/setMany/allOff/lightRGB/attach/setOuts），游戏无需改动。
window.PP29 = {
  HEADER:[0xF0,0x05,0x30,0x7F,0x7F,0x20,0x00], N:36,
  outs:[], lit:{},                                   // lamp -> [r,g,b]
  PALETTE:[[255,0,0],[255,255,0],[0,255,0],[0,255,255],[0,0,255],[160,0,255],[255,255,255]],
  attach(access){ const all=[...access.outputs.values()]; this.outs=all.filter(o=>/partykey/i.test(o.name||'')); if(!this.outs.length) this.outs=all; this.init(); return this.outs; },
  setOuts(list){ this.outs=list||[]; this.init(); },
  _send(msg){ this.outs.forEach(o=>{ try{ o.send(msg); }catch(e){} }); },
  init(){ this._send([...this.HEADER,0x0F,0x01,0xF7]); },          // 进入 LED 模式
  _enc(v){ return [Math.floor(v/128), v%128]; },                  // 8bit→双7bit
  clearHW(){ this._send([...this.HEADER,0x71,0x00,0xF7]); },       // 全熄
  flush(){
    this.clearHW();
    const groups={}; for(const k in this.lit){ const c=this.lit[k], key=c.join(','); (groups[key]=groups[key]||{rgb:c,keys:[]}).keys.push(+k); }
    const gk=Object.keys(groups); if(!gk.length) return;
    const m=[...this.HEADER,0x15,gk.length];
    gk.forEach(k=>{ const g=groups[k]; m.push(...this._enc(g.rgb[0]),...this._enc(g.rgb[1]),...this._enc(g.rgb[2]),g.keys.length,...g.keys); });
    m.push(0xF7); this._send(m);
  },
  set(lamp,slot){ if(lamp<0||lamp>=this.N) return; this.lit[lamp]=this.PALETTE[((slot||3)-1)%7]; this.flush(); },
  clear(lamp){ delete this.lit[lamp]; this.flush(); },
  setMany(lamps,slot){ const c=this.PALETTE[((slot||3)-1)%7]; lamps.forEach(l=>{ if(l>=0&&l<this.N) this.lit[l]=c; }); this.flush(); },
  allOff(){ this.lit={}; this.clearHW(); },
  lightRGB(lamps,rgb){ this.lit={}; lamps.forEach(l=>{ if(l>=0&&l<this.N) this.lit[l]=rgb; }); this.flush(); }
};
