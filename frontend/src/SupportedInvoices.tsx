// 支援的三種發票：在投放區裡畫出它們的外形，讓人放之前就能比對「手上這張能不能放」
// 只是示意圖，不是真的發票；線條用灰階色塊代表文字，深色代表號碼和總計

// 圖裡用到的顏色（和 Tailwind 的 slate 灰階相同）
const PAPER = "#ffffff";
const EDGE = "#94a3b8"; // 紙張外框、店名
const LINE = "#e2e8f0"; // 一般文字
const RULE = "#cbd5e1"; // 表格線、虛線
const INK = "#475569"; // 號碼、總計（比較重要的字）

// 三種發票（名稱與稅額編碼和後端 prompt.py 一致）
const KINDS = [
  { name: "三聯式統一發票", format: 21, hint: "表格式，有買受人統編", Drawing: TripleForm },
  { name: "收銀機統一發票（三聯）", format: 25, hint: "收銀機印的，有品項明細", Drawing: CashierReceipt },
  { name: "二聯式收銀機發票", format: 22, hint: "窄長熱感紙，通常只有總計", Drawing: ThermalStrip },
];

export default function SupportedInvoices() {
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-12 gap-y-6">
      {KINDS.map(({ name, format, hint, Drawing }) => (
        <div key={format} className="flex min-w-0 flex-col items-center">
          <Drawing />
          <p className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm font-medium text-slate-800">
            {name}
            <span className="rounded bg-slate-100 px-1.5 font-mono text-xs font-normal text-slate-500">{format}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        </div>
      ))}
    </div>
  );
}

// 一條代表文字的圓角色塊
function Bar({ x, y, w, h = 5, fill = LINE }: { x: number; y: number; w: number; h?: number; fill?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx="2" fill={fill} />;
}

// 三聯式：表格式的表單，後面疊著另外兩聯（複寫紙）
function TripleForm() {
  return (
    <svg width="196" height="150" viewBox="0 0 196 150" aria-hidden="true" className="max-w-full">
      <rect x="14" y="2" width="178" height="128" rx="2" fill="#f1f5f9" stroke={RULE} />
      <rect x="8" y="8" width="178" height="128" rx="2" fill="#f8fafc" stroke={RULE} />
      <rect x="2" y="14" width="178" height="132" rx="2" fill={PAPER} stroke={EDGE} />
      <Bar x={62} y={24} w={58} h={7} fill={EDGE} />
      <Bar x={14} y={40} w={44} />
      <Bar x={118} y={40} w={50} h={6} fill={INK} />
      <Bar x={14} y={51} w={64} />
      {/* 品項表格 */}
      <rect x="14" y="64" width="154" height="58" fill="none" stroke={RULE} />
      <line x1="14" y1="76" x2="168" y2="76" stroke={RULE} />
      <line x1="14" y1="88" x2="168" y2="88" stroke={LINE} />
      <line x1="14" y1="100" x2="168" y2="100" stroke={LINE} />
      <line x1="14" y1="110" x2="168" y2="110" stroke={RULE} />
      <line x1="84" y1="64" x2="84" y2="122" stroke={LINE} />
      <line x1="112" y1="64" x2="112" y2="122" stroke={LINE} />
      <line x1="138" y1="64" x2="138" y2="122" stroke={LINE} />
      <Bar x={144} y={113} w={20} fill={INK} />
      <Bar x={14} y={130} w={70} />
    </svg>
  );
}

// 收銀機統一發票（三聯）：中等長度，列出品項
function CashierReceipt() {
  const items = [88, 99, 110]; // 三行品項的高度位置
  return (
    <svg width="104" height="170" viewBox="0 0 104 170" aria-hidden="true" className="max-w-full">
      <rect x="2" y="2" width="100" height="166" rx="2" fill={PAPER} stroke={EDGE} />
      <Bar x={24} y={14} w={56} h={7} fill={EDGE} />
      <Bar x={30} y={27} w={44} />
      <Bar x={18} y={42} w={68} h={7} fill={INK} />
      <Bar x={14} y={56} w={50} />
      <Bar x={14} y={66} w={62} />
      <line x1="12" y1="80" x2="92" y2="80" stroke={RULE} strokeDasharray="3 3" />
      {items.map((y, i) => (
        <g key={y}>
          <Bar x={14} y={y} w={[46, 54, 40][i]} />
          <Bar x={72} y={y} w={18} />
        </g>
      ))}
      <line x1="12" y1="124" x2="92" y2="124" stroke={RULE} strokeDasharray="3 3" />
      <Bar x={14} y={132} w={30} />
      <Bar x={62} y={131} w={28} h={7} fill={INK} />
      <Bar x={14} y={146} w={30} />
      <Bar x={62} y={146} w={28} />
    </svg>
  );
}

// 二聯式收銀機發票：窄長的熱感紙，底部是撕下來的鋸齒邊
function ThermalStrip() {
  // 鋸齒：從右下角往左，每 5.5 單位上下一次
  const teeth = Array.from({ length: 12 }, (_, i) => `l-5.5 ${i % 2 === 0 ? 6 : -6}`).join(" ");
  const barcode = [[14, 2], [19, 1], [23, 3], [29, 1], [33, 2], [38, 1], [42, 3], [48, 1], [52, 2]];
  return (
    <svg width="70" height="188" viewBox="0 0 70 188" aria-hidden="true" className="max-w-full">
      <path d={`M2 2 H68 V180 ${teeth} Z`} fill={PAPER} stroke={EDGE} />
      <Bar x={14} y={14} w={42} h={6} fill={EDGE} />
      <Bar x={18} y={26} w={34} />
      <Bar x={10} y={40} w={50} h={7} fill={INK} />
      <Bar x={10} y={54} w={40} />
      <Bar x={10} y={64} w={34} />
      <line x1="8" y1="78" x2="62" y2="78" stroke={RULE} strokeDasharray="3 3" />
      <Bar x={10} y={86} w={30} />
      <Bar x={46} y={86} w={14} />
      <Bar x={10} y={97} w={36} />
      <Bar x={46} y={97} w={14} />
      <line x1="8" y1="111" x2="62" y2="111" stroke={RULE} strokeDasharray="3 3" />
      <Bar x={10} y={119} w={20} />
      <Bar x={36} y={118} w={24} h={7} fill={INK} />
      {/* 條碼 */}
      <rect x="10" y="138" width="50" height="22" fill="none" stroke={LINE} />
      {barcode.map(([x, w]) => (
        <rect key={x} x={x} y="142" width={w} height="14" fill={RULE} />
      ))}
    </svg>
  );
}
