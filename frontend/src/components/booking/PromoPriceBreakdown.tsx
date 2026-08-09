'use client';

interface PromoPriceBreakdownProps {
  basePrice: number;
  promo: {
    code?: string;
    name: string;
    discount_amount: number;
    final_price: number;
  } | null;
  className?: string;
}

/** แสดงราคาเต็ม → โค้ด/ส่วนลด → ราคาที่ต้องจ่าย */
export default function PromoPriceBreakdown({
  basePrice,
  promo,
  className = '',
}: PromoPriceBreakdownProps): React.ReactElement {
  const payAmount = promo ? promo.final_price : basePrice;

  return (
    <div className={`space-y-2 text-sm ${className}`}>
      <div className="flex items-center justify-between text-charcoal-500">
        <span>ราคาเต็ม</span>
        <span className="tabular-nums font-medium text-charcoal-700">
          ฿{basePrice.toLocaleString()}
        </span>
      </div>

      {promo && (
        <>
          <div className="flex items-center justify-between text-charcoal-500">
            <span>โค้ดส่วนลด</span>
            <span className="font-mono text-xs font-semibold text-forest-800">
              {promo.code || promo.name}
            </span>
          </div>
          <div className="flex items-center justify-between text-emerald-700">
            <span>ส่วนลด</span>
            <span className="tabular-nums font-medium">
              -฿{promo.discount_amount.toLocaleString()}
            </span>
          </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-stone-200 pt-3">
        <span className="font-semibold text-forest-900">ราคาที่ต้องจ่าย</span>
        <span className="font-display text-xl font-bold tabular-nums text-forest-900">
          ฿{payAmount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
