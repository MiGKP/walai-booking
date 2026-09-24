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
  const [boatTicketBalance, setBoatTicketBalance] = useState(0);

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
    api
      .get('/promotions/boat-tickets/mine')
      .then((res) => setBoatTicketBalance(Number(res.data?.data?.total_remaining || 0)))
      .catch(() => {});
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
      {boatTicketBalance > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-bamboo-200 bg-bamboo-50/70 px-4 py-3 text-xs font-medium text-bamboo-800">
          <Ticket size={16} className="shrink-0" />
          <p>คุณมีโปรโมชั่นพายเรือฟรี {boatTicketBalance} ใบ — ใช้ได้ตอนจองเรือที่หน้า <Link href="/kayaks" className="font-bold underline">จองเรือคายัค</Link></p>
        </div>
      )}

      <div className="mb-4 flex gap-2">
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
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === t.id ? 'bg-forest-800 text-cream-100' : 'bg-stone-100 text-charcoal-500 hover:bg-stone-200'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-2xl bg-stone-100" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 py-16 text-center">
          <Ticket size={40} className="mx-auto mb-3 text-stone-300" />
          <p className="mb-4 text-sm text-charcoal-400">
            {filter === 'saved' ? 'ยังไม่มีโปรโมชั่นในกระเป๋า' : 'ยังไม่มีรายการในหมวดนี้'}
          </p>
          {filter === 'saved' && <Link href="/promotions" className="btn-primary">ไปเก็บโปรโมชั่น</Link>}
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
