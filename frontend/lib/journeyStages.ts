// Data Journey stage definitions — 11 steps through the full analytics pipeline

export interface JourneyStage {
  id: string
  title: string
  subtitle: string
  description: string
  path: string
  selector: string
  placement: 'top' | 'bottom' | 'left' | 'right'
}

export const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: 'raw-data',
    title: '原始交易資料',
    subtitle: '541,909 筆交易 · 兩年時間 · 一個真實的英國零售商',
    description: '2009 年 12 月到 2011 年 12 月，每一筆商品的售出都被記錄下來。這是分析的起點——但原始資料還很粗糙：有退貨、有空值、有異常。它像一部未剪輯的影片，需要有人告訴它，哪些畫面是真正有用的。',
    path: '/',
    selector: '[data-tour="kpi-strip"]',
    placement: 'bottom',
  },
  {
    id: 'cleaning',
    title: '資料清理過濾',
    subtitle: '541,909 → 397,924 筆（移除 27% 無效資料）',
    description: '143,985 筆記錄被過濾掉。退貨單代表客戶不滿意；空白客戶 ID 代表匿名交易無從追蹤；負數量是庫存調整記錄，不是真實購買。清洗不只是技術步驟——它定義了「什麼樣的交易算是有意義的客戶行為」。',
    path: '/',
    selector: '[data-tour="monthly-chart"]',
    placement: 'top',
  },
  {
    id: 'rfm',
    title: 'RFM 特徵計算',
    subtitle: '三個數字，精準描述一位客戶',
    description: 'Recency 問「他上次買東西是幾天前？」——越近越好；Frequency 問「他總共來了幾次？」——越多越忠誠；Monetary 問「他總共花了多少錢？」——越多越有價值。這三個維度的組合，是過去 50 年客戶分析最重要的框架。',
    path: '/customers',
    selector: '[data-tour="rfm-scatter"]',
    placement: 'right',
  },
  {
    id: 'segmentation',
    title: 'K-Means 客戶分群',
    subtitle: '四個群體 · 各需不同的對待方式',
    description: '演算法在 RFM 空間中找到了四個自然聚集的群體。Champions 近期買、常常買、花很多——他們是你最重要的資產；At Risk 曾是好客戶，現在安靜了——他們需要被挽留；Lost 已經超過半年沒有出現——他們可能已經去了競爭對手那裡。',
    path: '/customers',
    selector: '[data-tour="segment-dist"]',
    placement: 'bottom',
  },
  {
    id: 'cohort',
    title: '同期群留存分析',
    subtitle: '第一個月留存 23% → 第五個月 8%',
    description: '把同一個月第一次購買的客戶放在一起觀察——他們下個月還會回來嗎？六個月後呢？留存熱力圖的每一個格子都是一個答案，而那些顏色快速褪去的行，告訴你客戶流失的速度比你想像的更快。',
    path: '/cohort',
    selector: '[data-tour="cohort-heatmap"]',
    placement: 'top',
  },
  {
    id: 'basket',
    title: '購物籃關聯分析',
    subtitle: 'Apriori 演算法 · 88 條規則 · lift 最高 3.2×',
    description: '「買了 A 的人，也買了 B」——這不只是 Amazon 的秘密，它有一個數學名字叫 lift。當 lift > 3，代表這兩樣商品一起出現的頻率是隨機情況的 3 倍以上。這 88 條規則，是你的商品擺放、套裝銷售和主動推薦的地圖。',
    path: '/basket',
    selector: '[data-tour="basket-scatter"]',
    placement: 'top',
  },
  {
    id: 'churn',
    title: '流失預測（MLP）',
    subtitle: '提前知道誰要離開',
    description: '流失不是突然發生的，它留有痕跡：Recency 開始拉長、購買頻率下降。MLP 分類器從這些模式中學習，為每位客戶計算一個「未來 180 天內流失」的機率。知道誰快要離開，你才能在他離開之前遞出那封個人化的挽留信件。',
    path: '/ml-insights',
    selector: '[data-tour="churn-table"]',
    placement: 'top',
  },
  {
    id: 'forecast',
    title: '時序銷售預測',
    subtitle: '三個模型，各有擅長',
    description: '如果知道下個月的收入，你會做不同的採購決策嗎？SARIMA 擅長捕捉週期性波動，ETS 自動適應季節強度，LSTM 學習長期序列依賴。三個模型的預測分歧最小的時段，是我們最有把握的部分；分歧最大的，是未知風險所在。',
    path: '/forecast',
    selector: '[data-tour="forecast-chart"]',
    placement: 'top',
  },
  {
    id: 'recommendations',
    title: '個人化推薦引擎',
    subtitle: 'Collaborative Filtering + Thompson Sampling Bandit',
    description: '協作過濾找出「品味相近的客戶群」並推薦他們喜歡但你還沒看過的商品。Thompson Sampling Bandit 則在多個推薦策略之間即時分配流量——在真實數據中學習哪個演算法表現最好，而不需要等一個月的 A/B 測試結果。',
    path: '/recommendations',
    selector: '[data-tour="rec-tabs"]',
    placement: 'bottom',
  },
  {
    id: 'ab-test',
    title: 'A/B 測試驗證',
    subtitle: '用統計學確認「改進不是巧合」',
    description: '有個想法：「換一種推薦演算法，轉換率會提升嗎？」但直覺不可靠。A/B 測試把用戶隨機分成兩組，讓資料說話。Z-test 計算這個差異「純屬偶然」的機率（p-value）。當 p < 0.05，我們才說：這個改進是真實的，不是運氣。',
    path: '/ab-testing',
    selector: '[data-tour="experiment-list"]',
    placement: 'right',
  },
  {
    id: 'insights',
    title: '商業洞察匯總',
    subtitle: '從一張原始表格，到 11 個可部署的模型',
    description: '這條管線從一份 CSV 出發，回答了六個業務問題：誰是最有價值的客戶？誰快要流失？下個月的收入是多少？什麼商品應該一起推薦？哪種推薦策略在實戰中最好？新功能帶來的提升是否真實？每個問題，都有一個可以呼叫的 API 端點。',
    path: '/',
    selector: '[data-tour="model-status"]',
    placement: 'top',
  },
]
