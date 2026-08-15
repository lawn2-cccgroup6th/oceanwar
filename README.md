# 🏴‍☠️ Ocean War / 海盗远征

> **A pirate island survival & conquest game** | **海盗海岛生存征服游戏**
>
> **7 old kids design.** Designed, coded, and maintained by a small team of young developers.

---

## 📖 Overview / 项目概述

Ocean War is a **Canvas-based 2D action-survival game** built entirely with vanilla JavaScript (no frameworks, no build tools). Players take on the role of a pirate captain stranded in an infinite procedurally-generated archipelago, fighting waves of pirates across six rival factions, battling sea monsters, managing resources, upgrading weapons and ships, and expanding their territory to become the legendary Pirate King.

Ocean War 是一款**纯 Canvas 2D 动作生存游戏**，完全使用原生 JavaScript 编写，无框架、无构建工具。玩家扮演一名海盗船长，在无限程序化生成的群岛中战斗：击败六大帮派的海盗、猎杀海怪 BOSS、采集资源、锻造装备、升级舰队，最终成为传奇海盗王。

---

## 🎮 Game Features / 游戏特色

| Feature | Description | 中文说明 |
|---------|-------------|----------|
| **Procedural World** | Infinite archipelago with dynamic islands | 无限程序化群岛，动态生成 |
| **6 Pirate Factions** | Red Skull, Black Shark, Gold Beard, Blue Algae, Poison Flame, Green Bone | 6 大海盗帮派：红骷髅、黑鲨、金胡子、蓝藻、毒焰、绿骨 |
| **Sea Monsters** | Mermaids, sea serpents, giant crabs, sea giants, krakens, and a **Sea King BOSS** | 人鱼、海蛇、巨蟹、海巨人、克苏鲁，以及**海王 BOSS**（人面蛇身+吉他） |
| **15+ Weapons** | Dagger, spear, axe, scimitar, crossbow, musket, grenades, shotgun, bow, rocket launcher, dragon blade, scythe, + legendary forged weapons | 15+ 种武器，含传说锻造装备 |
| **Ship & Fleet** | Upgrade your ship, capture enemy vessels, automatic fleet artillery | 升级主船、俘获战船、舰队自动开炮 |
| **Cannon System** | Ship-mounted cannon fires AoE blasts across land and sea; auto-fires when captain is ashore | 舰炮陆海通杀；船长离船时舰队自动炮火支援 |
| **Equipment** | 5 tiers (Common → Rare → Epic → Legendary → Mythic) with auto-equip | 5 品阶装备，自动穿戴 |
| **Day/Night Cycle** | Dawn → Day → Dusk → Night, affecting visibility | 昼夜交替影响视野 |
| **Dynamic Weather** | Rain, thunderstorms, hurricanes, fog, whirlpools | 雨/雷暴/台风/浓雾/漩涡 |
| **Territory War** | Conquer enemy strongholds, defend owned islands, destroy kingdoms to win | 攻占敌方要塞、防守领地、灭王国获胜 |
| **Kingdom** | Home island with king & guards — absolute safety zone | 家园王国岛，绝对安全区 |
| **Birds & Fishing** | Catch seagulls, parrots, albatrosses; shoot fish, sharks, whales | 捕鸟+捕鱼，鹦鹉额外掉落金币 |
| **Crew & Camp** | Recruit pirates as followers, set up healing camps | 收编随从、扎营回血 |
| **Victory** | Kill 300 pirates OR conquer 20 islands | 击杀 300 名海盗 或 占领 20 座岛屿 |

---

## 🕹️ Controls / 操作说明

| Key | Action | 操作 |
|-----|--------|------|
| **WASD** | Move | 移动 |
| **Mouse click** | Attack / Fire cannon | 攻击/开炮 |
| **F** | Gather / Catch birds & fish / Loot wrecks / Open chests | 采集/捕鸟捕鱼/搜刮/开宝箱 |
| **E** | Disembark from ship / Load & unload vehicles | 下船/装载卸载载具 |
| **B** | Attack enemy territory | 攻击敌方领地 |
| **Q** | Cycle weapons | 切换武器 |
| **1-9, 0** | Quick-select weapon slot | 快捷键选武器 |
| **C** | Set up camp | 扎营 |
| **X** | Recall camp (refunds) | 回收营地 |
| **G** | Eat food (recover hunger & HP) | 进食 |

