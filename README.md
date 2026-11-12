# Emuge 项目展示网站

纯静态网页（HTML + CSS + JS），不需要构建，直接放到 GitHub Pages 就能访问。

## 目录结构

```
index.html        页面本体：结构、样式和大部分交互脚本（含 CONFIG）
machine3d.js      首页可交互的 3D 公共装置（three.js）+ 像素屏幕动画
personal3d.js     个人装置 3D 模型：拖动旋转、五色外壳切换、屏幕播放步骤录屏（视频贴图）
assets/           图片：装置渲染图、蛋形装置、蔬菜表情（v-<类别>-<序号>.webp）
media/            视频与模型
  personal-step1~4.mp4 个人装置屏幕录屏，按“读表情 / 拖轮盘选蔬菜 / 加特殊状态 / 种进校园地图”分段（已裁成圆形）
  public-screen.mp4    公共装置屏幕录屏
  emuge-machine.glb    公共装置 3D 模型（贴图已压缩，约 1MB）
  personal-device.glb  个人装置 3D 模型（五种颜色，约 3MB）
```

## 本地预览

3D 模型需要通过 http 加载，不能直接双击打开 index.html：

```bash
cd emuge-site
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 部署到 GitHub Pages

1. 新建仓库，把本文件夹里的全部内容推到 `main` 分支根目录。
2. 仓库 Settings → Pages → Source 选 “Deploy from a branch”，Branch 选 `main` / `(root)`。
3. 一两分钟后访问 `https://<用户名>.github.io/<仓库名>/`。

## 常改的地方

- **链接、演示视频、团队信息**：`index.html` 里搜索 `const CONFIG`。
  - `demoVideo` 填 `.mp4` 路径（如 `media/demo.mp4`）会直接播放；填 B 站等网页链接会显示跳转按钮。
  - `team` 里每人的 `photo` 填图片路径，留空显示占位卡片。
- **个人装置四段视频**：直接替换 `media/personal-step1.mp4` ~ `personal-step4.mp4`（圆形画面，正方形尺寸）；切换逻辑在脚本 `stepPlayer` 一段；视频画到 3D 屏幕上的方式（圆形居中、边缘羽化、用视频边缘色填满异形屏幕）在 `personal3d.js` 的 `paint()`。
- **公共装置录屏**：`CONFIG.links.publicScreenVideo`。
- **首页大字母**：五个字母的 SVG 直接写在 `index.html` 里（搜索 `class="letter"`），倾斜效果在脚本 `letterPlanes` 一段。
- **标题划线 / 琴弦效果**：脚本 `titleUnderline` 一段（振幅 `A=l.fs*.22`，衰减 `Math.exp(-t*3.2)`）。
- **3D 装置交互**：`machine3d.js`，零件按 GLB 里的节点名查找（`Valve_*`、`Slider_Knob`、`Button0-2`、`Joystick_*`、`Tray_*`、`Screen`、`CatBox_*`）。
- **箱子里的小猫**：贴图是 `assets/cat.webp`（睁眼）和 `assets/cat-blink.webp`（闭眼），动画在 `machine3d.js` 里搜索 `cat living in the cardboard box`。

## 外部依赖（CDN）

- GSAP 3.12.5 + ScrollTrigger（cdnjs）：滚动进场动画
- three.js 0.147.0 + GLTFLoader（jsdelivr）：3D 装置
- Google Fonts：Bricolage Grotesque、Noto Sans SC

视频建议压到单个 15MB 以内；GitHub 单文件上限 100MB。
