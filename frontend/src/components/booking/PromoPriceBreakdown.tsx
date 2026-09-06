'use client';

interface PromoPriceBreakdownProps {
  basePrice: number;
  promo: {
    code?: string;
    name: string;
    discount_amount: number;
    final_price: number;
  } | null;
  lines?: Array<{ code: string; discount_amount: number }>;
  className?: string;
}

/** แสดงราคาเต็ม → โค้ด/ส่วนลด → ราคาที่ต้องจ่าย */
export default function PromoPriceBreakdown({
  basePrice,
  promo,
  lines,
  className = '',
}: PromoPriceBreakdownProps): React.ReactElement {
  const stacked = (lines?.length ?? 0) > 0;
  const discountTotal = stacked
    ? (lines ?? []).reduce((sum, line) => sum + line.discount_amount, 0)
    : promo
      ? promo.discount_amount
      : 0;
  const payAmount = stacked || promo ? Math.max(0, basePrice - discountTotal) : basePrice;
  const displayLines = stacked
    ? (lines ?? [])
    : promo
      ? [{ code: promo.code || promo.name, discount_amount: promo.discount_amount }]
      : [];

  return (
    <div className={`space-y-2 text-sm ${className}`}>
      <div className="flex items-center justify-between text-charcoal-500">
        <span>ราคาเต็ม</span>
        <span className="tabular-nums font-medium text-charcoal-700">
          ฿{basePrice.toLocaleString()}
        </span>
      </div>

      {displayLines.map((line) => (
        <div key={line.code} className="space-y-1">
          <div className="flex items-center justify-between text-charcoal-500">
            <span>โค้ดส่วนลด</span>
            <span className="font-mono text-xs font-semibold text-forest-800">
              {line.code}
            </span>
          </div>
          <div className="flex items-center justify-between text-emerald-700">
            <span>ส่วนลด</span>
            <span className="tabular-nums font-medium">
              -฿{line.discount_amount.toLocaleString()}
            </span>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between border-t border-stone-200 pt-3">
        <span className="font-semibold text-forest-900">ราคาที่ต้องจ่าย</span>
        <span className="font-display text-xl font-bold tabular-nums text-forest-900">
          ฿{payAmount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