---

## 🏗️ Tech Stack / 技术栈

```
Frontend:  Pure Canvas 2D + HTML5 + CSS3
Language:  JavaScript (ES6+)
Backend:   None (browser-only, client-side)
Database:  None
Build:     None — open index.html directly
```

- **No external dependencies.** Zero npm packages. No bundler.
- **File size:** ~3 files totaling ~230 KB (game.js 209KB + index.html 11KB + style.css 8KB)
- **Performance:** Optimized with object count caps, distance culling, and GC-free collision loops

---

## 📁 Project Structure / 项目结构

```
oceanwar/
├── index.html      # Game entry, HUD layout, start/end screens
├── game.js         # Core game engine (~4000 lines)
├── style.css       # UI themes, panels, HUD styling
├── README.md       # This file (bilingual documentation)
└── .gitignore      # (optional)
```

---

## 🚀 Getting Started / 快速开始

### Option A — Local Play / 本地游玩

```bash
# Just open index.html in your browser
# Windows: double-click index.html
# Or start a simple server:
python -m http.server 8080
# Then visit http://localhost:8080
```

### Option B — Fork from GitHub / 从 GitHub 获取

```bash
git clone https://github.com/lawn2-cccgroup6th/oceanwar.git
cd oceanwar
# Open index.html
```

### Compatibility / 兼容性

- Chrome 80+, Edge 80+, Firefox 78+, Safari 14+
- Desktop recommended (mouse + keyboard)
- Mobile touch support: limited

---

## ⚙️ Development / 开发说明

### File Responsibilities / 文件职责

| File | Responsibility | 职责 |
|------|---------------|------|
| `index.html` | DOM structure, HUD elements, start/end overlays, hint bar | DOM 结构、HUD 面板、开始/结束界面 |
| `game.js` | Game loop, rendering, physics, AI, combat, inventory, crafting, territory | 游戏引擎全部逻辑 |
| `style.css` | HUD panels, button styles, color scheme, minimap styling | 所有 UI 样式 |

### Game Engine Architecture / 引擎架构

`game.js` uses a **single-file monolithic architecture** organized into clear sections:

1. **Constants & Config** (~L1-120) — weapon definitions, sea monster types, weather, pirate factions
2. **State Management** (~L120-420) — game state, ship, captain, inventory, projectile arrays
3. **Input Handling** (~L420-700) — keyboard, mouse, touch events
4. **Game Loop** (~L700-800) — `update()` + `render()` at 60fps
5. **Combat & AI** (~L800-2200) — pirate behavior, sea monster AI, ship AI, fleet artillery
6. **Rendering** (~L2200-3600) — canvas drawing for all entities
7. **HUD & UI** (~L3600-4000) — DOM updates, minimap, crafting panels
8. **Misc Systems** — weather, day/night, kingdom, victory conditions

### Performance Tips / 性能优化

- Object count caps: `particles ≤ 600`, `projectiles ≤ 200`
- Distance culling: islands > 3000px from player are skipped
- No array spreads in hot loops (avoids GC pressure)
- Canvas batched rendering per entity type

---

## 🛠️ Build & Deploy / 构建与部署

No build step required. To deploy:

```bash
# Simple HTTP server
python -m http.server 8778

# Or use Cloudflare Pages / GitHub Pages:
# Push to GitHub → Settings → Pages → Deploy from main branch
```

---

## 📝 Version History / 版本历史

| Version | Date | Key Changes |
|---------|------|-------------|
| v24 | 2026-08-15 | Performance fixes: distance culling, GC-free collision, object caps |
| v23 | 2026-08-15 | Sea King BOSS, ship cannon in weapon bar, sea monster ranged attacks, weapon grouping |
| v22 | 2026-08-15 | Weather system (typhoon, fog), sea monsters, random weapons on ground |
| v21 | 2026-08-15 | Green dragon redesign, pirate kingdoms, max 5 pirates per island |
| v20 | 2026-08-15 | Six pirate captains with faction colors, territory strongholds |

---

## 🙏 Credits / 致谢

- **Design & Development**: 7 old kids
- **Tech Stack**: Vanilla JS, Canvas 2D, HTML5, CSS3

---

## 📄 License / 许可证

This project is released under the **MIT License**. Feel free to fork, modify, and share.

---

> *"The sea knows no borders — only legends."*
> *"大海无边界，唯传奇永存。"*