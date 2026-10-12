# M2 物種

> 截止：10/15（四）上課前 15:30
> 這一站在做什麼、怎麼做、卡住看哪裡，都在課程頁：<https://course.interaction.tw/oop/#milestones>

> 這一站是**報告站**：每個人上台三分鐘，簡報一律轉成 PDF 放這個資料夾。

在你的世界裡長出站得住腳的物種，並讓牠第一次動起來。

## 這一站要交的四件套

- [x] 程式碼：會動的雛形（`index.html` 與 `sketch.js`）
- [x] 截圖或影片：牠動起來的樣子
- [ ] 反思：下面那段，一百到兩百字，自己寫
- [x] AI 揭露欄：下面的表格
- [ ] 簡報 PDF：檔名 `m2-簡報.pdf`，放這個資料夾裡；物種設定書五欄也放這裡

### 物種動態影片展示

<video src="m2-creature.mp4" controls width="100%"></video>

> 🎬 **影片檔案**：[點此在 GitHub 開啟／預覽物種動態影片 (`m2-creature.mp4`)](m2-creature.mp4)

## 反思

（一百到兩百字，自己寫，AI 不代寫：你這一站做了什麼、卡在哪、怎麼解的、下一站想改什麼。）

## AI 揭露欄

| 項目 | 內容 |
|------|------|
| 工具 | agy／Claude Code (Blender MCP)／ChatGPT |
| 日期 | 10／6～10／15 |
| prompt 摘要 | 1. 用 ChatGPT 彙整物種文字與結構設定，整理成給 Claude 的執行提示詞。<br>2. 透過 Claude 串接 Blender MCP 進行物種 3D 幾何方塊建模與動畫產出。<br>3. 請 Claude 將動畫轉寫為 p5.js WEBGL 網頁版，加入賽博龐克與未來感風格、游標互動與響應式設計，完成 sketch.js。<br>4. 遇 Claude 額度上限，將程式進度與提示詞無縫轉交 ChatGPT，接力完成 index.html 與 style.css。<br>5. 透過 agy 進行程式檢驗、專案架構防護與 Git / GitHub 推送發布。 |
| 採用範圍 | **AI 工具分工與協作：**<br>1. **ChatGPT**：負責前期需求文字結構化；於後期接力產出 index.html 與 style.css 介面。<br>2. **Claude + Blender MCP**：負責 3D 骨架建模動畫，並轉寫出 p5.js (sketch.js) 逆向運動學與行為狀態邏輯。<br>3. **agy**：負責專案檔案防護、本機程式碼檢視與 Git 版本管理推送。<br><br>**由我主導流程與驗收：**<br>1. 規劃賽博龐克生物的整體風格與「游標追蹤／點擊驚嚇」互動走向。<br>2. 跨模型調度決策（在 Claude 額度耗盡時，精準將 context 與 code 轉交 ChatGPT 續寫）。<br>3. 本機各階段驗證互動流暢度、錄製操作影片並維護交付成果。 |

## 課前準備與物種日誌

過程中的筆記、查到的資料、想到一半的點子，寫在這個資料夾的 `notes.md`（需要時自己建，格式自由）。
