'use strict';
/* ============================================================
   海盗远征 · Captain's Quest  (v10 · 舰炮远程/炮击陆地/海盗内斗/鸟类)
   纯原生 JS + Canvas，零外部依赖。相对路径，可直接丢服务器。
   v10 新增：
     1) 船载大炮真·远程（射程 ~1200px，落点爆炸，含飞行轨迹与射程环）
     2) 舰炮可炮轰岸上海盗（AoE 同时命中陆地单位/海盗船/火药桶连锁）
     3) 海盗船持续登陆放兵（不再只在闲置时），登陆兵继承所属帮派
     4) 海盗分「红骷髅帮 / 黑鲨帮」两派，遭遇即互相厮杀，内斗可升级、掉落宝箱
     5) 鸟类系统：海鸥/鹦鹉/信天翁，可用远程武器射落或近身 F 徒手捕捉
   ============================================================ */

// ---------- 基础配置 ----------
const WORLD_LIMIT = 25000;       // 无限世界软边界（±），实际地图程序化无限延伸
const MAX_FOLLOWERS = 8;
const MAX_MYSHIPS = 5;
const WEAPON_MAX_LV = 999;          // 武器无限升级（成本随等级递增）
const DAY_LENGTH = 200;            // 一昼夜秒数

const WEAPONS = {
  knife:   { name:'小刀',     icon:'🗡️', type:'melee',  dmg:16, range:70,  cd:0.32 },
  spear:   { name:'长矛',     icon:'🔱', type:'melee',  dmg:30, range:92,  cd:0.45 },
  axe:     { name:'战斧',     icon:'🪓', type:'melee',  dmg:42, range:78,  cd:0.55 },
  cutlass: { name:'弯刀',     icon:'⚔️', type:'melee',  dmg:48, range:76,  cd:0.40 },
  bow:     { name:'弩',       icon:'🏹', type:'ranged', dmg:36, range:560, cd:0.60, pspeed:640 },
  pistol:  { name:'火枪',     icon:'🔫', type:'ranged', dmg:52, range:620, cd:0.55, pspeed:660 },
  flask:   { name:'掷弹筒',   icon:'🧨', type:'ranged', dmg:40, range:460, cd:0.90, pspeed:420, aoe:42 },
  // —— 现代远程武器（混搭）——
  handgun: { name:'手枪',     icon:'🔫', type:'ranged', dmg:30, range:760, cd:0.22, pspeed:760 },
  gatling: { name:'加特林',   icon:'⚡', type:'ranged', dmg:14, range:680, cd:0.07, pspeed:780, spread:0.10 },
  rifle:   { name:'突击步枪', icon:'🎯', type:'ranged', dmg:46, range:900, cd:0.16, pspeed:880 },
  rpg:     { name:'火箭筒',   icon:'🚀', type:'ranged', dmg:70, range:640, cd:1.10, pspeed:480, aoe:60 },
  // —— v13 新增现代枪械 ——
  mk14:    { name:'MK14',     icon:'🔭', type:'ranged', dmg:58, range:950, cd:0.20, pspeed:920 },  // 半自动精确步枪，高伤高精度
  m416:    { name:'M416',     icon:'🔫', type:'ranged', dmg:38, range:700, cd:0.10, pspeed:780, spread:0.06 },  // 突击步枪，均衡射速
  ump:     { name:'UMP',      icon:'🌪️', type:'ranged', dmg:22, range:500, cd:0.06, pspeed:680, spread:0.08 },  // 冲锋枪，爆发压制
  s12k:    { name:'S12K',     icon:'💥', type:'ranged', dmg:28, range:280, cd:0.55, pspeed:620, pellets:6 },  // 霰弹枪，多发弹丸近战
  // —— 锻造传说武器（在铁匠铺锻造获得，锻造后自动加入武器栏）——
  scythe:  { name:'死神镰刀', icon:'💀', type:'melee',  dmg:65, range:90,  cd:0.50, execute:true },   // 近战·对Lv5以下处决秒杀
  blood_axe:{ name:'鲜血战斧', icon:'🪓', type:'melee',  dmg:72, range:80,  cd:0.60, lifesteal:0.25 }, // 近战·吸血25%
  shadow_blade:{ name:'暗影之刃', icon:'🗡️', type:'melee', dmg:55, range:88, cd:0.35, dodge:0.35 },   // 近战·35%闪避
  thunder_bow:{ name:'雷霆之弓', icon:'🏹', type:'ranged', dmg:45, range:700, cd:0.50, pspeed:700, shock:true }, // 远程·麻痹
  cannon: { name:'舰炮',     icon:'💥', type:'ranged', dmg:52, range:1200, cd:0.85, pspeed:560, aoe:74, shipOnly:true }
};
const WEAPON_ORDER = ['knife','spear','axe','cutlass','bow','pistol','flask','handgun','gatling','rifle','rpg','mk14','m416','ump','s12k','thunder_bow','cannon','scythe','blood_axe','shadow_blade'];

const RECIPES = [
  { id:'spear',   cost:{ wood:2, iron:1 } },
  { id:'axe',     cost:{ wood:1, iron:2 } },
  { id:'cutlass', cost:{ iron:2, wood:1 } },
  { id:'bow',     cost:{ wood:3, iron:1 } },
  { id:'pistol',  cost:{ iron:2, powder:1 } },
  { id:'flask',   cost:{ iron:1, powder:2 } },
  { id:'handgun', cost:{ steel:2, parts:1 } },
  { id:'gatling', cost:{ steel:4, parts:3 } },
  { id:'rifle',   cost:{ steel:3, parts:2 } },
  { id:'rpg',     cost:{ steel:5, parts:2, powder:2 } },
  { id:'mk14',    cost:{ steel:6, parts:4 } },
  { id:'m416',    cost:{ steel:4, parts:3 } },
  { id:'ump',     cost:{ steel:3, parts:3 } },
  { id:'s12k',    cost:{ steel:3, parts:2, powder:1 } },
];
const SHOP = [
  { id:'spear',   cost:{ gold:5 } },
  { id:'axe',     cost:{ gold:7 } },
  { id:'cutlass', cost:{ gold:10 } },
  { id:'bow',     cost:{ gold:9 } },
  { id:'pistol',  cost:{ gold:12 } },
  { id:'flask',   cost:{ gold:14 } },
  { id:'handgun', cost:{ gold:18 } },
  { id:'gatling', cost:{ gold:30 } },
  { id:'rifle',   cost:{ gold:24 } },
  { id:'rpg',     cost:{ gold:38 } },
  { id:'mk14',    cost:{ gold:42 } },
  { id:'m416',    cost:{ gold:30 } },
  { id:'ump',     cost:{ gold:22 } },
  { id:'s12k',    cost:{ gold:26 } },
];
function weaponUpCost(id){ const lv=(weaponLevel[id]||1); return { gold:3+lv*2, iron:1+lv }; }
// 船升级成本随等级递增

// ---------- 装备系统（v13） ----------
// 品质：1普通(绿) 2稀有(蓝) 3史诗(紫) 4传说(橙) 5神话(红)
// 效果：dmg(攻击) def(防御) speed(移速) regen(回血) gold(金币倍率) burn(灼烧) execute(处决) all(全属性)
const RARITY_META = { 1:{color:'#5ec98a',name:'普通'}, 2:{color:'#7ab8ff',name:'稀有'}, 3:{color:'#b088ff',name:'史诗'}, 4:{color:'#ffb060',name:'传说'}, 5:{color:'#ff5555',name:'神话'} };
const EQUIPMENT = [
  { id:'iron_hat',     name:'铁盔',      icon:'⛑️',  rarity:1, slot:'head',   effect:'def',   value:10,  rate:0.05 },
  { id:'iron_chest',   name:'锁子甲',    icon:'🛡️',  rarity:1, slot:'chest',  effect:'def',   value:14,  rate:0.04 },
  { id:'iron_boots',   name:'钢靴',      icon:'👢',   rarity:1, slot:'feet',   effect:'speed', value:0.3, rate:0.04 },
  { id:'limit_glove',  name:'极限拳套',  icon:'🥊',   rarity:1, slot:'weapon', effect:'dmg',   value:18,  rate:0.03 },
  { id:'iron_shield',  name:'铁盾',      icon:'🔰',   rarity:2, slot:'offhand',effect:'regen', value:0.008, rate:0.015 },
  { id:'lucky_charm',  name:'幸运挂饰',  icon:'🍀',   rarity:2, slot:'acc',    effect:'gold',  value:0.5,  rate:0.015 },
  { id:'berserker_glove', name:'狂战士手套', icon:'💀', rarity:3, slot:'weapon', effect:'dmg', value:28, rate:0.006 },
  { id:'titan_helm',   name:'泰坦头盔',  icon:'👑',   rarity:3, slot:'head',   effect:'def',   value:30,  rate:0.005 },
  { id:'lava_armor',   name:'熔岩铠甲',  icon:'🔥',   rarity:4, slot:'chest',  effect:'burn',  value:30,  rate:0.003 },
  { id:'dragon_armor', name:'龙鳞甲',    icon:'🐲',   rarity:4, slot:'chest',  effect:'all',   value:15,  rate:0.003 },
];
// 装备锻造配方：高等装备需金币+稀有材料
const EQUIP_RECIPES = [
  { id:'iron_hat',     cost:{ iron:5, gold:10 } },
  { id:'iron_chest',   cost:{ iron:6, gold:15 } },
  { id:'iron_boots',   cost:{ iron:4, gold:10 } },
  { id:'limit_glove',  cost:{ iron:4, gold:20 } },
  { id:'iron_shield',  cost:{ iron:6, gold:40 } },
  { id:'lucky_charm',  cost:{ gold:50, powder:3 } },
  { id:'berserker_glove', cost:{ iron:12, gold:100 } },
  { id:'titan_helm',   cost:{ iron:12, gold:120 } },
  { id:'lava_armor',   cost:{ iron:20, powder:15, gold:300 } },
  { id:'dragon_armor', cost:{ iron:18, gold:400 } },
];
// 传说武器锻造配方（在铁匠铺「传说锻造」区，锻造后进入武器栏）
const WEAPON_FORGE = [
  { id:'scythe',       cost:{ iron:30, powder:20, gold:800 } },
  { id:'blood_axe',    cost:{ iron:28, powder:18, gold:700 } },
  { id:'shadow_blade', cost:{ iron:25, powder:15, gold:600 } },
  { id:'thunder_bow',  cost:{ iron:22, powder:20, gold:650 } },
];

// ---------- 胜利条件 ----------
const WIN_BY_KILLS = 300;       // 击败 X 海盗获胜
const WIN_BY_ISLANDS = 20;      // 征服 X 岛屿获胜
// 船长升级
const CAPTAIN_MAX_LV = 99;      // 船长最高等级
const CAPTAIN_XP_WALK = 0.03;   // 每移动一帧（1/60s）获得的锻炼值
const CAPTAIN_XP_KILL = 10;     // 击杀一个海盗获得的锻炼值
const CAPTAIN_XP_KILL_SHIP = 20;// 击沉一艘船获得的锻炼值
// 载具专属材料成本（不再共用废铁/零件）
const VEHICLE_COSTS = {
  car:   { tire:3, aluminum:2 },           // 轮胎 + 铝材
  plane: { aluminum:5, tire:1 },           // 铝材为主 + 少量轮胎
};
// 船材专属成本
const SHIP_BUILD_COST = { timber:16, steel:10 };

const NODE_TYPES = {
  tree:   { res:'wood',   color:'#2f7d3f', amount:6, label:'🌳', name:'木材' },
  bush:   { res:'food',   color:'#4caf50', amount:5, label:'🌿', name:'食物' },
  rock:   { res:'iron',   color:'#8a8f98', amount:5, label:'⛰️', name:'铁矿' },
  barrel: { res:'powder', color:'#b5651d', amount:4, label:'🛢️', name:'火药' },
  chest:  { res:'gold',   color:'#d4af37', amount:3, label:'📦', name:'金币' },
};
const RES_META = {
  wood:{icon:'🪵',name:'木材'}, food:{icon:'🍖',name:'食物'}, gold:{icon:'🪙',name:'金币'},
  iron:{icon:'⛏️',name:'铁矿'}, powder:{icon:'🧨',name:'火药'},
  steel:{icon:'⚙️',name:'废铁'}, parts:{icon:'🔩',name:'零件'},
  tire:{icon:'🛞',name:'轮胎'}, aluminum:{icon:'🔧',name:'铝材'}, timber:{icon:'🏗️',name:'造船木'},
};

// ---------- 鸟类 ----------
const BIRD_TYPES = {
  gull:   { name:'海鸥',   icon:'🕊️', hp:12, food:1, gold:0, speed:1.15, size:9,  body:'#f3f6fb', wing:'#c9d6e6' },
  parrot: { name:'鹦鹉',   icon:'🦜', hp:14, food:1, gold:2, speed:1.35, size:8,  body:'#3fbf6a', wing:'#f2c14e' },
  albat:  { name:'信天翁', icon:'🦅', hp:28, food:3, gold:0, speed:0.95, size:14, body:'#e2e9f2', wing:'#8fa3b8' },
};
const BIRD_KEYS = ['gull','gull','gull','parrot','albat'];

// ---------- 海盗船长阵营（v20 · 6 大船长势力）----------
// 每个阵营 = 一名海盗船长 + 旗下海盗 + 旗下舰队 + 岛屿颜色
const CREWS = [
  { id:0, name:'红骷髅帮',   band:'#c2362b', flag:'#e0483a', ship:'#7a1e1e', hull:'#4a1a0e', deck:'#8a5a3a', captain:'☠️', desc:'凶残的嗜血海盗，红色头巾' },
  { id:1, name:'黑鲨帮',     band:'#1c1c1c', flag:'#4a4a4a', ship:'#2a2a2a', hull:'#1a1a1a', deck:'#4a4a3a', captain:'🦈', desc:'隐秘的暗影海盗，黑色制服' },
  { id:2, name:'金胡子帮',   band:'#b8860b', flag:'#ffd24a', ship:'#8a6b1e', hull:'#5a4810', deck:'#a88428', captain:'🥸', desc:'贪婪的商船劫匪，金色披风' },
  { id:3, name:'蓝藻帮',     band:'#1a5fa8', flag:'#4a9fff', ship:'#1c3f6b', hull:'#0e2a4a', deck:'#4a7ab8', captain:'🐙', desc:'深海的走私集团，蓝色制服' },
  { id:4, name:'毒焰帮',     band:'#8b2e7a', flag:'#d94ff2', ship:'#5a1e52', hull:'#3a0e35', deck:'#8a4a88', captain:'🧪', desc:'疯狂的炼金术士，紫色斗篷' },
  { id:5, name:'绿骨帮',     band:'#2d7a2d', flag:'#66dd66', ship:'#1e4a1e', hull:'#0e2a0e', deck:'#4a8a4a', captain:'💀', desc:'诅咒的亡灵海盗，绿色骷髅' },
];
const CREW_COUNT = CREWS.length;

const PIRATE_COLORS = ['#9b5a2b','#b5651d','#c2362b','#a01f1f','#7a1414','#4a0d0d','#2a0a0a'];
function pirateStats(level){
  return {
    hp:    48 + (level-1)*40,
    dmg:   9 * (1 + 0.42*(level-1)),
    speed: Math.min(2.6, 1.45 + (level-1)*0.12),
    radius:Math.min(24, 12 + (level-1)*2),
    color: PIRATE_COLORS[Math.min(level-1, PIRATE_COLORS.length-1)],
  };
}
function pirateXpNeed(level){ return 4 + level*3; }

