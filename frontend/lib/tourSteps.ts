export interface TourStep {
  id: string
  title: string
  content: string
  selector: string
  placement: 'top' | 'bottom' | 'left' | 'right'
}

export const PAGE_TOURS: Record<string, TourStep[]> = {
  '/': [
    {
      id: 'kpi',
      title: '業務 KPI 總覽',
      content: '2009–2011 年，這家英國線上零售商留下了 541,909 筆完整的交易記錄。四個數字概括了全部：£891萬總營收、4,338 位活躍客戶、25,900 張發票、£344 平均客單價。每一個數字背後，都是一位真實客戶的購買決策。',
      selector: '[data-tour="kpi-strip"]',
      placement: 'bottom',
    },
    {
      id: 'revenue',
      title: '月收入趨勢',
      content: '這條曲線說了一件有趣的事：每年 11–12 月，收入飆升至平日的 2–3 倍。這是聖誕季的採購熱情，被資料完整記錄下來了。問題是：如何提前預測它、備好庫存？這就是為什麼我們需要時序預測模型。',
      selector: '[data-tour="monthly-chart"]',
      placement: 'top',
    },
    {
      id: 'countries',
      title: '市場地理分布',
      content: '82% 的收入來自英國本土，18% 來自德國、法國、荷蘭等歐洲市場。這張圖說明兩件事：現有業務的護城河在英國，但增長機會在哪裡？那些黯淡的柱子，可能是下一個戰場。',
      selector: '[data-tour="country-chart"]',
      placement: 'top',
    },
    {
      id: 'models',
      title: '已訓練 ML 模型狀態',
      content: '這個平台為了回答不同的業務問題，訓練了 11+ 個模型，覆蓋 6 種 ML 範式。監督學習問「誰會流失」；非監督問「誰是異常客戶」；時序模型問「下個月賣多少」；強化學習問「哪種推薦策略最好」。每種範式解決不同問題。',
      selector: '[data-tour="model-status"]',
      placement: 'top',
    },
  ],
  '/customers': [
    {
      id: 'insight',
      title: '動態分析解說',
      content: '這不是寫死的文案——這句話是系統在載入完資料後，即時計算出來的。它正在告訴你：此刻有多少位「曾是好客戶但已沉默」的人，以及他們佔了多少比例的收入。這個數字，直接決定了客戶挽回行動的優先順序。',
      selector: '[data-tour="customer-insight"]',
      placement: 'bottom',
    },
    {
      id: 'segments',
      title: 'RFM 分群分布',
      content: 'K-Means 把 4,338 位客戶分成了四個真實的「人群」。Champions 是你的 VIP：他們可能只佔 20% 的人數，卻貢獻了超過 60% 的營收。At Risk 那群曾經很活躍，但已超過 90 天沒有回來——他們正在悄悄離開。',
      selector: '[data-tour="segment-dist"]',
      placement: 'bottom',
    },
    {
      id: 'scatter',
      title: 'RFM 互動散佈圖',
      content: '這張圖讓每位客戶變成一個可以觸碰的點。X 軸越靠左，表示最近才購買；Y 軸越高，表示買得越頻繁；顏色代表分群。點擊任何一個點，右側面板會展開這位客戶的完整分析：RFM 分數、預估終身價值、推薦商品。',
      selector: '[data-tour="rfm-scatter"]',
      placement: 'right',
    },
    {
      id: 'list',
      title: '客戶清單',
      content: '篩選框讓你立刻縮小範圍，例如只看「At Risk」的客戶。點開任一行，看到他的詳細 RFM 評分——R 分低代表很久沒買、F 分低代表購買頻率下降。這些訊號組合起來，就是一份可以採取行動的流失預警清單。',
      selector: '[data-tour="customer-list"]',
      placement: 'top',
    },
  ],
  '/cohort': [
    {
      id: 'kpi',
      title: '同期群 KPI',
      content: '留存率是業務健康最誠實的指標，因為它沒辦法被行銷活動短暫美化。M1（首月）留存率代表：首次購買後，第二個月有多少比例的客戶回來了？業界電商優秀標準通常在 20–40%。這裡的數字，正是你真實的產品黏性。',
      selector: '[data-tour="cohort-kpi"]',
      placement: 'bottom',
    },
    {
      id: 'heatmap',
      title: '月度留存熱力圖',
      content: '讀法：每一行是一批「同期加入的客戶群」（按首購月份），每一欄是他們加入後第 N 個月的回購率。顏色越深越綠，留存越好。右下角的空白格代表那個時間段還沒到來——不是 0，是「未來」。',
      selector: '[data-tour="cohort-heatmap"]',
      placement: 'top',
    },
    {
      id: 'trend',
      title: 'M1 留存趨勢折線圖',
      content: '這條折線追蹤了每一批新客的首月回購表現，橫跨整個 14 個月的資料集。如果線條持續上升，代表產品或服務體驗正在改善；如果某個月突然下滑，那個月可能發生了什麼值得追查的事件。',
      selector: '[data-tour="m1-trend"]',
      placement: 'top',
    },
  ],
  '/basket': [
    {
      id: 'kpi',
      title: '關聯規則摘要',
      content: 'Apriori 演算法在 25,900 筆發票中，挖掘出 88 條有意義的購物共現規律。最高 Lift 值超過 40——代表這兩件商品同時被購買的機率，是純隨機情況的 40 倍。這就是「買了A通常也會買B」最強有力的統計佐證。',
      selector: '[data-tour="basket-kpi"]',
      placement: 'bottom',
    },
    {
      id: 'filters',
      title: '關聯規則篩選器',
      content: '調高 min_lift 閾值，只保留最強關聯；搜尋特定商品，找到它通常與哪些商品一起被購買。這些規則可以直接轉換成促銷方案文案或商品擺放決策，從資料到行動之間只差一個業務人員。',
      selector: '[data-tour="basket-filters"]',
      placement: 'bottom',
    },
    {
      id: 'scatter',
      title: 'Lift 分佈散點圖',
      content: '右上角的大點是最有價值的規則：出現頻率高（高支持度）、關聯強（高信心度）、遠超隨機（大 Lift）。它們就是你的首選「套裝銷售」候選名單，也是電商首頁推薦位的最佳素材。',
      selector: '[data-tour="basket-scatter"]',
      placement: 'top',
    },
    {
      id: 'table',
      title: '關聯規則明細表',
      content: '每一行是一條可執行的商業規則：「買了這些商品 → 很可能也想要這個」。按 Lift 排序找最強關聯；按 Support 排序找最廣泛適用的組合。每條規則都附有可信度數值，幫助你判斷力度。',
      selector: '[data-tour="basket-table"]',
      placement: 'top',
    },
  ],
  '/recommendations': [
    {
      id: 'tabs',
      title: '三種推薦模式',
      content: '三種推薦策略，各自解決不同問題。ALS 協同過濾問：「哪些客戶品味相似，他們買了什麼？」SBERT 語意搜尋問：「這個商品描述在語義空間裡有哪些近鄰？」Thompson Sampling 問：「在真實流量中，哪種策略的實際效果最好？」',
      selector: '[data-tour="rec-tabs"]',
      placement: 'bottom',
    },
    {
      id: 'bandit',
      title: 'Thompson Sampling Bandit 統計',
      content: 'Thompson Sampling 是一種優雅的「探索與利用」機制：5 種策略各自維護一個 Beta(α,β) 信念分布。每次請求時，從各策略的分布採樣，選最高值者——這讓績效好的策略自然被選得更頻繁，無需任何人工調參。它在自我學習。',
      selector: '[data-tour="rec-bandit"]',
      placement: 'top',
    },
  ],
  '/forecast': [
    {
      id: 'kpi',
      title: '預測 KPI',
      content: '預測未來七天的收入、峰值日期和誤差率（MAPE）。MAPE 37% 看起來不小，但零售時序資料的特性是：節日效應、促銷活動、天氣都會造成巨幅波動。在這個資料集上，37% 已是相當合理的預測精度。',
      selector: '[data-tour="forecast-kpi"]',
      placement: 'bottom',
    },
    {
      id: 'selector',
      title: '模型與時距選擇',
      content: '三個模型代表三種統計哲學：SARIMA 用差分消除趨勢和季節性後做線性預測；ETS 讓資料自己決定要加法還是乘法的季節模式；LSTM 用神經網路記憶長達數月的序列依賴關係。切換模型，看看它們在同一段時間對預測的「意見分歧」有多大。',
      selector: '[data-tour="model-selector"]',
      placement: 'bottom',
    },
    {
      id: 'chart',
      title: '預測圖表 + 信賴區間',
      content: '折線是點預測，陰影帶是 95% 信賴區間。有個反直覺的現象：LSTM 的 MAPE 最低（最準），但信賴區間卻往往最寬（最不確定）。這是深度學習的典型特徵——它很有自信地告訴你一個答案，但不太確定這個答案有多可靠。',
      selector: '[data-tour="forecast-chart"]',
      placement: 'top',
    },
    {
      id: 'mape',
      title: '三模型 MAPE 比較',
      content: '三個模型在相同的歷史保留集（hold-out set）上比較。最低 MAPE 的模型被標記為「最佳」。值得注意：ETS 在這個資料集上往往優於 SARIMA，因為 Holt-Winters 的加法季節分解更適合這類零售週期。',
      selector: '[data-tour="mape-comparison"]',
      placement: 'top',
    },
  ],
  '/ml-insights': [
    {
      id: 'tabs',
      title: 'ML 洞察四大分析',
      content: '四個 Tab，四個不同的機器學習問題。流失預測把「誰會離開？」轉化為分類任務；CLV 把「他值多少錢？」轉化為回歸任務；異常偵測把「誰的行為不尋常？」轉化為重建誤差任務；模型比較則把上述所有答案放在一起接受審視。',
      selector: '[data-tour="ml-tabs"]',
      placement: 'bottom',
    },
    {
      id: 'churn',
      title: '流失風險排名表',
      content: '這份名單是由 MLP 分類器自動排序的。排在最前面的，是模型認為「接下來 180 天最可能消失」的客戶。但流失機率高，不代表一定流失——它代表這是一個值得現在就採取行動的信號：一封個人化的 email，一個專屬優惠碼。',
      selector: '[data-tour="churn-table"]',
      placement: 'top',
    },
    {
      id: 'compare',
      title: '四模型比較圖',
      content: '四個分類器在相同資料集上的較量。AUC-ROC 衡量模型是否能正確「排序」高低風險；F1 平衡了精確率與召回率。Decision Tree 可解釋性最高，Random Forest 最穩健，MLP 通常 AUC 最高——不同業務場景需要不同取捨。',
      selector: '[data-tour="model-compare"]',
      placement: 'top',
    },
  ],
  '/ab-testing': [
    {
      id: 'demo',
      title: '一鍵建立示範實驗',
      content: '點擊這裡，10 秒內完成一個完整的 A/B 實驗週期：建立實驗、隨機分配 200 位虛擬用戶到 control（5% 轉換率）和 treatment（8% 轉換率）、批次發送事件、執行 Z-test 統計顯著性分析。真實實驗需要數週，這裡壓縮到 10 秒。',
      selector: '[data-tour="demo-button"]',
      placement: 'bottom',
    },
    {
      id: 'results',
      title: '實驗清單與統計結果',
      content: '左側是你所有實驗的清單，右側是選中實驗的統計解讀。看兩個關鍵數字：p-value < 0.05 代表差異不是運氣；lift > 0 且顯著代表 treatment 組確實更好。這就是「用資料做決策」和「用感覺做決策」最根本的差別。',
      selector: '[data-tour="experiment-list"]',
      placement: 'right',
    },
    {
      id: 'calculator',
      title: 'A/B 實驗模擬器',
      content: '這個模擬器回答 A/B 測試最核心的問題：「我需要跑多久？」把滑桿設成你的每日流量、現有轉換率、期望提升幅度，系統立刻告訴你需要幾天——然後用動畫展示 p-value 如何一天天從 1.0 收斂到 0.05 以下。試試把「每日訪客」往左拖，看看流量少的實驗為什麼要跑那麼久。',
      selector: '[data-tour="sample-calculator"]',
      placement: 'top',
    },
  ],
}
