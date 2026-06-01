# CHANGELOG

## 2026-06-01
- **fix: ch4 幽灵传送门触发时机**：幽灵通讯入口改为在玩家看完 ch4_recover 所有消息后才出现。`ChatEngine.js` 新增：ch4_recover 段落完成时写 `ch4_recover_complete` 到 localStorage；`MainPage.js` 改为检查此标记（原来检查 `chat_last_played >= 4` 会在段落开始时就触发）；`GameState.reset()` 同步清除该 key。

## 2026-05-31
- **修复关键词虚线位置**：`RichText.js` 将下划线 Y 偏移从 `fontSize * 0.95` 改为 `fontSize * 1.1`，解决移动端浏览器中虚线出现在词语中间而非底部的问题（原因：移动端 `textBaseline='top'` 的字形留白与桌面端不同）
- **修复键盘弹出压缩页面**：`game.js` 中 `_updateCanvasHeight` 新增保护——高度缩减超过 25% 时（键盘弹出）不更新 `canvas.style.height`，避免整个画面被压扁
- **修复移动端键盘弹不出**：`EditBox.js` 将 `setTimeout(() => input.focus(), 50)` 改为同步调用 `input.focus()`，满足 iOS Safari 要求 focus 在用户手势同步链内的约束；同时将隐藏 input 的 `font-size` 固定为 16px（防 iOS 自动缩放），视觉字号通过 `transform: scale` 补偿
- **修复证据板搜索框 overlay 位置**：`EvidencePage.js` 为 `_searchEditBox` 设置正确的 x/y，使透明 HTML input 叠在画面搜索框上方而非左上角
