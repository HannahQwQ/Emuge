<div align="center">

# EMUGE

**Feelings you can grow and hear.**
把一闪而过的心情，种成一棵会唱歌的菜。

### 🌱 [打开展示网站 → hannahqwq.github.io/Emuge](https://hannahqwq.github.io/Emuge/)

[个人装置原型](https://hannahqwq.github.io/emuge-PersonalDevice/) · [公共装置原型](https://tongji-mood-garden.silvercat34.chatgpt.site/) · [演示视频](https://hannahqwq.github.io/Emuge/#demo)

<a href="https://hannahqwq.github.io/Emuge/#demo"><img src="assets/demo-poster.jpg" alt="Emuge 演示视频截图" width="760"></a>

*Affective AI for Human Flourishing · 同济大学 · 2026*

</div>

---

## Emuge 是什么

Emuge 让学生不用开口，也能被听见；不用暴露自己，也能被关心。
它由两个装置组成：一个属于自己，一个属于大家。

| | 个人装置 · Personal device | 公共装置 · Mood commons |
|---|---|---|
| **一句话** | Plant how you feel. | A garden that answers back. |
| **做什么** | 对着装置做个表情，在情绪轮盘上拖动，找到最贴近此刻的那颗蔬菜，并试听它的声音；可以叠加一个特殊状态，最后把它种进校园地图。 | 种子会落在校园地图上。路过的人转动水壶把手选一个地方，那里的蔬菜就掉进重力箱。浇水、加热、遮光、戳一戳、敲一锤，每一种回应都会变成声音，传回种下它的人。 |
| **原型** | [打开 ↗](https://hannahqwq.github.io/emuge-PersonalDevice/) | [打开 ↗](https://tongji-mood-garden.silvercat34.chatgpt.site/) |

五种蔬菜对应五类情绪：🌽 玉米（快乐、兴奋）· 🥬 卷心菜（放松、满足）· 🍄 蘑菇（专注、沉思）· 🍆 茄子（低落、疲惫）· 🌶️ 辣椒（愤怒、紧张）。

## 网站里可以玩的

- **首页的 3D 公共装置**：可以拧水阀、推滑杆、按按钮、摇摇杆，屏幕上是像素花园，箱子里住着一只小猫。
- **EMUGE 大字母**：每个字母都是一块会在空间里转动的平面；标题下有一条五色划线，滑到 “hear” 下面会像琴弦一样被拨动。
- **个人装置**：拖动 3D 蛋形装置旋转，切换五种外壳颜色，屏幕上依次播放四段真实操作录屏。
- **公共装置卡片**：一台小装置沿着卡片边框绕圈行走，时不时停下来打招呼，点它会跳起来。
- **星空**：鼠标划过会搅动星光；页面上漂浮着蔬菜，滑到页面最底部，它们会全部掉下来堆在一起，可以用鼠标推开；往上翻，它们会飞回原位。

## 团队

| 成员 | 学号 |
|---|---|
| 戚添 | 2633494 |
| 温雅 | 2633459 |
| 邓笑晗 | 2633505 |
| 谢嘉懿 | 2633502 |

指导老师：**薛海安**

---

<details>
<summary><b>开发说明（目录结构、本地预览、常改的地方）</b></summary>

纯静态网页（HTML + CSS + JS），不需要构建，推到 `main` 分支后由 GitHub Pages 自动发布。

### 目录结构

```
index.html        页面本体：结构、样式和大部分交互脚本（含 CONFIG）
machine3d.js      首页可交互的 3D 公共装置 + 像素屏幕动画 + 箱中小猫
personal3d.js     个人装置 3D 模型：拖动旋转、五色外壳、屏幕播放步骤录屏
walker3d.js       沿公共装置卡片边框行走的 3D 小装置
team3d.js         团队页两个装置的 3D 模型与像素表情
assets/           图片：装置渲染图、蔬菜表情（v-<类别>-<序号>.webp）、团队手绘形象
media/
  demo.mp4             演示视频（1080p）
  personal-step1~4.mp4 个人装置四段操作录屏（圆形裁切）
  public-screen.mp4    公共装置屏幕录屏
  emuge-machine.glb    公共装置 3D 模型（约 1MB）
  personal-device.glb  个人装置 3D 模型（五种颜色，约 3MB）
```

### 本地预览

3D 模型需要通过 http 加载，不能直接双击打开 `index.html`：

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

### 常改的地方

- **链接、演示视频、团队信息**：`index.html` 里搜索 `const CONFIG`。
- **个人装置四段视频**：替换 `media/personal-step1.mp4` ~ `personal-step4.mp4`；视频贴到 3D 屏幕的方式在 `personal3d.js` 的 `paint()`。
- **标题划线 / 琴弦效果**：脚本 `titleUnderline` 一段。
- **星空光标特效**：脚本 `stars` 一段（WebGL 流体，无 WebGL 时自动退回普通星空）。
- **漂浮 / 掉落的蔬菜**：脚本 `vegs` 一段，`HOMES` 里设置每个蔬菜的位置和图片。
- **3D 装置交互**：`machine3d.js`，零件按 GLB 节点名查找（`Valve_*`、`Slider_Knob`、`Button0-2`、`Joystick_*`、`Tray_*`、`Screen`）。

### 外部依赖（CDN）

- three.js 0.147.0 + GLTFLoader（jsdelivr）
- GSAP 3.12.5 + ScrollTrigger（cdnjs）
- Google Fonts：Bricolage Grotesque、Noto Sans SC

开启系统“减少动态效果”时，动画会自动关闭。

</details>
