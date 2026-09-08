# Diagram Design Fly

**让设计师不皱眉的编辑级图表。**

[English](README.md) · 中文 · [在线图库 ↗](https://huangzhuxing.github.io/diagram-design-fly/)

![diagram-design-fly 的工作原理 —— 这个 skill 为自己画的架构动效图](docs/motion/skill-architecture.gif)

*上面这张图是这个 skill 为自己画的架构图，用 `flow` 模式做的动效，再由它自己文档里的那条导出管线渲染成 GIF。全程没有一帧是手工做的。*（[源文件](skills/diagram-design-fly/assets/example-skill-architecture-flow.html) · [MP4](docs/motion/skill-architecture.mp4)）

<details>
<summary><b>试试看 —— 生成这张图的提示词</b></summary>

```text
画一张这个 skill 自身的架构图，用 flow 模式让请求在管线里流动起来。
```
```bash
node scripts/render-video.mjs skills/diagram-design-fly/assets/example-skill-architecture-flow.html --format gif
```
</details>

**这个 fork 新增的是 `flow` 模式。** 真正会流动的管线：物料在管道中移动、光点跨越连接线、接收节点在物料到达时脉冲。纯 CSS、零 JavaScript，底下压着一张完整的静态图。外加一条命令，把任意 flow 图渲染成 MP4、WebM 或 GIF。

![这个 fork 新增了什么 —— 上半部分刻意静止，下半部分在流动](docs/motion/fork-delta.gif)

*两个部分由同一个 skill 绘制。上半部分没有挂 flow 层 —— 这个对比本身就是 changelog。*（[源文件](skills/diagram-design-fly/assets/example-fork-delta-flow.html)）

---

## 一句提示词，一整页架构

这来自一个真实仓库 —— 一个 Go + React 的 SRE 控制台 —— 除了装好 skill 之外没有任何额外配置。完整的提示词就是：

```text
将当前的项目架构详细描述出来
```

没提动效、没指定图型、没说版面、没给配色。

![OpsPilot 运行时架构 —— 浏览器运行时、Go 服务进程、状态与持久化三层，请求在其间流动](docs/motion/real-example-opspilot.gif)

它读了代码库，返回的是一整页三张图：这张运行时总览、一张 Go 模块依赖图、一张圆桌变更状态机，外加接口与数据边界、部署方式与分层。**`flow` 模式是它自己选的**，因为这个主题承载了顺序。

真正值得注意的是它**没画什么**。为了守住密度预算，它把 5 个前端视图和 5 个领域服务各自合并成单个节点；并且刻意没有把真实连接器、IAM 审批、真实命令执行器、持久化任务队列、图/向量数据库画成现有能力 —— 因为那些是规划中的，不是已建成的。虚线框和图例把「演示或可选路径」明确标为演示。**一张悄悄把路线图升格成架构的图，比没有图更糟。**

这一页通过了 `verify-flow`、`verify-motion`、`lint-render`、`lint-contrast`。`lint-skin` 报了 3 条，全是同一条规则：它的可访问名检查**假设一个文件只有一张 SVG**，而这页有三张，所以保留了三组各自正确且互不冲突的 `<title>` / `<desc>` ID。那是这条规则不适配多图页面，不是产出的缺陷。

源文件与渲染命令：

```bash
node scripts/render-video.mjs docs/examples/opspilot-current-architecture.html --format gif
```

## 这个项目从哪来

这是 [Cathryn Lavery](https://github.com/cathrynlavery) 的
[**diagram-design**](https://github.com/cathrynlavery/diagram-design) 的一个 fork。
39 种图型、整套设计系统、语义模式、以及那套校验体系，**全部是她的工作**。用她自己的话说：

> 每次我需要一张图 —— 架构草图、流程图、一个「什么最重要」的金字塔 —— 我问 Claude，
> 拿回来的是一堆圆角方块，跟网站其它部分格格不入。我要么跟 Figma 搏斗半小时，要么干脆不画了。

> *最高质量的动作通常是删除。* 每个节点都要挣得自己的位置。强调色只留给读者最该先看的那 1–2 个东西。目标密度：4/10。

**这个 fork 加的是** `flow` 模式 —— 为那些主题本身就是「吞吐」的图提供持续运动 —— 以及一条把任意 flow 图渲染成 MP4/WebM/GIF 的视频导出通路。**其余全部是上游的，未作改动。** 如果你不需要动效，请直接用[原版](https://github.com/cathrynlavery/diagram-design)。

---

## 它能做什么

**任何一种图都能动起来。**

![一条数据管线，物料在每条管道中流动](docs/motion/pipeline-flow.gif)

`flow` 是一个**模式**，不是第 40 种图型。同一张架构图、数据流图、环形图或泳道图，会获得管道和行进光点，但不会因此变成另一种图 —— 并且在打印、`prefers-reduced-motion`、PNG 导出时，会退回到底下那张完整的静态图。

**该不该用，判据不是「这是什么图型」，而是「这张图有没有承载一条读者要走的顺序」。** 39 种里有 17 种有：管线、生命周期、循环、跨时间的计划、在列之间流动的工作、向下游分流的量。对这些图，flow 展示方向、[阶段序号](#可选阶段序号)标出起点，两者合起来回答*发生了什么、以什么顺序* —— 而且不需要控制器。

| | |
|---|---|
| **有顺序** —— 上 flow，开序号 | `architecture` `data-flow` `deployment` `dp-integration` `flowchart` `gantt` `high-level` `journey` `kanban` `loop` `medallion` `process` `sequence` `state` `story-map` `swimlane` `timeline` |
| **有方向但无步骤** —— 视情况上 flow，一般不加序号 | `dependency` `fishbone` `it-state` `layers` `nested` `org-chart` `pyramid` `tree` `wardley` |
| **无顺序** —— 不用 flow | `bar` `db-schema` `er` `line` `polar` `quadrant` `radar` `scatter` `treemap` `uml-class` `venn` `dp-security-matrix` |

ER 图里没有东西在流动，柱状图的分类之间也没有顺序可走，在这些图上加动效纯属装饰 —— 而装饰正是这个 skill 的设计哲学明确排除的。

**在这个 fork 里，有顺序的主题默认就是动效，不需要你开口要。** 上游默认静态、把动效当作可选项；这里则相反：只要图承载了顺序，skill 就直接用 `flow` 模式构建并打开阶段序号。

这样做是安全的，因为契约保证了：**一张 flow 图本身就是一张完整的静态图**，上面叠了一层装饰。打印、`prefers-reduced-motion`、`?motion=static`、PNG 导出，全都会解析到与纯静态构建完全相同的那一帧。默认用 flow 是**加了一层，从不减一层**。

无顺序的图型保持静态；图型自己的校验器仍然优先于这张路由表 —— 见 [`flow.md`](skills/diagram-design-fly/references/flow.md) 里的 Sankey 例外。

视频导出仍然是手动的，和 PNG/SVG 同一条规则：skill 会把那行命令告诉你，但不会替你执行。

![一个自增强的内容飞轮，中心是共享的反馈记录](docs/motion/loop.gif)

![一条从采集经清洗、存储到消费的数据管线](docs/motion/data-flow.gif)

**上面这两张不是手写的。** 它们由 Codex（`gpt-5.6-luna`）生成 —— 只给了一段中文提示词，装好这个仓库的 skill，**提示词里没有任何代码**。Codex 自己从 `SKILL.md` 路由到了 `flow.md`，并反复对着 `verify-flow.py` 迭代直到通过。

这次实验揪出了两个真实缺陷，都已修复：

1. **校验器硬编码了 `@keyframes` 的名字**，把 Codex 从更安全的 slug 前缀写法（避免两张图内联同页时全局名冲突）逼回了会冲突的全局名。
2. **没有任何检查确认连接线足够长**。第一版把各阶段排得只隔 12 像素，通过了全部四项校验，而动效根本看不见 —— flow 的全部意义就是看见物料在连接线上移动。

**下面 39 种图型的缩略图里，17 张是动效的** —— 就是上表「有顺序」那一列的全部，每张都是带阶段序号的实时 `flow` 图，由 Codex 对照 `flow.md` 的路由表生成。无顺序的那些保持静态，因为在那里加动效只是装饰。

> `sankey` 在语义上有顺序，却**不能**上 flow：它的 `verify-sankey.py` 靠属性里的几何直接验证「条带宽度 = 标注数值」，为此禁止任何会重绘图形的样式表规则，而 flow 的 `animation` 正是这类规则。**图型自己的校验器优先级高于这张路由表。**

图库里共有 12 张 flow 示例（tab 54–65）：[skill 架构](skills/diagram-design-fly/assets/example-skill-architecture-flow.html) · [fork 差异](skills/diagram-design-fly/assets/example-fork-delta-flow.html) · [动效原理](skills/diagram-design-fly/assets/example-flow-mechanism-flow.html) · [上手流程](skills/diagram-design-fly/assets/example-getting-started-flow.html) · [数据流](skills/diagram-design-fly/assets/example-data-flow-flow.html) · [环形飞轮](skills/diagram-design-fly/assets/example-loop-flow.html) · [架构](skills/diagram-design-fly/assets/example-architecture-flow.html) · [流程图](skills/diagram-design-fly/assets/example-flowchart-flow.html) · [时序](skills/diagram-design-fly/assets/example-sequence-flow.html) · [状态机](skills/diagram-design-fly/assets/example-state-flow.html) · [泳道](skills/diagram-design-fly/assets/example-swimlane-flow.html) · [高层概览](skills/diagram-design-fly/assets/example-high-level-flow.html)

39 种图型本身各有三个静态变体：极简浅色、极简深色、完整编辑版。任意一个都能直接在浏览器打开，**没有构建步骤、没有 JavaScript、没有外部图片依赖**。**在线站点：** [huangzhuxing.github.io/diagram-design-fly](https://huangzhuxing.github.io/diagram-design-fly/) —— 每个 flow 示例都是**实时播放**的，不是录屏，还包含上面那个 OpsPilot 案例。完整的 39 种图型图库在 [`/gallery.html`](https://huangzhuxing.github.io/diagram-design-fly/gallery.html)。离线查看则打开 [`skills/diagram-design-fly/assets/index.html`](skills/diagram-design-fly/assets/index.html)。

---

## 安装

![从仓库到动效图 —— 克隆、装进 Claude Code 或 Codex、提要求、渲染](docs/motion/getting-started.gif)

*01–04 步除了 skill 本身什么都不用装；只有视频导出需要额外依赖。*（[源文件](skills/diagram-design-fly/assets/example-getting-started-flow.html)）

### 最简单的方式：软链

Claude Code 和 Codex 读的是同一个目录，所以一次克隆可以喂给两边：

```bash
git clone https://github.com/huangzhuxing/diagram-design-fly.git ~/code/diagram-design-fly

# Claude Code
ln -s ~/code/diagram-design-fly/skills/diagram-design-fly ~/.claude/skills/diagram-design-fly

# Codex
ln -s ~/code/diagram-design-fly/skills/diagram-design-fly ~/.codex/skills/diagram-design-fly
```

Claude Code 无需重启即可发现；Codex 需要开一个新会话。

因为这个 fork 的 skill 叫 `diagram-design-fly`，它**可以和上游的 `diagram-design` 并存**，互不冲突。

### 插件市场方式

**Claude Code：**

```text
/plugin marketplace add huangzhuxing/diagram-design-fly
/plugin install diagram-design-fly@diagram-design-fly
```

**Codex：**

```bash
codex plugin marketplace add huangzhuxing/diagram-design-fly
codex plugin add diagram-design-fly@diagram-design-fly
```

其它宿主（Factory Droid、Pi、Kiro、OpenCode 等）的安装方式，见[英文 README 的 Install 一节](README.md#install)。

---

## Flow —— 会动的图

`step` 和 `reveal` 讲述一个**有顺序、会结束**的变化。**`flow` 讲的是没有开头也没有结尾的运动** —— 物料穿过管线、请求跨越边界、一个循环在转。用这样的话去提要求，skill 就会路由到这里：

> 「给我画一张我的数据摄取管线的架构图，把数据流动展示出来。」

### 一个机制

![flow 模式的原理 —— 每种 stroke-dashoffset 形态的活体样本](docs/motion/flow-mechanism.gif)

*那张图里的三条样本是**活的**：每一条就是它旁边印着的那行声明。*（[源文件](skills/diagram-design-fly/assets/example-flow-mechanism-flow.html)）

没有 `offset-path`，没有 `<animateMotion>`，没有逐帧 JavaScript，也没有运行时测量几何。**全部是一个动画化的 `stroke-dashoffset`**：

```css
/* 管道 —— 虚线在管子里爬行 */
.flow-stream { stroke-dasharray: 5 9; }                    /* 周期 14 */
@keyframes flow-stream { to { stroke-dashoffset: -70; } }  /* 5 个周期 */

/* 光点 —— 零长度虚线配圆头线帽，就是一个点 */
.flow-token  { stroke-dasharray: 0 var(--token-gap, 1); stroke-linecap: round; }
@keyframes flow-token { to { stroke-dashoffset: 0; } }
```

由此推出两件事，都很关键：

- **它跟随任意路径。** 直线段、正交折线、长贝塞尔曲线，全部由同一条声明驱动，因为虚线是沿着路径自身的长度行进的。头图里那条大 S 形曲线不需要任何特殊处理。
- **当行进距离是虚线周期的整数倍时，循环无缝。** `-70` 除以周期 `14` 恰好是 5。[`verify-flow.py`](scripts/verify-flow.py) 会校验这个算术 —— 算错的话每个周期都会出现一次可见的跳变，而其它任何检查都发现不了。

光点带 `pathLength="1"`，所以无论连接线是 76px 还是 900px，穿越一次都恰好耗时一个周期。**管道刻意不加** —— 归一化会把短连接线切成和长曲线一样多的段数，整张图就失去了统一的节奏。

### 它仍然是一张图

`flow` 是叠在一张完整静态图之上的表现层，而且这一点是**被工具强制的**，不是靠自觉：

| | |
|---|---|
| **零 JavaScript** | 整个模式纯 CSS。没有要审的代码，没有会坏的东西，没有要跑的运行时。 |
| **没有动效也完整** | 删掉整个 flow 层，图依然读得懂。`?motion=static`、打印、`prefers-reduced-motion` 都解析到那一帧。 |
| **有预算** | 8 条连接线、16 个光点、一个时钟、2.5–6 秒周期。flow **共享**静态图的复杂度预算，不是在其之上叠加。 |
| **连接线要够长** | 端到端至少 64 单位。在短桩上虚线和光点会同时铺满整条路径，动效退化成闪烁。 |
| **可校验** | [`verify-flow.py`](scripts/verify-flow.py) 检查预算、相位、归一化和接缝算术；[`test-verify-flow.py`](scripts/test-verify-flow.py) 用 27 种变异攻击标准模板，证明每条规则都还在生效。 |

完整契约见 [`flow.md`](skills/diagram-design-fly/references/flow.md)。从 [`template-flow.html`](skills/diagram-design-fly/assets/template-flow.html) 开始写。

### 可选：阶段序号

![带阶段序号的自增强内容飞轮](docs/motion/loop.gif)

**默认关闭。** 当读者需要猜「该从哪一头开始看」时才打开 —— 折成两行的管线、环形图、分支不明显并行的扇出：

```html
<main data-motion-root data-motion-mode="flow" data-flow-cycle="4.4"
      data-flow-sequence="5">
  <g class="flow-seq" data-seq="1">
    <circle cx="440" cy="68" r="13"/><text x="440" y="68">1</text>
  </g>
```

**它表示阅读顺序，不是时间先后。** flow 没有开头 —— 物料同时存在于每个阶段，第 1 秒和第 100 秒看起来一样。序号说的是*从这里开始读*。如果你要表达的是「先发生这个，再发生那个」，那是 [`animation.md`](skills/diagram-design-fly/references/animation.md) 里的 `step` 模式：它有控制器、会结束、可以停在任意一帧。

徽标位于**基础层**，绝不放进 `data-motion-decorative` —— 序号是**语义**，而装饰层正是打印、`prefers-reduced-motion`、静态导出会删掉的那一层。`verify-flow.py` 强制这一点，外加「要么全有要么全无」的声明、`1..N` 连续、以及 2–9 的上限。

**可以放在节点上，也可以放在线上。** 落在节点角上读作「这是第 3 个阶段」，落在管道中点读作「这是第 3 次交接」。环形和线性链适合后者，扇出适合前者。放在线上时，徽标要排在装饰层**之后**（仍在其外，所以静态帧保留），否则流动的光点会盖住数字。

### 渲染成视频

```bash
cd remotion && npm install          # 只需一次
node scripts/render-video.mjs 你的图.html --format gif
```

`--format` 接受 `gif`、`mp4`、`webm`。本 README 里的所有 GIF 都由 [`render-motion-assets.mjs`](scripts/render-motion-assets.mjs) 产出，它同时也负责告诉你哪个已提交的资产过期了：

```bash
node scripts/render-motion-assets.mjs --check
```

**渲染器不重新实现动画。** 它运行图自己的样式表，然后拨动时钟：

```css
*, *::before, *::after {
  animation-play-state: paused !important;
  animation-delay: calc(var(--flow-delay, 0s) - {t}s) !important;
}
```

`paused` 停表，负的 delay 定位。`calc()` 读的是每个元素自己的 `--flow-delay`，所以**逐元素的相位在定位后依然保持** —— 一条声明了领先 0.5 秒的管道，在视频里依然领先 0.5 秒。

**视频不可能和网页漂移** —— 两者跑的是同一份样式表里的同一组 keyframes，区别只在于谁在推进时间。第 *n* 帧只取决于 *n*，所以同一个源渲染两次的结果完全一致；一个周期天然就是一个无缝循环。

> 实测：渲染两个周期后，第 0 帧与第 120 帧（相隔恰好一个周期）的 PSNR 为 **49.66 dB**（差异纯属 h264 压缩噪声），而对照组半个周期只有 30.52 dB。

细节、格式选择与尺寸建议见 [`video-export.md`](skills/diagram-design-fly/references/video-export.md)。

**写一张 flow 图不需要装这些**。Remotion 只是可选的导出层；HTML 在任何浏览器里都会自己动。

---

## 品牌化 —— 让它像*你的*东西

整套设计系统是可换肤的。所有颜色、字体、token 都在唯一的真相源
[`references/style-guide.md`](skills/diagram-design-fly/references/style-guide.md) 里。

第一次在新项目里画图时，skill 会先停下来问你要不要定制品牌，可以：

- 从你的网站 URL 抓取
- 从已安装的其它 skill 提取
- 从本地设计系统目录提取
- 手动粘贴 token
- 先用默认皮肤
- 载入一个已保存的客户 profile

对比度检查是自动的，产出默认满足可访问性。详见
[`onboarding.md`](skills/diagram-design-fly/references/onboarding.md) 和
[`profiles.md`](skills/diagram-design-fly/references/profiles.md)。

---

## 导入与导出

**从 draw.io / Mermaid 导入：** 把源文件指给 skill，它会**重画** —— 内容不变，换成这套设计系统，尺寸和细节层级按目标场景调整。见
[`import-drawio.md`](skills/diagram-design-fly/references/import-drawio.md) 与
[`import-mermaid.md`](skills/diagram-design-fly/references/import-mermaid.md)。

**导出 PNG / SVG：** 两种格式都只输出图本身（`<svg>` 节点），编辑性外壳（卡片、标题）按设计被丢弃。导出是**手动的** —— 绝不会未经要求就产出文件。见
[`export.md`](skills/diagram-design-fly/references/export.md)。

**导出视频：** 见上面的 [渲染成视频](#渲染成视频)。同样是手动的。

---

## 开发环境

写一张图**什么都不用装** —— 产物就是一个自包含的 HTML 文件。下面是跑仓库自身校验门禁所需的环境：

| | 版本 | 用于 |
|---|---|---|
| **Python** | **3.10+ 必需** | 所有 `scripts/*.py` 门禁。CI 在 Linux/Windows/macOS 上跑 3.11 和 3.12。 |
| **Node** | 18+ | `render-video.mjs`、`render-motion-assets.mjs` |
| **ffmpeg** | 较新版本即可 | GIF 调色板生成 |
| Pillow | 钉住 `12.1.1` | `build-readme-thumbs.py` |
| Playwright + Chromium | 当前版本 | `lint-render.py`、PNG 导出 |

```bash
python3 --version                              # 必须 ≥ 3.10
python3 -m pip install "Pillow==12.1.1" playwright
python3 -m playwright install chromium
cd remotion && npm install                     # 仅视频导出需要
```

**macOS 注意：`/usr/bin/python3` 是苹果自带的 3.9，太旧。** 它会让
`scripts/test-verify-ridgeline.py` 报
`write_text() got an unexpected keyword argument 'newline'`（那是 3.10 才有的 API）。
装一个当前版本（`brew install python@3.13`），并确保它在 `PATH` 上排在 `/usr/bin` 之前。
如果不想重排整个 PATH，在 `~/.local/bin` 放一个软链就够了：

```bash
ln -sfn /opt/homebrew/bin/python3.13 ~/.local/bin/python3
```

`lint-render.py` 值得为它装上 Playwright，尽管它是可选的：**它是唯一检查*渲染后布局*的门禁**，而契约校验器看不见一张「技术上合法但视觉上是错的」图。

完整贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 什么时候*不要*用这个 skill

- 快速的 unicode 示意图 → 用 wiretext
- 罗列一堆东西 → 用表格或列表
- 简单的前后对比 → 用表格
- 只有一个形状的「图」 → 直接写那句话

画之前先问：*读者从这张图里得到的，会比一段写得好的文字更多吗？* 如果不会，就别画。

同理，动效只在「运动本身就是内容」时才用。静态是默认。

---

## 致谢

上游的 **diagram-design** 由 **Cathryn Lavery** 创作 —— [BestSelf.co](https://bestself.co) 创始人，[littlemight.com](https://littlemight.com) 作者。去 [X 上跟她打个招呼](https://x.com/cathrynlavery)，并给[原仓库](https://github.com/cathrynlavery/diagram-design)点个星。

这个 fork 里的 `flow` 模式和 Remotion 视频管线维护在
[huangzhuxing/diagram-design-fly](https://github.com/huangzhuxing/diagram-design-fly)。

MIT。