// ---------- 工具 ----------
const rand = (a,b)=>a+Math.random()*(b-a);
const randi = (a,b)=>Math.floor(rand(a,b+1));
const clamp = (v,a,b)=>v<a?a:(v>b?b:v);
const dist = (ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
const choice = arr=>arr[randi(0,arr.length-1)];
function hex2rgb(h){ const n=parseInt(h.slice(1),16); return [n>>16&255, n>>8&255, n&255]; }
function lerpColor(a,b,t){ const A=hex2rgb(a),B=hex2rgb(b);
  return 'rgb('+Math.round(A[0]+(B[0]-A[0])*t)+','+Math.round(A[1]+(B[1]-A[1])*t)+','+Math.round(A[2]+(B[2]-A[2])*t)+')'; }
const DAY_SKY1='#0e3a5c', DAY_SKY2='#0a2a45', NIGHT_SKY1='#0a1430', NIGHT_SKY2='#06101e';

// ---------- 世界：无限群岛（程序化区块生成） ----------
const CHUNK = 1100;            // 区块尺寸
function chunkHash(cx,cy,seed){
  let h = (Math.imul(seed,0x9E3779B1) + cx*374761393 + cy*668265263) | 0;
  h = Math.imul(h ^ (h>>>13), 1274126177); h ^= h>>>16;
  return (h>>>0)/4294967295;
}
function islandAt(cx,cy){
  if(cx!==0 || cy!==0){ if(chunkHash(cx,cy,7) > 0.5) return null; }
  const rx = (chunkHash(cx,cy,11)*2-1) * CHUNK*0.26;
  const ry = (chunkHash(cx,cy,13)*2-1) * CHUNK*0.26;
  const r  = 170 + chunkHash(cx,cy,17)*270;
  return { x:cx*CHUNK+rx, y:cy*CHUNK+ry, r };
}
// 岛屿形状：程序化生成不规则轮廓（按区块固定，每个岛都不一样）
function getIslandShape(cx,cy,r){
  const N = 14;
  const pts = [];
  for(let i=0;i<N;i++){
    const baseAngle = (i/N)*Math.PI*2;
    const jitter1 = (chunkHash(cx+100+i, cy+200+i, 31) - 0.5) * 0.55;
    const jitter2 = (chunkHash(cx+300+i, cy+400+i, 43) - 0.5) * 0.25;
    const rr = r * (0.62 + Math.abs(jitter1) + Math.abs(jitter2));
    pts.push({ angle:baseAngle, rr });
  }
  return pts;
}
function drawIslandShape(ctx, is, fillStyle){
  const cx=Math.floor(is.x/CHUNK), cy=Math.floor(is.y/CHUNK);
  const shape=getIslandShape(cx,cy,is.r);
  ctx.beginPath();
  for(let i=0;i<shape.length;i++){
    const p=shape[i], p2=shape[(i+1)%shape.length];
    const px=is.x+Math.cos(p.angle)*p.rr, py=is.y+Math.sin(p.angle)*p.rr;
    const p2x=is.x+Math.cos(p2.angle)*p2.rr, p2y=is.y+Math.sin(p2.angle)*p2.rr;
    if(i===0) ctx.moveTo(px,py);
    else ctx.quadraticCurveTo(px,py,(px+p2x)/2,(py+p2y)/2);
  }
  ctx.closePath(); ctx.fillStyle=fillStyle; ctx.fill();
}
function nearbyIslands(x,y,span=1){
  const out=[], cx=Math.floor(x/CHUNK), cy=Math.floor(y/CHUNK);
  for(let dx=-span;dx<=span;dx++) for(let dy=-span;dy<=span;dy++){
    const is=islandAt(cx+dx,cy+dy); if(is) out.push(is);
  }
  return out;
}
function isLand(x,y){ for(const is of nearbyIslands(x,y)){ if(dist(x,y,is.x,is.y)<is.r) return true; } return false; }
function pushToSea(x,y,margin){
  let best=null,bd=1e9;
  for(const is of nearbyIslands(x,y,2)){ const d=dist(x,y,is.x,is.y); if(d<bd){bd=d;best=is;} }
  if(!best) return {x,y};
  const dx=x-best.x, dy=y-best.y, len=Math.hypot(dx,dy)||1, need=best.r+margin;
  if(bd>=need) return {x,y};
  return { x:best.x+dx/len*need, y:best.y+dy/len*need };
}
function pushToLand(x,y,margin){
  let best=null,bd=1e9;
  for(const is of nearbyIslands(x,y,2)){ const d=dist(x,y,is.x,is.y); if(d<bd){bd=d;best=is;} }
  if(!best) return {x,y};
  const dx=x-best.x, dy=y-best.y, len=Math.hypot(dx,dy)||1, need=Math.max(20,best.r-margin);
  if(bd<=need) return {x,y};
  return { x:best.x+dx/len*need, y:best.y+dy/len*need };
}
function nearestLandDist(x,y){ let bd=1e9; for(const is of nearbyIslands(x,y,2)){ bd=Math.min(bd, Math.abs(dist(x,y,is.x,is.y)-is.r)); } return bd; }
function nearestIsland(x,y,span=2){ let best=null,bd=1e9; for(const is of nearbyIslands(x,y,span)){ const d=dist(x,y,is.x,is.y); if(d<bd){bd=d;best=is;} } return best; }
function playerXY(){ return captain.onShip? {x:ship.x,y:ship.y} : {x:captain.x,y:captain.y}; }
function randomWaterNear(px,py,minR,maxR,retry=30){
  let x=px,y=py,t=0;
  do{ const a=rand(0,Math.PI*2), d=rand(minR,maxR); x=px+Math.cos(a)*d; y=py+Math.sin(a)*d; t++; } while(isLand(x,y)&&t<retry);
  return {x,y};
}
function randomLandPoint(px,py,span=1){
  let isles = nearbyIslands(px,py,span);
  if(!isles.length) isles = nearbyIslands(px,py,3);
  const is = isles.length? choice(isles) : islandAt(0,0);
  const a=rand(0,Math.PI*2), r=rand(is.r*0.2,is.r*0.82);
  return { x:is.x+Math.cos(a)*r, y:is.y+Math.sin(a)*r };
}

// ---------- 画布 ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
let DPR = Math.min(window.devicePixelRatio||1, 2);
function resize(){
  canvas.width = window.innerWidth*DPR; canvas.height = window.innerHeight*DPR;
  canvas.style.width = window.innerWidth+'px'; canvas.style.height = window.innerHeight+'px';
}
window.addEventListener('resize', resize); resize();

let cam = { x:0, y:0 };
let state = 'menu';
let lastT = 0;
let animT = 0;

// ---------- 实体 ----------
let captain, ship, followers;
let pirates = [], pirateShips = [], myShips = [];
let nodes = [], projectiles = [], particles = [], texts = [];
let kills = 0, nextElite = 10, spawnTimer = 0, shipSpawnTimer = 0, milestone = 0, wreckTimer = 4;
let worldTime = 0.06;
let weather = { type:'clear', t:20, rain:0, wind:0, thunder:0 };
let lightning = 0, boltX = 0.5;
let whirls = [], camps = [], creatures = [], birds = [];
let mouse = { x:0, y:0, down:false };
let keys = {};
let inventory = { wood:0, food:0, gold:0, iron:0, powder:0, steel:0, parts:0, tire:0, aluminum:0, timber:0 };
let arsenal = new Set(['knife']);
let weaponLevel = { knife:1 };

// ---------- v11 新系统状态 ----------
let wrecks = [];
let seenCrews = new Set();  // v20 已遇阵营（用于首次出现提示）
let vehicles = [];
let ownedIslands = {};
let shipSpeedLv = 1;

// ---------- v14 陆地动物 + 龙 + 宝藏 ----------
let landAnimals = [];     // 狼🐺 熊🐻 龙🐉
let treasureChests = [];  // 宝藏箱📦 岛屿上随机生成

// ---------- v22 海上系统 ----------
// 登船海盗：可以跳上主船进行甲板近身战斗
let boardedPirates = [];
// 海怪：海里巡逻的巨大怪物，人型+怪物型两种
let seaMonsters = [];
// 散落武器：岛屿上的武器箱，捡起来装备
let groundWeapons = [];

const SEA_MONSTER_TYPES = {
  merman:    { name:'人鱼海盗', icon:'🧜', hp:450,  atk:28, sp:1.4, range:95,  cd:0.70, size:28, color:'#4a7aaa', reward:{gold:300, iron:8} },
  sea_giant: { name:'海巨人',   icon:'👹', hp:600,  atk:35, sp:1.0, range:80,  cd:0.80, size:32, color:'#8b5a3c', reward:{gold:400, iron:10, wood:5} },
  kraken:    { name:'巨型章鱼', icon:'🐙', hp:800,  atk:30, sp:0.8, range:120, cd:0.90, size:38, color:'#2d6b8a', reward:{gold:500, iron:12, powder:3} },
  sea_serpent:{name:'海蛇',     icon:'🐍', hp:550,  atk:32, sp:1.6, range:95,  cd:0.65, size:30, color:'#1a7a4a', reward:{gold:350, iron:8, food:2} },
  zombie:    { name:'海底僵尸', icon:'🧟', hp:400,  atk:25, sp:1.2, range:50,  cd:0.75, size:24, color:'#5a7a5a', reward:{food:2, gold:150} },
  sea_king:  { name:'海王',     icon:'🧜‍♂️', hp:1800, atk:42, sp:1.2, range:180, cd:1.10, size:48, color:'#0f6f78', reward:{gold:1500, iron:30, powder:10}, ranged:true, boss:true }
};
let seaKingCooldown = 0;
let seaKing = null;

// 散落武器池
const GROUND_WEAPON_POOL = ['knife','spear','axe','cutlass','bow','pistol','flask','handgun','gatling','rifle','rpg'];

// ---------- v22 天气扩展 ----------
const WEATHER_TYPES = {
  clear: { t:'☀️', name:'晴朗', rain:0, wind:0, thunder:0, dur:[20,40], color:'#87CEEB' },
  rain:  { t:'🌧️', name:'下雨', rain:1, wind:0.2, thunder:0, dur:[15,25], color:'#8899AA' },
  storm: { t:'🌪️', name:'风暴', rain:2, wind:1, thunder:0.6, dur:[12,20], color:'#556677' },
  typhoon:{ t:'🌀', name:'台风', rain:3, wind:2.5, thunder:0.9, dur:[10,16], color:'#334455' },
  fog:   { t:'🌫️', name:'浓雾', rain:0, wind:0.3, thunder:0, dur:[8,15], color:'#aaaacc' },
  whirl: { t:'🌀', name:'漩涡', rain:1, wind:0.5, thunder:0.2, dur:[10,18], color:'#6677aa' },
};

const ANIMAL_TYPES = {
  wolf:  { icon:'🐺', name:'野狼',  hp:40,  atk:8,  sp:1.8, range:52,  cd:0.70, color:'#a08050', size:10, diet:'carnivore', reward:{food:1,gold:20} },
  bear:  { icon:'🐻', name:'棕熊',  hp:90,  atk:16, sp:1.2, range:58,  cd:0.90, color:'#6b4a20', size:14, diet:'carnivore', reward:{food:2,gold:40} },
  cow:   { icon:'🐂', name:'野牛',  hp:60,  atk:0,  sp:1.0, range:0,   cd:99,   color:'#8b5e3c', size:12, diet:'herbivore', reward:{food:1,gold:10} },
  deer:  { icon:'🦌', name:'野鹿',  hp:35,  atk:0,  sp:1.6, range:0,   cd:99,   color:'#a0784a', size:10, diet:'herbivore', reward:{food:1,gold:10} },
  sheep: { icon:'🐑', name:'野羊',  hp:25,  atk:0,  sp:1.2, range:0,   cd:99,   color:'#d8d0c0', size:9,  diet:'herbivore', reward:{food:1,gold:5} },
  dragon:{ icon:'🐉', name:'青龙',  hp:280, atk:35, sp:1.6, range:80,  cd:0.60, color:'#2d9e4a', size:22, diet:'carnivore', reward:{food:3,gold:500,iron:5,timber:3} },
};

// 船长成长
let captainXp = 0;
let captainLv = 1;
let victoryWon = false;
let victoryType = '';

// ---------- 初始化一局 ----------
function resetGame(){
  const si = islandAt(0,0);
  // 王国在 (0,0) chunk，船长从王国出发
  initKingdom();
  captain = { x:KINGDOM.x, y:KINGDOM.y+30,
    hp:100, maxhp:100, hunger:100, _starveCd:0, onShip:false, riding:null, weapon:'knife', weaponCd:0, attackFlash:0, safeTimer:0, _regen:false, walk:0, facing:1,
    coat:true, sash:true, beard:true, patch:false };
  ship = { x:captain.x, y:captain.y+40, level:1, cannonDmg:52, rock:0, submerged:false, autoFireCd:2, speed:3.4, vehicles:[], _lastUnloadT:0, hp:200, maxhp:200 };
  followers = [ makeFollower(captain.x-30, captain.y) ];
  pirates = []; pirateShips = []; myShips = []; nodes = []; projectiles = []; particles = []; texts = [];
  whirls = []; camps = []; creatures = []; birds = []; wrecks = []; vehicles = []; ownedIslands = {}; shipSpeedLv = 1;
  landAnimals = []; treasureChests = []; enemyIslands = {}; pirateKingdoms = [];
  boardedPirates = []; seaMonsters = []; groundWeapons = [];
  seaKing = null; seaKingCooldown = 90;
  kills = 0; nextElite = 10; milestone = 0; spawnTimer = 1.5; shipSpawnTimer = 3; worldTime = 0.06;
  weather = { type:'clear', t:20, rain:0, wind:0, thunder:0 }; lightning = 0;
  inventory = { wood:0, food:0, gold:500, iron:0, powder:0, steel:0, parts:0, tire:0, aluminum:0, timber:0 };
  arsenal = new Set(['knife']); weaponLevel = { knife:1 };
  ship.speed = 3.4;
  captainXp = 0; captainLv = 1; victoryWon = false; victoryType = '';
  seenCrews = new Set();
  for(let i=0;i<70;i++) spawnNode(captain.x, captain.y);
  for(let i=0;i<8;i++) spawnLandPirate(undefined, captain.x, captain.y);
  for(let i=0;i<2;i++) spawnPirateShip(captain.x, captain.y);
  for(let i=0;i<16;i++) spawnCreature(captain.x, captain.y);
  for(let i=0;i<10;i++) spawnBird(captain.x, captain.y);
  for(let i=0;i<20;i++) spawnLandAnimal(captain.x, captain.y);
  spawnDragonNests();
  dragonKing = null;
  for(let i=0;i<8;i++) spawnTreasureChest();
  spawnEnemyIslands();
  captain.equip = [];  // v13 装备栏
  updateEquipmentHUD();
  buildHUD();
}

// ---------- 生成器（围绕玩家，支持无限地图） ----------
function spawnNode(px,py){
  const p = randomLandPoint(px,py,1);
  const typeKeys = ['tree','tree','bush','rock','rock','barrel','chest'];
  const t = choice(typeKeys), meta = NODE_TYPES[t];
  nodes.push({ x:p.x, y:p.y, type:t, amount:meta.amount, color:meta.color, respawn:0 });
}
function makePirate(x,y,lv=1,crew){
  const s = pirateStats(lv);
  return { x, y, hp:s.hp, maxhp:s.hp, level:lv, dmg:s.dmg, speed:s.speed, radius:s.radius,
    color:s.color, combatXp:0, atkCd:0, flash:0, wpx:0, wpy:0, dead:false, walk:rand(0,6), facing:-1,
    crew: (crew===undefined? randi(0, CREW_COUNT-1) : crew),
    patch:Math.random()<0.4, beard:Math.random()<0.5, coat:false, sash:false,
    thrower: lv>=2? Math.random()<0.45 : Math.random()<0.25 };
}
const MAX_PIRATES_PER_ISLAND = 5;  // 每岛最多海盗数
function countPiratesOnIsland(isl){
  if(!isl) return 0;
  let n=0;
  for(const p of pirates){ if(!p.dead && dist(p.x,p.y,isl.x,isl.y) < isl.r) n++; }
  return n;
}
function spawnLandPirate(lv, px, py){
  // 不在王国岛上生成海盗，且每岛最多5个海盗
  let tries=0, p, ok=false;
  do {
    p = randomLandPoint(px,py,1); tries++;
    const isl = nearestIsland(p.x, p.y, 2);
    ok = !inKingdom(p.x, p.y) && (!isl || countPiratesOnIsland(isl) < MAX_PIRATES_PER_ISLAND);
  } while(!ok && tries<8);
  const level = lv || clamp(1 + Math.floor(kills/8) + randi(0,1), 1, 12);
  pirates.push(makePirate(p.x, p.y, level));
}
function spawnElite(px,py){
  const p = randomLandPoint(px,py,1);
  const lv = clamp(4 + Math.floor(kills/10), 4, 14);
  const pk = makePirate(p.x, p.y, lv);
  pk.hp = pk.maxhp = pirateStats(lv).hp*2.2; pk.dmg = pirateStats(lv).dmg*1.3;
  pk.radius = pirateStats(lv).radius+4; pk.elite = true;
  pirates.push(pk);
  floatText(pk.x, pk.y - pk.radius - 14, '精英海盗来袭 Lv.'+lv+'!', '#ff5b3a');
}
function spawnPirateShip(px,py){
  const pp = px!==undefined? {x:px,y:py} : playerXY();
  let tries=0, p;
  do { p = randomWaterNear(pp.x, pp.y, 700, 1800); tries++; }
  while(inKingdom(p.x, p.y) && tries<3);
  if(isLand(p.x,p.y)) return;
  const hp = 120 + kills*4, dmg = 14 + kills*0.25;
  pirateShips.push({ x:p.x, y:p.y, hp, maxhp:hp, dmg, speed:1.05, atkCd:0, flash:0, fireCd:rand(1,3),
    crew:randi(0,1), _landCd:rand(6,12) });
}
function makeFollower(x,y){
  return { x, y, hp:60, maxhp:60, cd:0, gatherCd:0, downed:false, respawn:0, attackFlash:0, walk:0, facing:1,
    coat:true, sash:false, beard:false, patch:false };
}
// 海里动物
function spawnCreature(px,py){
  const type=choice(['fish','fish','fish','shark','turtle','whale']);
  const pp = px!==undefined? {x:px,y:py} : playerXY();
  const p = randomWaterNear(pp.x, pp.y, 150, 1200);
  if(isLand(p.x,p.y)) return;
  const c={ x:p.x, y:p.y, type, vx:rand(-0.7,0.7), vy:rand(-0.3,0.3), phase:rand(0,6), flash:0 };
  if(type==='whale') c.size=rand(36,54);
  creatures.push(c);
}
// 鸟类：海鸥/鹦鹉/信天翁。alt = 飞行高度，越低越好捕
function spawnBird(px,py){
  const pp = px!==undefined? {x:px,y:py} : playerXY();
  const a=rand(0,Math.PI*2), d=rand(260,1300);
  const x=pp.x+Math.cos(a)*d, y=pp.y+Math.sin(a)*d;
  const type = choice(BIRD_KEYS), m = BIRD_TYPES[type];
  const ang = rand(0,Math.PI*2);
  birds.push({ x, y, type, hp:m.hp, maxhp:m.hp, alt:rand(48,86), targetAlt:rand(48,86),
    vx:Math.cos(ang)*m.speed, vy:Math.sin(ang)*m.speed, flap:rand(0,6), flash:0, dead:false,
    restCd:rand(6,16), resting:false, scare:0 });
}
function updateBirds(dt){
  const pp = playerXY();
  for(const b of birds){
    if(b.dead) continue;
    const m = BIRD_TYPES[b.type];
    if(b.flash>0) b.flash-=dt;
    if(b.scare>0) b.scare-=dt;
    b.flap += dt*(b.resting? 2 : 11);
    // 高度：休息时贴地/贴水（易捕），否则高飞
    b.restCd -= dt;
    if(b.restCd<=0){
      b.resting = !b.resting;
      b.restCd = b.resting? rand(4,9) : rand(8,18);
      b.targetAlt = b.resting? rand(4,12) : rand(52,92);
    }
    if(b.scare>0) b.targetAlt = 96;               // 受惊拉升
    b.alt += (b.targetAlt-b.alt)*Math.min(1,dt*1.8);
    // 水平移动：受惊/休息速度不同
    const spd = b.resting? 0.25 : (b.scare>0? 1.9 : 1);
    b.x += b.vx*spd; b.y += b.vy*spd;
    if(Math.random()<0.02){ const a=Math.atan2(b.vy,b.vx)+rand(-0.6,0.6); b.vx=Math.cos(a)*m.speed; b.vy=Math.sin(a)*m.speed; }
    // 鹦鹉偏爱陆地，海鸥/信天翁偏爱海面
    if(Math.random()<0.01){
      const overLand = isLand(b.x,b.y);
      const want = b.type==='parrot';
      if(overLand!==want){ const a=Math.atan2(b.vy,b.vx)+Math.PI*rand(0.6,1.4); b.vx=Math.cos(a)*m.speed; b.vy=Math.sin(a)*m.speed; }
    }
  }
  birds = birds.filter(b=>!b.dead && dist(b.x,b.y,pp.x,pp.y)<2400);
  if(birds.length<10 && Math.random()<0.05) spawnBird(pp.x,pp.y);
}
function catchBird(b, method){
  if(b.dead) return;
  b.dead = true;
  const m = BIRD_TYPES[b.type];
  inventory.food += m.food;
  if(m.gold) inventory.gold += m.gold;
  const extra = m.gold? ' 🪙+'+m.gold : '';
  floatText(b.x, b.y-b.alt-10, (method==='hand'?'徒手捕获 ':'射落 ')+m.icon+m.name+' 🍖+'+m.food+extra, '#9be8b4');
  for(let i=0;i<9;i++) particles.push(mkParticle(b.x, b.y-b.alt, choice([m.body,m.wing,'#ffffff'])));
  updateInventoryHUD();
}
function scareBirds(x,y,r){
  for(const b of birds){ if(!b.dead && dist(b.x,b.y,x,y)<r){ b.scare=2.4; b.resting=false; b.restCd=rand(9,16); } }
}

// ---------- v11：废墟 / 载具 / 领地 ----------
function spawnWreck(px,py){
  const sea = !isLand(px,py);
  const type = sea ? 'ship' : (Math.random()<0.5?'car':'plane');
  let x,y;
  if(type==='ship'){ const p=randomWaterNear(px,py,200,700); x=p.x; y=p.y; }
  else { const p=randomLandPoint(px,py,2); x=p.x; y=p.y; }
  wrecks.push({ x,y,type, looted:false, phase:rand(0,6) });
}
function tryLootWreck(px,py){
  let best=null,bd=70;
  for(const w of wrecks){ if(w.looted) continue; const d=dist(px,py,w.x,w.y); if(d<bd){bd=d;best=w;} }
  if(!best) return false;
  best.looted=true;
  let msg='';
  if(best.type==='ship'){
    const t=randi(3,5); inventory.timber+=t; inventory.steel+=randi(1,2); msg='船骸⚓ +🏗️造船木×'+t;
  } else if(best.type==='car'){
    const t=randi(2,4); inventory.tire+=t; inventory.aluminum+=randi(1,2); msg='车骸🚗 +🛞轮胎×'+t;
  } else {
    const a=randi(3,5); inventory.aluminum+=a; inventory.tire+=randi(1,2); msg='飞机骸✈️ +🔧铝材×'+a;
  }
  floatText(best.x,best.y-26, msg, '#bfe8ff'); updateInventoryHUD();
  for(let i=0;i<6;i++) particles.push(mkParticle(best.x,best.y,'#bfe8ff'));
  return true;
}
// 载具：使用专属材料打造，打造后自动装载到主船（最多4辆），船满时才放陆地
function buildVehicle(type){
  const cost = VEHICLE_COSTS[type];
  for(const k in cost){ if(inventory[k] < cost[k]){
    const m=RES_META[k]; floatText(captain.x,captain.y-30,'材料不足，需'+m.icon+m.name+'×'+cost[k],'#e35d4f'); return; } }
  for(const k in cost) inventory[k]-=cost[k];
  if(ship.vehicles.length < 4){
    const idx = ship.vehicles.length;
    ship.vehicles.push({ type, offset: idx===0? -14 : (idx%2===0?-8:8), speed:(type==='plane'?5.2:4.6), facing:1, walk:0, alt:0 });
    const label = type==='car'?'🚗 车子':'✈️ 飞机';
    floatText(ship.x, ship.y-40, label+' 已自动装载上船!','#9be8b4');
    updateInventoryHUD(); return;
  }
  const p = type==='plane' ? playerXY() : randomLandPoint(captain.x,captain.y,1);
  vehicles.push({ type, x:p.x, y:p.y, speed:(type==='plane'?5.2:4.6), facing:1, walk:0, alt:0 });
  floatText(p.x,p.y-30, (type==='car'?'🚗 车子':'✈️ 飞机')+' 打造完成! 船已满，靠船按E装载', '#ffd27a'); updateInventoryHUD();
}
// 打造新战船：消耗造船木+废铁，新增一艘跟随护航的友方战船
function buildShip(){
  const cost = SHIP_BUILD_COST;
  for(const k in cost){ if(inventory[k] < cost[k]){
    const m=RES_META[k]; floatText(captain.x,captain.y-30,'材料不足(需'+m.icon+m.name+'×'+cost[k]+')','#e35d4f'); return; } }
  if(myShips.length >= MAX_MYSHIPS){ floatText(captain.x,captain.y-30,'友军舰队已满(最多'+MAX_MYSHIPS+'艘)','#e35d4f'); return; }
  for(const k in cost) inventory[k]-=cost[k];
  const a=rand(0,Math.PI*2), off=90+rand(0,60);
  const hp = 180 + ship.level*30 + captainLv*10;
  const px = captain.onShip ? ship.x+Math.cos(a)*off : captain.x+Math.cos(a)*off;
  const py = captain.onShip ? ship.y+Math.sin(a)*off : captain.y+Math.sin(a)*off;
  myShips.push({ x:px, y:py, hp, maxhp:hp, ally:true, flash:0, fireCd:rand(1,2), _ox:Math.cos(a)*70, _oy:Math.sin(a)*70 });
  floatText(px, py-30, '🚢 新战船打造完成! (随舰队护航)', '#9be8b4');
  updateInventoryHUD();
}
// 把陆地载具装载到船上
function loadVehicleToShip(){
  if(!captain.onShip){ floatText(captain.x,captain.y-30,'需登船后才能装载载具','#e35d4f'); return; }
  if(ship.vehicles.length>=4){ floatText(ship.x,ship.y-40,'船上已满载(最多4辆)','#e35d4f'); return; }
  let best=null,bd=80;
  for(const v of vehicles){ const d=dist(ship.x,ship.y,v.x,v.y); if(d<bd){bd=d;best=v;} }
  if(!best){ floatText(ship.x,ship.y-40,'附近无载具可装载','#e35d4f'); return; }
  const idx=ship.vehicles.length;
  ship.vehicles.push({ type:best.type, offset:idx===0?-14:(idx%2===0?-8:8), speed:best.speed, facing:best.facing, walk:best.walk, alt:0 });
  vehicles.splice(vehicles.indexOf(best),1);
  const label=best.type==='car'?'🚗 车子':'✈️ 飞机';
  floatText(ship.x, ship.y-40, label+' 已装载上船!','#9be8b4');
}
// 从船上卸载载具到岸上
function unloadVehicleFromShip(){
  if(!captain.onShip || ship.vehicles.length===0){ floatText(captain.x,captain.y-30,'船上无载具','#e35d4f'); return; }
  const v=ship.vehicles[ship.vehicles.length-1];
  const p=pushToLand(ship.x, ship.y, 20);
  vehicles.push({ type:v.type, x:p.x, y:p.y, speed:v.speed, facing:v.facing, walk:v.walk, alt:0 });
  ship.vehicles.pop();
  const label=v.type==='car'?'🚗 车子':'✈️ 飞机';
  floatText(p.x, p.y-30, label+' 已卸载到岸上','#e35d4f');
}
function enterVehicle(){
  if(captain.riding) return;
  let best=null,bd=60;
  for(const v of vehicles){ const d=dist(captain.x,captain.y,v.x,v.y); if(d<bd){bd=d;best=v;} }
  if(!best){ floatText(captain.x,captain.y-30,'附近无载具','#e35d4f'); return; }
  captain.riding=best;
  floatText(best.x,best.y-30, (best.type==='car'?'上车 🚗':'登机 ✈️'), '#9be8b4');
}
function exitVehicle(){
  const v=captain.riding; if(!v) return;
  if(v.type==='plane'){
    if(!isLand(v.x,v.y) && dist(v.x,v.y,ship.x,ship.y)>150){ floatText(v.x,v.y-30,'飞到陆地或船边再降落','#e35d4f'); return; }
    if(!isLand(v.x,v.y)){ captain.onShip=true; captain.riding=null; floatText(ship.x,ship.y-30,'降落登船 ⚓','#9be8b4'); return; }
  }
  captain.x=v.x; captain.y=v.y; captain.riding=null;
  floatText(v.x,v.y-30, '下车 🚶', '#9be8b4');
}
function makeSoldier(x,y){
  return { x,y, hp:90, maxhp:90, dmg:18, speed:2.0, radius:12, flash:0, cd:0, walk:rand(0,6), facing:1, attackFlash:0, color:'#2e6fb0', coat:true, sash:true, beard:false, patch:false };
}
function islandKey(is){ return Math.floor(is.x/CHUNK)+','+Math.floor(is.y/CHUNK); }
// 自动占领：岛上所有敌人死亡后自动把岛屿变成玩家领地
function checkAutoCapture(killedX, killedY){
  const is = nearestIsland(killedX, killedY, 2);
  if(!is) return;
  const key = islandKey(is);
  if(ownedIslands[key]) return;
  for(const p of pirates){ if(!p.dead && dist(p.x, p.y, is.x, is.y) < is.r) return; }
  for(const ps of pirateShips){ if(!ps.dead && dist(ps.x, ps.y, is.x, is.y) < is.r+30) return; }
  captureIsland(is);
}

// ---------- 船长锻炼升级 ----------
function gainCaptainXp(amount){
  captainXp += amount;
  maybeCaptainLevelUp();
}
function captainXpNeed(){ return captainLv * 30; }
function maybeCaptainLevelUp(){
  while(captainXp >= captainXpNeed() && captainLv < CAPTAIN_MAX_LV){
    captainXp -= captainXpNeed();
    captainLv++;
    const hpBonus = 8;
    const dmgBonus = Math.round(captainLv * 2);
    const defBonus = Math.round(captainLv * 0.8);
    captain.maxhp += hpBonus;
    captain.hp = Math.min(captain.maxhp, captain.hp + hpBonus);
    captain._dmgBonus = dmgBonus;
    captain._defBonus = defBonus;
    floatText(captain.onShip?ship.x:captain.x, captain.onShip?ship.y:captain.y-30,
      '💪 船长 Lv.'+captainLv+'! HP+'+hpBonus+' 攻击+'+dmgBonus+' 防御+'+defBonus, '#ffd27a');
  }
}
function captainDmgBonus(){ return (captain._dmgBonus||0) + equipBonus('dmg'); }
function captainDefBonus(){ return (captain._defBonus||0) + equipBonus('def'); }
function captainSpeedBonus(){ return (captain._speedBonus||0) + equipBonus('speed'); }
function captainGoldBonus(){ return (captain._goldBonus||0) + equipBonus('gold'); }
function captainRegenBonus(){ return (captain._regenBonus||0) + equipBonus('regen'); }
function captainHasEquip(id){ if(!captain.equip) return false; return captain.equip.some(e=>e.id===id); }
function equipBonus(type){
  if(!captain.equip) return 0;
  let s = 0;
  for(const e of captain.equip){
    if(e.effect===type || (type==='all' && e.effect!=='burn' && e.effect!=='execute' && e.effect!=='gold')) s += e.value;
  }
  return s;
}
function equipBurnTick(dt){
  if(!captain.equip) return;
  const lava = captain.equip.find(e=>e.id==='lava_armor');
  if(!lava) return;
  lava._burnCd = (lava._burnCd||0) - dt;
  if(lava._burnCd > 0) return;
  lava._burnCd = 0.3;
  const cx = captain.onShip?ship.x:captain.x, cy = captain.onShip?ship.y:captain.y;
  for(const t of pirates){ if(t.dead) continue; if(dist(cx,cy,t.x,t.y)<200){ damageEnemy(t,lava.value,false); } }
  if(Math.random()<0.6){ const a=rand(0,Math.PI*2), px=cx+Math.cos(a)*22, py=cy+Math.sin(a)*22; particles.push(mkParticle(px,py,choice(['#ff7700','#ff3300','#ffaa00']))); }
}
// 尝试装备：从掉落装备中自动穿戴（更好就替换，上限5件）
function tryEquip(eq){
  if(!captain.equip) captain.equip = [];
  // 背包无限，永远可拾取
  // 同slot已装备的，更好的换
  const slot = eq.slot;
  const idx = captain.equip.findIndex(e=>e.slot===slot);
  if(idx>=0){
    const old = captain.equip[idx];
    if(eq.rarity > old.rarity || (eq.rarity===old.rarity && eq.value > old.value)){
      captain.equip[idx] = eq;
    } else {
      floatText(captain.x,captain.y-30,'已有更好装备','#ffe9b0'); return false;
    }
  } else {
    captain.equip.push(eq);
  }
  const rm = RARITY_META[eq.rarity];
  floatText(captain.x, captain.y-40, '🎖️ 装备 ['+rm.name+'] '+eq.icon+eq.name+' '+eq.desc, rm.color);
  floatText(captain.x, captain.y-54, '自动穿戴生效！', '#ffd27a');
  updateEquipmentHUD();
  return true;
}
function craftEquip(id){
  const r = EQUIP_RECIPES.find(x=>x.id===id);
  if(!r) return;
  for(const [k,v] of Object.entries(r.cost)){ if(inventory[k]!==undefined && inventory[k]<v){ floatText(captain.x,captain.y-30,'材料不足','#e35d4f'); return; } }
  for(const [k,v] of Object.entries(r.cost)){ if(inventory[k]!==undefined) inventory[k]-=v; }
  const eq = EQUIPMENT.find(e=>e.id===id);
  const drop = { ...eq }; drop._burnCd = 0;
  tryEquip(drop);
  updateInventoryHUD();
  floatText(captain.x, captain.y-68, '锻造成功！', '#ffd27a');
}

// ---------- 家园王国系统 ----------
// 开局即有的专属王国岛，位于 (0,0) chunk
// 国王👑+侍卫🛡️ 常驻，范围250像素内无敌，敌人靠近即秒杀
const KINGDOM = { x:0, y:0, r:180 };
let kingdomNPCs = []; // {x,y,type:'king'|'guard',ang,walk}
function initKingdom(){
  kingdomNPCs = [
    { x:KINGDOM.x, y:KINGDOM.y-20, type:'king', ang:0, walk:0, bob:0 },
    { x:KINGDOM.x-40, y:KINGDOM.y, type:'guard', ang:0, walk:0 },
    { x:KINGDOM.x+40, y:KINGDOM.y, type:'guard', ang:Math.PI, walk:0 },
    { x:KINGDOM.x-30, y:KINGDOM.y+40, type:'guard', ang:0.5, walk:0 },
    { x:KINGDOM.x+30, y:KINGDOM.y+40, type:'guard', ang:Math.PI-0.5, walk:0 },
    { x:KINGDOM.x-50, y:KINGDOM.y-40, type:'guard', ang:0.8, walk:0 },
    { x:KINGDOM.x+50, y:KINGDOM.y-40, type:'guard', ang:Math.PI+0.8, walk:0 },
  ];
}
function inKingdom(x,y){ return dist(x,y,KINGDOM.x,KINGDOM.y) < KINGDOM.r; }
// 王国守卫逻辑：巡逻+秒杀范围内敌人
function updateKingdom(dt){
  // 侍卫巡逻移动
  for(const g of kingdomNPCs){
    if(g.type!=='guard') continue;
    g.walk += dt*2;
    const r = 80 + (g.x-KINGDOM.x)*0.2;
    const baseAng = Math.atan2(g.y-KINGDOM.y, g.x-KINGDOM.x);
    const targetX = KINGDOM.x + Math.cos(baseAng + Math.sin(animT*0.5+g.ang)*0.4) * r;
    const targetY = KINGDOM.y + Math.sin(baseAng + Math.sin(animT*0.5+g.ang)*0.4) * r;
    const d = dist(g.x, g.y, targetX, targetY);
    if(d > 3){ const a = Math.atan2(targetY-g.y, targetX-g.x); g.x += Math.cos(a)*1.8*dt*60; g.y += Math.sin(a)*1.8*dt*60; g.facing = Math.cos(a)>=0?1:-1; }
    // 秒杀范围内敌人
    for(const p of pirates){ if(!p.dead && dist(g.x, g.y, p.x, p.y) < 120){ damageEnemy(p, 9999, false); } }
  }
  // 国王呼吸动画
  const k = kingdomNPCs[0];
  if(k){ k.bob += dt*3; k.walk += dt*1.2; }
}
// 王国岛屿绘制：城堡、王旗、金边围栏
function drawKingdom(ctx){
  // render 已 ctx.translate(-cam.x,-cam.y)，直接用世界坐标
  // 画围栏（金边虚线圆）
  ctx.save();
  ctx.beginPath();
  ctx.arc(KINGDOM.x, KINGDOM.y, KINGDOM.r, 0, Math.PI*2);
  ctx.strokeStyle='rgba(240,192,96,0.45)'; ctx.lineWidth=2;
  ctx.setLineDash([8,4]); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  // 王旗/城堡标志
  ctx.save(); ctx.translate(KINGDOM.x, KINGDOM.y-KINGDOM.r+20);
  ctx.font='28px Segoe UI'; ctx.textAlign='center'; ctx.fillText('🏰', 0, 0);
  ctx.font='bold 10px Segoe UI'; ctx.fillStyle='#ffd27a'; ctx.fillText('王  国', 0, 14);
  ctx.restore();
}

// 胜利条件检测
function checkVictory(){
  if(victoryWon) return;
  if(kills >= WIN_BY_KILLS){
    victoryWon = true; victoryType = 'kills';
    endGame(true);
  }
  if(Object.keys(ownedIslands).length >= WIN_BY_ISLANDS){
    victoryWon = true; victoryType = 'islands';
    endGame(true);
  }
  // 攻破所有海盗王国 = 胜利
  if(pirateKingdoms.length > 0 && pirateKingdoms.every(k => !k.alive)){
    victoryWon = true; victoryType = 'kingdoms';
    endGame(true);
  }
}

// ========== v14 陆地动物系统 ==========
// 龙窝（龙巢穴）：在远处岛屿上生成，聚集多条龙，标记为火海区域
let dragonNests = [];  // { x, y, r, guards:[dragons], phase, alive }
const DRAGON_NEST_COUNT = 4;       // 初始生成龙窝数量
const DRAGON_NEST_GUARDS = 3;      // 每个龙窝的守卫龙数量
// 东海龙王：终极BOSS，在击败所有龙窝后出现
let dragonKing = null;  // { x, y, hp, maxhp, atk, speed, range, cd, phase, size, dead }

function spawnLandAnimal(px, py, span){
  const types = ['wolf','wolf','bear','cow','cow','cow','deer','deer','sheep','sheep','sheep'];
  if(Math.random()<0.04) types.push('dragon');
  const type = choice(types);
  const m = ANIMAL_TYPES[type];
  const p = randomLandPoint(px, py, span||2);
  if(!isLand(p.x, p.y)) return;
  const a = rand(0, Math.PI*2);
  landAnimals.push({ type, x:p.x, y:p.y, vx:Math.cos(a)*m.sp*rand(0.3,0.8), vy:Math.sin(a)*m.sp*rand(0.3,0.8),
    hp:m.hp, maxhp:m.hp, atk:m.atk, speed:m.sp, range:m.range, cd:m.cd, color:m.color, size:m.size,
    diet:m.diet, flash:0, angle:a, patrolCd:rand(0.5,1.5), face:Math.cos(a)>=0?1:-1, dead:false });
}
function killLandAnimal(a){
  a.dead = true; kills++;
  const m = ANIMAL_TYPES[a.type];
  const r = m.reward;
  if(r.food) inventory.food += r.food;
  if(r.gold) inventory.gold += r.gold;
  if(r.iron) inventory.iron += r.iron;
  if(r.timber) inventory.timber += r.timber;
  let msg = m.icon + ' ' + m.name + ' 击败!';
  if(r.food) msg += ' 🍖+'+r.food;
  if(r.gold) msg += ' 🪙+'+r.gold;
  floatText(a.x, a.y-20, msg, a.type==='dragon'?'#ff5b3a':'#ffe9b0');
  gainCaptainXp(a.type==='dragon' ? CAPTAIN_XP_KILL_SHIP : 10);
  if(a.type === 'dragon'){
    // 龙必掉龙鳞甲
    tryEquipFromDrop('dragon_armor', a.x, a.y);
  } else {
    tryDropEquipment(a.x, a.y, a.type==='wolf'||a.type==='bear' ? 2 : 1);
  }
  updateInventoryHUD(); checkMilestone(); checkVictory();
}
function updateLandAnimals(dt){
  for(const a of landAnimals){
    if(a.dead) continue;
    a.flash = Math.max(0, a.flash-dt);
    if(a.cd<=0) a.cd -= dt;
    if(dist(a.x, a.y, KINGDOM.x, KINGDOM.y) < KINGDOM.r){ a.vx*=-1; a.vy*=-1; continue; }

    // 草食动物：持续游荡吃草，永不攻击
    if(a.diet==='herbivore'){
      a.patrolCd -= dt;
      if(a.patrolCd<=0){
        const na = a.angle + rand(-0.8, 0.8); a.angle = na;
        // 草食动物走得慢，悠闲游荡
        a.vx = Math.cos(na)*a.speed*rand(0.3,0.6); a.vy = Math.sin(na)*a.speed*rand(0.3,0.6);
        a.patrolCd = rand(1.5, 3.5);
      }
      // 偶尔低头吃草（短暂停顿）
      if(!a.grazing) a.grazing -= dt;
      const moving = a.grazing > 0;
      if(!moving){
        const nx = a.x+a.vx*dt*3, ny = a.y+a.vy*dt*3;
        if(!isLand(nx, a.y)) a.vx *= -1; else a.x = nx;
        if(!isLand(a.x, ny)) a.vy *= -1; else a.y = ny;
        a.walk = (a.walk||0) + dt*4; // 走路动画
        // 偶尔低头吃草
        if(Math.random()<0.005) a.grazing = rand(0.8, 2.0);
      }
      a.face = a.vx>=0?1:-1;
      continue;
    }

    // 肉食动物：追击船长，平滑加速
    const tpx = captain.onShip? ship.x : captain.x, tpy = captain.onShip? ship.y : captain.y;
    const d = dist(a.x, a.y, tpx, tpy);
    let chasing = false;
    if(d < 380 && !captain.onShip){ chasing = true; }
    else if(d < 520 && !captain.riding){ chasing = true; }

    if(chasing){
      const ta = Math.atan2(tpy-a.y, tpx-a.x);
      // 平滑转向：vx/vy 向目标方向加速（非瞬移）
      const ax = Math.cos(ta)*a.speed*1.5;
      const ay = Math.sin(ta)*a.speed*1.5;
      a.vx = a.vx*0.92 + ax*0.08;
      a.vy = a.vy*0.92 + ay*0.08;
      const nx = a.x+a.vx*dt*3, ny = a.y+a.vy*dt*3;
      if(!isLand(nx, a.y)) a.vx *= -0.5; else a.x = nx;
      if(!isLand(a.x, ny)) a.vy *= -0.5; else a.y = ny;
      a.face = a.vx>=0?1:-1;
      a.walk = (a.walk||0) + dt*5; // 快跑动画
      // 攻击
      if(d < a.range && a.cd<=0 && a.atk > 0){
        a.cd = ANIMAL_TYPES[a.type].cd;
        if(captain.hp > 0){
          captain.hp -= a.atk;
          const icon = a.type==='dragon'?'🐉':(a.type==='wolf'?'🐺':'🐻');
          floatText(captain.x, captain.y-20, icon+' 攻击 -'+a.atk, '#ff7a5c');
          if(captain.hp<=0) endGame(false);
        }
      }
    } else {
      // 游走模式
      a.patrolCd -= dt;
      if(a.patrolCd<=0){
        const na = a.angle + rand(-1.0, 1.0); a.angle = na;
        a.vx = Math.cos(na)*a.speed*rand(0.4,0.7); a.vy = Math.sin(na)*a.speed*rand(0.4,0.7);
        a.patrolCd = rand(1.2, 3.0);
      }
      const nx = a.x+a.vx*dt*3, ny = a.y+a.vy*dt*3;
      if(!isLand(nx, a.y)) a.vx *= -1; else a.x = nx;
      if(!isLand(a.x, ny)) a.vy *= -1; else a.y = ny;
      a.face = a.vx>=0?1:-1;
      a.walk = (a.walk||0) + dt*3;
    }
    // 龙水柱粒子
    if(a.type==='dragon' && Math.random()<0.06)
      particles.push(mkParticle(a.x+rand(-4,4)*a.face, a.y-6, '#4aa8ff'));
  }
  const pp = playerXY();
  if(landAnimals.length < 35 && Math.random()<0.025) spawnLandAnimal(pp.x, pp.y);
  landAnimals = landAnimals.filter(a => !a.dead && (a._nest || a.type==='dragonKing' || dist(a.x, a.y, pp.x, pp.y) < 3000));
}
function drawLandAnimals(){
  for(const a of landAnimals){
    if(a.dead) continue;
    const sx = a.x - cam.x, sy = a.y - cam.y;
    const vw = canvas.width/DPR, vh = canvas.height/DPR;
    if(sx<-40||sx>vw+40||sy<-40||sy>vh+40) continue;
    ctx.save();
    const isKing = (a.type==='dragonKing');
    const SCALE = (a.type==='dragon'||a.type==='dragonKing') ? (isKing ? 1.8 : 1) : 1;
    // 阴影
    ctx.globalAlpha=0.2; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(a.x, a.y+a.size*0.85, a.size*0.9, a.size*0.3, 0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    if(a.type==='dragon' || a.type==='dragonKing'){
      // ===== 青龙绘制：绿色身体+龙鳞+短犄角+水柱吐息+四爪 =====
      const S=a.size*SCALE, face=a.face, flash=a.flash>0;
      const wingFlap = Math.sin(animT*6 + a.x*0.01)*0.4 + 0.6;
      const waterPhase = Math.sin(animT*5)*0.5+0.5;
      const dGreen = isKing ? '#1a6b3a' : '#2d9e4a';
      const dGreenDark = isKing ? '#0e4a28' : '#1a7a3a';
      // BOSS水波光晕
      if(isKing){
        ctx.fillStyle='rgba(30,180,100,'+(0.12+Math.sin(animT*4)*0.04)+')';
        ctx.beginPath(); ctx.arc(a.x, a.y, S*1.5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(80,200,255,0.5)'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(a.x, a.y, S*1.3, 0, Math.PI*2); ctx.stroke();
      }
      // 尾巴（蜿蜒）
      ctx.strokeStyle=flash?'#fff':dGreenDark; ctx.lineWidth=S*0.18; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(a.x-face*S*0.3, a.y+S*0.1);
      for(let i=1;i<=6;i++){
        const tx=a.x-face*S*(0.3+0.25*i), ty=a.y+S*0.1+Math.sin(animT*4+i*1.2)*S*0.15*i;
        ctx.lineTo(tx,ty);
      }
      ctx.stroke();
      // 尾尖水珠
      const tTipX=a.x-face*S*1.8, tTipY=a.y+S*0.1+Math.sin(animT*4+7.2)*S*0.15*6;
      ctx.fillStyle='#4aa8ff'; ctx.beginPath(); ctx.arc(tTipX,tTipY,S*0.12+waterPhase*S*0.06,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(180,230,255,0.7)'; ctx.beginPath(); ctx.arc(tTipX-S*0.03,tTipY-S*0.03,S*0.05,0,Math.PI*2); ctx.fill();
      // 身体主体
      ctx.fillStyle=flash?'#fff':dGreen;
      ctx.beginPath(); ctx.ellipse(a.x, a.y, S*0.8, S*0.5, 0, 0, Math.PI*2); ctx.fill();
      // 龙鳞（菱形网格覆盖全身）
      ctx.fillStyle='rgba(20,100,50,0.55)';
      for(let sx=-S*0.55;sx<=S*0.55;sx+=S*0.15){
        for(let sy=-S*0.32;sy<=S*0.32;sy+=S*0.13){
          const off=((sx/S/0.15)|0)+((sy/S/0.13)|0);
          if(off%2!==0) continue;
          ctx.beginPath(); ctx.moveTo(a.x+sx, a.y+sy-S*0.055);
          ctx.lineTo(a.x+sx+S*0.065, a.y+sy);
          ctx.lineTo(a.x+sx, a.y+sy+S*0.055);
          ctx.lineTo(a.x+sx-S*0.065, a.y+sy); ctx.closePath(); ctx.fill();
        }
      }
      // 鳞片高光
      ctx.fillStyle='rgba(120,220,150,0.3)';
      for(let sx=-S*0.45;sx<=S*0.45;sx+=S*0.15){
        for(let sy=-S*0.25;sy<=S*0.25;sy+=S*0.13){
          const off=((sx/S/0.15)|0)+((sy/S/0.13)|0);
          if(off%2!==0) continue;
          ctx.beginPath(); ctx.arc(a.x+sx-S*0.02, a.y+sy-S*0.02, S*0.025, 0, Math.PI*2); ctx.fill();
        }
      }
      // 腹部浅色
      ctx.fillStyle='rgba(200,255,180,0.35)';
      ctx.beginPath(); ctx.ellipse(a.x, a.y+S*0.15, S*0.5, S*0.22, 0, 0, Math.PI*2); ctx.fill();
      // 翅膀（半透明翠绿膜翼）
      ctx.fillStyle=flash?'rgba(255,255,255,0.6)':'rgba(40,140,70,0.65)';
      ctx.strokeStyle='rgba(15,60,30,0.8)'; ctx.lineWidth=1.5;
      // 左翼
      ctx.beginPath(); ctx.moveTo(a.x-S*0.2, a.y-S*0.2);
      ctx.quadraticCurveTo(a.x-S*0.35*wingFlap, a.y-S*0.5*wingFlap, a.x-S*0.7, a.y-S*0.15);
      ctx.quadraticCurveTo(a.x-S*0.5, a.y+S*0.05, a.x-S*0.15, a.y+S*0.05);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // 右翼
      ctx.beginPath(); ctx.moveTo(a.x+S*0.2, a.y-S*0.2);
      ctx.quadraticCurveTo(a.x+S*0.35*wingFlap, a.y-S*0.5*wingFlap, a.x+S*0.7, a.y-S*0.15);
      ctx.quadraticCurveTo(a.x+S*0.5, a.y+S*0.05, a.x+S*0.15, a.y+S*0.05);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // 翼骨
      ctx.strokeStyle='rgba(10,50,20,0.6)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(a.x-S*0.2, a.y-S*0.2); ctx.lineTo(a.x-S*0.6, a.y-S*0.1);
      ctx.moveTo(a.x+S*0.2, a.y-S*0.2); ctx.lineTo(a.x+S*0.6, a.y-S*0.1); ctx.stroke();
      // 头部
      const hx=a.x+face*S*0.6, hy=a.y-S*0.2;
      ctx.fillStyle=flash?'#fff':dGreen;
      ctx.beginPath(); ctx.ellipse(hx, hy, S*0.32, S*0.26, 0, 0, Math.PI*2); ctx.fill();
      // 头部鳞片
      ctx.fillStyle='rgba(20,100,50,0.4)';
      for(let sx=-S*0.2;sx<=S*0.2;sx+=S*0.12){
        ctx.beginPath(); ctx.moveTo(hx+sx, hy-S*0.04);
        ctx.lineTo(hx+sx+S*0.05, hy);
        ctx.lineTo(hx+sx, hy+S*0.04);
        ctx.lineTo(hx+sx-S*0.05, hy); ctx.closePath(); ctx.fill();
      }
      // 两只短犄角（圆润短角，不吓人）
      ctx.fillStyle='#3a5a1a';
      ctx.beginPath(); ctx.ellipse(hx-face*S*0.05, hy-S*0.22, S*0.04, S*0.1, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx+face*S*0.12, hy-S*0.22, S*0.04, S*0.1, 0.3, 0, Math.PI*2); ctx.fill();
      // 犄角高光
      ctx.fillStyle='rgba(150,200,100,0.5)';
      ctx.beginPath(); ctx.ellipse(hx-face*S*0.05, hy-S*0.24, S*0.015, S*0.04, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx+face*S*0.12, hy-S*0.24, S*0.015, S*0.04, 0.3, 0, Math.PI*2); ctx.fill();
      // 眼睛（友好圆眼，蓝色虹膜）
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(hx+face*S*0.12, hy-S*0.05, S*0.07, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#4a9fff'; ctx.beginPath(); ctx.arc(hx+face*S*0.13, hy-S*0.05, S*0.045, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(hx+face*S*0.14, hy-S*0.05, S*0.022, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(hx+face*S*0.135, hy-S*0.06, S*0.012, 0, Math.PI*2); ctx.fill();
      // 嘴
      ctx.fillStyle=dGreenDark;
      ctx.beginPath(); ctx.moveTo(hx+face*S*0.22, hy+S*0.08);
      ctx.quadraticCurveTo(hx+face*S*0.32, hy+S*0.05, hx+face*S*0.22, hy+S*0.16); ctx.closePath(); ctx.fill();
      // 水柱吐息（从嘴喷出蓝色水柱）
      if(waterPhase>0.3){
        ctx.fillStyle='rgba(74,168,255,'+waterPhase*0.7+')';
        for(let fi=0;fi<5;fi++){
          const fx=hx+face*S*(0.35+fi*0.16), fy=hy+S*0.1+Math.sin(animT*10+fi)*S*0.05;
          const fs=S*0.1-fi*S*0.012;
          if(fs<=0) continue;
          ctx.beginPath(); ctx.arc(fx,fy,fs,0,Math.PI*2); ctx.fill();
        }
        ctx.fillStyle='rgba(180,230,255,'+waterPhase*0.6+')';
        for(let fi=0;fi<3;fi++){
          const fx=hx+face*S*(0.4+fi*0.22), fy=hy+S*0.1+Math.sin(animT*8+fi)*S*0.06;
          ctx.beginPath(); ctx.arc(fx,fy,S*0.05,0,Math.PI*2); ctx.fill();
        }
      }
      // 四条腿（粗壮）
      ctx.fillStyle=flash?'#fff':dGreenDark;
      ctx.beginPath(); ctx.ellipse(a.x-S*0.35, a.y+S*0.4, S*0.13, S*0.18, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(a.x+S*0.35, a.y+S*0.4, S*0.13, S*0.18, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(a.x-S*0.12, a.y+S*0.45, S*0.11, S*0.16, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(a.x+S*0.12, a.y+S*0.45, S*0.11, S*0.16, 0, 0, Math.PI*2); ctx.fill();
      // 四爪（每只脚3爪尖+爪尖线）
      ctx.fillStyle='#2a4a1a';
      const clawPos=[[-S*0.35,S*0.58],[S*0.35,S*0.58],[-S*0.12,S*0.61],[S*0.12,S*0.61]];
      for(const [lx,ly] of clawPos){
        for(let ci=0;ci<3;ci++){
          ctx.beginPath(); ctx.arc(a.x+lx+(ci-1)*S*0.055, a.y+ly, S*0.038, 0, Math.PI*2); ctx.fill();
        }
        ctx.strokeStyle='#1a3a0a'; ctx.lineWidth=1;
        for(let ci=0;ci<3;ci++){
          ctx.beginPath(); ctx.moveTo(a.x+lx+(ci-1)*S*0.055, a.y+ly);
          ctx.lineTo(a.x+lx+(ci-1)*S*0.055, a.y+ly+S*0.05); ctx.stroke();
        }
      }
    } else {
      const isHerb = a.diet==='herbivore';
      ctx.fillStyle = isHerb ? (a.type==='cow'?'#a07840':(a.type==='deer'?'#8a6530':'#c8b898')) : a.color;
      ctx.beginPath(); ctx.ellipse(a.x, a.y, a.size, a.size*0.65, 0, 0, Math.PI*2); ctx.fill();
      if(a.flash>0){ ctx.fillStyle='rgba(255,255,255,'+a.flash+')'; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.size, a.size*0.65, 0, 0, Math.PI*2); ctx.fill(); }
      // 非龙动物保留emoji显示
      const headOffset = a.grazing > 0 ? a.size*0.35 : 0;
      let icon;
      if(a.type==='wolf') icon='🐺';
      else if(a.type==='bear') icon='🐻';
      else if(a.type==='cow') icon='🐂';
      else if(a.type==='deer') icon='🦌';
      else icon='🐑';
      ctx.font=(isHerb?'12px':'14px')+' Segoe UI'; ctx.textAlign='center';
      ctx.fillText(icon, a.x, a.y-a.size-4-headOffset);
      if(a.grazing > 0){
        ctx.fillStyle='rgba(80,160,80,0.8)';
        ctx.beginPath(); ctx.arc(a.x, a.y-a.size-4, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='#5a3d1d'; ctx.beginPath(); ctx.moveTo(a.x, a.y-a.size); ctx.lineTo(a.x-2, a.y-a.size+4); ctx.moveTo(a.x, a.y-a.size); ctx.lineTo(a.x+2, a.y-a.size+4); ctx.stroke();
      }
    }
    // 血条
    const hpColor = (a.type==='dragon'||a.type==='dragonKing')?'#4aa8ff':(a.type==='bear'?'#a06030':'#708050');
    const barW = a.size*2;
    drawBar(a.x-barW/2, a.y-a.size*SCALE-22, barW, 3, a.hp/a.maxhp, hpColor);
    // BOSS名称
    if(isKing){
      ctx.font='bold 14px Segoe UI'; ctx.textAlign='center';
      ctx.fillStyle='#1a8b3a';
      ctx.fillText('🐲 东海龙王', a.x, a.y-a.size*SCALE-28);
      ctx.font='10px Segoe UI'; ctx.fillStyle='#80d0ff';
      ctx.fillText('BOSS Lv.99  HP:'+Math.ceil(a.hp), a.x, a.y-a.size*SCALE-40);
      ctx.textAlign='left';
    } else {
      ctx.textAlign='left';
    }
    ctx.restore();
  }
}

// ========== 龙窝 + 东海龙王 ==========
function spawnDragonNests(){
  dragonNests = [];
  const pp = playerXY();
  for(let i=0; i<DRAGON_NEST_COUNT*4; i++){
    const cx = Math.floor((pp.x + rand(-6000, 6000)) / CHUNK);
    const cy = Math.floor((pp.y + rand(-6000, 6000)) / CHUNK);
    if(dist(cx*CHUNK, cy*CHUNK, KINGDOM.x, KINGDOM.y) < 2000) continue;
    const isl = islandAt(cx, cy);
    if(!isl) continue;
    const guards = [];
    for(let g=0; g<DRAGON_NEST_GUARDS; g++){
      const a=rand(0,Math.PI*2), rr=rand(isl.r*0.15, isl.r*0.55);
      const dx=isl.x+Math.cos(a)*rr, dy=isl.y+Math.sin(a)*rr;
      if(!isLand(dx, dy)) continue;
      guards.push({ type:'dragon', x:dx, y:dy, vx:0, vy:0, hp:280, maxhp:280, atk:35, speed:1.6, range:80, cd:0.6,
        color:'#2d9e4a', size:22, diet:'carnivore', flash:0, angle:a, patrolCd:rand(1,2), face:Math.cos(a)>=0?1:-1, dead:false, _nest:true });
    }
    if(guards.length<2) continue;
    dragonNests.push({ x:isl.x, y:isl.y, r:isl.r, guards, phase:rand(0,6), alive:true });
    landAnimals.push(...guards);
    if(dragonNests.length >= DRAGON_NEST_COUNT) break;
  }
}
function spawnDragonKing(){
  if(dragonKing && !dragonKing.dead) return;
  const pp = playerXY();
  const isl = nearestIsland(pp.x, pp.y, 3);
  if(!isl) return;
  const a=rand(0,Math.PI*2), rr=rand(isl.r*0.15, isl.r*0.5);
  const dx=isl.x+Math.cos(a)*rr, dy=isl.y+Math.sin(a)*rr;
  if(!isLand(dx, dy)) return;
  dragonKing = { type:'dragonKing', x:dx, y:dy, vx:0, vy:0, hp:2000, maxhp:2000, atk:60, speed:1.8, range:100, cd:0.5,
    color:'#1a8b3a', size:40, flash:0, angle:a, face:Math.cos(a)>=0?1:-1, dead:false, _fireCd:0, _phase:0 };
  floatText(dx, dy-40, '🐲 东海龙王降临!!! 海域震颤!', '#1a8b3a');
  for(let i=0;i<40;i++) particles.push(mkParticle(dx, dy, choice(['#1a8b3a','#4aa8ff','#80d0ff'])));
  landAnimals.push(dragonKing);
}
function killDragonKing(){
  dragonKing.dead = true; kills++;
  inventory.gold += 5000;
  inventory.iron += 20;
  inventory.timber += 10;
  floatText(dragonKing.x, dragonKing.y-40, '🐲 东海龙王已被讨伐! 🪙+5000 ⛏️+20 🏗️+10', '#4aa8ff');
  floatText(dragonKing.x, dragonKing.y-60, '🏆 海域传说·屠龙者!', '#80d0ff');
  for(let i=0;i<60;i++) particles.push(mkParticle(dragonKing.x, dragonKing.y, choice(['#1a8b3a','#4aa8ff','#80d0ff','#aae0ff','#b060ff'])));
  tryEquipFromDrop('dragon_armor', dragonKing.x, dragonKing.y);
  if(!arsenal.has('scythe')){ arsenal.add('scythe'); weaponLevel['scythe']=1; floatText(dragonKing.x, dragonKing.y-80, '🔥 获得传说武器: 死神镰刀!','#ff5555'); }
  gainCaptainXp(CAPTAIN_XP_KILL_SHIP*5);
  updateInventoryHUD(); checkMilestone(); checkVictory();
}
function updateDragonNests(dt){
  // 龙窝水雾粒子
  for(const nest of dragonNests){
    if(!nest.alive) continue;
    nest.phase += dt*2;
    // 龙窝水雾粒子
    if(Math.random()<0.1){
      const a=rand(0,Math.PI*2), r=rand(0,nest.r*0.4);
      particles.push(mkParticle(nest.x+Math.cos(a)*r, nest.y+Math.sin(a)*r, choice(['#4aa8ff','#80d0ff','#aae0ff'])));
    }
    // 检查守卫龙是否全灭
    if(nest.guards.every(g=>g.dead)){ nest.alive=false;
      floatText(nest.x, nest.y-nest.r-16, '💧 龙窝已破!', '#4aa8ff');
    }
  }
  // 所有龙窝被破后，召唤东海龙王
  const allNestsDown = dragonNests.length>0 && dragonNests.every(n=>!n.alive);
  if(allNestsDown && (!dragonKing || dragonKing.dead)){
    if(Math.random()<0.003) spawnDragonKing();
  }
  // 东海龙王AI
  if(dragonKing && !dragonKing.dead){
    dragonKing._phase += dt;
    const tpx = captain.onShip? ship.x : captain.x, tpy = captain.onShip? ship.y : captain.y;
    const d = dist(dragonKing.x, dragonKing.y, tpx, tpy);
    // 追击（在岛上范围内）
    if(d < 500 && !captain.onShip){
      const ta = Math.atan2(tpy-dragonKing.y, tpx-dragonKing.x);
      dragonKing.vx = dragonKing.vx*0.9 + Math.cos(ta)*dragonKing.speed*1.2*0.1;
      dragonKing.vy = dragonKing.vy*0.9 + Math.sin(ta)*dragonKing.speed*1.2*0.1;
      dragonKing.x += dragonKing.vx*dt*3; dragonKing.y += dragonKing.vy*dt*3;
      dragonKing.face = dragonKing.vx>=0?1:-1;
      if(d < dragonKing.range && dragonKing.cd<=0){
        dragonKing.cd = dragonKing._cd;
        if(captain.hp>0){ captain.hp -= dragonKing.atk;
          floatText(captain.x, captain.y-30, '🐲 龙王水柱! -'+dragonKing.atk, '#4aa8ff');
          if(captain.hp<=0) endGame(false); }
      }
      // 龙王水柱AOE
      dragonKing._fireCd -= dt;
      if(dragonKing._fireCd<=0 && d<160){
        dragonKing._fireCd = 1.5;
        // 水柱扇形AOE
        const ta = Math.atan2(tpy-dragonKing.y, tpx-dragonKing.x);
        for(let i=0;i<12;i++) particles.push(mkParticle(dragonKing.x+Math.cos(ta)*rand(20,80), dragonKing.y+Math.sin(ta)*rand(20,80), choice(['#4aa8ff','#80d0ff','#aae0ff'])));
        for(const p of pirates){ if(!p.dead && dist(dragonKing.x,dragonKing.y,p.x,p.y)<120){ damageEnemy(p, 40, false); } }
      }
    } else {
      // 巡守
      dragonKing.patrolCd = (dragonKing.patrolCd||0) - dt;
      if(dragonKing.patrolCd<=0){
        const na=dragonKing.angle+rand(-1,1); dragonKing.angle=na;
        dragonKing.vx=Math.cos(na)*dragonKing.speed*0.4; dragonKing.vy=Math.sin(na)*dragonKing.speed*0.4;
        dragonKing.patrolCd=rand(1,2.5);
      }
      dragonKing.x+=dragonKing.vx*dt*2; dragonKing.y+=dragonKing.vy*dt*2;
      dragonKing.face=dragonKing.vx>=0?1:-1;
    }
    // 血条显示
    if(dragonKing.hp<=0){ killDragonKing(); dragonKing=null; }
  }
}
function drawDragonNests(){
  for(const nest of dragonNests){
    if(!nest.alive) continue;
    const sx=nest.x-cam.x, sy=nest.y-cam.y;
    const vw=canvas.width/DPR, vh=canvas.height/DPR;
    if(sx<-nest.r-40||sx>vw+nest.r+40||sy<-nest.r-40||sy>vh+nest.r+40) continue;
    ctx.save();
    // 水池
    const pulse=Math.sin(nest.phase)*0.1+1;
    ctx.fillStyle='rgba(30,120,200,0.35)';
    ctx.beginPath(); ctx.ellipse(nest.x, nest.y, nest.r*0.35*pulse, nest.r*0.25*pulse, 0, 0, Math.PI*2); ctx.fill();
    // 水波环
    ctx.strokeStyle='rgba(80,200,255,0.6)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(nest.x, nest.y, nest.r*0.32, 0, Math.PI*2); ctx.stroke();
    // 水柱
    for(let fi=0;fi<5;fi++){
      const fa=Math.sin(nest.phase+fi*1.3)*0.3+0.7;
      ctx.fillStyle='rgba(74,'+(168+fi*20)+',255,'+(fa*0.6)+')';
      ctx.beginPath(); ctx.moveTo(nest.x+rand(-nest.r*0.2,nest.r*0.2), nest.y+rand(-nest.r*0.15,nest.r*0.15));
      ctx.lineTo(nest.x+rand(-nest.r*0.1,nest.r*0.1), nest.y-rand(nest.r*0.15,nest.r*0.3));
      ctx.lineTo(nest.x+rand(-nest.r*0.2,nest.r*0.2), nest.y+rand(-nest.r*0.15,nest.r*0.15));
      ctx.closePath(); ctx.fill();
    }
    // 标记
    ctx.font='bold 12px Segoe UI'; ctx.textAlign='center'; ctx.fillStyle='#4aa8ff';
    ctx.fillText('💧 青龙巢', nest.x, nest.y-nest.r*0.35-12);
    const alive=nest.guards.filter(g=>!g.dead).length;
    ctx.font='10px Segoe UI'; ctx.fillStyle='#aae0ff';
    ctx.fillText('守卫 '+alive+' 条', nest.x, nest.y-nest.r*0.35-2);
    ctx.textAlign='left'; ctx.restore();
  }
}

// ========== 海盗王国绘制 ==========
function drawPirateKingdoms(){
  for(const k of pirateKingdoms){
    if(!k.alive) continue;
    const sx=k.cx-cam.x, sy=k.cy-cam.y;
    const vw=canvas.width/DPR, vh=canvas.height/DPR;
    if(sx<-k.r-60||sx>vw+k.r+60||sy<-k.r-60||sy>vh+k.r+60) continue;
    ctx.save();
    // 领土圆（半透明）
    ctx.globalAlpha=0.07; ctx.fillStyle=k.color;
    ctx.beginPath(); ctx.arc(k.cx, k.cy, k.r, 0, Math.PI*2); ctx.fill();
    // 边界虚线
    ctx.globalAlpha=0.55; ctx.strokeStyle=k.color;
    ctx.lineWidth=2; ctx.setLineDash([10,6]);
    ctx.beginPath(); ctx.arc(k.cx, k.cy, k.r, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha=1;
    // 王国旗标
    ctx.font='bold 14px Segoe UI'; ctx.textAlign='center';
    ctx.fillStyle=k.color;
    ctx.fillText(k.icon+' '+k.name+' 王国', k.cx, k.cy-k.r-8);
    // 剩余要塞数
    const remaining = k.islands.filter(key => enemyIslands[key]).length;
    ctx.font='11px Segoe UI'; ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.fillText('🏰 '+remaining+'/'+k.islands.length+' 座要塞', k.cx, k.cy-k.r+8);
    ctx.textAlign='left';
    ctx.restore();
  }
}
function spawnTreasureChest(){
  const pp = playerXY();
  const p = randomLandPoint(pp.x, pp.y, 2);
  if(!isLand(p.x, p.y)) return;
  if(dist(p.x, p.y, KINGDOM.x, KINGDOM.y) < KINGDOM.r) return;
  treasureChests.push({ x:p.x, y:p.y, open:false, phase:rand(0,6) });
}
function openTreasureChest(ch){
  if(ch.open) return false;
  const px = captain.onShip? ship.x : captain.x, py = captain.onShip? ship.y : captain.y;
  if(dist(px, py, ch.x, ch.y) > 60) return false;
  ch.open = true;
  inventory.gold += 100000;
  floatText(ch.x, ch.y-20, '📦 宝藏开启! 🪙+100,000 (1万金子!)', '#ffd27a');
  for(let i=0;i<24;i++) particles.push(mkParticle(ch.x, ch.y, choice(['#ffd27a','#fff3b0','#ff8c00'])));
  updateInventoryHUD(); return true;
}
function drawTreasureChests(){
  for(const ch of treasureChests){
    if(ch.open) continue;
    const sx = ch.x - cam.x, sy = ch.y - cam.y;
    const vw = canvas.width/DPR, vh = canvas.height/DPR;
    if(sx<-30||sx>vw+30||sy<-30||sy>vh+30) continue;
    const bob = Math.sin(ch.phase + animT*2) * 2;
    ctx.save();
    ctx.strokeStyle='rgba(255,210,80,0.5)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(ch.x, ch.y, 16+bob, 0, Math.PI*2); ctx.stroke();
    ctx.font='20px Segoe UI'; ctx.textAlign='center'; ctx.fillText('📦', ch.x, ch.y+bob);
    ctx.font='9px Segoe UI'; ctx.fillStyle='#ffd27a'; ctx.fillText('F打开', ch.x, ch.y+16+bob);
    ctx.textAlign='left'; ctx.restore();
  }
}
function captureIsland(forceIsland){
  // 先检测附近是否有敌方领地（可攻破）
  const nearestEnemy = nearestEnemyIsland(captain.onShip?ship.x:captain.x, captain.onShip?ship.y:captain.y, 2);
  if(nearestEnemy){
    // 攻击敌方城墙
    attackEnemyIsland(nearestEnemy);
    return;
  }
  const is = forceIsland || nearestIsland(captain.onShip?ship.x:captain.x, captain.onShip?ship.y:captain.y, 2);
  if(!is){ floatText(captain.x, captain.y-30,'附近无岛屿','#e35d4f'); return; }
  const key=islandKey(is);
  if(ownedIslands[key]){ floatText(captain.x, captain.y-30,'此岛已是领地','#e35d4f'); return; }
  const wallMax = 200 + ship.level*40;
  const soldiers=[]; const n=randi(3,5);
  for(let i=0;i<n;i++){ const a=rand(0,Math.PI*2), rr=rand(is.r*0.3,is.r*0.7);
    soldiers.push(makeSoldier(is.x+Math.cos(a)*rr, is.y+Math.sin(a)*rr)); }
  ownedIslands[key] = { x:is.x, y:is.y, r:is.r, wallHp:wallMax, wallMax, defCd:0, soldiers, alerted:false };
  floatText(is.x, is.y-is.r-12, '🚩 占领成功! 岛屿已变为我方领地!', '#9be8b4');
  floatText(is.x, is.y-is.r-28, '驻军 '+n+' 人 + 城墙 + 防御炮', '#ffd27a');
  for(let i=0;i<20;i++) particles.push(mkParticle(is.x,is.y-is.r,choice(['#9be8b4','#ffd27a','#ff9a3a'])));
  checkVictory();
}
// 敌方领地（已被其他海盗阵营占领的岛屿，可攻破）
// 敌方领地统一使用 CREWS 阵营（同一世界、同一批海盗船长）
const ENEMY_FACTIONS = CREWS.map(c=>({ name:c.name, color:c.band, icon:c.captain }));
let enemyIslands = {}; // key -> { x,y,r,wallHp,wallMax,faction,defCd }
let pirateKingdoms = []; // { faction, name, color, icon, islands:[keys], cx, cy, r, alive }
function spawnEnemyIslands(){
  enemyIslands = {};
  pirateKingdoms = [];
  const pp = playerXY();
  // 选 2-3 个阵营建立海盗王国
  const factionCount = randi(2, 3);
  const shuffled = [...ENEMY_FACTIONS].sort(()=>Math.random()-0.5);
  for(let fi=0; fi<factionCount && fi<shuffled.length; fi++){
    const faction = shuffled[fi];
    // 找一个中心岛屿（远离玩家王国）
    let centerIsl = null;
    for(let tries=0; tries<15; tries++){
      const cx = Math.floor((pp.x + rand(-5500, 5500)) / CHUNK);
      const cy = Math.floor((pp.y + rand(-5500, 5500)) / CHUNK);
      if(dist(cx*CHUNK, cy*CHUNK, KINGDOM.x, KINGDOM.y) < 1200) continue;
      const isl = islandAt(cx, cy);
      if(!isl) continue;
      // 避免和其他王国中心太近
      let tooClose = false;
      for(const k of pirateKingdoms){ if(dist(isl.x, isl.y, k.cx, k.cy) < 2500) { tooClose = true; break; } }
      if(tooClose) continue;
      centerIsl = isl;
      break;
    }
    if(!centerIsl) continue;
    // 创建王国岛屿（1-3座）
    const kingdomKeys = [];
    const wallMax = 280 + ship.level*35;
    const mainKey = islandKey(centerIsl);
    enemyIslands[mainKey] = { x:centerIsl.x, y:centerIsl.y, r:centerIsl.r, wallHp:wallMax, wallMax, defCd:0, faction };
    kingdomKeys.push(mainKey);
    // 找附属岛屿
    const nearby = nearbyIslands(centerIsl.x, centerIsl.y, 2);
    const extraCount = randi(1, 2);
    let added = 0;
    for(const isl of nearby){
      if(added >= extraCount) break;
      if(dist(isl.x, isl.y, centerIsl.x, centerIsl.y) < 300) continue;
      if(dist(isl.x, isl.y, KINGDOM.x, KINGDOM.y) < 800) continue;
      const key = islandKey(isl);
      if(enemyIslands[key] || ownedIslands[key]) continue;
      enemyIslands[key] = { x:isl.x, y:isl.y, r:isl.r, wallHp:wallMax*0.7, wallMax:Math.round(wallMax*0.7), defCd:0, faction };
      kingdomKeys.push(key);
      added++;
    }
    // 计算王国领土半径
    let maxR = centerIsl.r;
    for(const key of kingdomKeys){ const isl = enemyIslands[key]; if(isl){ maxR = Math.max(maxR, dist(isl.x, isl.y, centerIsl.x, centerIsl.y) + isl.r); } }
    pirateKingdoms.push({
      faction, name: faction.name, color: faction.color, icon: faction.captain,
      islands: kingdomKeys, cx: centerIsl.x, cy: centerIsl.y, r: maxR + 150, alive: true
    });
    // 首次遇新阵营提示
    const ci = CREWS.findIndex(c=>c.name===faction.name);
    if(ci>=0 && !seenCrews.has(ci)){ seenCrews.add(ci);
      setTimeout(()=>{ if(captain.hp>0) floatText(centerIsl.x, centerIsl.y-centerIsl.r-20, '🏴‍☠️ 发现 '+faction.icon+' '+faction.name+' 王国!', '#ff9a3a'); }, 1500);
    }
  }
}
// 攻破敌方领地：攻击城墙→墙被破后岛屿归我方
function attackEnemyIsland(isl){
  if(!isl) return false;
  // 攻击城墙（我方舰炮/近战伤害城墙）
  isl.wallHp -= 50 + ship.level*5 + wdmg(captain.weapon)*0.3;
  if(isl.wallHp <= 0){
    // 攻破！转为玩家领地
    const key = islandKey(isl);
    delete enemyIslands[key];
    const soldiers=[]; const n=randi(2,3);
    for(let i=0;i<n;i++){ const a=rand(0,Math.PI*2), rr=rand(isl.r*0.3,isl.r*0.7);
      soldiers.push(makeSoldier(isl.x+Math.cos(a)*rr, isl.y+Math.sin(a)*rr)); }
    ownedIslands[key] = { x:isl.x, y:isl.y, r:isl.r, wallHp:isl.wallMax, wallMax:isl.wallMax, defCd:0, soldiers, alerted:false };
    floatText(isl.x, isl.y-isl.r-12, '💥 攻破 '+isl.faction.icon+isl.faction.name+' 领地!', '#ff5b3a');
    floatText(isl.x, isl.y-isl.r-28, '🚩 该岛已归我方！', '#9be8b4');
    for(let i=0;i<24;i++) particles.push(mkParticle(isl.x,isl.y-isl.r,choice(['#ff5b3a','#ffd27a','#ff8c00'])));
    // 检查所属王国是否全灭
    for(const k of pirateKingdoms){
      if(!k.alive) continue;
      const stillAlive = k.islands.some(key => enemyIslands[key]);
      if(!stillAlive){
        k.alive = false;
        floatText(k.cx, k.cy-k.r-20, '👑 '+k.icon+' '+k.name+' 王国已覆灭!', '#ffd27a');
        for(let i=0;i<40;i++) particles.push(mkParticle(k.cx, k.cy, choice(['#ffd27a','#ff5b3a','#ffaa00'])));
      }
    }
    checkVictory();
    return true;
  }
  floatText(isl.x, isl.y-isl.r-8, '⚔️ 攻击 '+isl.faction.icon+isl.faction.name+' 城墙! '+Math.round(isl.wallHp)+'/'+isl.wallMax, '#ff9a3a');
  return false;
}

// 辅助：找岛附近目标（避免每个岛都遍历全部海盗），提前退出远岛
function findIslandTarget(isl, pp, radius, maxDist){
  if(dist(isl.x, isl.y, pp.x, pp.y) > maxDist) return null;
  let target=null, bd=radius;
  for(const ps of pirateShips){ const dd=dist(isl.x,isl.y,ps.x,ps.y); if(dd<bd){bd=dd;target=ps;} }
  if(target) return target;
  for(const p of pirates){ const dd=dist(isl.x,isl.y,p.x,p.y); if(dd<bd){bd=dd;target=p;} }
  return target;
}
function nearestEnemyIsland(x,y,span){
  let best=null, bd=99999;
  for(const key in enemyIslands){
    const isl=enemyIslands[key];
    const d=dist(x,y,isl.x,isl.y);
    if(d<bd && d<span*CHUNK){ bd=d; best=isl; }
  }
  return best;
}
function ownedWallAt(x,y){
  for(const key in ownedIslands){ const isl=ownedIslands[key]; if(isl.wallHp>0 && dist(x,y,isl.x,isl.y) < isl.r) return isl; }
  return null;
}
function enemyWallAt(x,y){
  for(const key in enemyIslands){ const isl=enemyIslands[key]; if(isl.wallHp>0 && dist(x,y,isl.x,isl.y) < isl.r) return isl; }
  return null;
}
function keepOutsideWalls(e){
  const w=ownedWallAt(e.x,e.y); if(w){ const a=Math.atan2(e.y-w.y,e.x-w.x), r=w.r+2; e.x=w.x+Math.cos(a)*r; e.y=w.y+Math.sin(a)*r; }
  const w2=enemyWallAt(e.x,e.y); if(w2){ const a=Math.atan2(e.y-w2.y,e.x-w2.x), r=w2.r+2; e.x=w2.x+Math.cos(a)*r; e.y=w2.y+Math.sin(a)*r; }
}
function updateGarrison(isl, dt){
  for(const s of isl.soldiers){
    if(s.flash>0) s.flash-=dt; if(s.cd>0) s.cd-=dt;
    let target=null,bd=300;
    for(const p of pirates){ const dd=dist(s.x,s.y,p.x,p.y); if(dd<bd){bd=dd;target=p;} }
    if(!target) for(const ps of pirateShips){ const dd=dist(s.x,s.y,ps.x,ps.y); if(dd<bd){bd=dd;target=ps;} }
    let moving=false;
    if(target){ const a=Math.atan2(target.y-s.y,target.x-s.x);
      if(dist(s.x,s.y,target.x,target.y)>34){ s.x+=Math.cos(a)*s.speed; s.y+=Math.sin(a)*s.speed; moving=true; }
      if(s.cd<=0 && dist(s.x,s.y,target.x,target.y)<42){ s.cd=0.7; s.attackFlash=0.15;
        if(target.combatXp!==undefined) damageEnemy(target, s.dmg, false);
        else { target.hp-=s.dmg; target.flash=0.15; if(target.hp<=0 && !target.dead) sinkPirateShip(target); } }
    } else {
      const d=dist(s.x,s.y,isl.x,isl.y);
      if(d>isl.r*0.6){ const a=Math.atan2(isl.y-s.y,isl.x-s.x); s.x+=Math.cos(a)*s.speed*0.5; s.y+=Math.sin(a)*s.speed*0.5; moving=true; }
    }
    s.walk = moving? s.walk+dt*12 : s.walk*0.85;
  }
  isl.soldiers = isl.soldiers.filter(s=>s.hp>0);
}
function updateIslands(dt){
  const pp = playerXY();
  for(const key in ownedIslands){
    const isl=ownedIslands[key];
    // 跳过远离玩家的领地（距离>3000px 不做检测炮）
    if(dist(isl.x, isl.y, pp.x, pp.y) > 3000) continue;
    updateGarrison(isl, dt);
    isl.defCd-=dt;
    let target = findIslandTarget(isl, pp, 540, 3000);
    if(target && isl.defCd<=0){ isl.defCd=1.6; const a=Math.atan2(target.y-isl.y,target.x-isl.x), sp=440;
      projectiles.push({ x:isl.x+Math.cos(a)*26, y:isl.y+Math.sin(a)*26, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
        dmg:Math.round(ship.cannonDmg*0.7), from:'cap', ship:true, cannon:true, aoe:CANNON.aoe, life:CANNON.life, color:'#9be8ff' });
      scareBirds(isl.x,isl.y,200); }
  }
  // 敌方领地防御炮
  for(const key in enemyIslands){
    const isl=enemyIslands[key];
    if(dist(isl.x, isl.y, pp.x, pp.y) > 3000) continue;
    isl.defCd-=dt;
    let target = findIslandTarget(isl, pp, 540, 3000);
    if(!target && dist(isl.x,isl.y, captain.onShip?ship.x:captain.x, captain.onShip?ship.y:captain.y) < 400){
      target={x:captain.onShip?ship.x:captain.x, y:captain.onShip?ship.y:captain.y}; }
    if(target && isl.defCd<=0){ isl.defCd=1.6; const a=Math.atan2(target.y-isl.y,target.x-isl.x), sp=440;
      projectiles.push({ x:isl.x+Math.cos(a)*26, y:isl.y+Math.sin(a)*26, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
        dmg:Math.round(ship.cannonDmg*0.6), from:'enemy', ship:true, cannon:true, aoe:CANNON.aoe*0.7, life:CANNON.life, color:isl.faction.color });
      scareBirds(isl.x,isl.y,200); }
  }
}
// ---------- 输入 ----------
window.addEventListener('keydown', e=>{
  keys[e.key.toLowerCase()] = true;
  if(state!=='play') return;
  const k=e.key.toLowerCase();
  if(k==='f') tryGather();
  if(k==='b') captureIsland();
  if(k==='e'){
    if(captain.riding){ exitVehicle(); }
    else if(captain.onShip){
      // 船上按 E：优先尝试下船（靠岸即可，无需载具）；
      // 下船失败（离岸太远）时，再尝试载具装载/卸载
      const canDisembark = nearestLandDist(ship.x,ship.y) < 120;
      if(!canDisembark){
        // 下不了船：尝试载具装载/卸载
        if(ship._lastUnloadT && (animT-ship._lastUnloadT)<0.5){ unloadVehicleFromShip(); ship._lastUnloadT=0; }
        else { loadVehicleToShip(); ship._lastUnloadT=animT; }
      } else {
        const p = pushToLand(ship.x, ship.y, 8);
        captain.onShip=false; captain.x=p.x; captain.y=p.y;
        floatText(p.x, p.y-30, '登陆 🏝️', '#9be8b4');
      }
    } else {
      let near=null,bd=60; for(const v of vehicles){ const d=dist(captain.x,captain.y,v.x,v.y); if(d<bd){bd=d;near=v;} }
      if(near) enterVehicle(); else toggleShip();
    }
  }
  if(k==='c') buildCamp();
  if(k==='x') recycleCamp();
  if(k==='g') eatFood();
  if(k==='q') cycleWeapon();
  const n = parseInt(e.key,10);
  if(n>=1 && n<=WEAPON_ORDER.length){ const w=WEAPON_ORDER[n-1]; if(arsenal.has(w)) captain.weapon=w; }
  else if(e.key==='0' && WEAPON_ORDER[9] && arsenal.has(WEAPON_ORDER[9])) captain.weapon=WEAPON_ORDER[9];
  // v20 更多武器：按数字键 1-9/0 对应前10把，其他通过 Q 切换 或 点击武器栏
});
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e=>{ mouse.x=e.clientX; mouse.y=e.clientY; });
canvas.addEventListener('mousedown', ()=>{ mouse.down=true; });
window.addEventListener('mouseup', ()=>{ mouse.down=false; });
canvas.addEventListener('contextmenu', e=>e.preventDefault());

function toggleShip(){
  if(!captain.onShip){
    if(dist(captain.x,captain.y,ship.x,ship.y) < 95){
      captain.onShip = true;
      floatText(captain.x, captain.y-30, '登船 ⚓', '#9be8b4');
    } else floatText(captain.x, captain.y-30, '离船太远', '#e35d4f');
  } else {
    if(nearestLandDist(ship.x,ship.y) < 120){
      const p = pushToLand(ship.x, ship.y, 8);
      captain.onShip=false; captain.x=p.x; captain.y=p.y;
      floatText(p.x, p.y-30, '登陆 🏝️', '#9be8b4');
    } else floatText(ship.x, ship.y-30, '需靠近海岸下船', '#e35d4f');
  }
}
function cycleWeapon(){
  const owned = WEAPON_ORDER.filter(w=>arsenal.has(w));
  const i = owned.indexOf(captain.weapon);
  captain.weapon = owned[(i+1)%owned.length];
}
function buildCamp(){
  if(captain.onShip){ floatText(captain.x, captain.y-30, '需登陆后扎营', '#e35d4f'); return; }
  if(inventory.wood<3){ floatText(captain.x, captain.y-30, '木材不足(需3)', '#e35d4f'); return; }
  for(const cp of camps){ if(dist(cp.x,cp.y,captain.x,captain.y)<150){ floatText(captain.x,captain.y-30,'附近已有营地','#e35d4f'); return; } }
  inventory.wood-=3; camps.push({ x:captain.x, y:captain.y, phase:0 });
  floatText(captain.x, captain.y-30, '扎营 ⛺ 营地回血', '#9be8b4'); updateInventoryHUD();
}
function recycleCamp(){
  if(captain.onShip){ floatText(captain.x, captain.y-30, '需登陆后回收', '#e35d4f'); return; }
  let idx=-1, bd=140;
  for(let i=0;i<camps.length;i++){ const d=dist(camps[i].x,camps[i].y,captain.x,captain.y); if(d<bd){bd=d;idx=i;} }
  if(idx<0){ floatText(captain.x, captain.y-30, '附近无营地', '#e35d4f'); return; }
  camps.splice(idx,1); inventory.wood+=2; updateInventoryHUD();
  floatText(captain.x, captain.y-30, '回收帐篷 🪵+2', '#9be8b4');
}
function eatFood(){
  const px=captain.onShip?ship.x:captain.x, py=captain.onShip?ship.y:captain.y;
  if(inventory.food<=0){ floatText(px,py-30, '没有食物', '#e35d4f'); return; }
  if(captain.hunger>=100 && captain.hp>=captain.maxhp){ floatText(px,py-30, '已饱食且满血', '#e35d4f'); return; }
  inventory.food--;
  captain.hunger=Math.min(100, captain.hunger+35);
  const heal=12; captain.hp=Math.min(captain.maxhp, captain.hp+heal);
  floatText(px,py-30, '进食 🍖 +'+heal+'血 饱食+35', '#9be8b4'); updateInventoryHUD();
}

// ---------- 采集 / 捕鱼 ----------
const CATCH_RANGE = 180;   // 虚拟 3 米捕捉半径（约 60px/米），徒手捕鱼/捕鸟统一适用
// 徒手捕鸟：只对低空/停歇的鸟有效，高飞的会被惊走
function tryCatchBirdByHand(px,py){
  let best=null,bd=CATCH_RANGE;
  for(const b of birds){ if(b.dead||b.alt>34) continue; const d=dist(px,py,b.x,b.y); if(d<bd){bd=d;best=b;} }
  if(!best) return false;
  const p = clamp(0.9 - best.alt/60, 0.25, 0.9);
  if(Math.random()<p){ catchBird(best,'hand'); }
  else { best.scare=2.4; best.resting=false; best.targetAlt=96;
    floatText(best.x, best.y-best.alt-10, '鸟飞走了…', '#e35d4f'); }
  return true;
}
function tryGather(){
  const px = captain.onShip? ship.x : captain.x, py = captain.onShip? ship.y : captain.y;
  if(tryLootWreck(px,py)) return;
  // v14 宝藏箱：优先打开
  for(const ch of treasureChests){ if(!ch.open && openTreasureChest(ch)) return; }
  if(captain.onShip){
    if(tryCatchBirdByHand(px,py)) return;
    let best=null,bd=CATCH_RANGE;
    for(const c of creatures){ if(!['fish','turtle','shark','whale'].includes(c.type)) continue; const d=dist(px,py,c.x,c.y); if(d<bd){bd=d;best=c;} }
    if(best) catchFish(best);
    else floatText(px,py-30,'附近无鱼/鸟','#e35d4f');
    return;
  }
  if(tryCatchBirdByHand(captain.x,captain.y)) return;
  let best=null,bd=58;
  for(const n of nodes){ if(n.amount<=0) continue; const d=dist(captain.x,captain.y,n.x,n.y); if(d<bd){bd=d;best=n;} }
  if(!best) return;
  const meta = NODE_TYPES[best.type];
  best.amount--; inventory[meta.res]++;
  if(meta.res==='food') captain.hp = Math.min(captain.maxhp, captain.hp+6);
  floatText(best.x, best.y-18, '+1 '+RES_META[meta.res].icon, '#ffe9b0');
  for(let i=0;i<5;i++) particles.push(mkParticle(best.x,best.y,meta.color));
  if(best.amount<=0) best.respawn = rand(12,20);
  updateInventoryHUD();
}

// ---------- 武器伤害（含升级+船长加成） ----------
function wdmg(id){ return Math.round(WEAPONS[id].dmg*(1+0.35*((weaponLevel[id]||1)-1)) + captainDmgBonus()); }
function weaponVisual(id){
  if(!id || !WEAPONS[id]) return 'knife';
  if(id==='knife')   return 'knife';
  if(id==='spear')   return 'spear';
  if(id==='axe')     return 'axe';
  if(id==='cutlass') return 'cutlass';
  if(id==='bow')     return 'bow';
  if(id==='pistol')  return 'pistol';
  if(id==='flask')   return 'flask';
  if(id==='handgun') return 'handgun';
  if(id==='gatling') return 'gatling';
  if(id==='rifle')   return 'rifle';
  if(id==='rpg')     return 'rpg';
  if(id==='mk14')    return 'mk14';
  if(id==='m416')    return 'm416';
  if(id==='ump')     return 'ump';
  if(id==='s12k')    return 's12k';
  if(id==='scythe')  return 'scythe';
  return 'knife';
}

// ---------- 战斗 ----------
// ---------- 舰炮（远程 · 可炮轰陆地） ----------
const CANNON = { speed:560, life:2.3, aoe:74, cd:0.85 };   // 射程 ≈ speed*life ≈ 1290px
function cannonRange(){ return CANNON.speed*CANNON.life; }
function fireCannon(ox,oy,ang,dmg){
  const mx=ox+Math.cos(ang)*32, my=oy+Math.sin(ang)*32;
  for(let i=0;i<10;i++) particles.push(mkParticle(mx,my, choice(['#ffd27a','#ff9a3a','#8a8a8a'])));
  projectiles.push({ x:mx, y:my, sx:mx, sy:my, vx:Math.cos(ang)*CANNON.speed, vy:Math.sin(ang)*CANNON.speed,
    dmg, from:'cap', ship:true, cannon:true, aoe:CANNON.aoe, life:CANNON.life, color:'#ffd27a' });
  scareBirds(mx,my,220);
}
// 炮弹落点爆炸：同时命中岸上海盗 / 海盗船 / 火药桶（连锁）
function cannonBlast(x,y,dmg,aoe){
  floatText(x, y-24, '💥 炮弹命中!', '#ffd27a');
  for(let i=0;i<26;i++) particles.push(mkParticle(x,y, choice(['#ffd27a','#ff8a3a','#ff5b3a','#9a9a9a'])));
  scareBirds(x,y,320);
  for(const t of [...pirates, ...pirateShips]){
    const d=dist(x,y,t.x,t.y); if(d>=aoe) continue;
    const f=Math.max(0.35, 1-d/aoe);
    damageEnemy(t, dmg*f, t.combatXp===undefined);
  }
  for(const n of nodes){ if(n.amount>0 && n.type==='barrel' && dist(x,y,n.x,n.y)<aoe) hitNode(n,null); }
  for(const b of birds){ if(!b.dead && dist(x,y,b.x,b.y)<aoe*0.7) catchBird(b,'shot'); }
  // 大炮同样可捕获落点范围内的鱼/龟/鲨/鲸
  for(const c of creatures.slice()){ if(['fish','turtle','shark','whale'].includes(c.type) && dist(x,y,c.x,c.y)<aoe*0.7) catchFish(c); }
}
function doAttack(){
  const w = WEAPONS[captain.weapon];
  if(captain.onShip){
    // 船上使用远程/近程武器：远程武器发射弹道，近程武器在甲板范围攻击
    if(captain.weapon==='cannon'){
      captain.weaponCd = w.cd; captain.attackFlash = 0.18;
      const wx=mouse.x+cam.x, wy=mouse.y+cam.y;
      const ang=Math.atan2(wy-ship.y,wx-ship.x);
      const dmg = wdmg(captain.weapon);
      fireCannon(ship.x, ship.y, ang, dmg);
      ship.fireFlash = 0.2; ship.rock = 0.15;
      return;
    }
    if(w.type==='ranged'){
      captain.weaponCd = w.cd; captain.attackFlash = 0.18;
      const wx=mouse.x+cam.x, wy=mouse.y+cam.y;
      const ang=Math.atan2(wy-ship.y,wx-ship.x);
      const dmg = wdmg(captain.weapon);
      const sp=w.pspeed||600;
      const pellets = w.pellets || 1;
      for(let p=0; p<pellets; p++){
        const a2 = ang + rand(-((w.spread||0) + (pellets>1?0.25:0)), ((w.spread||0) + (pellets>1?0.25:0)));
        const pelDmg = pellets>1 ? Math.ceil(dmg/pellets) : dmg;
        projectiles.push({ x:ship.x+Math.cos(a2)*30, y:ship.y+Math.sin(a2)*20, sx:ship.x, sy:ship.y, vx:Math.cos(a2)*sp, vy:Math.sin(a2)*sp,
          dmg:pelDmg, from:'cap', ship:false, aoe:(w.aoe||0), life:9999, color:(w.aoe?'#ff9a3a':'#ffe9b0') });
      }
    } else {
      // 近程武器：在甲板范围内攻击登船海盗
      captain.weaponCd = w.cd; captain.attackFlash = 0.18;
      const wx=mouse.x+cam.x, wy=mouse.y+cam.y;
      const ang=Math.atan2(wy-ship.y,wx-ship.x);
      const dmg = wdmg(captain.weapon);
      // 甲板攻击范围
      for(const p of boardedPirates){
        if(p.dead) continue;
        if(dist(ship.x,ship.y,p.x,p.y) <= w.range + 10){
          const ta=Math.atan2(p.y-ship.y,p.x-ship.x);
          let da=Math.abs(((ta-ang+Math.PI)%(Math.PI*2))-Math.PI);
          if(da<1.0) damageEnemy(p, dmg, false);
        }
      }
      // 攻击船上海盗船目标
      for(const ps of pirateShips){
        if(ps.dead) continue;
        if(dist(ship.x,ship.y,ps.x,ps.y) <= w.range + ps.radius){
          damageEnemy(ps, dmg, true);
        }
      }
    }
    return;
  }
  if(w.shipOnly){ floatText(captain.x, captain.y-34, '需登船使用大炮', '#e35d4f'); captain.weaponCd=0.4; return; }
  captain.weaponCd = w.cd; captain.attackFlash = 0.18;
  const ox=captain.x, oy=captain.y;
  const wx=mouse.x+cam.x, wy=mouse.y+cam.y, ang=Math.atan2(wy-oy,wx-ox);
  const dmg = wdmg(captain.weapon);
  if(w.type==='melee'){
    for(const t of pirates){
      if(dist(ox,oy,t.x,t.y) <= w.range + t.radius){
        const ta=Math.atan2(t.y-oy,t.x-ox);
        let da=Math.abs(((ta-ang+Math.PI)%(Math.PI*2))-Math.PI);
        if(da<1.0) damageEnemy(t, dmg, false);
      }
    }
    // v14 动物也可近程攻击
    for(const a of landAnimals){
      if(a.dead) continue;
      if(dist(ox,oy,a.x,a.y) <= w.range + a.size){
        const ta=Math.atan2(a.y-oy,a.x-ox);
        let da=Math.abs(((ta-ang+Math.PI)%(Math.PI*2))-Math.PI);
        if(da<1.0){
          // 镰刀对低等级动物也可秒杀
          if(a.level && a.level<=3 && captain.weapon==='scythe'){
            floatText(a.x,a.y-22,'💀 处决!','#b060ff'); a.hp=0;
          } else { a.hp-=dmg; }
          a.flash=0.15;
          if(a.hp<=0 && !a.dead) killLandAnimal(a);
          for(let i=0;i<3;i++) particles.push(mkParticle(a.x,a.y, a.type==='dragon'?'#ff5b3a':'#a08050'));
        }
      }
    }
  } else {
    const sp=w.pspeed;
    const pellets = w.pellets || 1;
    for(let p=0; p<pellets; p++){
      const a2 = ang + rand(-((w.spread||0) + (pellets>1?0.25:0)), ((w.spread||0) + (pellets>1?0.25:0)));
      const pelDmg = pellets>1 ? Math.ceil(dmg/pellets) : dmg;
      projectiles.push({ x:ox+Math.cos(a2)*24, y:oy+Math.sin(a2)*24, sx:ox, sy:oy, vx:Math.cos(a2)*sp, vy:Math.sin(a2)*sp,
        dmg:pelDmg, from:'cap', ship:false, aoe:(w.aoe||0), life:9999, color:(w.aoe?'#ff9a3a':'#ffe9b0') });
    }
  }
}
function damageEnemy(t, dmg, isShip){
  // 死神镰刀处决：使用镰刀武器时，对≤Lv5的海盗/士兵直接秒杀
  if(!isShip && t.level && t.level <= 5 && captain.weapon==='scythe'){
    floatText(t.x, t.y-22, '💀 处决!', '#b060ff');
    t.hp = 0;
  } else {
    t.hp -= dmg;
  }
  t.flash = 0.15;
  const px=t.x+rand(-8,8), py=t.y+rand(-8,8);
  for(let i=0;i<4;i++) particles.push(mkParticle(px,py, isShip?'#ffb56b':'#ff9a8a'));
  if(t.hp<=0 && !t.dead){ if(isShip) sinkPirateShip(t); else killLandPirate(t); }
}
function damageMyShip(ms, dmg){
  ms.hp -= dmg; ms.flash = 0.15;
  for(let i=0;i<4;i++) particles.push(mkParticle(ms.x,ms.y,'#9be8b4'));
  if(ms.hp<=0 && !ms.dead){ ms.dead=true; floatText(ms.x, ms.y-20, '战船被击毁! 💥', '#ff7a5c');
    for(let i=0;i<14;i++) particles.push(mkParticle(ms.x,ms.y,'#9be8b4')); }
}
function catchFish(c){
  const i=creatures.indexOf(c); if(i<0) return;
  creatures.splice(i,1);
  const gain = c.type==='whale'?5 : c.type==='shark'?3 : c.type==='turtle'?2 : 1;
  inventory.food += gain;
  const icon = c.type==='fish'?'🐟' : c.type==='shark'?'🦈' : c.type==='whale'?'🐋' : '🐢';
  floatText(c.x, c.y-10, '捕到 '+icon+' +🍖×'+gain, '#9be8b4'); updateInventoryHUD();
}
function explodeAt(x,y,radius,dmg){
  floatText(x, y-22, '💥 火药爆炸!', '#ff7a3a');
  for(let i=0;i<28;i++) particles.push(mkParticle(x,y, choice(['#ffd27a','#ff8a3a','#ff5b3a'])));
  const affected=[...pirates, ...pirateShips, ...myShips, captain];
  for(const t of affected){
    const tx = (t===captain && captain.onShip)? ship.x : t.x;
    const ty = (t===captain && captain.onShip)? ship.y : t.y;
    const d=dist(x,y,tx,ty); if(d>=radius) continue;
    const f=1-d/radius;
    if(t===captain){ captain.hp-=dmg*f; if(captain.hp<=0) endGame(false); }
    else if(t.ally){ t.hp-=dmg*f; t.flash=0.15; if(t.hp<=0 && !t.dead){ t.dead=true; floatText(t.x,t.y-20,'战船被炸毁! 💥','#ff7a5c'); } }
    else if(t.combatXp!==undefined){ damageEnemy(t, dmg*f, false); }
    else { t.hp-=dmg*f; t.flash=0.15; if(t.hp<=0 && !t.dead) sinkPirateShip(t); }
  }
}
function hitNode(n, pr){
  if(n.type==='barrel'){ explodeAt(n.x, n.y, 92, 50); }
  else { floatText(n.x, n.y-16, '摧毁 '+NODE_TYPES[n.type].label, '#ffe9b0'); }
  n.amount=0; n.respawn = n.type==='barrel'? rand(14,22) : rand(12,20);
  for(let i=0;i<6;i++) particles.push(mkParticle(n.x,n.y, NODE_TYPES[n.type].color));
}
// 装备掉落：按品质概率筛选候选，再按单件rate判断
function tryDropEquipment(x, y){
  // 根据船长等级提高稀有掉落率
  const luck = 1 + (captain.lv-1)*0.03;
  // 品质权重：高等级时高等品质更容易出
  const weights = [60, 25, 12, 3, 1];
  const roll = rand(0, weights.reduce((a,b)=>a+b,0));
  let cum=0, pickedRarity=1;
  for(let i=0;i<5;i++){ cum+=weights[i]; if(roll<cum){ pickedRarity=i+1; break; } }
  const pool = EQUIPMENT.filter(e=>e.rarity===pickedRarity);
  if(!pool.length) return;
  const eq = choice(pool);
  if(Math.random() > eq.rate * luck) return;
  const drop = { ...eq };
  drop._burnCd = 0;
  floatText(x, y-40, '📦 掉落装备 '+eq.icon+eq.name+'! (靠近自动拾取)', RARITY_META[pickedRarity].color);
  tryEquip(drop);
}
// 强制掉落指定ID的装备并立即穿戴
function tryEquipFromDrop(id, x, y){
  const eq = EQUIPMENT.find(e=>e.id===id);
  if(!eq) return;
  const drop = { ...eq, _burnCd:0 };
  floatText(x, y-40, '🎖️ 获得 ['+RARITY_META[eq.rarity].name+'] '+eq.icon+eq.name+' '+eq.desc, RARITY_META[eq.rarity].color);
  tryEquip(drop);
}
function killLandPirate(p){
  p.dead=true; kills++;
  const loot=choice(['wood','iron','powder','gold','gold','food']);
  inventory[loot]++; if(loot==='gold') inventory.gold+=randi(1,3);
  if(Math.random()<0.15){ const t=choice(['tire','aluminum','timber']); inventory[t]++; floatText(p.x,p.y-36, RES_META[t].icon+'+'+RES_META[t].name, '#bfe8ff'); }
  // 装备掉落
  tryDropEquipment(p.x, p.y);
  floatText(p.x, p.y-20, '击败! +'+RES_META[loot].icon, '#ffe9b0');
  for(let i=0;i<12;i++) particles.push(mkParticle(p.x,p.y,'#ff9a8a'));
  if(followers.length < MAX_FOLLOWERS){
    followers.push(makeFollower(p.x, p.y));
    floatText(p.x, p.y-36, '获得随从! ⚔️', '#9be8b4');
  }
  gainCaptainXp(CAPTAIN_XP_KILL);
  updateInventoryHUD();
  checkMilestone();
  checkAutoCapture(p.x, p.y);
  checkVictory();
}
// v22 海怪死亡：掉落奖励+武器
function killSeaMonster(sm){
  sm.dead=true; kills++;
  const m = SEA_MONSTER_TYPES[sm.type];
  const reward = m?.reward || { gold:200, iron:5 };
  for(const k of Object.keys(reward)){ inventory[k] = (inventory[k]||0) + reward[k]; }
  floatText(sm.x, sm.y-30, '🌊 '+m?.name+' 被击败!', m?.color||'#4aa8ff');
  for(const k of Object.keys(reward)){
    const meta = RES_META[k];
    if(meta) floatText(sm.x, sm.y-46, meta.icon+'+'+meta.name+'×'+reward[k], '#ffd27a');
  }
  if(Math.random()<0.5){
    const wType = choice(GROUND_WEAPON_POOL);
    groundWeapons.push({ type:wType, x:sm.x+rand(-10,10), y:sm.y+rand(-10,10), bob:0 });
    floatText(sm.x, sm.y-62, '🔧 掉落 '+WEAPONS[wType]?.icon+WEAPONS[wType]?.name, '#bfe8ff');
  }
  // 海王BOSS特殊奖励
  if(sm.type==='sea_king'){
    seaKing = null;
    seaKingCooldown = 120;
    floatText(sm.x, sm.y-78, '👑 海王陨落! 海域清净 120s', '#ffd27a');
    for(let i=0;i<40;i++) particles.push(mkParticle(sm.x, sm.y, '#ffd27a'));
    inventory.parts += 10; inventory.steel += 20;
    floatText(sm.x, sm.y-94, '🔧+10 ⚙️+20','#9be8b4');
  }
  for(let i=0;i<20;i++) particles.push(mkParticle(sm.x, sm.y, m?.color||'#4aa8ff'));
  gainCaptainXp(CAPTAIN_XP_KILL_SHIP);
  updateInventoryHUD();
  checkVictory();
}
// 海盗内斗：被同类击杀（不计玩家战功、不给随从，胜者获经验，尸体可能留下宝箱）
function pirateSlainByRival(victim, killer){
  victim.dead = true;
  for(let i=0;i<10;i++) particles.push(mkParticle(victim.x,victim.y,'#ff9a8a'));
  floatText(victim.x, victim.y-22, '☠️ '+CREWS[killer.crew].name+' 火并得手', '#ffb56b');
  killer.combatXp += 2; killer.flash=0.2; maybeLevelUp(killer);
  if(Math.random()<0.35){
    const meta=NODE_TYPES.chest;
    nodes.push({ x:victim.x, y:victim.y, type:'chest', amount:meta.amount, color:meta.color, respawn:0 });
    floatText(victim.x, victim.y-38, '掉落 📦 战利品', '#ffd27a');
  }
  checkAutoCapture(victim.x, victim.y);
}
function sinkPirateShip(s){
  s.dead=true; kills++;
  inventory.wood+=randi(2,4); inventory.iron+=randi(1,3);
  inventory.powder+=randi(1,2); inventory.gold+=randi(2,5);
  inventory.timber+=randi(1,2);
  const notOwned = WEAPON_ORDER.filter(w=>w!=='knife' && !arsenal.has(w));
  if(notOwned.length && Math.random()<0.4){ const w=choice(notOwned); arsenal.add(w); weaponLevel[w]=1; floatText(s.x,s.y-32,'俘获武器 '+WEAPONS[w].icon,'#ffe9b0'); }
  // 海盗船掉装备（品质偏高）
  tryDropEquipment(s.x, s.y);
  floatText(s.x, s.y-20, '击沉海盗船! 俘船+物资', '#9be8b4');
  for(let i=0;i<16;i++) particles.push(mkParticle(s.x,s.y,'#ffb56b'));
  if(myShips.length < MAX_MYSHIPS){
    const a=rand(0,Math.PI*2), shp=140+ship.level*20;
    myShips.push({ x:s.x, y:s.y, hp:shp, maxhp:shp, ally:true, flash:0, fireCd:rand(1,2), _ox:Math.cos(a)*70, _oy:Math.sin(a)*70 });
  }
  gainCaptainXp(CAPTAIN_XP_KILL_SHIP);
  updateInventoryHUD();
  checkMilestone();
  checkAutoCapture(s.x, s.y);
  checkVictory();
}
function checkMilestone(){
  const m = Math.floor(kills/25)*25;
  if(m>milestone && m>0){ milestone=m; floatText(captain.x, captain.y-44, '🏴‍☠️ 已击败 '+m+' 名海盗!', '#ffd27a'); }
  if(kills>=nextElite){ const pp=playerXY(); spawnElite(pp.x,pp.y); nextElite += 10; }
}
function maybeLevelUp(p){
  if(p.combatXp >= pirateXpNeed(p.level)){
    p.level++; const s=pirateStats(p.level);
    p.maxhp=s.hp; p.hp=s.hp; p.dmg=s.dmg; p.speed=s.speed; p.radius=s.radius; p.color=s.color;
    p.combatXp=0; p.flash=0.3;
    floatText(p.x, p.y-26, '升级! Lv.'+p.level, '#ff7a5c');
  }
}
function mkParticle(x,y,color){ const a=rand(0,Math.PI*2), s=rand(40,160); return { x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:rand(.3,.7), color }; }
function floatText(x,y,txt,color){ texts.push({x,y,txt,color,life:1.1}); }

// ---------- 随从 ----------
function updateFollowers(dt){
  for(const f of followers){
    if(f.attackFlash>0) f.attackFlash-=dt;
    if(f.cd>0) f.cd-=dt;
    if(f.gatherCd>0) f.gatherCd-=dt;
    if(f.downed){ f.respawn-=dt; if(f.respawn<=0){ f.downed=false; f.hp=f.maxhp;
        const a=captain.onShip?ship:captain; f.x=a.x; f.y=a.y+20; floatText(a.x,a.y-30,'随从归队!','#9be8b4'); } continue; }
    const anchor = captain.onShip? ship : captain;
    const d=dist(f.x,f.y,anchor.x,anchor.y);
    let moving=false;
    if(d>36){ const a=Math.atan2(anchor.y-f.y, anchor.x-f.x); const step=Math.min(d,2.3); f.x+=Math.cos(a)*step; f.y+=Math.sin(a)*step; f.facing=Math.cos(a)>=0?1:-1; moving=true; }
    if(!captain.onShip){
      if(f.cd<=0){ let near=null,bd=46; for(const p of pirates){ const dd=dist(f.x,f.y,p.x,p.y); if(dd<bd){bd=dd;near=p;} }
        if(near){ f.cd=0.6; f.attackFlash=0.15; damageEnemy(near,14,false); moving=true; }
        else {
          let shipN=null, sd=240; for(const ps of pirateShips){ const dd=dist(f.x,f.y,ps.x,ps.y); if(dd<sd){sd=dd;shipN=ps;} }
          if(shipN){ f.cd=0.9; f.attackFlash=0.15; const a=Math.atan2(shipN.y-f.y,shipN.x-f.x), sp=420;
            projectiles.push({ x:f.x+Math.cos(a)*22, y:f.y+Math.sin(a)*22, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, dmg:16, from:'ally', ship:true, aoe:0, life:1.6, color:'#9be8b4' }); moving=true; }
          else if(f.gatherCd<=0){ let best=null,bd=68; for(const n of nodes){ if(n.amount<=0) continue; const dd=dist(f.x,f.y,n.x,n.y); if(dd<bd){bd=dd;best=n;} }
            if(best){ f.gatherCd=1.0; const meta=NODE_TYPES[best.type]; best.amount--; inventory[meta.res]++;
              if(meta.res==='food') captain.hp=Math.min(captain.maxhp,captain.hp+3);
              for(let i=0;i<3;i++) particles.push(mkParticle(best.x,best.y,meta.color));
              if(best.amount<=0) best.respawn=rand(12,20);
              updateInventoryHUD(); moving=true; } }
        }
      }
    }
    f.walk = moving ? f.walk + dt*12 : f.walk*0.85;
  }
}
function updateMyShips(dt){
  for(const ms of myShips){
    if(ms.flash>0) ms.flash-=dt;
    ms.fireCd-=dt;
    const tx=ship.x+(ms._ox||0), ty=ship.y+(ms._oy||0);
    const d=dist(ms.x,ms.y,tx,ty);
    if(d>6){ const a=Math.atan2(ty-ms.y,tx-ms.x); const step=Math.min(d,2.0); ms.x+=Math.cos(a)*step; ms.y+=Math.sin(a)*step; }
    if(ms.fireCd<=0){
      let near=null,bd=460; for(const s of pirateShips){ const dd=dist(ms.x,ms.y,s.x,s.y); if(dd<bd){bd=dd;near=s;} }
      if(near){ ms.fireCd=1.8; const a=Math.atan2(near.y-ms.y,near.x-ms.x), sp=400;
        projectiles.push({ x:ms.x+Math.cos(a)*24, y:ms.y+Math.sin(a)*24, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, dmg:38+ship.level*4, from:'ally', ship:true, aoe:0, life:1.8, color:'#9be8b4' }); }
    }
  }
  myShips = myShips.filter(s=>!s.dead);
}
// 主船自动炮击：船长不在船上时，舰炮照常开火（海盗船优先，其次炮轰岸上海盗）
function updateShipAuto(dt){
  if(captain.onShip) return;
  ship.autoFireCd-=dt;
  if(ship.autoFireCd>0) return;
  const R=cannonRange()*0.9;
  let near=null,bd=R;
  for(const s of pirateShips){ const dd=dist(ship.x,ship.y,s.x,s.y); if(dd<bd){bd=dd;near=s;} }
  if(!near){
    // 无敌舰 → 舰炮支援陆战：轰击离船最近的岸上海盗（避免误伤己方船长/随从）
    let bp=null,pd=R;
    for(const p of pirates){
      const dd=dist(ship.x,ship.y,p.x,p.y); if(dd>=pd) continue;
      if(dist(p.x,p.y,captain.x,captain.y) < CANNON.aoe+26) continue;
      let friendly=false;
      for(const f of followers){ if(!f.downed && dist(p.x,p.y,f.x,f.y) < CANNON.aoe+18){ friendly=true; break; } }
      if(friendly) continue;
      pd=dd; bp=p;
    }
    near=bp;
  }
  if(near){
    ship.autoFireCd=2.0; ship.rock=0.25; ship.fireFlash=0.16;
    fireCannon(ship.x, ship.y, Math.atan2(near.y-ship.y, near.x-ship.x), ship.cannonDmg);
  }
}

// ---------- 天气 / 昼夜 ----------
function dayPhase(p){
  if(p<0.22) return { label:'清晨', icon:'🌅', light: 0.25 + (p/0.22)*0.45 };
  if(p<0.48) return { label:'白昼', icon:'☀️', light: 0.70 + ((p-0.22)/0.26)*0.30 };
  if(p<0.62) return { label:'黄昏', icon:'🌇', light: 1.00 - ((p-0.48)/0.14)*0.45 };
  if(p<0.95) return { label:'夜晚', icon:'🌙', light: 0.55 - ((p-0.62)/0.33)*0.40 };
  return { label:'深夜', icon:'🌌', light: 0.15 + ((p-0.95)/0.05)*0.10 };
}
function weatherInfo(t){ return WEATHER_TYPES[t] || { t:'❓', name:'未知', rain:0, wind:0, thunder:0 }; }
function pickWeather(){
  const r=Math.random();
  if(r<0.38) weather={ type:'clear', t:rand(18,30), rain:0, wind:0, thunder:0 };
  else if(r<0.55) weather={ type:'rain', t:rand(16,26), rain:1, wind:0.2, thunder:0 };
  else if(r<0.68) weather={ type:'fog', t:rand(14,22), rain:0, wind:0.3, thunder:0 };
  else if(r<0.82) weather={ type:'storm', t:rand(14,22), rain:2, wind:1, thunder:0.6 };
  else if(r<0.92) weather={ type:'typhoon', t:rand(10,18), rain:3, wind:2.5, thunder:0.9 };
  else { weather={ type:'whirl', t:rand(16,24), rain:1, wind:0.5, thunder:0.2 }; spawnWhirls(); }
}
function spawnWhirls(){
  const n=randi(1,2), pp=playerXY();
  for(let i=0;i<n;i++){
    const p=randomWaterNear(pp.x, pp.y, 250, 900);
    if(isLand(p.x,p.y)) continue;
    whirls.push({ x:p.x, y:p.y, r:rand(120,180), spin:0, pull:rand(0.8,1.3), life:rand(18,26) });
  }
}
function updateWeather(dt){
  worldTime = (worldTime + dt/DAY_LENGTH) % 1;
  weather.t -= dt;
  if(weather.t<=0) pickWeather();
  if(weather.thunder>0 && Math.random()<weather.thunder*0.01){ lightning=0.28; boltX=rand(0.2,0.8); }
  if(lightning>0) lightning-=dt;
  // 台风效果：风力推动船只，增加移动阻力
  if(weather.type==='typhoon'){
    const pushAng = animT*0.7;
    ship.x += Math.cos(pushAng)*weather.wind*dt*40;
    ship.y += Math.sin(pushAng)*weather.wind*dt*40;
    // 台风对船上船长造成伤害
    if(captain.onShip && Math.random()<0.005){
      captain.hp -= 3; floatText(ship.x, ship.y-26, '🌀 台风卷击 -3', '#4a88ff');
      if(captain.hp<=0) endGame(false);
    }
    // 台风视觉粒子（横扫的白色风条）
    for(let i=0;i<3;i++) particles.push(mkParticle(ship.x+rand(-300,300), ship.y+rand(-200,200), '#ffffff'));
  }
  if(weather.type==='fog'){
    // 浓雾降低可见度（视觉上用半透明灰色遮罩在render中处理）
  }
  let shipInWhirl=false;
  for(const w of whirls){
    w.spin += dt*2.2; w.life -= dt;
    const targets=[ship, ...myShips, ...pirateShips];
    for(const t of targets){
      const d=dist(t.x,t.y,w.x,w.y);
      if(d < w.r && d>8){
        const a=Math.atan2(w.y-t.y, w.x-t.x);
        const pull=(1-d/w.r)*w.pull;
        t.x += Math.cos(a)*pull*dt*70; t.y += Math.sin(a)*pull*dt*70;
      }
      if(d < w.r){
        if(t===ship) shipInWhirl = true;
        if(d<18){
          if(t===ship){ captain.hp-=10*dt; if(captain.hp<=0) endGame(false); }
          else if(t.hp!==undefined){ t.hp-=22*dt; if(t.ally && t.hp<=0) t.dead=true; }
        }
      }
    }
  }
  ship.submerged = shipInWhirl;
  whirls = whirls.filter(w=>w.life>0);
  for(const cp of camps){ cp.phase += dt; }
}

// ---------- 安全/营地回血 ----------
function updateSafe(dt){
  const px=captain.onShip?ship.x:captain.x, py=captain.onShip?ship.y:captain.y;
  let danger=false;
  for(const p of pirates){ if(dist(px,py,p.x,p.y)<360){ danger=true; break; } }
  if(!danger && captain.onShip){ for(const s of pirateShips){ if(dist(px,py,s.x,s.y)<540){ danger=true; break; } } }
  let nearCamp=false;
  for(const cp of camps){ if(dist(px,py,cp.x,cp.y)<130){ nearCamp=true; break; } }
  if(danger) captain.safeTimer=0; else captain.safeTimer+=dt;
  let regen=0;
  if(captain.hunger<=0) regen=0;                      // 饥饿时不回血
  else if(nearCamp && !danger) regen=16;
  else if(captain.safeTimer>2.5) regen=9;
  if(regen>0){
    captain.hp=Math.min(captain.maxhp, captain.hp+regen*dt);
    for(const f of followers){ if(!f.downed) f.hp=Math.min(f.maxhp, f.hp+regen*dt); }
  }
  captain._regen = regen>0;
}

// ---------- 海里动物 ----------
function updateCreatures(dt){
  for(const c of creatures){
    if(c.dead) continue;
    if(c.flash>0) c.flash-=dt;
    c.phase += dt;
    let nx=c.x+c.vx, ny=c.y+c.vy;
    if(isLand(nx,c.y)){ c.vx*=-1; nx=c.x; }
    if(isLand(c.x,ny)){ c.vy*=-1; ny=c.y; }
    c.x=clamp(nx,-WORLD_LIMIT,WORLD_LIMIT); c.y=clamp(ny,-WORLD_LIMIT,WORLD_LIMIT);
    if(c.type==='fish'){ c.vx+=rand(-0.05,0.05); c.vy+=rand(-0.02,0.02); c.vx=clamp(c.vx,-0.9,0.9); c.vy=clamp(c.vy,-0.4,0.4); }
    if(c.type==='shark' && captain.onShip){
      const a=Math.atan2(ship.y-c.y, ship.x-c.x), d=dist(c.x,c.y,ship.x,ship.y);
      if(d<260){ c.vx=Math.cos(a)*1.1; c.vy=Math.sin(a)*1.1; }
      if(d<48 && Math.random()<0.02){ captain.hp-=6; floatText(ship.x,ship.y-26,'🦈 鲨鱼撕咬 -6','#ff7a5c'); if(captain.hp<=0) endGame(false); }
    }
    if(c.type==='whale' && Math.random()<0.008){ for(let i=0;i<6;i++) particles.push(mkParticle(c.x+rand(-6,6), c.y-(c.size||40)*0.5, '#cfe8ff')); }
  }
  if(creatures.length<14 && Math.random()<0.03){ const pp=playerXY(); spawnCreature(pp.x,pp.y); }
  creatures = creatures.filter(c=>!c.dead);
}

// ========== v22 海怪系统 ==========
function spawnSeaMonster(){
  const types = Object.keys(SEA_MONSTER_TYPES);
  const type = choice(types);
  const m = SEA_MONSTER_TYPES[type];
  const pp = playerXY();
  const a = rand(0, Math.PI*2);
  const r = rand(800, 2200);
  const px = pp.x + Math.cos(a)*r, py = pp.y + Math.sin(a)*r;
  // 避免生成在岛上
  if(isLand(px, py)) return;
  seaMonsters.push({
    type, x:px, y:py, vx:0, vy:0, hp:m.hp, maxhp:m.hp, atk:m.atk, speed:m.sp,
    range:m.range, cd:m.cd, size:m.size, color:m.color, flash:0, angle:0, dead:false, phase:0
  });
}
// 生成海王BOSS
function spawnSeaKing(){
  const m = SEA_MONSTER_TYPES.sea_king;
  const pp = playerXY();
  const a = rand(0, Math.PI*2);
  const r = rand(1200, 2200);
  const px = pp.x + Math.cos(a)*r, py = pp.y + Math.sin(a)*r;
  if(isLand(px, py)) { seaKingCooldown = 60; return; }
  const sk = {
    type:'sea_king', x:px, y:py, vx:0, vy:0, hp:m.hp, maxhp:m.hp, atk:m.atk, speed:m.sp,
    range:m.range, cd:m.cd, size:m.size, color:m.color, flash:0, angle:0, dead:false, phase:0
  };
  seaKing = sk;
  seaMonsters.push(sk);
  floatText(pp.x, pp.y-60, '👑 海王已出现!', '#ffd27a');
  for(let i=0;i<30;i++) particles.push(mkParticle(px, py, '#ffd27a'));
}

function updateSeaMonsters(dt){
  for(const sm of seaMonsters){
    if(sm.dead) continue;
    if(sm.flash>0) sm.flash-=dt;
    sm.phase += dt;
    const pp = playerXY();
    const d = dist(sm.x, sm.y, pp.x, pp.y);
    if(sm.cd>0) sm.cd-=dt;
    // 巡逻 + 追击
    if(d < 1800){
      // 追击船/船长
      const tx = captain.onShip ? ship.x : pp.x, ty = captain.onShip ? ship.y : pp.y;
      const ta = Math.atan2(ty-sm.y, tx-sm.x);
      sm.vx = Math.cos(ta)*sm.speed; sm.vy = Math.sin(ta)*sm.speed;
      sm.angle = ta;
      if(sm.cd<=0 && dist(sm.x, sm.y, tx, ty) < sm.range){
        sm.cd = m.cd;
        if(sm.type==='merman' || sm.type==='sea_serpent' || sm.type==='sea_king'){
          // 远程攻击：水弹/水柱
          const pa = Math.atan2(ty-sm.y, tx-sm.x);
          const sp = 420;
          const dmg = sm.atk;
          projectiles.push({ x:sm.x+Math.cos(pa)*sm.size, y:sm.y+Math.sin(pa)*sm.size, sx:sm.x, sy:sm.y, vx:Math.cos(pa)*sp, vy:Math.sin(pa)*sp,
            dmg, from:'monster', ship:true, life:1.8, color:'#4aa8ff', isWater:true });
          sm.flash=0.15;
          if(Math.random()<0.6) particles.push(mkParticle(sm.x, sm.y, '#aaddff'));
        } else if(captain.onShip){
          // 攻击船
          ship.hp -= sm.atk; sm.flash=0.15;
          floatText(ship.x, ship.y-30, sm.name?'🌊 '+SEA_MONSTER_TYPES[sm.type].name+' 攻击! -'+sm.atk:'🌊 海怪攻击! -'+sm.atk, sm.color);
          if(ship.hp<=0) endGame(false);
        } else if(!captain.onShip && dist(sm.x, sm.y, captain.x, captain.y) < sm.range){
          captain.hp -= sm.atk; sm.flash=0.15;
          floatText(captain.x, captain.y-30, '🌊 海怪攻击! -'+sm.atk, sm.color);
          if(captain.hp<=0) endGame(false);
        }
      }
      // 水花粒子
      if(Math.random()<0.03) particles.push(mkParticle(sm.x+rand(-10,10), sm.y+rand(-10,10), '#aaddff'));
    } else {
      // 远离玩家时巡逻
      sm.vx = sm.vx*0.95 + Math.cos(animT+sm.phase)*0.3;
      sm.vy = sm.vy*0.95 + Math.sin(animT+sm.phase)*0.3;
    }
    sm.x += sm.vx*dt*30; sm.y += sm.vy*dt*30;
    sm.x = clamp(sm.x, -WORLD_LIMIT, WORLD_LIMIT);
    sm.y = clamp(sm.y, -WORLD_LIMIT, WORLD_LIMIT);
    // 远离回收
    if(d > 3500){ sm.dead = true; }
  }
  seaMonsters = seaMonsters.filter(sm=>!sm.dead);
  // 生成控制
  if(seaMonsters.length < 3 && Math.random() < 0.004){ const pp=playerXY(); spawnSeaMonster(); }
  // 海王刷新
  if(!seaKing && seaKingCooldown > 0){
    seaKingCooldown -= dt;
    if(seaKingCooldown <= 0) spawnSeaKing();
  }
}
// 绘制海怪（含海王）
function drawSeaMonsters(){
  for(const sm of seaMonsters){
    if(sm.dead) continue;
    const sx=sm.x-cam.x, sy=sm.y-cam.y;
    const vw=canvas.width/DPR, vh=canvas.height/DPR;
    if(sx<-40||sx>vw+40||sy<-40||sy>vh+40) continue;
    ctx.save();
    ctx.translate(sm.x, sm.y);
    ctx.globalAlpha=0.2; ctx.fillStyle='#88bbdd';
    ctx.beginPath(); ctx.ellipse(0, sm.size*0.4, sm.size*0.8, sm.size*0.3, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    const m = SEA_MONSTER_TYPES[sm.type];
    if(m) {
      ctx.fillStyle = sm.flash>0 ? '#ffffff' : m.color;
      ctx.beginPath(); ctx.ellipse(0, 0, sm.size, sm.size*0.6, 0, 0, Math.PI*2); ctx.fill();
      if(sm.type==='sea_serpent'){
        ctx.strokeStyle=m.color; ctx.lineWidth=sm.size*0.4; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0, 0);
        for(let i=1;i<=4;i++){ ctx.lineTo(-i*sm.size*0.3, Math.sin(sm.phase*2+i)*sm.size*0.2); }
        ctx.stroke();
      }
      if(sm.type==='kraken'){
        ctx.strokeStyle=m.color; ctx.lineWidth=sm.size*0.15;
        for(let i=0;i<6;i++){
          const ang=(i/6)*Math.PI*2 + sm.phase;
          ctx.beginPath(); ctx.moveTo(0, sm.size*0.4);
          ctx.quadraticCurveTo(Math.cos(ang)*sm.size*0.6, sm.size*0.7, Math.cos(ang)*sm.size*0.9, sm.size*0.9);
          ctx.stroke();
        }
      }
      if(sm.type==='merman' || sm.type==='zombie'){
        ctx.fillStyle = m.color;
        ctx.fillRect(-sm.size*0.15, -sm.size*0.5, sm.size*0.3, sm.size*0.6);
        ctx.beginPath(); ctx.arc(0, -sm.size*0.5, sm.size*0.2, 0, Math.PI*2); ctx.fill();
      }
      if(sm.type==='sea_giant'){
        ctx.fillStyle = m.color;
        ctx.fillRect(-sm.size*0.2, -sm.size*0.6, sm.size*0.4, sm.size*0.7);
        ctx.beginPath(); ctx.arc(0, -sm.size*0.65, sm.size*0.22, 0, Math.PI*2); ctx.fill();
      }
      if(sm.type==='sea_king'){
        // 上半身人
        ctx.fillStyle = '#e6c991';
        ctx.beginPath(); ctx.arc(0, -sm.size*0.45, sm.size*0.24, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(-sm.size*0.08, -sm.size*0.48, 0.03*sm.size, 0, Math.PI*2); ctx.arc(sm.size*0.08, -sm.size*0.48, 0.03*sm.size, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -sm.size*0.4, 0.08*sm.size, 0, Math.PI); ctx.stroke();
        ctx.fillStyle = '#5a3a1e';
        ctx.fillRect(-sm.size*0.26, -sm.size*0.55, sm.size*0.52, sm.size*0.12);
        // 蛇尾
        ctx.strokeStyle = m.color; ctx.lineWidth = sm.size*0.38; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0, -sm.size*0.2);
        for(let i=1;i<=5;i++){ ctx.lineTo(-i*sm.size*0.15, sm.size*0.18 + Math.sin(sm.phase*2+i)*sm.size*0.12); }
        ctx.stroke();
        ctx.strokeStyle = '#106d6d'; ctx.lineWidth = sm.size*0.12;
        ctx.beginPath(); ctx.moveTo(0, -sm.size*0.2);
        for(let i=1;i<=5;i++){ ctx.lineTo(-i*sm.size*0.15, sm.size*0.18 + Math.sin(sm.phase*2+i)*sm.size*0.12); }
        ctx.stroke();
        // 吉他
        ctx.save(); ctx.translate(sm.size*0.42, -sm.size*0.22); ctx.rotate(-0.35);
        ctx.fillStyle = '#8a4a1e'; ctx.beginPath(); ctx.ellipse(0, 0, sm.size*0.13, sm.size*0.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a1e0b'; ctx.beginPath(); ctx.ellipse(0, 0.04*sm.size, sm.size*0.07, sm.size*0.09, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = sm.size*0.025;
        ctx.beginPath(); ctx.moveTo(0, -sm.size*0.18); ctx.lineTo(0, sm.size*0.06); ctx.stroke();
        ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = sm.size*0.008;
        for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(-sm.size*0.06, sm.size*0.02*i); ctx.lineTo(sm.size*0.06, sm.size*0.02*i); ctx.stroke(); }
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-sm.size*0.02, -sm.size*0.26, sm.size*0.08, sm.size*0.06);
        ctx.restore();
        // BOSS 标识
        ctx.fillStyle = '#ffd27a'; ctx.font='bold 12px Segoe UI'; ctx.textAlign='center';
        ctx.fillText('BOSS', 0, -sm.size*0.78);
        ctx.textAlign='left';
      }
    }
    ctx.font = (sm.size*0.55)+'px Segoe UI Emoji, Segoe UI Symbol';
    ctx.textAlign='center';
    if(m) ctx.fillText(m.icon, 0, sm.size*0.22);
    const m2 = SEA_MONSTER_TYPES[sm.type];
    const hpColor = m2 ? m2.color : '#4aa8ff';
    drawBar(-sm.size, -sm.size*0.7-12, sm.size*2, 3, sm.hp/sm.maxhp, hpColor);
    ctx.font='bold 10px Segoe UI'; ctx.fillStyle=hpColor;
    if(m) ctx.fillText(m.name + (m.boss?'  BOSS':''), 0, -sm.size*0.7-18);
    ctx.restore();
  }
}

// ========== v22 散落武器系统 ==========
function spawnGroundWeapons(){
  const pp = playerXY();
  const isles = nearbyIslands(pp.x, pp.y, 2);
  for(const is of isles){
    const count = randi(1, 2);
    for(let i=0; i<count && groundWeapons.length<30; i++){
      const a = rand(0, Math.PI*2), r = rand(is.r*0.3, is.r*0.7);
      const wx = is.x + Math.cos(a)*r, wy = is.y + Math.sin(a)*r;
      if(!isLand(wx, wy)) continue;
      if(dist(wx, wy, KINGDOM.x, KINGDOM.y) < KINGDOM.r) continue;
      const wType = choice(GROUND_WEAPON_POOL);
      const w = WEAPONS[wType]; if(!w) continue;
      groundWeapons.push({ type: wType, x: wx, y: wy, bob: rand(0, 6) });
    }
  }
}
function updateGroundWeapons(dt){
  for(let i=groundWeapons.length-1; i>=0; i--){
    const g = groundWeapons[i];
    g.bob += dt*2;
    const d = dist(g.x, g.y, captain.x, captain.y);
    if(d < 30 && keys['f'] && mouse.down===false){
      arsenal.add(g.type); weaponLevel[g.type] = (weaponLevel[g.type]||1);
      const w = WEAPONS[g.type];
      floatText(g.x, g.y-20, '🔧 获得 '+w.icon+' '+w.name, '#ffd27a');
      for(let k=0;k<8;k++) particles.push(mkParticle(g.x, g.y, '#ffd27a'));
      groundWeapons.splice(i, 1);
      updateInventoryHUD();
    }
  }
  const pp = playerXY();
  groundWeapons = groundWeapons.filter(g => dist(g.x, g.y, pp.x, pp.y) < 3000);
  if(groundWeapons.length < 20 && Math.random() < 0.01) spawnGroundWeapons();
}
function drawGroundWeapons(){
  for(const g of groundWeapons){
    const sx=g.x-cam.x, sy=g.y-cam.y;
    const vw=canvas.width/DPR, vh=canvas.height/DPR;
    if(sx<-20||sx>vw+20||sy<-20||sy>vh+20) continue;
    const w = WEAPONS[g.type]; if(!w) continue;
    ctx.save(); ctx.translate(g.x, g.y);
    ctx.fillStyle = 'rgba(60,40,20,0.7)';
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth=2;
    ctx.fillRect(-8, -8, 16, 16); ctx.strokeRect(-8, -8, 16, 16);
    ctx.font='10px Segoe UI Emoji, Segoe UI Symbol'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(w.icon, 0, 1);
    ctx.textBaseline='alphabetic';
    const dy = Math.sin(g.bob)*3;
    ctx.font='bold 8px Segoe UI'; ctx.fillStyle='#ffd27a';
    ctx.fillText(w.name, 0, -12+dy);
    ctx.fillText('F', 0, 8);
    ctx.restore();
  }
}

// ========== v22 海盗登船系统 ==========
function updatePirateBoarding(dt){
  if(captain.onShip){
    for(let i=pirates.length-1; i>=0; i--){
      const p = pirates[i]; if(p.dead || p._onShip) continue;
      const d = dist(p.x, p.y, ship.x, ship.y);
      if(d < 60 && !isLand(p.x, p.y) && boardedPirates.length < 4){
        if(Math.random() < 0.03){
          p._onShip = true; p.x = ship.x + rand(-20, 20); p.y = ship.y - 10;
          pirates.splice(i, 1);
          boardedPirates.push(p);
          floatText(ship.x, ship.y-40, '⚠️ '+CREWS[p.crew||0].name+' 海盗登船!', '#ff5b3a');
          break;
        }
      }
    }
  }
  for(let i=boardedPirates.length-1; i>=0; i--){
    const p = boardedPirates[i];
    if(p.dead){ boardedPirates.splice(i, 1); continue; }
    if(p.atkCd>0) p.atkCd-=dt;
    if(dist(p.x, p.y, ship.x, ship.y) < 30 && p.atkCd<=0){
      p.atkCd = 1.0; p.flash=0.15;
      captain.hp -= p.dmg; p.combatXp++;
      floatText(ship.x, ship.y-30, '-'+p.dmg, '#ff7a5c');
      if(captain.hp<=0) endGame(false);
    }
    p.x = ship.x + Math.sin(animT*2 + p.x)*20;
    p.y = ship.y - 10 + Math.cos(animT*2 + p.y)*3;
  }
  if(!captain.onShip && boardedPirates.length > 0){
    for(const p of boardedPirates){ if(!p.dead) p.dead=true; }
    boardedPirates = [];
  }
}
function drawBoardedPirates(){
  for(const p of boardedPirates){
    if(p.dead) continue;
    const crew = CREWS[p.crew||0];
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = p.flash>0 ? '#ffffff' : crew.band;
    ctx.beginPath(); ctx.arc(0, -3, 7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(-3, 2, 6, 8);
    drawBar(-7, -14, 14, 2, p.hp/p.maxhp, crew.band);
    ctx.restore();
  }
}

// ---------- 更新 ----------
function update(dt){
  animT += dt;
  let mx=0,my=0;
  if(keys['w']||keys['arrowup']) my-=1;
  if(keys['s']||keys['arrowdown']) my+=1;
  if(keys['a']||keys['arrowleft']) mx-=1;
  if(keys['d']||keys['arrowright']) mx+=1;
  const ml=Math.hypot(mx,my)||1; mx/=ml; my/=ml;
  const moving = (mx!==0||my!==0);

  if(captain.onShip){
    const sp=ship.speed;
    let nx=ship.x+mx*sp, ny=ship.y+my*sp;
    if(!isLand(nx,ship.y)) ship.x=nx;
    if(!isLand(ship.x,ny)) ship.y=ny;
    ship.x=clamp(ship.x,-WORLD_LIMIT,WORLD_LIMIT); ship.y=clamp(ship.y,-WORLD_LIMIT,WORLD_LIMIT);
  } else if(captain.riding){
    const v=captain.riding;
    const sp=v.speed;
    let nx=v.x+mx*sp, ny=v.y+my*sp;
    if(v.type==='plane'){
      // 飞机：升空后无视地形，可飞越海域
      v.alt = Math.min(54, v.alt + dt*40);
      v.x=clamp(nx,-WORLD_LIMIT,WORLD_LIMIT); v.y=clamp(ny,-WORLD_LIMIT,WORLD_LIMIT);
    } else {
      if(isLand(nx,v.y)) v.x=nx; if(isLand(v.x,ny)) v.y=ny;
      v.x=clamp(v.x,-WORLD_LIMIT,WORLD_LIMIT); v.y=clamp(v.y,-WORLD_LIMIT,WORLD_LIMIT);
    }
    captain.x=v.x; captain.y=v.y;
    if(mx!==0) v.facing = mx>0?1:-1;
    v.walk = moving ? v.walk+dt*12 : v.walk*0.85;
  } else {
    const sp=2.4;
    let nx=captain.x+mx*sp, ny=captain.y+my*sp;
    if(isLand(nx,captain.y)) captain.x=nx;
    if(isLand(captain.x,ny)) captain.y=ny;
    captain.x=clamp(captain.x,-WORLD_LIMIT,WORLD_LIMIT); captain.y=clamp(captain.y,-WORLD_LIMIT,WORLD_LIMIT);
    const sea=pushToSea(captain.x,captain.y,42);
    ship.x += (sea.x-ship.x)*Math.min(1,dt*2.2);
    ship.y += (sea.y-ship.y)*Math.min(1,dt*2.2);
  }
  if(moving){ captain.walk += dt*12; if(mx!==0) captain.facing = mx>0?1:-1;
    gainCaptainXp(CAPTAIN_XP_WALK); }
  else captain.walk *= 0.85;
  ship.rock = Math.sin(animT*3) * weather.wind * 0.18;
  if(ship.fireFlash>0) ship.fireFlash-=dt;

  // 饥饿度：持续下降；饿空掉血，<50 提示进食
  captain.hunger = Math.max(0, captain.hunger - 0.22*dt);
  captain._starveCd -= dt;
  if(captain.hunger<=0){
    captain.hp -= 6*dt;
    if(captain._starveCd<=0){ captain._starveCd=1.2; const sp2=playerXY(); floatText(sp2.x, sp2.y-34, '饥饿掉血! 快进食 🍖', '#ff7a5c'); }
    if(captain.hp<=0) endGame(false);
  }

  if(captain.weaponCd>0) captain.weaponCd-=dt;
  if(captain.attackFlash>0) captain.attackFlash-=dt;
  if(mouse.down && captain.weaponCd<=0) doAttack();

  // 陆地海盗 AI（玩家阵营优先，其次与敌对帮派海盗火并）
  for(const p of pirates){
    if(p.flash>0) p.flash-=dt;
    if(p.atkCd>0) p.atkCd-=dt;
    let victim=null, vd=1e9, isRival=false;
    if(!captain.onShip){
      const dc=dist(p.x,p.y,captain.x,captain.y);
      if(dc<380){ victim=captain; vd=dc; }
      for(const f of followers){ if(f.downed) continue; const dd=dist(p.x,p.y,f.x,f.y); if(dd<380 && dd<vd){ vd=dd; victim=f; } }
    }
    if(!victim){
      for(const q of pirates){
        if(q===p || q.dead || q.crew===p.crew) continue;
        const dd=dist(p.x,p.y,q.x,q.y);
        if(dd<340 && dd<vd){ vd=dd; victim=q; isRival=true; }
      }
    }
    if(victim){
      const ta=Math.atan2(victim.y-p.y, victim.x-p.x); p.facing=Math.cos(ta)>=0?1:-1;
      if(p.thrower){
        // 抛射型海盗：保持距离，投掷远程武器
        const d=dist(p.x,p.y,victim.x,victim.y);
        let nx=p.x, ny=p.y;
        if(d<150){ nx=p.x-Math.cos(ta)*p.speed; ny=p.y-Math.sin(ta)*p.speed; }
        else if(d>300){ nx=p.x+Math.cos(ta)*p.speed; ny=p.y+Math.sin(ta)*p.speed; }
        if(isLand(nx,p.y)) p.x=nx; if(isLand(p.x,ny)) p.y=ny;
        p.walk += dt*9;
        if(d<330 && p.atkCd<=0){
          p.atkCd=2.1; p.combatXp++; p.flash=0.15;
          const sp=300;
          projectiles.push({ x:p.x+Math.cos(ta)*18, y:p.y+Math.sin(ta)*18, vx:Math.cos(ta)*sp, vy:Math.sin(ta)*sp,
            dmg:Math.round(p.dmg*0.75), from:'pthrow', owner:p, crew:p.crew, life:1.5, color:'#c9a06a' });
        }
      } else {
        let nx=p.x+Math.cos(ta)*p.speed, ny=p.y+Math.sin(ta)*p.speed;
        if(isLand(nx,p.y)) p.x=nx; if(isLand(p.x,ny)) p.y=ny;
        p.walk += dt*10;
        if(dist(p.x,p.y,victim.x,victim.y) < 30+p.radius && p.atkCd<=0){
          p.atkCd=1.0; p.combatXp++; p.flash=0.15;
          if(isRival){
            const d2=Math.round(p.dmg*0.9);
            victim.hp-=d2; victim.flash=0.15;
            floatText(victim.x, victim.y-22, '-'+d2, '#ffb56b');
            for(let i=0;i<3;i++) particles.push(mkParticle(victim.x,victim.y,'#ff9a8a'));
            maybeLevelUp(p);
            if(victim.hp<=0 && !victim.dead) pirateSlainByRival(victim, p);
          } else {
            victim.hp -= p.dmg; floatText(victim.x, victim.y-22, '-'+p.dmg, '#ff7a5c');
            maybeLevelUp(p);
            if(victim===captain){ if(captain.hp<=0) endGame(false); }
            else if(victim.hp<=0){ victim.downed=true; victim.respawn=8; floatText(victim.x,victim.y-20,'随从倒下!','#e35d4f'); }
          }
        }
      }
    } else {
      if(Math.random()<0.012){ p.wpx=rand(-1,1); p.wpy=rand(-1,1); }
      let nx=p.x+p.wpx*p.speed*0.4, ny=p.y+p.wpy*p.speed*0.4;
      if(isLand(nx,p.y)) p.x=nx; if(isLand(p.x,ny)) p.y=ny;
      p.walk += dt*4;
    }
    keepOutsideWalls(p);
  }
  pirates = pirates.filter(p=>!p.dead);

  // 海盗船 AI：攻击最近的主船 / 我方战船
  for(const s of pirateShips){
    if(s.flash>0) s.flash-=dt;
    if(s.fireCd>0) s.fireCd-=dt;
    let target=null, td=520;
    if(captain.onShip && dist(s.x,s.y,ship.x,ship.y) < td){ target=ship; td=dist(s.x,s.y,ship.x,ship.y); }
    for(const ms of myShips){ const d=dist(s.x,s.y,ms.x,ms.y); if(d<td){ target=ms; td=d; } }
    if(target){
      const d=dist(s.x,s.y,target.x,target.y);
      if(d>170){ const a=Math.atan2(target.y-s.y,target.x-s.x); s.x+=Math.cos(a)*s.speed; s.y+=Math.sin(a)*s.speed; }
      if(d<340 && s.fireCd<=0){ s.fireCd=1.7; s.flash=0.15; const a=Math.atan2(target.y-s.y,target.x-s.x), sp=280;
        projectiles.push({ x:s.x+Math.cos(a)*26, y:s.y+Math.sin(a)*26, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, dmg:s.dmg, from:'pirate', ship:true, life:2.2, color:'#ff8a5c' }); }
    } else {
      // 无战斗目标时，海盗船驶向最近岛屿（准备抢滩）
      const isle = nearestIsland(s.x, s.y, 3);
      if(isle){
        const dx=s.x-isle.x, dy=s.y-isle.y, len=Math.hypot(dx,dy)||1;
        const shoreX = isle.x + dx/len*(isle.r+34), shoreY = isle.y + dy/len*(isle.r+34);
        const d=dist(s.x,s.y,shoreX,shoreY);
        if(d>46){ const a=Math.atan2(shoreY-s.y, shoreX-s.x); s.x+=Math.cos(a)*s.speed*0.85; s.y+=Math.sin(a)*s.speed*0.85; }
      }
    }
    // 登陆放兵：无论是否交战，只要靠近海岸就周期性放下登陆队（继承所属帮派）
    s._landCd = (s._landCd===undefined? rand(6,12) : s._landCd) - dt;
    if(s._landCd<=0){
      const isle = nearestIsland(s.x, s.y, 3);
      const shoreD = isle? Math.abs(dist(s.x,s.y,isle.x,isle.y)-isle.r) : 1e9;
      if(isle && shoreD<210 && pirates.length<20){
        s._landCd = rand(9,16);
        const dx=s.x-isle.x, dy=s.y-isle.y, len=Math.hypot(dx,dy)||1;
        const bx=isle.x+dx/len*(isle.r-8), by=isle.y+dy/len*(isle.r-8);
        const squad = randi(1, 3);
        const lv = clamp(1+Math.floor(kills/10), 1, 9);
        for(let i=0;i<squad && pirates.length<20;i++){
          const lp = pushToLand(bx+rand(-40,40), by+rand(-40,40), 12);
          const pir = makePirate(lp.x, lp.y, lv, s.crew); pir._fromShip=true;
          pirates.push(pir);
          for(let k=0;k<5;k++) particles.push(mkParticle(lp.x,lp.y,'#cfe8ff'));
        }
        floatText(bx, by-24, '⚔️ '+CREWS[s.crew].name+' 登陆 ×'+squad, '#ff7a5c');
      } else s._landCd = rand(3,6);
    }
    keepOutsideWalls(s);
  }
  pirateShips = pirateShips.filter(s=>!s.dead);

  // 弹道
  for(const pr of projectiles){
    pr.x+=pr.vx*dt; pr.y+=pr.vy*dt; pr.life-=dt;
    if(pr.from==='pirate'){
      if(captain.onShip && dist(pr.x,pr.y,ship.x,ship.y) < 24){ captain.hp-=pr.dmg; pr.life=0; floatText(ship.x,ship.y-24,'-'+pr.dmg,'#ff7a5c'); if(captain.hp<=0) endGame(false); }
      for(const ms of myShips){ if(dist(pr.x,pr.y,ms.x,ms.y) < 24){ damageMyShip(ms, pr.dmg); pr.life=0; break; } }
    } else if(pr.from==='enemy'){
      // 敌方领地防御炮：攻击玩家船/船长
      if(captain.onShip && dist(pr.x,pr.y,ship.x,ship.y) < 24){ captain.hp-=pr.dmg; pr.life=0; floatText(ship.x,ship.y-24,'-'+pr.dmg,'#ff7a5c'); if(captain.hp<=0) endGame(false); }
      if(!captain.onShip && dist(pr.x,pr.y,captain.x,captain.y) < 16){ captain.hp-=pr.dmg; pr.life=0; floatText(captain.x,captain.y-22,'-'+pr.dmg,'#ff7a5c'); if(captain.hp<=0) endGame(false); }
      for(const ms of myShips){ if(dist(pr.x,pr.y,ms.x,ms.y) < 24){ damageMyShip(ms, pr.dmg); pr.life=0; break; } }
    } else if(pr.from==='pthrow'){
      // 海盗投掷武器：命中船长/随从，也可能命中敌对帮派海盗（内斗流弹）
      let done=false;
      if(!captain.onShip && dist(pr.x,pr.y,captain.x,captain.y)<15){ captain.hp-=pr.dmg; floatText(captain.x,captain.y-22,'-'+pr.dmg,'#ff7a5c'); if(captain.hp<=0) endGame(false); done=true; }
      if(!done){ for(const f of followers){ if(!f.downed && dist(pr.x,pr.y,f.x,f.y)<14){ f.hp-=pr.dmg; floatText(f.x,f.y-18,'-'+pr.dmg,'#ff7a5c'); if(f.hp<=0){ f.downed=true; f.respawn=8; floatText(f.x,f.y-20,'随从倒下!','#e35d4f'); } done=true; break; } } }
      if(!done){
        for(const q of pirates){
          if(q.dead || q.crew===pr.crew) continue;
          if(dist(pr.x,pr.y,q.x,q.y) < q.radius+6){
            q.hp-=pr.dmg; q.flash=0.15; floatText(q.x,q.y-20,'-'+pr.dmg,'#ffb56b');
            if(q.hp<=0 && !q.dead && pr.owner && !pr.owner.dead) pirateSlainByRival(q, pr.owner);
            else if(q.hp<=0 && !q.dead) q.dead=true;
            done=true; break;
          }
        }
      }
      if(done) pr.life=0;
    } else if(pr.from==='monster'){
      if(pr.isWater){
        if(captain.onShip && dist(pr.x,pr.y,ship.x,ship.y) < 28){
          ship.hp -= pr.dmg; pr.life=0;
          floatText(ship.x,ship.y-28,'🌊 海怪水弹! -'+pr.dmg,'#4aa8ff');
          for(let i=0;i<5;i++) particles.push(mkParticle(ship.x,ship.y,'#aaddff'));
          if(ship.hp<=0) endGame(false);
        }
        if(pr.life>0 && !captain.onShip && dist(pr.x,pr.y,captain.x,captain.y) < 18){
          captain.hp -= pr.dmg; pr.life=0;
          floatText(captain.x,captain.y-24,'🌊 海怪水弹! -'+pr.dmg,'#4aa8ff');
          if(captain.hp<=0) endGame(false);
        }
      }
    } else if(pr.from==='ally'){
      for(const s of pirateShips){ if(dist(pr.x,pr.y,s.x,s.y) < (s.radius||18)+6){ damageEnemy(s, pr.dmg, true); pr.life=0; break; } }
    } else { // cap：陆地远程 / 船载大炮
      if(pr.cannon){
        let boom=false;
        for(const t2 of pirates){ if(!t2.dead && dist(pr.x,pr.y,t2.x,t2.y) < (t2.radius||22)+10){ boom=true; break; } }
        if(!boom){ for(const s of pirateShips){ if(!s.dead && dist(pr.x,pr.y,s.x,s.y) < (s.radius||22)+10){ boom=true; break; } } }
        if(!boom){ for(const n of nodes){ if(n.amount>0 && n.type==='barrel' && dist(pr.x,pr.y,n.x,n.y)<18){ boom=true; break; } } }
        if(!boom && pr.life<=0) boom=true;
        if(boom){ cannonBlast(pr.x, pr.y, pr.dmg, pr.aoe); pr.life=0; }
      } else if(pr.aoe>0){
        let boom=false;
        for(const t2 of pirates){ if(!t2.dead && dist(pr.x,pr.y,t2.x,t2.y) < (t2.radius||20)+8){ boom=true; break; } }
        if(!boom){ for(const s of pirateShips){ if(!s.dead && dist(pr.x,pr.y,s.x,s.y) < (s.radius||20)+8){ boom=true; break; } } }
        if(!boom && pr.life<=0) boom=true;
        if(boom){
          for(const t2 of pirates){ if(!t2.dead && dist(pr.x,pr.y,t2.x,t2.y)<pr.aoe) damageEnemy(t2, pr.dmg, false); }
          for(const s of pirateShips){ if(!s.dead && dist(pr.x,pr.y,s.x,s.y)<pr.aoe) damageEnemy(s, pr.dmg, true); }
          for(let i=0;i<14;i++) particles.push(mkParticle(pr.x,pr.y, choice(['#ffd27a','#ff8a3a'])));
          scareBirds(pr.x,pr.y,200);
          pr.life=0;
        }
      } else {
        // 找最近的目标（避免创建临时数组，直接遍历各列表）
        let hit=null, hd=1e9;
        for(const t of pirates){ const d=dist(pr.x,pr.y,t.x,t.y); if(!t.dead && d<((t.radius||18))+8 && d<hd){ hd=d; hit=t; } }
        for(const s of pirateShips){ const d=dist(pr.x,pr.y,s.x,s.y); if(!s.dead && d<((s.radius||18))+8 && d<hd){ hd=d; hit=s; } }
        for(const a of landAnimals){ if(a.dead) continue; const d=dist(pr.x,pr.y,a.x,a.y); if(d<((a.size||18))+8 && d<hd){ hd=d; hit=a; } }
        for(const sm of seaMonsters){ if(sm.dead) continue; const d=dist(pr.x,pr.y,sm.x,sm.y); if(d<((sm.size||18))+8 && d<hd){ hd=d; hit=sm; } }
        if(hit){
          if(hit.combatXp===undefined){ damageEnemy(hit, pr.dmg, true); pr.life=0; }
          else if(hit.atk!==undefined && hit.type in ANIMAL_TYPES){ hit.hp-=pr.dmg; hit.flash=0.15;
            if(hit.hp<=0 && !hit.dead) killLandAnimal(hit);
            pr.life=0; }
          else if(hit.type in SEA_MONSTER_TYPES){
            hit.hp-=pr.dmg; hit.flash=0.15;
            if(hit.hp<=0 && !hit.dead) killSeaMonster(hit);
            pr.life=0;
          } else { damageEnemy(hit, pr.dmg, false); pr.life=0; }
        } else {
          for(const b of birds){ if(!b.dead && dist(pr.x,pr.y,b.x,b.y-b.alt)<16){ catchBird(b,'shot'); pr.life=0; break; } }
          if(pr.life>0){ for(const c of creatures){ if(['fish','turtle','shark','whale'].includes(c.type) && dist(pr.x,pr.y,c.x,c.y)<14){ catchFish(c); pr.life=0; break; } } }
          if(pr.life>0){ for(const n of nodes){ if(n.amount>0 && dist(pr.x,pr.y,n.x,n.y)<14){ hitNode(n,pr); pr.life=0; break; } } }
        }
      }
    }
    if(Math.abs(pr.x)>WORLD_LIMIT||Math.abs(pr.y)>WORLD_LIMIT) pr.life=0;
  }
  projectiles = projectiles.filter(p=>p.life>0);
  // 限制弹道数量，防止弹道过多拖慢（优先保留高伤害弹道）
  if(projectiles.length > 200){
    projectiles.sort((a,b)=>(b.dmg||0)-(a.dmg||0));
    projectiles.length = 200;
  }

  updateFollowers(dt);
  updateMyShips(dt);
  updateShipAuto(dt);
  updateWeather(dt);
  updateCreatures(dt);
  updateBirds(dt);
  updateLandAnimals(dt);
  updateDragonNests(dt);
  updateSeaMonsters(dt);
  updateGroundWeapons(dt);
  updatePirateBoarding(dt);
  updateIslands(dt);
  updateSafe(dt);

  // 物资刷新
  for(const n of nodes){ if(n.amount<=0 && n.respawn>0){ n.respawn-=dt; if(n.respawn<=0) n.amount=NODE_TYPES[n.type].amount; } }
  // 无限地图：回收远离玩家的实体 + 周边补给
  const pp=playerXY();
  pirates = pirates.filter(p=>dist(p.x,p.y,pp.x,pp.y)<2600);
  pirateShips = pirateShips.filter(s=>dist(s.x,s.y,pp.x,pp.y)<3200);
  creatures = creatures.filter(c=>dist(c.x,c.y,pp.x,pp.y)<2200);
  nodes = nodes.filter(n=>dist(n.x,n.y,pp.x,pp.y)<2200);
  whirls = whirls.filter(w=>dist(w.x,w.y,pp.x,pp.y)<2600);
  birds = birds.filter(b=>dist(b.x,b.y,pp.x,pp.y)<2400);
  wrecks = wrecks.filter(w=>dist(w.x,w.y,pp.x,pp.y)<3000);
  vehicles = vehicles.filter(v=>dist(v.x,v.y,pp.x,pp.y)<3200);
  if(nodes.filter(n=>n.amount>0).length < 60 && Math.random()<0.02) spawnNode(pp.x,pp.y);
  // 废墟刷新（海上船骸 / 岸上车·飞机骸）
  wreckTimer-=dt;
  if(wreckTimer<=0){ wreckTimer=rand(5,9); if(wrecks.filter(w=>!w.looted).length<10) spawnWreck(pp.x,pp.y); }

  // 无尽刷新
  spawnTimer-=dt;
  if(spawnTimer<=0 && pirates.length<14){
    spawnTimer=rand(2.5,5) * Math.max(0.45, 1-kills*0.02);
    // 检查附近岛屿是否有空位（每岛最多5个海盗）
    const isles = nearbyIslands(pp.x, pp.y, 2);
    const hasSpace = isles.some(isl => !inKingdom(isl.x, isl.y) && countPiratesOnIsland(isl) < MAX_PIRATES_PER_ISLAND);
    if(hasSpace) spawnLandPirate(undefined, pp.x, pp.y);
  }
  shipSpawnTimer-=dt;
  if(shipSpawnTimer<=0 && pirateShips.length<5){ shipSpawnTimer=rand(7,12); spawnPirateShip(pp.x, pp.y);
    // v20 首次遇新阵营提示
    if(pirateShips.length>0){ const s=pirateShips[pirateShips.length-1]; const c=CREWS[s.crew||0];
      if(!seenCrews.has(s.crew||0)){ seenCrews.add(s.crew||0);
        setTimeout(()=>{ if(captain.hp>0) floatText(s.x,s.y-40,'⚠️ 新势力 '+c.captain+' '+c.name+' 现身海域!','#ffd27a'); },500);
      }
    }
  }

  for(const pa of particles){ pa.x+=pa.vx*dt; pa.y+=pa.vy*dt; pa.vx*=0.92; pa.vy*=0.92; pa.life-=dt; }
  particles=particles.filter(p=>p.life>0);
  // 限制粒子数量，防止过多拖慢渲染
  if(particles.length > 600){ particles.length = 600; }
  for(const t of texts){ t.y-=22*dt; t.life-=dt; }
  texts=texts.filter(t=>t.life>0);

  equipBurnTick(dt);
  updateKingdom(dt);
  updateCamera();
  updateHUD();
}

function updateCamera(){
  const px=captain.onShip?ship.x:captain.x, py=captain.onShip?ship.y:captain.y;
  const vw=canvas.width/DPR, vh=canvas.height/DPR;
  let sx=0, sy=0;
  if(weather.wind>0){ sx=(Math.random()-0.5)*weather.wind*9; sy=(Math.random()-0.5)*weather.wind*9; }
  cam.x = px-vw/2+sx; cam.y = py-vh/2+sy;
}

// ---------- 渲染 ----------
function render(){
  const W=canvas.width/DPR, H=canvas.height/DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const ph=dayPhase(worldTime), light=ph.light;
  const top=lerpColor(NIGHT_SKY1, DAY_SKY1, light);
  const bot=lerpColor(NIGHT_SKY2, DAY_SKY2, light);
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,top); g.addColorStop(1,bot);
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.translate(-cam.x,-cam.y);

  // 岛屿（不规则形状，每岛不同）
  for(const is of nearbyIslands(cam.x+W/2, cam.y+H/2, 3)){
    drawIslandShape(ctx, is, '#d8b878');
    ctx.save(); ctx.beginPath();
    const cx0=Math.floor(is.x/CHUNK), cy0=Math.floor(is.y/CHUNK);
    const sh=getIslandShape(cx0,cy0,is.r-1);
    ctx.beginPath();
    for(let i=0;i<sh.length;i++){
      const p=sh[i], p2=sh[(i+1)%sh.length];
      const px=is.x+Math.cos(p.angle)*p.rr, py=is.y+Math.sin(p.angle)*p.rr;
      const p2x=is.x+Math.cos(p2.angle)*p2.rr, p2y=is.y+Math.sin(p2.angle)*p2.rr;
      if(i===0) ctx.moveTo(px,py); else ctx.quadraticCurveTo(px,py,(px+p2x)/2,(py+p2y)/2);
    }
    ctx.closePath(); ctx.clip();
    drawIslandShape(ctx, {x:is.x,y:is.y,r:is.r}, '#3f7a3f');
    drawIslandShape(ctx, {x:is.x,y:is.y,r:is.r*0.55}, '#356b35');
    ctx.restore();
  }
  for(const n of nodes){ if(n.amount<=0) continue; drawNode(n); }
  for(const cp of camps) drawCamp(cp);
  for(const c of creatures) drawCreature(c);
  for(const w of wrecks) drawWreck(w);
  for(const w of whirls) drawWhirl(w);
  for(const key in ownedIslands) drawOwnedIsland(ownedIslands[key]);
  // 敌方领地绘制
  for(const key in enemyIslands) drawEnemyIsland(enemyIslands[key]);
  for(const s of pirateShips) drawPirateShip(s);
  for(const ms of myShips) drawMyShip(ms);
  for(const pr of projectiles){
    ctx.beginPath(); ctx.arc(pr.x,pr.y,pr.aoe>0?5:3.5,0,Math.PI*2); ctx.fillStyle=pr.color; ctx.fill();
    if(pr.aoe>0){ ctx.beginPath(); ctx.arc(pr.x,pr.y,pr.aoe,0,Math.PI*2); ctx.strokeStyle='rgba(255,180,90,.25)'; ctx.stroke(); }
  }
  // 王国围栏+王旗
  drawKingdom(ctx);
  drawPirateKingdoms();
  for(const p of pirates) drawPirate(p);
  for(const f of followers){ if(!f.downed) drawFollower(f); }
  for(const key in ownedIslands) for(const s of ownedIslands[key].soldiers) drawFollower(s);
  drawKingdomNPCs(ctx);
  for(const v of vehicles) drawVehicle(v);
  if(captain.onShip) drawShip(true); else { if(captain.riding) drawVehicle(captain.riding); else drawCaptain(); drawShip(false); }
  for(const b of birds) drawBird(b);
  drawLandAnimals();
  drawDragonNests();
  drawSeaMonsters();
  drawGroundWeapons();
  drawTreasureChests();
  if(captain.onShip) drawCannonAim();
  drawBoardedPirates();

  for(const pa of particles){ ctx.globalAlpha=Math.max(0,pa.life*1.4); ctx.fillStyle=pa.color;
    ctx.beginPath(); ctx.arc(pa.x,pa.y,2.5,0,Math.PI*2); ctx.fill(); }
  ctx.globalAlpha=1;
  ctx.font='bold 14px Segoe UI, sans-serif'; ctx.textAlign='center';
  for(const t of texts){ ctx.globalAlpha=Math.min(1,t.life); ctx.fillStyle=t.color; ctx.fillText(t.txt,t.x,t.y); }
  ctx.globalAlpha=1; ctx.textAlign='left';
  ctx.restore();

  // 夜晚暗化
  if(light<1){ ctx.fillStyle='rgba(4,10,28,'+((1-light)*0.55)+')'; ctx.fillRect(0,0,W,H); }
  // 夜晚船长火把光
  if(light<0.7 && !captain.onShip){
    const cx=captain.x-cam.x, cy=captain.y-cam.y;
    const rg=ctx.createRadialGradient(cx,cy,4,cx,cy,140);
    rg.addColorStop(0,'rgba(255,200,120,0.35)'); rg.addColorStop(1,'rgba(255,200,120,0)');
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(cx,cy,140,0,Math.PI*2); ctx.fill();
  }
  drawRain(W,H);
  // 浓雾效果
  if(weather.type==='fog'){
    ctx.fillStyle='rgba(200,210,220,0.35)';
    ctx.fillRect(0,0,W,H);
  }
  // 台风效果：横扫的风线
  if(weather.type==='typhoon'){
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=2;
    for(let i=0;i<30;i++){
      const y=Math.random()*H, x=Math.random()*W;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+rand(20,60), y+rand(-3,3)); ctx.stroke();
    }
  }
  if(lightning>0) drawLightning(W,H);
  drawMinimap();
}

// ---------- 人物渲染（强化形象） ----------
function shade(hex, amt){
  if(!hex || typeof hex!=='string') hex='#888888';
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)+amt, g=((n>>8)&255)+amt, b=(n&255)+amt;
  r=clamp(r,0,255); g=clamp(g,0,255); b=clamp(b,0,255);
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawHat(kind,x,hy,r,facing,band){
  ctx.save();
  if(kind==='captain'){
    ctx.fillStyle='#1f3a66';
    ctx.beginPath(); ctx.ellipse(x, hy-r*0.42, r*0.98, r*0.30, 0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, hy-r*0.56, r*0.62, r*0.46, 0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#f0c060'; ctx.lineWidth=r*0.08; ctx.beginPath(); ctx.ellipse(x, hy-r*0.42, r*0.98, r*0.30, 0,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='#e35d4f'; ctx.lineWidth=r*0.12; ctx.beginPath(); ctx.moveTo(x+r*0.4, hy-r*0.6); ctx.quadraticCurveTo(x+r*0.95, hy-r*1.05, x+r*0.5, hy-r*1.25); ctx.stroke();
  } else if(kind==='elite'){
    ctx.fillStyle='#161616';
    ctx.beginPath(); ctx.ellipse(x, hy-r*0.45, r*1.02, r*0.32, 0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, hy-r*0.62, r*0.66, r*0.48, 0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#eee'; ctx.beginPath(); ctx.arc(x, hy-r*0.56, r*0.20, 0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#161616'; ctx.beginPath(); ctx.arc(x-r*0.07, hy-r*0.58, r*0.05,0,Math.PI*2); ctx.arc(x+r*0.07, hy-r*0.58, r*0.05,0,Math.PI*2); ctx.fill();
  } else if(kind==='guard'){
    // 侍卫头盔（金色钢盔）
    ctx.fillStyle='#c4952a';
    ctx.beginPath(); ctx.ellipse(x, hy-r*0.44, r*0.92, r*0.30, 0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, hy-r*0.60, r*0.66, r*0.44, 0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#8b6914'; ctx.fillRect(x-r*0.02, hy-r*0.58, r*0.04, r*0.18);
    // 头盔红色羽饰
    ctx.fillStyle='#c2362b'; ctx.beginPath(); ctx.moveTo(x, hy-r*0.98); ctx.quadraticCurveTo(x+r*0.15, hy-r*0.85, x, hy-r*0.72); ctx.quadraticCurveTo(x-r*0.15, hy-r*0.85, x, hy-r*0.98); ctx.fill();
  } else if(kind==='pirate'){
    band = band || '#b5302a';
    ctx.fillStyle=band;
    ctx.beginPath(); ctx.ellipse(x, hy-r*0.42, r*0.88, r*0.28, 0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=shade(band,-30); ctx.fillRect(x-r*0.22, hy-r*0.56, r*0.44, r*0.12);
    // 头巾飘带（帮派色）
    ctx.strokeStyle=band; ctx.lineWidth=r*0.12; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x-facing*r*0.7, hy-r*0.44); ctx.lineTo(x-facing*r*1.05, hy-r*0.18); ctx.stroke();
  } else {
    ctx.fillStyle='#2f6f4f';
    ctx.beginPath(); ctx.ellipse(x, hy-r*0.42, r*0.82, r*0.26, 0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1f4d37'; ctx.fillRect(x+facing*r*0.2, hy-r*0.6, r*0.5, r*0.12);
  }
  ctx.restore();
}
function drawHeldWeapon(type, hx, hy, facing, r){
  if(!type) return;
  ctx.save(); ctx.translate(hx,hy); ctx.scale(facing,1);

  if(type==='knife'){
    // 小刀：银色细刃+木柄+金环刀柄
    ctx.strokeStyle='#5a3d1d'; ctx.lineWidth=r*0.1; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.16,0); ctx.lineTo(r*0.16,0); ctx.stroke();
    ctx.strokeStyle='#c0c8d0'; ctx.lineWidth=r*0.12;
    ctx.beginPath(); ctx.moveTo(r*0.16,0); ctx.lineTo(r*0.85,-r*0.1); ctx.stroke();
    ctx.fillStyle='#a0a8b0'; ctx.beginPath();
    ctx.moveTo(r*0.16,0); ctx.lineTo(r*0.85,-r*0.1); ctx.lineTo(r*0.78,-r*0.02); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#c4952a'; ctx.fillRect(-r*0.16,-r*0.09,r*0.1,r*0.18);
  } else if(type==='spear'){
    // 长矛：长木杆+金属矛尖
    ctx.strokeStyle='#5a3d1d'; ctx.lineWidth=r*0.1; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.05,0); ctx.lineTo(r*0.85,-r*0.14); ctx.stroke();
    ctx.fillStyle='#c0c8d0'; ctx.beginPath();
    ctx.moveTo(r*0.75,-r*0.22); ctx.lineTo(r*1.05,-r*0.12); ctx.lineTo(r*0.75,-r*0.04); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#8090a0'; ctx.lineWidth=r*0.06;
    ctx.beginPath(); ctx.moveTo(r*0.75,-r*0.22); ctx.lineTo(r*1.05,-r*0.12); ctx.lineTo(r*0.75,-r*0.04); ctx.closePath(); ctx.stroke();
  } else if(type==='axe'){
    // 战斧：木柄+双面菱形斧头
    ctx.strokeStyle='#5a3d1d'; ctx.lineWidth=r*0.1; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.05,0); ctx.lineTo(r*0.55,-r*0.28); ctx.stroke();
    ctx.fillStyle='#b0b8c0'; ctx.beginPath();
    ctx.moveTo(r*0.45,-r*0.42); ctx.lineTo(r*0.65,-r*0.28); ctx.lineTo(r*0.45,-r*0.14); ctx.lineTo(r*0.25,-r*0.28); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#70808a'; ctx.lineWidth=r*0.05;
    ctx.beginPath(); ctx.moveTo(r*0.45,-r*0.42); ctx.lineTo(r*0.65,-r*0.28); ctx.lineTo(r*0.45,-r*0.14); ctx.lineTo(r*0.25,-r*0.28); ctx.closePath(); ctx.stroke();
    ctx.fillStyle='#d0d8e0'; ctx.beginPath();
    ctx.moveTo(r*0.42,-r*0.32); ctx.lineTo(r*0.55,-r*0.28); ctx.lineTo(r*0.42,-r*0.24); ctx.closePath(); ctx.fill();
  } else if(type==='cutlass'){
    // 弯刀：弧形刀刃+金护手
    ctx.strokeStyle='#7a4a1d'; ctx.lineWidth=r*0.1; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.14,0); ctx.lineTo(r*0.1,0); ctx.stroke();
    ctx.fillStyle='#c8d0d8';
    ctx.beginPath(); ctx.moveTo(r*0.1,-r*0.04);
    ctx.quadraticCurveTo(r*0.55,-r*0.5, r*0.85,-r*0.2);
    ctx.lineTo(r*0.75,-r*0.06);
    ctx.quadraticCurveTo(r*0.42,-r*0.28, r*0.1,0.04); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#8890a0'; ctx.lineWidth=r*0.05;
    ctx.beginPath(); ctx.moveTo(r*0.1,-r*0.04);
    ctx.quadraticCurveTo(r*0.55,-r*0.5, r*0.85,-r*0.2);
    ctx.stroke();
    ctx.fillStyle='#c4952a'; ctx.fillRect(r*0.04,-r*0.12,r*0.1,r*0.24);
  } else if(type==='bow'){
    // 长弓：木弓+弓弦+搭箭
    ctx.strokeStyle='#7a4a1d'; ctx.lineWidth=r*0.12; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(r*0.15,0,r*0.58,-1.3,1.3); ctx.stroke();
    ctx.strokeStyle='#ddd'; ctx.lineWidth=r*0.04;
    ctx.beginPath(); ctx.moveTo(r*0.15+Math.cos(-1.3)*r*0.58, Math.sin(-1.3)*r*0.58);
    ctx.lineTo(r*0.15+Math.cos(1.3)*r*0.58, Math.sin(1.3)*r*0.58); ctx.stroke();
    ctx.strokeStyle='#5a3d1d'; ctx.lineWidth=r*0.06;
    ctx.beginPath(); ctx.moveTo(r*0.15+Math.cos(-1.3)*r*0.58, Math.sin(-1.3)*r*0.58);
    ctx.lineTo(r*0.15+Math.cos(1.3)*r*0.58 + r*0.45, Math.sin(1.3)*r*0.58); ctx.stroke();
    ctx.fillStyle='#e35d4f'; ctx.beginPath();
    ctx.moveTo(r*0.15+Math.cos(-1.3)*r*0.58-r*0.14, Math.sin(-1.3)*r*0.58-r*0.05);
    ctx.lineTo(r*0.15+Math.cos(-1.3)*r*0.58, Math.sin(-1.3)*r*0.58);
    ctx.lineTo(r*0.15+Math.cos(-1.3)*r*0.58-r*0.14, Math.sin(-1.3)*r*0.58+r*0.05); ctx.closePath(); ctx.fill();
  } else if(type==='pistol'){
    // 老式手枪：短枪管+木握把+顶部火帽
    ctx.fillStyle='#2b2b2b'; ctx.fillRect(0,-r*0.12,r*0.55,r*0.24);
    ctx.fillStyle='#5a3d1d'; ctx.fillRect(r*0.08,-r*0.03,r*0.14,r*0.42);
    ctx.fillStyle='#c4952a'; ctx.fillRect(r*0.36,-r*0.17,r*0.08,r*0.08);
    ctx.fillStyle='#3a3a3a'; ctx.fillRect(r*0.02,-r*0.04,r*0.14,r*0.08);
  } else if(type==='handgun'){
    // 现代手枪：矩形枪身+套筒+弹匣
    ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,-r*0.11,r*0.6,r*0.22);
    ctx.fillStyle='#3a3a3a'; ctx.fillRect(r*0.04,-r*0.15,r*0.32,r*0.07);
    ctx.fillStyle='#2a1a0a'; ctx.fillRect(r*0.12,-r*0.02,r*0.14,r*0.32);
    ctx.fillStyle='#c4952a'; ctx.fillRect(r*0.4,-r*0.14,r*0.06,r*0.06);
  } else if(type==='gatling'){
    // 加特林：多管旋转+底座+金色扳机
    ctx.fillStyle='#2a2a2a'; ctx.fillRect(0,-r*0.15,r*0.7,r*0.3);
    ctx.fillStyle='#3a3a3a';
    for(let i=0;i<4;i++){ const ox=i*0.14*r-0.14*r; ctx.fillRect(ox+r*0.05,-r*0.14,r*0.11,r*0.28); }
    ctx.fillStyle='#5a3d1d'; ctx.fillRect(r*0.44,-r*0.07,r*0.22,r*0.18);
    ctx.fillStyle='#c4952a'; ctx.fillRect(r*0.55,-r*0.01,r*0.04,r*0.06);
  } else if(type==='rifle'){
    // 狙击步枪：长枪管+大瞄准镜+木托
    ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,-r*0.1,r*0.85,r*0.2);
    ctx.fillStyle='#2a1a0a'; ctx.fillRect(r*0.5,-r*0.05,r*0.35,r*0.28);
    ctx.fillStyle='#1a1a1a'; ctx.fillRect(r*0.28,-r*0.19,r*0.14,r*0.09);
    ctx.strokeStyle='#88a0c0'; ctx.lineWidth=r*0.04; ctx.beginPath();
    ctx.arc(r*0.35,-r*0.14,r*0.06,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#4a4a4a'; ctx.fillRect(r*0.72,-r*0.07,r*0.15,r*0.14);
  } else if(type==='rpg'){
    // 火箭筒：圆管+火箭头探出
    ctx.fillStyle='#2b2b2b'; ctx.fillRect(0,-r*0.13,r*0.75,r*0.26);
    ctx.fillStyle='#3a2a1a'; ctx.fillRect(r*0.55,-r*0.07,r*0.2,r*0.14);
    ctx.fillStyle='#c4302a'; ctx.beginPath(); ctx.arc(r*0.85,0,r*0.11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#e35d4f'; ctx.beginPath();
    ctx.moveTo(r*0.9,0); ctx.lineTo(r*1.0,-r*0.07); ctx.lineTo(r*1.0,r*0.07); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#5a3d1d'; ctx.lineWidth=r*0.04; ctx.beginPath(); ctx.arc(r*0.85,0,r*0.11,0,Math.PI*2); ctx.stroke();
  } else if(type==='mk14'){
    // MK14 精确步枪：大瞄准镜+两脚架+弹匣
    ctx.fillStyle='#2a2a2a'; ctx.fillRect(0,-r*0.11,r*0.9,r*0.22);
    ctx.fillStyle='#2a1a0a'; ctx.fillRect(r*0.55,-r*0.05,r*0.35,r*0.28);
    ctx.fillStyle='#1a1a1a'; ctx.fillRect(r*0.25,-r*0.22,r*0.18,r*0.12);
    ctx.strokeStyle='#5a8ab0'; ctx.lineWidth=r*0.04; ctx.beginPath();
    ctx.arc(r*0.34,-r*0.16,r*0.06,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='#3a3a3a'; ctx.lineWidth=r*0.05;
    ctx.beginPath(); ctx.moveTo(r*0.38,-r*0.08); ctx.lineTo(r*0.42,r*0.13);
    ctx.moveTo(r*0.46,-r*0.08); ctx.lineTo(r*0.5,r*0.13); ctx.stroke();
    ctx.fillStyle='#8a6a3a'; ctx.fillRect(r*0.1,-r*0.04,r*0.14,r*0.08);
  } else if(type==='m416'){
    // M416 突击步枪：前握把+制退器+小瞄准镜
    ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,-r*0.1,r*0.85,r*0.2);
    ctx.fillStyle='#2a1a0a'; ctx.fillRect(r*0.48,-r*0.05,r*0.37,r*0.28);
    ctx.fillStyle='#3a3a3a'; ctx.fillRect(r*0.2,-r*0.14,r*0.05,r*0.2);
    ctx.fillStyle='#4a4a4a'; ctx.fillRect(r*0.75,-r*0.1,r*0.12,r*0.2);
    ctx.fillStyle='#1a1a1a'; ctx.fillRect(r*0.3,-r*0.18,r*0.07,r*0.07);
    ctx.fillStyle='#3a3a3a'; ctx.fillRect(r*0.1,-r*0.04,r*0.12,r*0.1);
  } else if(type==='ump'){
    // UMP 冲锋枪：弹鼓+折叠枪托
    ctx.fillStyle='#2a2a2a'; ctx.fillRect(0,-r*0.09,r*0.7,r*0.18);
    ctx.fillStyle='#3a2a1a'; ctx.fillRect(r*0.4,-r*0.04,r*0.3,r*0.22);
    ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(r*0.2, r*0.07, r*0.11, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='#4a4a4a'; ctx.lineWidth=r*0.04; ctx.beginPath(); ctx.arc(r*0.2, r*0.07, r*0.11, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle='#3a3a3a'; ctx.lineWidth=r*0.07; ctx.beginPath();
    ctx.moveTo(r*0.68,-r*0.07); ctx.lineTo(r*0.72,r*0.01); ctx.stroke();
  } else if(type==='s12k'){
    // S12K 霰弹枪：长圆管+泵动+木托+制退器
    ctx.fillStyle='#2a2a2a'; ctx.fillRect(0,-r*0.1,r*0.75,r*0.2);
    ctx.fillStyle='#5a3d1d'; ctx.fillRect(r*0.5,-r*0.05,r*0.3,r*0.28);
    ctx.fillStyle='#3a3a3a'; ctx.fillRect(r*0.2,-r*0.13,r*0.15,r*0.26);
    ctx.fillStyle='#4a4a4a'; ctx.fillRect(r*0.04,-r*0.05,r*0.66,r*0.1);
    ctx.fillStyle='#5a5a5a'; ctx.fillRect(r*0.68,-r*0.11,r*0.08,r*0.22);
  } else if(type==='scythe'){
    // 死神镰刀：长木柄+弯钩刀刃
    ctx.strokeStyle='#5a3d1d'; ctx.lineWidth=r*0.13; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.08, r*0.08); ctx.lineTo(r*0.85, -r*0.5); ctx.stroke();
    ctx.fillStyle='#c0c0c0'; ctx.beginPath();
    ctx.arc(r*0.85, -r*0.5, r*0.24, -2.2, -0.6); ctx.strokeStyle='#c0c0c0'; ctx.lineWidth=r*0.14; ctx.stroke();
    ctx.fillStyle='#909090'; ctx.beginPath();
    ctx.arc(r*0.85, -r*0.5, r*0.24, -2.0, -0.7); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#c4952a'; ctx.beginPath(); ctx.arc(r*0.78, -r*0.42, r*0.07, 0, Math.PI*2); ctx.fill();
  } else if(type==='flask'){
    // 火药瓶：圆瓶身+木塞
    ctx.fillStyle='#3a6e35'; ctx.beginPath(); ctx.arc(r*0.42,0,r*0.16,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#7a4a1d'; ctx.lineWidth=r*0.08; ctx.beginPath(); ctx.moveTo(r*0.42,0); ctx.lineTo(r*0.58,-r*0.2); ctx.stroke();
  }
  ctx.restore();
}
function drawAttackEffect(o, x, baseY, r){
  const prog=o.attackFlash/0.18; if(prog<=0) return;
  const k=o.wid||'knife', a=1-prog;
  ctx.save(); ctx.translate(x, baseY-r*0.5); ctx.scale(o.facing||1,1);
  ctx.lineCap='round';
  if(k==='knife'){
    ctx.strokeStyle='rgba(255,240,200,'+prog+')'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(r*0.2,0, r*0.55, -0.9+a*1.3, -0.9+a*1.3+0.85); ctx.stroke();
  } else if(k==='spear'){
    ctx.strokeStyle='rgba(240,245,255,'+prog+')'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(r*0.15,0); ctx.lineTo(r*0.15+Math.sin(Math.min(1,a*1.5))*r*2.2,0); ctx.stroke();
    // 突刺小星
    ctx.fillStyle='rgba(255,255,255,'+prog*0.7+')';
    ctx.beginPath(); ctx.arc(r*0.15+Math.sin(Math.min(1,a*1.5))*r*2.2,0,r*0.12,0,Math.PI*2); ctx.fill();
  } else if(k==='axe'){
    ctx.strokeStyle='rgba(255,225,190,'+prog+')'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.arc(r*0.2,0, r*1.5, -2.3+a*2.5, -2.3+a*2.5+1.35); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,'+prog*0.5+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(r*0.2,0, r*1.7, -2.3+a*2.5, -2.3+a*2.5+1.35); ctx.stroke();
  } else if(k==='cutlass'){
    ctx.strokeStyle='rgba(255,240,200,'+prog+')'; ctx.lineWidth=3.5;
    ctx.beginPath(); ctx.arc(r*0.2,0, r*1.2, -1.2+a*2.0, -1.2+a*2.0+1.6); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,'+prog*0.4+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(r*0.2,0, r*1.0, -1.2+a*2.0, -1.2+a*2.0+1.6); ctx.stroke();
  } else if(k==='bow'){
    // 弓：箭飞出轨迹
    ctx.strokeStyle='rgba(255,230,180,'+prog+')'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(r*0.2,0); ctx.lineTo(r*0.2+r*1.8,0); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,'+prog*0.6+')';
    ctx.beginPath(); ctx.arc(r*0.2+r*1.8,0,r*0.1,0,Math.PI*2); ctx.fill();
  } else if(k==='pistol'){
    // 手枪：枪口火焰+冲击波
    ctx.fillStyle='rgba(255,200,80,'+prog+')'; ctx.beginPath();
    ctx.moveTo(r*0.6,-r*0.1); ctx.lineTo(r*0.9,0); ctx.lineTo(r*0.6,r*0.1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,'+prog*0.6+')'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(r*0.7,0,r*0.2,0,Math.PI*2); ctx.stroke();
  } else if(k==='handgun'){
    ctx.fillStyle='rgba(255,180,60,'+prog+')'; ctx.beginPath();
    ctx.moveTo(r*0.6,-r*0.08); ctx.lineTo(r*0.85,0); ctx.lineTo(r*0.6,r*0.08); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,'+prog*0.5+')'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(r*0.72,0,r*0.15,0,Math.PI*2); ctx.stroke();
  } else if(k==='gatling'){
    // 加特林：快速火焰+旋转管
    ctx.fillStyle='rgba(255,150,50,'+prog+')';
    ctx.beginPath(); ctx.moveTo(r*0.6,-r*0.1); ctx.lineTo(r*1.0,0); ctx.lineTo(r*0.6,r*0.1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,100,0,'+prog*0.7+')'; ctx.lineWidth=1.5;
    const rot = Math.sin(a*6)*0.3;
    ctx.save(); ctx.translate(r*0.5,0); ctx.rotate(rot);
    for(let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(r*0.1,-r*0.08+i*r*0.05); ctx.stroke(); }
    ctx.restore();
  } else if(k==='rifle'){
    // 狙击步枪：精准轨迹
    ctx.strokeStyle='rgba(255,255,255,'+prog+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(r*0.85,0); ctx.lineTo(r*0.85+r*2.0,0); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,'+prog*0.8+')';
    ctx.beginPath(); ctx.arc(r*0.85+r*2.0,0,r*0.08,0,Math.PI*2); ctx.fill();
  } else if(k==='rpg'){
    // 火箭筒：火箭轨迹+尾部火焰
    ctx.fillStyle='rgba(255,120,30,'+prog+')';
    ctx.beginPath(); ctx.arc(r*0.85+r*1.0,0,r*0.18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,100,'+prog*0.8+')';
    ctx.beginPath(); ctx.moveTo(r*0.85,0); ctx.lineTo(r*0.95,-r*0.1); ctx.lineTo(r*0.95,r*0.1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,180,50,'+prog*0.6+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(r*0.95,0); ctx.lineTo(r*0.85+r*1.8,0); ctx.stroke();
  } else if(k==='mk14'){
    ctx.strokeStyle='rgba(200,220,255,'+prog+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(r*0.9,0); ctx.lineTo(r*0.9+r*2.2,0); ctx.stroke();
    ctx.fillStyle='rgba(150,200,255,'+prog*0.7+')';
    ctx.beginPath(); ctx.arc(r*0.9+r*2.2,0,r*0.09,0,Math.PI*2); ctx.fill();
  } else if(k==='m416'){
    ctx.strokeStyle='rgba(255,240,200,'+prog+')'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.moveTo(r*0.85,0); ctx.lineTo(r*0.85+r*2.0,0); ctx.stroke();
    ctx.fillStyle='rgba(255,220,150,'+prog*0.6+')';
    ctx.beginPath(); ctx.arc(r*0.85+r*2.0,0,r*0.07,0,Math.PI*2); ctx.fill();
  } else if(k==='ump'){
    ctx.fillStyle='rgba(255,200,100,'+prog+')';
    ctx.beginPath(); ctx.moveTo(r*0.7,-r*0.08); ctx.lineTo(r*0.9,0); ctx.lineTo(r*0.7,r*0.08); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,'+prog*0.4+')'; ctx.lineWidth=1;
    for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(r*0.85,0); ctx.lineTo(r*0.85+r*0.8,r*0.04*i); ctx.stroke(); }
  } else if(k==='s12k'){
    // 霰弹枪：扇形弹丸扩散
    ctx.fillStyle='rgba(255,220,150,'+prog+')';
    for(let i=-3;i<=3;i++){
      const ang = i*0.12;
      ctx.beginPath(); ctx.arc(r*0.85+r*1.5, Math.sin(ang)*r*1.5,r*0.07,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle='rgba(255,255,255,'+prog*0.5+')'; ctx.lineWidth=1;
    for(let i=-3;i<=3;i++){ const ang=i*0.12;
      ctx.beginPath(); ctx.moveTo(r*0.85,0); ctx.lineTo(r*0.85+r*1.5, Math.sin(ang)*r*1.5); ctx.stroke(); }
  } else if(k==='flask'){
    // 火药瓶：爆炸
    ctx.fillStyle='rgba(255,200,50,'+prog+')'; ctx.beginPath();
    ctx.arc(r*0.7,0,r*0.3+a*0.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,200,'+prog*0.7+')'; ctx.beginPath();
    ctx.arc(r*0.7,0,r*0.2+a*0.2,0,Math.PI*2); ctx.fill();
  } else if(k==='scythe'){
    ctx.strokeStyle='rgba(180,100,255,'+prog+')'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(r*0.2,0, r*1.8, -2.0+a*2.8, -2.0+a*2.8+1.8); ctx.stroke();
    ctx.strokeStyle='rgba(255,240,200,'+prog*0.6+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(r*0.2,0, r*1.6, -2.0+a*2.8, -2.0+a*2.8+1.8); ctx.stroke();
  } else {
    ctx.strokeStyle='rgba(255,240,200,'+prog+')'; ctx.lineWidth=3.5;
    ctx.beginPath(); ctx.arc(r*0.2,0, r*1.22, -1.35+a*2.1, -1.35+a*2.1+1.8); ctx.stroke();
  }
  ctx.restore();
}
function drawHumanoid(o){
  const x=o.x, y=o.y, r=o.radius;
  const skin=o.skin||'#e8b98c', cloth=o.cloth||'#3a6ea5';
  const walk=o.walk||0, facing=o.facing||1;
  ctx.save();
  // 阴影
  ctx.globalAlpha=0.25; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(x, y+r*0.95, r*0.85, r*0.35, 0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
  const legSwing=Math.sin(walk)*(r*0.18);
  const bob=Math.abs(Math.sin(walk))*(r*0.12);
  const baseY=y - r*0.1 - bob;
  const headY=baseY - r*1.05;
  // 外套下摆（船长/随从）
  if(o.coat){
    ctx.fillStyle=shade(cloth,-22);
    ctx.beginPath(); ctx.moveTo(x-r*0.5, baseY-r*0.3); ctx.lineTo(x+r*0.5, baseY-r*0.3);
    ctx.lineTo(x+r*0.62, y+r*0.15); ctx.lineTo(x-r*0.62, y+r*0.15); ctx.closePath(); ctx.fill();
  }
  // 腿 + 靴
  ctx.strokeStyle='#3a2a1a'; ctx.lineWidth=r*0.32; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(x-r*0.28, baseY); ctx.lineTo(x-r*0.28+legSwing, y);
  ctx.moveTo(x+r*0.28, baseY); ctx.lineTo(x+r*0.28-legSwing, y);
  ctx.stroke();
  ctx.fillStyle='#241a10';
  ctx.beginPath(); ctx.ellipse(x-r*0.28+legSwing, y, r*0.2, r*0.12,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+r*0.28-legSwing, y, r*0.2, r*0.12,0,0,Math.PI*2); ctx.fill();
  // 躯干（渐变 + 描边）
  const tg=ctx.createLinearGradient(x, baseY-r*0.95, x, baseY);
  tg.addColorStop(0, shade(cloth,18)); tg.addColorStop(1, shade(cloth,-18));
  ctx.fillStyle=tg; roundRect(x-r*0.55, baseY-r*0.95, r*1.1, r*0.95, r*0.3); ctx.fill();
  ctx.strokeStyle=shade(cloth,-40); ctx.lineWidth=Math.max(1,r*0.06); ctx.stroke();
  // 腰带
  ctx.fillStyle='#5a3d1d'; ctx.fillRect(x-r*0.55, baseY-r*0.28, r*1.1, r*0.18);
  ctx.fillStyle='#caa030'; ctx.fillRect(x-r*0.1, baseY-r*0.30, r*0.2, r*0.22); // 带扣
  // 斜挎绶带
  if(o.sash){ ctx.strokeStyle='#c9a23a'; ctx.lineWidth=r*0.16; ctx.beginPath();
    ctx.moveTo(x-r*0.5, baseY-r*0.85); ctx.lineTo(x+r*0.5, baseY-r*0.1); ctx.stroke(); }
  // 手臂
  ctx.strokeStyle=skin; ctx.lineWidth=r*0.26; ctx.lineCap='round';
  const handX=x+facing*r*0.62, handY=baseY-r*0.45+Math.sin(walk+1)*r*0.1;
  ctx.beginPath(); ctx.moveTo(x+facing*r*0.3, baseY-r*0.72); ctx.lineTo(handX, handY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-facing*r*0.3, baseY-r*0.72); ctx.lineTo(x-facing*r*0.52, baseY-r*0.32); ctx.stroke();
  // 头
  ctx.fillStyle=skin; ctx.beginPath(); ctx.arc(x, headY, r*0.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.08)'; ctx.beginPath(); ctx.arc(x+facing*r*0.15, headY, r*0.5, -0.6, 0.6); ctx.fill();
  // 胡须
  if(o.beard){ ctx.fillStyle=shade(skin,-50); ctx.beginPath(); ctx.arc(x, headY+r*0.28, r*0.42, 0.2, Math.PI-0.2); ctx.fill(); }
  // 眼睛
  ctx.fillStyle='#222'; ctx.beginPath();
  ctx.arc(x+facing*r*0.18, headY-r*0.05, r*0.07,0,Math.PI*2); ctx.arc(x+facing*r*0.42, headY-r*0.05, r*0.07,0,Math.PI*2); ctx.fill();
  // 眼罩
  if(o.patch){ ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(x+facing*r*0.18, headY-r*0.05, r*0.1,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#111'; ctx.lineWidth=r*0.07; ctx.beginPath(); ctx.moveTo(x+facing*r*0.18, headY-r*0.13); ctx.lineTo(x+facing*r*0.5, headY-r*0.22); ctx.stroke(); }
  // 帽子（海盗按帮派上色）
  drawHat(o.hat, x, headY, r, facing, o.band);
  // 手持武器
  drawHeldWeapon(o.weaponType, handX, handY, facing, r);
  // 闪光
  if(o.flash>0){ ctx.globalAlpha=Math.min(1,o.flash/0.15)*0.5; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x, baseY-r*0.4, r*1.2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
  if(o.attackFlash>0) drawAttackEffect(o, x, baseY, r);
  ctx.restore();
}
function drawKingdomNPCs(ctx){
  for(const npc of kingdomNPCs){
    // render 已 ctx.translate(-cam.x,-cam.y)，直接用世界坐标
    if(npc.type==='king'){
      ctx.save();
      const bobY = Math.sin(npc.bob||0)*2;
      ctx.font='22px Segoe UI'; ctx.textAlign='center';
      ctx.fillText('👑', npc.x, npc.y-12+bobY);
      ctx.fillStyle='#8b6914'; ctx.fillRect(npc.x-6, npc.y-4+bobY, 12, 12);
      ctx.fillStyle='#c4952a'; ctx.fillRect(npc.x-7, npc.y-6+bobY, 14, 4);
      ctx.font='14px Segoe UI'; ctx.fillText('👑', npc.x, npc.y-18+bobY);
      ctx.restore();
    } else {
      drawHumanoid({x:npc.x,y:npc.y,radius:12,skin:'#e8b98c',cloth:'#7a2e2e',hat:'guard',walk:npc.walk,facing:npc.facing||1,weaponType:'melee',attackFlash:0,flash:0,coat:false,sash:true,beard:false,patch:false});
    }
  }
}
function drawCaptain(){
  const c=captain;
  // 检查是否装备了武器槽装备，优先显示
  let wtype = weaponVisual(c.weapon);
  let wid = c.weapon;
  if(c.equip){
    for(const e of c.equip){
      if(e.slot==='weapon'){
        wtype = 'scythe'; wid = 'scythe'; break;
      }
    }
  }
  drawHumanoid({x:c.x,y:c.y,radius:15,skin:'#f0c98a',cloth:'#1f4e79',hat:'captain',walk:c.walk,facing:c.facing,weaponType:wtype,wid:wid,attackFlash:c.attackFlash,flash:0,coat:true,sash:true,beard:true,patch:false});
  drawBar(c.x-16,c.y-36,32,4,c.hp/c.maxhp,'#5ec98a');
}
function drawFollower(f){
  drawHumanoid({x:f.x,y:f.y,radius:13,skin:'#e8b98c',cloth:'#2f7d52',hat:'ally',walk:f.walk,facing:f.facing,weaponType:'melee',attackFlash:f.attackFlash,flash:0,coat:true,sash:false,beard:false,patch:false});
  drawBar(f.x-14,f.y-32,28,3,f.hp/f.maxhp,'#5ec98a');
}
function drawPirate(p){
  const crew = CREWS[p.crew||0];
  drawHumanoid({x:p.x,y:p.y,radius:p.radius,skin:'#d9a06a',cloth:shade(p.color,-10),hat:p.elite?'elite':'pirate',band:crew.band,walk:p.walk,facing:p.facing,weaponType:p.thrower?'flask':'melee',attackFlash:0,flash:p.flash,coat:p.coat,sash:p.sash,beard:p.beard,patch:p.patch});
  if(p.level>=2){ ctx.font='bold 9px Segoe UI'; ctx.fillStyle='#ffd27a'; ctx.textAlign='center'; ctx.fillText('Lv.'+p.level, p.x, p.y-p.radius-18); ctx.textAlign='left'; }
  drawBar(p.x-p.radius,p.y-p.radius-12,p.radius*2,3,p.hp/p.maxhp, p.elite?'#ff3b3b':(p.level>=2?'#ff7a5c':'#e0a06a'));
}

// ---------- 营地 / 海兽 / 漩涡 ----------
function drawCamp(cp){
  ctx.save(); ctx.translate(cp.x,cp.y);
  ctx.fillStyle='#8a5a2b'; ctx.beginPath(); ctx.moveTo(-18,6); ctx.lineTo(0,-22); ctx.lineTo(18,6); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#6b4321'; ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(0,6); ctx.lineTo(18,6); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#3a2410'; ctx.beginPath(); ctx.moveTo(-5,6); ctx.lineTo(0,-8); ctx.lineTo(5,6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#5a3d1d'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(0,-34); ctx.stroke();
  ctx.fillStyle='#e35d4f'; ctx.beginPath(); ctx.moveTo(0,-34); ctx.lineTo(12,-30); ctx.lineTo(0,-26); ctx.closePath(); ctx.fill();
  // 营火
  const fl=2+Math.sin(cp.phase*4)*1.5;
  ctx.fillStyle='#ff8a3a'; ctx.beginPath(); ctx.arc(26,4,4+fl,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ffd27a'; ctx.beginPath(); ctx.arc(26,4,2,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawCreature(c){
  const facing = c.vx>=0?1:-1;
  ctx.save(); ctx.translate(c.x,c.y); ctx.scale(facing,1);
  if(c.type==='fish'){
    ctx.fillStyle='#7fd0e0'; ctx.beginPath(); ctx.ellipse(0,Math.sin(c.phase*3)*1.5,7,3.5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-7,0); ctx.lineTo(-12,-4); ctx.lineTo(-12,4); ctx.closePath(); ctx.fill();
  } else if(c.type==='shark'){
    ctx.fillStyle='#5b6b78'; ctx.beginPath(); ctx.ellipse(0,0,16,6,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(22,-3); ctx.lineTo(22,3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2,-5); ctx.lineTo(4,-13); ctx.lineTo(8,-5); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#cfe0ea'; ctx.beginPath(); ctx.ellipse(-2,3,11,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(9,-1,1.4,0,Math.PI*2); ctx.fill();
  } else if(c.type==='whale'){
    const s=c.size; ctx.fillStyle='#3a5a78'; ctx.beginPath(); ctx.ellipse(0,0,s*0.5,s*0.3,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s*0.45,0); ctx.lineTo(s*0.72,-s*0.12); ctx.lineTo(s*0.72,s*0.12); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#cfe8ff'; ctx.beginPath(); ctx.arc(-s*0.12,s*0.05,3,0,Math.PI*2); ctx.fill();
  } else if(c.type==='turtle'){
    ctx.fillStyle='#3f7a4a'; ctx.beginPath(); ctx.ellipse(0,0,10,7,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#2c5a36'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#c9a06a'; ctx.beginPath(); ctx.arc(11,0,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2c5a36'; ctx.beginPath(); ctx.ellipse(-9,4,4,2.5,0.5,0,Math.PI*2); ctx.ellipse(-9,-4,4,2.5,-0.5,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
// ---------- 鸟类渲染 ----------
function drawBird(b){
  const m=BIRD_TYPES[b.type];
  const bx=b.x, by=b.y-b.alt, s=m.size;
  // 地面/水面投影：高度越高影子越小越淡
  const k=clamp(1-b.alt/110,0.15,1);
  ctx.save(); ctx.globalAlpha=0.22*k; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(b.x, b.y, s*0.75*k, s*0.3*k, 0,0,Math.PI*2); ctx.fill(); ctx.restore();

  const facing = b.vx>=0?1:-1;
  const flap = b.resting? Math.sin(b.flap)*0.12 : Math.sin(b.flap)*0.85;
  ctx.save(); ctx.translate(bx,by); ctx.scale(facing,1);
  // 翅膀
  ctx.fillStyle=m.wing;
  ctx.beginPath(); ctx.moveTo(0,0);
  ctx.quadraticCurveTo(-s*0.5, -s*0.9*flap-s*0.15, -s*1.25, -s*0.55*flap);
  ctx.quadraticCurveTo(-s*0.55, -s*0.1, 0, s*0.12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0,0);
  ctx.quadraticCurveTo(s*0.45, -s*0.9*flap-s*0.15, s*1.15, -s*0.5*flap);
  ctx.quadraticCurveTo(s*0.5, -s*0.1, 0, s*0.12); ctx.closePath(); ctx.fill();
  // 身体
  ctx.fillStyle=m.body;
  ctx.beginPath(); ctx.ellipse(0,0,s*0.62,s*0.34,0,0,Math.PI*2); ctx.fill();
  // 尾羽
  ctx.beginPath(); ctx.moveTo(-s*0.5,0); ctx.lineTo(-s*0.95,-s*0.2); ctx.lineTo(-s*0.95,s*0.2); ctx.closePath(); ctx.fill();
  // 头 + 喙 + 眼
  ctx.beginPath(); ctx.arc(s*0.55,-s*0.16,s*0.26,0,Math.PI*2); ctx.fill();
  ctx.fillStyle= b.type==='parrot'? '#e0863a' : '#f0b23a';
  ctx.beginPath(); ctx.moveTo(s*0.74,-s*0.18); ctx.lineTo(s*1.12,-s*0.08); ctx.lineTo(s*0.74,s*0.02); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(s*0.62,-s*0.22,s*0.07,0,Math.PI*2); ctx.fill();
  if(b.type==='parrot'){ ctx.fillStyle='#e0483a'; ctx.beginPath(); ctx.moveTo(s*0.42,-s*0.36); ctx.lineTo(s*0.2,-s*0.72); ctx.lineTo(s*0.62,-s*0.44); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  // 低空可捕提示
  if(b.alt<34){
    ctx.font='bold 10px Segoe UI, sans-serif'; ctx.textAlign='center';
    ctx.fillStyle='rgba(155,232,180,.9)'; ctx.fillText('F 捕捉', bx, by-s-8); ctx.textAlign='left';
  }
}
// 舰炮瞄准：落点实线准星（无虚线）
function drawCannonAim(){
  const wx=mouse.x+cam.x, wy=mouse.y+cam.y;
  const a=Math.atan2(wy-ship.y, wx-ship.x), R=cannonRange();
  const d=Math.min(dist(ship.x,ship.y,wx,wy), R);
  const tx=ship.x+Math.cos(a)*d, ty=ship.y+Math.sin(a)*d;
  ctx.save();
  ctx.strokeStyle='rgba(255,210,120,.55)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(tx,ty,CANNON.aoe*0.5,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx-8,ty); ctx.lineTo(tx+8,ty); ctx.moveTo(tx,ty-8); ctx.lineTo(tx,ty+8); ctx.stroke();
  ctx.restore();
}

// ---------- v11 绘制：废墟 / 载具 / 领地 ----------
function drawWreck(w){
  ctx.save(); ctx.translate(w.x,w.y); ctx.rotate(Math.sin(w.phase)*0.05);
  if(w.type==='ship'){
    ctx.fillStyle = w.looted? '#4a4036' : '#5a4a36';
    ctx.beginPath(); ctx.ellipse(0,0,34,15,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3a3228'; ctx.fillRect(-5,-16,10,16);
    ctx.fillStyle='#7a6a52'; ctx.fillRect(-2,-26,4,12);
  } else if(w.type==='car'){
    ctx.fillStyle = w.looted? '#444' : '#7a4a4a';
    ctx.fillRect(-18,-10,36,18); ctx.fillRect(-12,-20,20,12);
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(-11,9,5,0,Math.PI*2); ctx.arc(11,9,5,0,Math.PI*2); ctx.fill();
    if(!w.looted){ ctx.fillStyle='#bfe8ff'; ctx.font='11px Segoe UI'; ctx.textAlign='center'; ctx.fillText('🔩',0,-24); ctx.textAlign='left'; }
  } else {
    ctx.fillStyle = w.looted? '#555' : '#6a6a72';
    ctx.beginPath(); ctx.moveTo(-22,6); ctx.lineTo(22,6); ctx.lineTo(10,-8); ctx.lineTo(-10,-8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#888'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,-28); ctx.stroke();
    if(!w.looted){ ctx.fillStyle='#bfe8ff'; ctx.font='11px Segoe UI'; ctx.textAlign='center'; ctx.fillText('🔩',0,-34); ctx.textAlign='left'; }
  }
  ctx.restore();
}
function drawVehicle(v){
  ctx.save(); ctx.translate(v.x,v.y);
  if(v.type==='car'){
    if(v.facing<0) ctx.scale(-1,1);
    ctx.fillStyle='#3a6ea5'; ctx.fillRect(-16,-9,32,16);
    ctx.fillStyle='#2a4f78'; ctx.fillRect(-10,-17,18,10);
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(-10,8,5,0,Math.PI*2); ctx.arc(10,8,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#cfe8ff'; ctx.fillRect(6,-15,6,7);
  } else {
    // 飞机：按高度画阴影 + 机身（升空时缩小上移）
    const sh = 1 - Math.min(0.5, v.alt/120);
    ctx.fillStyle='rgba(0,0,0,'+(0.25*sh)+')';
    ctx.beginPath(); ctx.ellipse(0, 6, 18*sh, 7*sh, 0,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.translate(0, -v.alt*0.5);
    if(v.facing<0) ctx.scale(-1,1);
    ctx.fillStyle='#d8d8e0'; ctx.beginPath(); ctx.ellipse(0,0,18,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#b0b0bc'; ctx.beginPath(); ctx.moveTo(-4,-4); ctx.lineTo(4,-4); ctx.lineTo(14,-16); ctx.lineTo(10,-16); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#9aa'; ctx.fillRect(-2,-7,4,14);
    ctx.restore();
  }
  ctx.restore();
}
function drawOwnedIsland(isl){
  // 城墙环（永远完好）
  ctx.beginPath(); ctx.arc(isl.x,isl.y,isl.r+6,0,Math.PI*2);
  ctx.lineWidth=7; ctx.strokeStyle='#9a8c6a'; ctx.stroke();
  ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.stroke();
  // 无敌标识
  ctx.font='14px Segoe UI'; ctx.textAlign='center';
  ctx.fillText('🛡️', isl.x, isl.y-isl.r-8);
  // 旗帜
  ctx.strokeStyle='#5a3a1a'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(isl.x,isl.y-isl.r); ctx.lineTo(isl.x,isl.y-isl.r-26); ctx.stroke();
  ctx.fillStyle='#2e8b57'; ctx.beginPath(); ctx.moveTo(isl.x,isl.y-isl.r-26); ctx.lineTo(isl.x+22,isl.y-isl.r-20); ctx.lineTo(isl.x,isl.y-isl.r-14); ctx.closePath(); ctx.fill();
  // 城墙血条（永远满）
  const bw=60, bx=isl.x-bw/2, by=isl.y-isl.r-40;
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(bx,by,bw,6);
  ctx.fillStyle='#6ad06a'; ctx.fillRect(bx,by,bw,6);
  ctx.font='bold 10px Segoe UI'; ctx.fillStyle='#fff'; ctx.fillText('⚔️ 城墙完整', isl.x, by+4);
  ctx.textAlign='left';
}
// 敌方领地绘制：敌人旗帜+破败城墙+ faction 颜色
function drawEnemyIsland(isl){
  const sx = isl.x - cam.x, sy = isl.y - cam.y;
  const vw = canvas.width/DPR, vh = canvas.height/DPR;
  if(sx<-isl.r-60||sx>vw+isl.r+60||sy<-isl.r-60||sy>vh+isl.r+60) return;
  ctx.save();
  // 敌方城墙环（红色虚线，带血条）
  ctx.beginPath(); ctx.arc(isl.x,isl.y,isl.r+6,0,Math.PI*2);
  ctx.lineWidth=7; ctx.strokeStyle=isl.faction.color; ctx.setLineDash([10,6]); ctx.stroke(); ctx.setLineDash([]);
  ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.stroke();
  // 敌方旗帜
  ctx.strokeStyle='#3a1a1a'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(isl.x,isl.y-isl.r); ctx.lineTo(isl.x,isl.y-isl.r-30); ctx.stroke();
  ctx.fillStyle=isl.faction.color; ctx.beginPath(); ctx.moveTo(isl.x,isl.y-isl.r-30); ctx.lineTo(isl.x+22,isl.y-isl.r-24); ctx.lineTo(isl.x,isl.y-isl.r-18); ctx.closePath(); ctx.fill();
  // 阵营图标
  ctx.font='16px Segoe UI'; ctx.textAlign='center';
  ctx.fillText(isl.faction.icon, isl.x, isl.y-isl.r-34);
  ctx.font='bold 9px Segoe UI'; ctx.fillStyle=isl.faction.color;
  ctx.fillText(isl.faction.name, isl.x, isl.y-isl.r-20);
  // 城墙血条（可被攻破）
  const bw=60, bx=isl.x-bw/2, by=isl.y-isl.r-8;
  ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(bx,by,bw,6);
  ctx.fillStyle=isl.faction.color; ctx.fillRect(bx,by,bw*(isl.wallHp/isl.wallMax),6);
  ctx.font='bold 10px Segoe UI'; ctx.fillStyle='#fff';
  ctx.fillText('🏴 攻破按B', isl.x, by+18);
  ctx.textAlign='left';
  ctx.restore();
}
function drawWhirl(w){
  ctx.save(); ctx.translate(w.x,w.y); ctx.rotate(w.spin);
  for(let i=0;i<4;i++){
    ctx.beginPath(); ctx.arc(0,0, w.r*(1-i*0.22), i*0.7, i*0.7+Math.PI*1.5);
    ctx.strokeStyle='rgba(140,190,230,'+(0.5-i*0.1)+')'; ctx.lineWidth=3; ctx.stroke();
  }
  ctx.fillStyle='rgba(10,30,50,0.5)'; ctx.beginPath(); ctx.arc(0,0,w.r*0.12,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ---------- 天气视觉 ----------
function drawRain(W,H){
  if(weather.rain<=0) return;
  ctx.strokeStyle='rgba(180,210,255,'+(0.22+weather.rain*0.12)+')';
  ctx.lineWidth=1.5;
  const n = weather.rain===2?220:110;
  const slant = weather.wind*8;
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const x=Math.random()*W, y=Math.random()*H, len=10+weather.rain*6;
    ctx.moveTo(x,y); ctx.lineTo(x-slant, y+len);
  }
  ctx.stroke();
}
function drawLightning(W,H){
  ctx.fillStyle='rgba(255,255,255,'+Math.min(0.8,lightning*3)+')';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,210,'+Math.min(1,lightning*4)+')'; ctx.lineWidth=2;
  let x=boltX*W, y=0; ctx.beginPath(); ctx.moveTo(x,y);
  while(y<H*0.6){ y+=rand(20,40); x+=(Math.random()-0.5)*60; ctx.lineTo(x,y); }
  ctx.stroke();
}

function drawNode(n){
  const m=NODE_TYPES[n.type];
  ctx.font='24px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(m.label, n.x, n.y);
  ctx.font='10px Segoe UI'; ctx.fillStyle='rgba(255,255,255,.6)'; ctx.fillText(n.amount+'', n.x, n.y+18);
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}
function drawGalleon(c, submerged){
  ctx.save();
  if(submerged){ ctx.globalAlpha=0.62; ctx.translate(0,11); }
  // 船体
  ctx.beginPath();
  ctx.moveTo(-34,0);
  ctx.quadraticCurveTo(-30,17, 0,19);
  ctx.quadraticCurveTo(30,17, 34,0);
  ctx.lineTo(27,-3);
  ctx.quadraticCurveTo(0,-9,-27,-3);
  ctx.closePath();
  ctx.fillStyle=c.hull; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=1.5; ctx.stroke();
  // 甲板
  ctx.beginPath();
  ctx.moveTo(-27,-3); ctx.quadraticCurveTo(0,-9,27,-3); ctx.lineTo(27,-7);
  ctx.quadraticCurveTo(0,-13,-27,-7); ctx.closePath();
  ctx.fillStyle=c.deck; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.14)'; ctx.lineWidth=0.8;
  for(let i=-18;i<=18;i+=9){ ctx.beginPath(); ctx.moveTo(i,-6.5); ctx.lineTo(i,-3); ctx.stroke(); }
  // 船舱（船尾）
  ctx.fillStyle=shade(c.hull,-8); roundRect(13,-22,17,19,2); ctx.fill();
  ctx.fillStyle=shade(c.hull,14); ctx.beginPath(); ctx.moveTo(11,-22); ctx.lineTo(21,-28); ctx.lineTo(32,-22); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=1; roundRect(13,-22,17,19,2); ctx.stroke();
  // 桅杆
  ctx.fillStyle='#5a3d1d'; ctx.fillRect(-4,-50,6,50);
  // 船帆
  ctx.beginPath();
  ctx.moveTo(-2,-46);
  ctx.quadraticCurveTo(26,-36, 19,-7);
  ctx.lineTo(-2,-7);
  ctx.closePath();
  ctx.fillStyle=c.sail; ctx.fill();
  ctx.strokeStyle=c.sailTrim; ctx.lineWidth=2; ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-2,-26); ctx.lineTo(17,-23); ctx.stroke();
  // 旗帜
  ctx.fillStyle=c.flag; ctx.beginPath(); ctx.moveTo(0,-50); ctx.lineTo(17,-46); ctx.lineTo(0,-42); ctx.closePath(); ctx.fill();
  // 大炮（舷侧）
  ctx.fillStyle=c.cannon;
  for(const cx of [-18, 2, 22]){ ctx.fillRect(cx,-5,10,5); ctx.fillStyle='#222'; ctx.fillRect(cx+9,-4,3,3); ctx.fillStyle=c.cannon; }
  // 船首斜桅
  ctx.fillStyle='#5a3d1d'; ctx.fillRect(30,-5,11,3);
  ctx.restore();
}
function drawShip(isPlayer){
  const s=ship, x=s.x, y=s.y;
  ctx.save(); ctx.translate(x,y); if(s.rock) ctx.rotate(s.rock);
  drawGalleon({hull: isPlayer?'#6b4a2b':'#4a3320', deck:'#caa86a', sail: isPlayer?'#f3ead2':'#d9d2c2', sailTrim: isPlayer?'#3da5ff':'#c2362b', flag: isPlayer?'#f0c060':'#c2362b', cannon:'#2b2b2b'}, s.submerged);
  // 装载的载具（在甲板上绘制）
  if(isPlayer){
    for(let i=0;i<s.vehicles.length;i++){
      const v=s.vehicles[i];
      ctx.fillStyle=v.type==='car'?'#5a6a7a':'#8a8a9a';
      ctx.fillRect(v.offset-8,-8,16,10);
      ctx.fillStyle='#c0c0d0';
      ctx.fillRect(v.offset-5,-12,10,5);
      if(v.type==='car'){ ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(v.offset-4,-3,2,0,Math.PI*2); ctx.arc(v.offset+4,-3,2,0,Math.PI*2); ctx.fill(); }
      else { ctx.fillStyle='#e0e0e0'; ctx.beginPath(); ctx.moveTo(v.offset-8,-14); ctx.lineTo(v.offset+8,-14); ctx.lineTo(v.offset+10,-18); ctx.lineTo(v.offset-10,-18); ctx.closePath(); ctx.fill(); }
    }
  }
  if(s.submerged){ ctx.strokeStyle='rgba(200,230,255,.5)'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,9,42,12,0,0,Math.PI*2); ctx.stroke(); }
  // 船长登船：甲板上显示船长头部（帽+脸+肩）
  if(isPlayer && captain.onShip && !s.submerged){
    ctx.fillStyle='#f0c98a'; ctx.beginPath(); ctx.arc(3,-15,6.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1f3a66';
    ctx.beginPath(); ctx.ellipse(3,-18.5,10.5,3.4,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3,-21.5,6.6,4.8,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#f0c060'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.ellipse(3,-18.5,10.5,3.4,0,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='#e35d4f'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(10.5,-21.5); ctx.quadraticCurveTo(17,-26,13,-29); ctx.stroke();
    ctx.fillStyle='#1f4e79'; ctx.fillRect(-1,-8,10,8);
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(6.5,-15.5,1,0,Math.PI*2); ctx.arc(9.5,-15.5,1,0,Math.PI*2); ctx.fill();
  }
  if(isPlayer && ship.fireFlash>0){
    const fr=ship.fireFlash/0.16;
    ctx.fillStyle='rgba(255,210,120,'+(0.85*fr)+')';
    ctx.beginPath(); ctx.arc(34,-4,10+8*fr,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,150,60,'+(0.7*fr)+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(34,-4,14+10*fr,0,Math.PI*2); ctx.stroke();
  }
  if(isPlayer){ ctx.font='10px serif'; ctx.textAlign='center'; ctx.fillText('Lv.'+s.level+(s.vehicles.length?' ['+s.vehicles.length+'/4]':''),-2,-54); ctx.textAlign='left'; }
  ctx.restore();
  if(isPlayer) drawBar(x-28,y-62,56,4,captain.hp/captain.maxhp,'#5ec98a');
}
function drawPirateShip(s){
  const crew = CREWS[s.crew||0];
  ctx.save(); ctx.translate(s.x,s.y);
  if(s.flash>0){ ctx.beginPath(); ctx.arc(0,0,36,0,Math.PI*2); ctx.fillStyle='rgba(255,120,80,.3)'; ctx.fill(); }
  drawGalleon({hull:crew.hull||'#3a2715', deck:crew.deck||'#8a6a3a', sail:'#cfc8b8', sailTrim:crew.band, flag:crew.flag, cannon:'#222'}, false);
  // 阵营标识：船长旗
  ctx.font='bold 11px Segoe UI';
  ctx.fillStyle='rgba(0,0,0,.7)';
  const nm=crew.name;
  ctx.textAlign='center';
  ctx.fillText(nm, 0, -54);
  // 船长头像
  ctx.font='14px Segoe UI Emoji, Segoe UI Symbol';
  ctx.fillText(crew.captain, 28, -4);
  ctx.restore();
  drawBar(s.x-32,s.y-62,64,4,s.hp/s.maxhp,crew.band);
}
function drawMyShip(ms){
  ctx.save(); ctx.translate(ms.x,ms.y);
  if(ms.flash>0){ ctx.beginPath(); ctx.arc(0,0,34,0,Math.PI*2); ctx.fillStyle='rgba(255,120,80,.3)'; ctx.fill(); }
  if(ms.fireCd<0.3){ ctx.beginPath(); ctx.arc(0,0,34,0,Math.PI*2); ctx.fillStyle='rgba(155,232,180,.25)'; ctx.fill(); }
  drawGalleon({hull:'#3f6f4a', deck:'#cbb98a', sail:'#e6f0ea', sailTrim:'#5ec98a', flag:'#5ec98a', cannon:'#2b2b2b'}, false);
  ctx.restore();
  drawBar(ms.x-26,ms.y-52,52,3, Math.max(0,ms.hp/ms.maxhp),'#5ec98a');
}
function drawBar(x,y,w,h,frac,color){
  frac=clamp(frac,0,1);
  ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(x,y,w,h);
  ctx.fillStyle=color; ctx.fillRect(x,y,w*frac,h);
}
function drawMinimap(){
  mctx.clearRect(0,0,180,135);
  mctx.fillStyle='#0a2a45'; mctx.fillRect(0,0,180,135);
  const pp=playerXY(), RW=2600, RH=1950;
  const sx=180/RW, sy=135/RH, x0=pp.x-RW/2, y0=pp.y-RH/2;
  const mpx=wx=>(wx-x0)*sx, mpy=wy=>(wy-y0)*sy;
  const vis=(wx,wy,pad=30)=> wx>x0-pad && wx<x0+RW+pad && wy>y0-pad && wy<y0+RH+pad;
  for(const is of nearbyIslands(pp.x,pp.y,2)){
    if(!vis(is.x,is.y,is.r)) continue;
    mctx.beginPath(); mctx.arc(mpx(is.x),mpy(is.y),Math.max(2.5,is.r*sy),0,Math.PI*2); mctx.fillStyle='#3f7a3f'; mctx.fill();
  }
  for(const cp of camps){ if(vis(cp.x,cp.y)){ mctx.fillStyle='#e35d4f'; mctx.fillRect(mpx(cp.x)-2,mpy(cp.y)-2,4,4); } }
  for(const c of creatures){ if(vis(c.x,c.y)){ mctx.fillStyle='#7fd0e0'; mctx.fillRect(mpx(c.x)-1,mpy(c.y)-1,2,2); } }
  for(const b of birds){ if(vis(b.x,b.y)){ mctx.fillStyle= b.alt<34? '#9be8b4' : '#eaf2ff'; mctx.fillRect(mpx(b.x)-1,mpy(b.y)-1,2,2); } }
  for(const n of nodes){ if(n.amount<=0 || !vis(n.x,n.y)) continue; mctx.fillStyle='#d4af37'; mctx.fillRect(mpx(n.x)-1,mpy(n.y)-1,2,2); }
  for(const ms of myShips){ if(vis(ms.x,ms.y)){ mctx.fillStyle='#5ec98a'; mctx.fillRect(mpx(ms.x)-2,mpy(ms.y)-2,4,4); } }
  for(const p of pirates){ if(!vis(p.x,p.y)) continue; const c=CREWS[p.crew||0]; mctx.fillStyle=p.elite?'#ffffff':c.band; mctx.beginPath(); mctx.arc(mpx(p.x),mpy(p.y),p.elite?3:2,0,Math.PI*2); mctx.fill(); }
  for(const s of pirateShips){ if(vis(s.x,s.y)){ const c=CREWS[s.crew||0]; mctx.fillStyle=c.band; mctx.fillRect(mpx(s.x)-2,mpy(s.y)-2,4,4); } }
  for(const w of whirls){ if(vis(w.x,w.y)){ mctx.strokeStyle='#9fd'; mctx.beginPath(); mctx.arc(mpx(w.x),mpy(w.y),Math.max(2,w.r*sy*0.3),0,Math.PI*2); mctx.stroke(); } }
  for(const key in ownedIslands){ const isl=ownedIslands[key]; if(!vis(isl.x,isl.y,isl.r)) continue;
    mctx.fillStyle='#2e8b57'; mctx.fillRect(mpx(isl.x)-3,mpy(isl.y-isl.r)-3,6,6);
    mctx.strokeStyle='#6ad06a'; mctx.lineWidth=1; mctx.beginPath(); mctx.arc(mpx(isl.x),mpy(isl.y),Math.max(3,isl.r*sy),0,Math.PI*2); mctx.stroke(); }
  for(const key in enemyIslands){ const isl=enemyIslands[key]; if(!vis(isl.x,isl.y,isl.r)) continue;
    mctx.fillStyle=isl.faction.color; mctx.fillRect(mpx(isl.x)-3,mpy(isl.y-isl.r)-3,6,6);
    mctx.strokeStyle=isl.faction.color; mctx.lineWidth=1; mctx.setLineDash([3,3]);
    mctx.beginPath(); mctx.arc(mpx(isl.x),mpy(isl.y),Math.max(3,isl.r*sy),0,Math.PI*2); mctx.stroke();
    mctx.setLineDash([]); }
  // 海盗王国领土标记
  for(const k of pirateKingdoms){ if(!k.alive || !vis(k.cx,k.cy,k.r)) continue;
    mctx.fillStyle=k.color; mctx.globalAlpha=0.15;
    mctx.beginPath(); mctx.arc(mpx(k.cx),mpy(k.cy),Math.max(4,k.r*sy),0,Math.PI*2); mctx.fill();
    mctx.globalAlpha=0.7; mctx.strokeStyle=k.color; mctx.lineWidth=1.5;
    mctx.beginPath(); mctx.arc(mpx(k.cx),mpy(k.cy),Math.max(4,k.r*sy),0,Math.PI*2); mctx.stroke();
    mctx.globalAlpha=1; mctx.fillRect(mpx(k.cx)-2,mpy(k.cy)-2,4,4); }
  for(const wr of wrecks){ if(!vis(wr.x,wr.y)) continue; mctx.fillStyle=wr.looted?'#555':'#bfe8ff'; mctx.fillRect(mpx(wr.x)-1,mpy(wr.y)-1,3,3); }
  for(const v of vehicles){ if(!vis(v.x,v.y)) continue; mctx.fillStyle=(v.type==='plane'?'#7fd0ff':'#3da5ff'); mctx.fillRect(mpx(v.x)-2,mpy(v.y)-2,4,3); }
  // 龙窝标记
  for(const nest of dragonNests){ if(!nest.alive || !vis(nest.x,nest.y,nest.r)) continue;
    mctx.fillStyle='#4aa8ff'; mctx.fillRect(mpx(nest.x)-2,mpy(nest.y)-2,4,4);
    mctx.strokeStyle='#80d0ff'; mctx.lineWidth=1; mctx.setLineDash([2,2]);
    mctx.beginPath(); mctx.arc(mpx(nest.x),mpy(nest.y),Math.max(2,nest.r*sy),0,Math.PI*2); mctx.stroke();
    mctx.setLineDash([]); }
  // 东海龙王标记
  if(dragonKing && !dragonKing.dead && vis(dragonKing.x,dragonKing.y)){
    mctx.fillStyle='#1a8b3a'; mctx.fillRect(mpx(dragonKing.x)-3,mpy(dragonKing.y)-3,6,6);
    mctx.strokeStyle='#4aa8ff'; mctx.lineWidth=2;
    mctx.beginPath(); mctx.arc(mpx(dragonKing.x),mpy(dragonKing.y),5,0,Math.PI*2); mctx.stroke(); }
  // 海怪标记
  for(const sm of seaMonsters){ if(sm.dead || !vis(sm.x,sm.y)) continue;
    const m2 = SEA_MONSTER_TYPES[sm.type];
    mctx.fillStyle = m2?.color || '#4aa8ff';
    mctx.fillRect(mpx(sm.x)-2,mpy(sm.y)-2,4,4);
    mctx.strokeStyle='#88ccff'; mctx.lineWidth=1;
    mctx.beginPath(); mctx.arc(mpx(sm.x),mpy(sm.y),4,0,Math.PI*2); mctx.stroke(); }
  mctx.fillStyle='#3da5ff'; mctx.beginPath(); mctx.arc(90,135/2,3,0,Math.PI*2); mctx.fill();
}

// ---------- HUD ----------
function buildHUD(){
  const inv=document.getElementById('inventory'); inv.innerHTML='';
  for(const k of ['wood','food','gold','iron','powder','steel','parts','tire','aluminum','timber']){
    const m=RES_META[k];
    const el=document.createElement('div'); el.className='res';
    el.innerHTML=`<div class="ic">${m.icon}</div><div class="nm">${m.name}</div><div class="ct" id="res_${k}">0</div>`;
    inv.appendChild(el);
  }
  // 卖木换钱按钮
  const sellBtn=document.getElementById('sellWoodBtn'); if(sellBtn) sellBtn.onclick = sellWood;
  const wb=document.getElementById('weaponBar'); wb.innerHTML='';
  // 武器槽：按类型分组（近程/远程/船上专属）
  const groups = [
    { label:'⚔️ 近程', ids: WEAPON_ORDER.filter(id => WEAPONS[id].type==='melee' && !WEAPONS[id].shipOnly) },
    { label:'🏹 远程', ids: WEAPON_ORDER.filter(id => WEAPONS[id].type==='ranged' && !WEAPONS[id].shipOnly) },
    { label:'🚢 船上', ids: WEAPON_ORDER.filter(id => WEAPONS[id].shipOnly) },
  ];
  for(const g of groups){
    const row=document.createElement('div'); row.className='wp-row';
    const sub=document.createElement('div'); sub.className='wp-sub'; sub.textContent=g.label;
    row.appendChild(sub);
    for(const w of g.ids){
      const m=WEAPONS[w];
      const el=document.createElement('div'); el.className='wp'; el.id='wp_'+w;
      el.innerHTML=`<div class="wlv hidden" id="lvbadge_${w}">Lv.1</div><div class="wic">${m.icon}</div><div class="wnm">${m.name}</div>`;
      el.onclick=()=>{ if(arsenal.has(w)) captain.weapon=w; };
      row.appendChild(el);
    }
    wb.appendChild(row);
  }
  // 装备槽（装备也放武器栏，与小刀同筐）
  if(captain.equip && captain.equip.length>0){
    for(let i=0; i<captain.equip.length; i++){
      const eq = captain.equip[i];
      const rm = RARITY_META[eq.rarity];
      const el=document.createElement('div'); el.className='wp wp-equip'; el.id='eq_'+i;
      el.style.border = '2px solid '+rm.color;
      el.innerHTML=`<div class="wic">${eq.icon}</div><div class="wnm" style="color:${rm.color};font-size:8px;">${eq.name}</div>`;
      wb.appendChild(el);
    }
  }
  const cl=document.getElementById('craftList'); cl.innerHTML='';
  for(const r of RECIPES){
    const m=WEAPONS[r.id];
    const cost=Object.entries(r.cost).map(([k,v])=>`${RES_META[k].icon}${v}`).join(' ');
    const el=document.createElement('div'); el.className='recipe'; el.id='craft_'+r.id;
    el.innerHTML=`<div class="rinfo"><span class="rname">${m.icon} ${m.name}</span><span class="rcost">${cost}</span></div>`;
    const btn=document.createElement('button'); btn.id='craftbtn_'+r.id; btn.textContent='打造';
    btn.onclick=()=>craft(r.id); el.appendChild(btn); cl.appendChild(el);
  }
  const sh=document.getElementById('shopList'); sh.innerHTML='';
  for(const s of SHOP){
    const m=WEAPONS[s.id];
    const el=document.createElement('div'); el.className='recipe'; el.id='shop_'+s.id;
    el.innerHTML=`<div class="rinfo"><span class="rname">${m.icon} ${m.name}</span><span class="rcost">🪙${s.cost.gold}</span></div>`;
    const btn=document.createElement('button'); btn.id='shopbtn_'+s.id; btn.textContent='购买';
    btn.onclick=()=>buy(s.id); el.appendChild(btn); sh.appendChild(el);
  }
  const ul=document.getElementById('upgradeList'); ul.innerHTML='';
  for(const id of WEAPON_ORDER){
    if(id==='cannon') continue;
    const m=WEAPONS[id];
    const el=document.createElement('div'); el.className='recipe'; el.id='up_'+id;
    el.innerHTML=`<div class="rinfo"><span class="rname">${m.icon} ${m.name} <span id="lv_${id}">Lv.1</span></span><span class="rcost" id="ucost_${id}"></span></div>`;
    const btn=document.createElement('button'); btn.id='upbtn_'+id; btn.textContent='升级';
    btn.onclick=()=>upgradeWeapon(id); el.appendChild(btn); ul.appendChild(el);
  }
  const up=document.getElementById('shipUpgrade'); up.innerHTML='';
  // 主船升级
  const el=document.createElement('div'); el.className='recipe'; el.id='shipup';
  el.innerHTML=`<div class="rinfo"><span class="rname">🚢 升级主船</span><span class="rcost">🪙12 🪵8</span></div>`;
  const btn=document.createElement('button'); btn.id='upbtn'; btn.textContent='升级';
  btn.onclick=upgradeShip; el.appendChild(btn); up.appendChild(el);
  // 船速升级（消耗废铁）
  const sp=document.createElement('div'); sp.className='recipe'; sp.id='shipup_sp';
  sp.innerHTML=`<div class="rinfo"><span class="rname">⚓ 升级船速 <span id="splv">Lv.1</span></span><span class="rcost" id="spcost"></span></div>`;
  const spb=document.createElement('button'); spb.id='spbtn'; spb.textContent='升级'; spb.onclick=upgradeShipSpeed; sp.appendChild(spb); up.appendChild(sp);
  // 载具打造（专属材料）
  addVehicleRow(up,'car','🚗 打造车子',VEHICLE_COSTS.car);
  addVehicleRow(up,'plane','✈️ 打造飞机',VEHICLE_COSTS.plane);
  // 新战船打造（造船木+废铁）
  const sb=document.createElement('div'); sb.className='recipe'; sb.id='shipup_new';
  const shipCostStr = Object.entries(SHIP_BUILD_COST).map(([k,v])=>`${RES_META[k].icon}${v}`).join(' ');
  sb.innerHTML=`<div class="rinfo"><span class="rname">🚢 打造新战船 <span id="shpct">×0/${MAX_MYSHIPS}</span></span><span class="rcost">${shipCostStr}</span></div>`;
  const sbb=document.createElement('button'); sbb.id='shpbtn'; sbb.textContent='打造'; sbb.onclick=buildShip; sb.appendChild(sbb); up.appendChild(sb);
  // 船长升级（锻炼值自动提升，展示进度）
  const cp=document.createElement('div'); cp.className='recipe'; cp.id='captainup';
  cp.innerHTML=`<div class="rinfo"><span class="rname">💪 船长等级 <span id="cplv">Lv.1</span></span><span class="rcost" id="cpbar">XP 0/30</span></div>`;
  const cpb=document.createElement('button'); cpb.id='cpbtn'; cpb.textContent='走路+击杀自动升级'; cpb.disabled=true; cp.appendChild(cpb); up.appendChild(cp);
  // 装备锻造（消耗金币+铁矿+火药）
  const eqSub=document.createElement('div'); eqSub.className='subTitle'; eqSub.textContent='⚔️ 装备锻造（消耗金币+铁矿+火药）';
  up.appendChild(eqSub);
  const eqList=document.createElement('div'); eqList.id='equipList';
  for(const r of EQUIP_RECIPES){
    const eq=EQUIPMENT.find(e=>e.id===r.id);
    if(!eq) continue;
    const costStr=Object.entries(r.cost).map(([k,v])=>`${RES_META[k].icon}${v}`).join(' ');
    const rm=RARITY_META[eq.rarity];
    const el=document.createElement('div'); el.className='recipe'; el.id='eqc_'+r.id;
    el.innerHTML=`<div class="rinfo"><span class="rname" style="color:${rm.color}">${eq.icon} ${eq.name} [${rm.name}]</span><span class="rcost">${costStr}</span></div>`;
    const btn=document.createElement('button'); btn.textContent='锻造'; btn.id='eqbtn_'+r.id;
    btn.onclick=()=>craftEquip(r.id); el.appendChild(btn); eqList.appendChild(el);
  }
  up.appendChild(eqList);
  // 传说武器锻造（锻造后自动加入武器栏，可像其他武器一样使用）
  const wfSub=document.createElement('div'); wfSub.className='subTitle'; wfSub.textContent='🔥 传说武器锻造（铁匠铺·打造后入武器栏）';
  up.appendChild(wfSub);
  const wfList=document.createElement('div'); wfList.id='weaponForgeList';
  for(const r of WEAPON_FORGE){
    const wp=WEAPONS[r.id];
    if(!wp) continue;
    const costStr=Object.entries(r.cost).map(([k,v])=>`${RES_META[k].icon}${v}`).join(' ');
    const el=document.createElement('div'); el.className='recipe'; el.id='wf_'+r.id;
    el.innerHTML=`<div class="rinfo"><span class="rname" style="color:#ff5555">${wp.icon} ${wp.name} <span id="wflv_${r.id}"></span></span><span class="rcost" id="wfcost_${r.id}">${costStr}</span></div>`;
    // 锻造按钮（初始显示）
    const fbtn=document.createElement('button'); fbtn.textContent='锻造'; fbtn.id='wfbtn_'+r.id;
    fbtn.onclick=()=>craftWeapon(r.id); el.appendChild(fbtn);
    // 升级按钮（初始隐藏，锻造成功后替代锻造按钮出现）
    const ubtn=document.createElement('button'); ubtn.textContent='升级'; ubtn.id='wfupbtn_'+r.id;
    ubtn.style.display='none';
    ubtn.onclick=()=>upgradeWeapon(r.id); el.appendChild(ubtn);
    wfList.appendChild(el);
  }
  up.appendChild(wfList);
  updateEquipmentHUD();
  updateInventoryHUD();
}
function addVehicleRow(parent,type,label,cost){
  const el=document.createElement('div'); el.className='recipe'; el.id='veh_'+type;
  const costStr=Object.entries(cost).map(([k,v])=>`${RES_META[k].icon}${v}`).join(' ');
  el.innerHTML=`<div class="rinfo"><span class="rname">${label}</span><span class="rcost">${costStr}</span></div>`;
  const btn=document.createElement('button'); btn.id='vehbtn_'+type; btn.textContent='打造';
  btn.onclick=()=>buildVehicle(type); el.appendChild(btn); parent.appendChild(el);
}
function upgradeShipSpeed(){
  if(shipSpeedLv>=8){ floatText(captain.x,captain.y-30,'船速已满级','#e35d4f'); return; }
  const cost=2+shipSpeedLv;
  if(inventory.steel<cost){ floatText(captain.x,captain.y-30,'废铁不足(需⚙️'+cost+')','#e35d4f'); return; }
  inventory.steel-=cost; shipSpeedLv++; ship.speed=Math.min(6.5, 3.4 + (shipSpeedLv-1)*0.45);
  const e=document.getElementById('splv'); if(e) e.textContent='Lv.'+shipSpeedLv;
  floatText(captain.x,captain.y-30,'船速提升! '+ship.speed.toFixed(1),'#9be8b4'); updateInventoryHUD();
}
function updateEquipmentHUD(){
  // 装备已在 buildHUD() 中渲染到武器栏，此处无需重复
  // 保留函数以兼容调用方
}
function buildWeaponSlotsFromEquip(){
  const wb=document.getElementById('weaponBar'); if(!wb) return;
  while(wb.lastChild && wb.lastChild.classList.contains('wp-equip')) wb.removeChild(wb.lastChild);
  if(!captain.equip) return;
  for(let i=0; i<captain.equip.length; i++){
    const eq = captain.equip[i];
    const rm = RARITY_META[eq.rarity];
    const el=document.createElement('div'); el.className='wp wp-equip'; el.id='eq_'+i;
    el.style.border = '2px solid '+rm.color;
    el.innerHTML=`<div class="wic">${eq.icon}</div><div class="wnm" style="color:${rm.color};font-size:8px;">${eq.name}</div>`;
    wb.appendChild(el);
  }
}
// 木材换钱：每次5块木头换50金币
function sellWood(){
  if(inventory.wood < 5){ floatText(captain.x, captain.y-30,'🪵 不足5块，无法换钱','#e35d4f'); return; }
  inventory.wood -= 5; inventory.gold += 50;
  floatText(captain.x, captain.y-30,'🪵-5 → 🪙+50','#9be8b4');
  updateInventoryHUD();
}
function updateInventoryHUD(){
  for(const k of ['wood','food','gold','iron','powder','steel','parts','tire','aluminum','timber']){ const el=document.getElementById('res_'+k); if(el) el.textContent=inventory[k]; }
  const spc=document.getElementById('spcost'); if(spc) spc.textContent='⚙️'+(2+shipSpeedLv);
  const shpct=document.getElementById('shpct'); if(shpct) shpct.textContent='×'+myShips.length+'/'+MAX_MYSHIPS;
  // 船长等级 & XP
  const cplv=document.getElementById('cplv'); if(cplv) cplv.textContent='Lv.'+captainLv;
  const cpbar=document.getElementById('cpbar'); if(cpbar) cpbar.textContent='XP '+captainXp+'/'+captainXpNeed();
}
function craft(id){
  if(arsenal.has(id)) return;
  const r=RECIPES.find(x=>x.id===id);
  for(const [k,v] of Object.entries(r.cost)){ if(inventory[k]<v){ floatText(captain.x,captain.y-30,'物资不足','#e35d4f'); return; } }
  for(const [k,v] of Object.entries(r.cost)) inventory[k]-=v;
  arsenal.add(id); weaponLevel[id]=1; updateInventoryHUD();
  floatText(captain.x,captain.y-30,'打造: '+WEAPONS[id].name,'#ffe9b0');
}
function buy(id){
  if(arsenal.has(id)) return;
  const s=SHOP.find(x=>x.id===id);
  if(inventory.gold<s.cost.gold){ floatText(captain.x,captain.y-30,'金币不足','#e35d4f'); return; }
  inventory.gold-=s.cost.gold; arsenal.add(id); weaponLevel[id]=1; updateInventoryHUD();
  floatText(captain.x,captain.y-30,'购买: '+WEAPONS[id].name,'#ffe9b0');
}
function upgradeWeapon(id){
  if(!arsenal.has(id)) return;
  const lv=(weaponLevel[id]||1);
  if(lv>=WEAPON_MAX_LV){ floatText(captain.x,captain.y-30,'已达最高级','#e35d4f'); return; }
  const c=weaponUpCost(id);
  if(inventory.gold<c.gold || inventory.iron<c.iron){ floatText(captain.x,captain.y-30,'金币/铁矿不足','#e35d4f'); return; }
  inventory.gold-=c.gold; inventory.iron-=c.iron; weaponLevel[id]=lv+1; updateInventoryHUD();
  floatText(captain.x,captain.y-30,'升级 '+WEAPONS[id].name+' Lv.'+weaponLevel[id],'#9be8b4');
}
function upgradeShip(){
  const costGold = 12 + ship.level*4;
  const costWood = 8 + ship.level*2;
  if(inventory.gold<costGold || inventory.wood<costWood){ floatText(captain.x,captain.y-30,'金币/木材不足','#e35d4f'); return; }
  inventory.gold-=costGold; inventory.wood-=costWood;
  ship.level++;
  ship.cannonDmg += 12;
  ship.maxhp = (ship.maxhp||200) + 40;
  captain.maxhp += 10;
  captain.hp = Math.min(captain.maxhp, captain.hp + 10);
  floatText(captain.x,captain.y-30,'船只升级 Lv.'+ship.level+' 炮击+12 HP+10','#9be8b4');
  updateInventoryHUD();
}
// 锻造传说武器：消耗材料，锻造后自动加入武器栏
function craftWeapon(id){
  if(arsenal.has(id)){ floatText(captain.x,captain.y-30,'已拥有该武器','#ffe9b0'); return; }
  const r=WEAPON_FORGE.find(x=>x.id===id);
  if(!r) return;
  for(const [k,v] of Object.entries(r.cost)){ if(inventory[k]!==undefined && inventory[k]<v){ floatText(captain.x,captain.y-30,'材料不足','#e35d4f'); return; } }
  for(const [k,v] of Object.entries(r.cost)){ if(inventory[k]!==undefined) inventory[k]-=v; }
  arsenal.add(id); weaponLevel[id]=1;
  updateInventoryHUD();
  updateHUD();
  buildWeaponSlotsFromEquip();
  const wp=WEAPONS[id];
  floatText(captain.x,captain.y-30,'🔥 锻造成功! '+wp.icon+' '+wp.name+' 已加入武器栏!','#ff5555');
  for(let i=0;i<12;i++) particles.push(mkParticle(captain.x,captain.y,choice(['#ff5555','#ffd27a','#b060ff'])));
}
function updateHUD(){
  const hp=clamp(captain.hp,0,captain.maxhp);
  document.getElementById('hpFill').style.width=(hp/captain.maxhp*100)+'%';
  document.getElementById('hpText').textContent=Math.max(0,Math.ceil(hp))+'/'+captain.maxhp;
  const shp=Math.max(0,Math.min(ship.hp, ship.maxhp));
  const shpFill=document.getElementById('shipHpFill'); const shpTxt=document.getElementById('shipHpText');
  if(shpFill) shpFill.style.width=(shp/ship.maxhp*100)+'%';
  if(shpTxt) shpTxt.textContent=Math.max(0,Math.ceil(shp))+'/'+ship.maxhp;
  const hg=document.getElementById('hungerFill'), ht=document.getElementById('hungerText');
  if(hg) hg.style.width=(clamp(captain.hunger,0,100))+'%';
  if(ht){ ht.textContent=Math.ceil(clamp(captain.hunger,0,100))+'/100'; ht.style.color = captain.hunger<50? '#ff8a3a' : '#cfe8ff'; }
  document.getElementById('modeText').textContent=captain.onShip?'船上 ⚓':'徒步 🚶';
  const ownedCt=Object.keys(ownedIslands).length;
  document.getElementById('objText').textContent=`🗡️${kills}/${WIN_BY_KILLS} 🚩${ownedCt}/${WIN_BY_ISLANDS} 🏴${Object.keys(enemyIslands).length}`;
  const clv=document.getElementById('capLvText'); if(clv) clv.textContent='Lv.'+captainLv;
  document.getElementById('allyText').textContent=followers.length;
  document.getElementById('fleetText').textContent=myShips.length+1;
  document.getElementById('shipLvText').textContent='Lv.'+ship.level;
  const rt=document.getElementById('regenText'); if(rt) rt.classList.toggle('hidden', !captain._regen);
  const ph=dayPhase(worldTime); const wt=weatherInfo(weather.type);
  document.getElementById('timeText').textContent=ph.icon+' '+ph.label;
  document.getElementById('weatherText').textContent=wt[0]+' '+wt[1];

  // ---- v20 · 阵营势力状态条（每0.4秒刷新一次） ----
  const csEl = document.getElementById('crewStatus');
  if(csEl && (animT - (csEl._lastT||0)) > 0.4){
    csEl._lastT = animT;
    const shipsCt = new Array(CREW_COUNT).fill(0);
    for(const s of pirateShips){ shipsCt[s.crew||0]++; }
    const landCt = new Array(CREW_COUNT).fill(0);
    for(const p of pirates){ landCt[p.crew||0]++; }
    let html = '';
    for(let i=0;i<CREW_COUNT;i++){
      const c = CREWS[i];
      // 该阵营是否有势力存在（船或陆地兵或敌方领地）
      const hasPresence = shipsCt[i]>0 || landCt[i]>0 || Object.values(enemyIslands).some(e=>e.faction.name===c.name);
      if(!hasPresence) continue;
      html += `<div class="cs-item${shipsCt[i]>0?' active':''}">`
        + `<span class="cs-icon">${c.captain}</span>`
        + `<span class="cs-dot" style="background:${c.band}"></span>`
        + `<span>${c.name}</span>`
        + (shipsCt[i]>0?`<span class="cs-num">🚢${shipsCt[i]}</span>`:'')
        + (landCt[i]>0?`<span class="cs-num">⚔${landCt[i]}</span>`:'')
        + (Object.values(enemyIslands).filter(e=>e.faction.name===c.name).length>0
          ?`<span class="cs-num-enemy">🏴${Object.values(enemyIslands).filter(e=>e.faction.name===c.name).length}</span>`:'')
        + `</div>`;
    }
    csEl.innerHTML = html || '';
  }
  for(const w of WEAPON_ORDER){
    const el=document.getElementById('wp_'+w); if(!el) continue;
    const owned=arsenal.has(w);
    el.classList.toggle('active', captain.weapon===w);
    el.style.opacity = owned? (captain.weapon===w?1:0.7) : 0.2;
    const badge=document.getElementById('lvbadge_'+w);
    if(badge){ badge.textContent='Lv.'+(weaponLevel[w]||1); badge.classList.toggle('hidden', !owned); }
  }
  for(const r of RECIPES){
    const el=document.getElementById('craft_'+r.id); if(!el) continue;
    const btn=document.getElementById('craftbtn_'+r.id); const owned=arsenal.has(r.id);
    el.classList.toggle('owned', owned);
    if(owned){ btn.textContent='已拥有'; btn.disabled=true; }
    else { let ok=true; for(const [k,v] of Object.entries(r.cost)) if(inventory[k]<v) ok=false; btn.disabled=!ok; btn.textContent='打造'; }
  }
  for(const s of SHOP){
    const el=document.getElementById('shop_'+s.id); if(!el) continue;
    const btn=document.getElementById('shopbtn_'+s.id); const owned=arsenal.has(s.id);
    el.classList.toggle('owned', owned);
    if(owned){ btn.textContent='已拥有'; btn.disabled=true; }
    else { btn.disabled = inventory.gold < s.cost.gold; btn.textContent='购买'; }
  }
  for(const id of WEAPON_ORDER){
    if(id==='cannon') continue;
    const el=document.getElementById('up_'+id); if(!el) continue;
    const owned=arsenal.has(id); const lv=(weaponLevel[id]||1);
    el.style.opacity = owned?1:0.35;
    const lvEl=document.getElementById('lv_'+id); if(lvEl) lvEl.textContent='Lv.'+lv;
    const costEl=document.getElementById('ucost_'+id);
    const btn=document.getElementById('upbtn_'+id);
    if(!owned){ if(costEl) costEl.textContent='未拥有'; btn.disabled=true; btn.textContent='—'; }
    else if(lv>=WEAPON_MAX_LV){ if(costEl) costEl.textContent='已满级'; btn.disabled=true; btn.textContent='满级'; }
    else { const c=weaponUpCost(id); if(costEl) costEl.textContent=`🪙${c.gold} ⛏️${c.iron}`;
      btn.disabled = inventory.gold<c.gold || inventory.iron<c.iron; btn.textContent='升级'; }
  }
  const upBtn=document.getElementById('upbtn');
  if(upBtn){
    const cGold=12+ship.level*4, cWood=8+ship.level*2;
    upBtn.disabled = inventory.gold<cGold || inventory.wood<cWood;
    const el=upBtn.parentElement; if(el){ const rcost=el.querySelector('.rcost'); if(rcost) rcost.textContent=`🪙${cGold} 🪵${cWood}`; }
  }
  // 传说武器锻造按钮状态：未锻造→显示锻造；已锻造→隐藏锻造，显示升级
  for(const r of WEAPON_FORGE){
    const el=document.getElementById('wf_'+r.id); if(!el) continue;
    const owned=arsenal.has(r.id);
    const fbtn=document.getElementById('wfbtn_'+r.id);
    const ubtn=document.getElementById('wfupbtn_'+r.id);
    const lvEl=document.getElementById('wflv_'+r.id);
    const costEl=document.getElementById('wfcost_'+r.id);
    if(!owned){
      // 未锻造：显示锻造按钮，隐藏升级按钮
      if(fbtn){ fbtn.style.display=''; fbtn.disabled=false; fbtn.textContent='锻造'; }
      if(ubtn) ubtn.style.display='none';
      if(lvEl) lvEl.textContent='';
      let ok=true; for(const [k,v] of Object.entries(r.cost)) if(inventory[k]<v) ok=false;
      if(fbtn) fbtn.disabled=!ok;
      if(costEl) costEl.textContent=Object.entries(r.cost).map(([k,v])=>`${RES_META[k].icon}${v}`).join(' ');
      el.style.opacity='1';
    } else {
      // 已锻造：隐藏锻造按钮，显示升级按钮（可像普通武器一样升级）
      if(fbtn) fbtn.style.display='none';
      if(ubtn) ubtn.style.display='';
      const lv=weaponLevel[r.id]||1;
      if(lvEl) lvEl.textContent='Lv.'+lv;
      if(lv>=WEAPON_MAX_LV){
        if(costEl) costEl.textContent='已满级';
        if(ubtn){ ubtn.disabled=true; ubtn.textContent='满级'; }
      } else {
        const c=weaponUpCost(r.id);
        if(costEl) costEl.textContent=`🪙${c.gold} ⛏️${c.iron}`;
        if(ubtn){ ubtn.disabled=inventory.gold<c.gold||inventory.iron<c.iron; ubtn.textContent='升级'; }
      }
      el.style.opacity='1';
    }
  }
}

// ---------- 流程 ----------
function endGame(win){
  if(state!=='play') return;
  state = win?'win':'lose';
  const es=document.getElementById('endScreen');
  const t=document.getElementById('endTitle'), m=document.getElementById('endMsg');
  if(win){
    const ownedCt=Object.keys(ownedIslands).length;
    if(victoryType==='kills'){
      t.textContent='⚔️ 屠海传说！'; t.className='win';
      m.textContent=`你以一把小刀起家，击败 ${kills} 名海盗，成为传奇船长！\n\n💪 船长 Lv.${captainLv} · 🚢 船 Lv.${ship.level} · 🚩 领地 ${ownedCt} 座`;
    } else if(victoryType==='islands'){
      t.textContent='🏝️ 群岛霸主！'; t.className='win';
      m.textContent=`你征服了 ${ownedCt} 座岛屿，建立了横跨四海的海盗帝国！\n\n⚔️ 击杀 ${kills} · 💪 船长 Lv.${captainLv} · 🚢 船 Lv.${ship.level}`;
    } else if(victoryType==='kingdoms'){
      t.textContent='👑 海域霸主！'; t.className='win';
      m.textContent=`你攻破了所有海盗王国的要塞，统一了整片海域！\n\n⚔️ 击杀 ${kills} · 🏰 领地 ${ownedCt} 座 · 💪 船长 Lv.${captainLv}`;
    } else {
      t.textContent='🏆 海域已净化！'; t.className='win';
      m.textContent=`击败 ${kills} 名海盗，征服 ${ownedCt} 座岛屿，成为传奇船长！`;
    }
  } else { t.textContent='💀 船长阵亡'; t.className='lose'; m.textContent=`无尽海域中你坚守到了最后，共击败 ${kills} 名海盗……再来一局，刷新纪录？`; }
  es.classList.remove('hidden');
}
function loop(t){
  const dt=Math.min(0.05,(t-lastT)/1000||0); lastT=t;
  if(state==='play'){ update(dt); render(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.getElementById('startBtn').onclick=()=>{ document.getElementById('startScreen').classList.add('hidden'); resetGame(); state='play'; };
document.getElementById('restartBtn').onclick=()=>{ document.getElementById('endScreen').classList.add('hidden'); resetGame(); state='play'; };
