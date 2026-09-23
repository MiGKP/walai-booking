'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Ticket } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { PromoVoucher, PromoBookingLinks } from '@/components/promotions/PromoVoucher';
import { walletStatusLabel, type WalletPromo, type WalletStatus } from '@/lib/promotions';

type FilterTab = 'saved' | 'used' | 'expired';

// แท็บ "โปรโมชั่นของฉัน" แบบฝังในหน้า dashboard เดียวกัน ไม่ต้องสลับไปหน้า /dashboard/coupons
export default function MyCouponsSection(): React.ReactElement {
  const [wallet, setWallet] = useState<WalletPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('saved');
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadWallet = useCallback(async (): Promise<void> => {
    try {
      const res = await api.get<{ data: WalletPromo[] }>('/promotions/mine');
      setWallet(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'โหลดโปรโมชั่นไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const grouped = useMemo(() => {
    const buckets: Record<FilterTab, WalletPromo[]> = { saved: [], used: [], expired: [] };
    for (const item of wallet) {
      const status: WalletStatus = item.status === 'used' || item.status === 'expired' ? item.status : 'saved';
      buckets[status].push(item);
    }
    return buckets;
  }, [wallet]);

  const visible = grouped[filter];

  const handleRemove = async (promotionId: number): Promise<void> => {
    setRemovingId(promotionId);
    try {
      await api.delete(`/promotions/${promotionId}/collect`);
      toast.success('เอาโปรโมชั่นออกจากกระเป๋าแล้ว');
      await loadWallet();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'เอาออกไม่สำเร็จ'));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            { id: 'saved', label: 'พร้อมใช้', count: grouped.saved.length },
            { id: 'used', label: 'ใช้แล้ว', count: grouped.used.length },
            { id: 'expired', label: 'หมดอายุ', count: grouped.expired.length },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              filter === t.id ? 'bg-forest-900 text-cream-100 shadow-sm' : 'bg-stone-100 text-charcoal-500 hover:bg-stone-200/80'
            }`}
          >
            {t.label} <span className={filter === t.id ? 'text-forest-200/80' : 'text-charcoal-400'}>({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((key) => <div key={key} className="h-32 animate-pulse rounded-2xl bg-stone-100" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl bg-stone-50 py-12 px-4 text-center border border-stone-100/50">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm mb-4">
            <Ticket size={28} className="text-stone-300" />
          </div>
          <h3 className="mb-1 text-base font-bold text-forest-900">
            {filter === 'saved' ? 'กระเป๋าโปรโมชั่นว่างเปล่า' : 'ไม่พบข้อมูล'}
          </h3>
          <p className="mb-6 text-sm text-charcoal-400 max-w-[260px]">
            {filter === 'saved' ? 'คุณยังไม่ได้เก็บโค้ดส่วนลดใดๆ ลองไปดูโปรโมชั่นที่น่าสนใจกันไหม?' : 'ยังไม่มีรายการในหมวดหมู่นี้ที่คุณเลือกดู'}
          </p>
          {filter === 'saved' && (
            <Link href="/promotions" className="rounded-full bg-forest-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-900 shadow-sm">
              ค้นหาโปรโมชั่น
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.promotion_id}>
              <PromoVoucher
                code={item.code}
                name={item.name}
                description={item.description}
                discountType={item.discount_type}
                discountValue={item.discount_value}
                startDate={item.start_date}
                endDate={item.end_date}
                stackable={Boolean(item.stackable)}
                appliesTo={item.applies_to}
                muted={item.status !== 'saved'}
                badge={walletStatusLabel(item.status)}
                footer={
                  item.status === 'saved' ? (
                    <>
                      <PromoBookingLinks code={item.code} appliesTo={item.applies_to} roomLabel="ใช้กับห้องพัก" kayakLabel="ใช้กับเรือ" />
                      <button
                        type="button"
                        className="text-xs font-medium text-charcoal-400 hover:text-red-600"
                        disabled={removingId === item.promotion_id}
                        onClick={() => void handleRemove(item.promotion_id)}
                      >
                        เอาออก
                      </button>
                      {item.remaining != null && (
                        <span className="ml-auto text-xs text-charcoal-400">เหลือ {item.remaining} ครั้ง</span>
                      )}
                    </>
                  ) : (
                    <Link href="/promotions" className="text-sm font-medium text-forest-800">ดูโปรโมชั่นอื่น</Link>
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
