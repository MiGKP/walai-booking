'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Ticket } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import { PromoVoucher, PromoBookingLinks } from '@/components/promotions/PromoVoucher';
import {
  walletStatusLabel,
  type WalletPromo,
  type WalletStatus,
} from '@/lib/promotions';
import toast from 'react-hot-toast';

type FilterTab = 'saved' | 'used' | 'expired';

export default function CouponsPage(): React.ReactElement | null {
  const { ready, user } = useAuthGuard({ allowedRoles: ['customer'] });
  const [wallet, setWallet] = useState<WalletPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('saved');
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadWallet = useCallback(async (): Promise<void> => {
    try {
      const res = await api.get<{ data: WalletPromo[] }>('/promotions/mine');
      setWallet(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'โหลดคูปองไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void loadWallet();
  }, [ready, loadWallet]);

  const grouped = useMemo(() => {
    const buckets: Record<FilterTab, WalletPromo[]> = {
      saved: [],
      used: [],
      expired: [],
    };
    for (const item of wallet) {
      const status: WalletStatus =
        item.status === 'used' || item.status === 'expired' ? item.status : 'saved';
      buckets[status].push(item);
    }
    return buckets;
  }, [wallet]);

  const visible = grouped[filter];

  const handleRemove = async (promotionId: number): Promise<void> => {
    setRemovingId(promotionId);
    try {
      await api.delete(`/promotions/${promotionId}/collect`);
      toast.success('เอาคูปองออกจากกระเป๋าแล้ว');
      await loadWallet();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'เอาออกไม่สำเร็จ'));
    } finally {
      setRemovingId(null);
    }
  };

  if (!ready || !user) return null;

  return (
    <div className="min-h-screen bg-[#FDFBF7] pt-16">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-medium text-forest-900">คูปองของฉัน</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            คูปองที่เก็บไว้ ใช้ตอนจองห้องพักหรือเรือคายัค
          </p>
        </div>

        <DashboardTabs />

        <div className="mb-5 flex gap-2">
          {(
            [
              { id: 'saved', label: 'พร้อมใช้', count: grouped.saved.length },
              { id: 'used', label: 'ใช้แล้ว', count: grouped.used.length },
              { id: 'expired', label: 'หมดอายุ', count: grouped.expired.length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={
                filter === tab.id
                  ? 'rounded-full bg-forest-800 px-3 py-1.5 text-xs font-semibold text-cream-100'
                  : 'rounded-full bg-stone-200/80 px-3 py-1.5 text-xs font-semibold text-charcoal-500'
              }
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((key) => (
              <div key={key} className="h-32 animate-pulse rounded-[22px] bg-stone-200/60" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <Ticket size={40} className="mx-auto text-stone-300" />
            <p className="mt-4 text-charcoal-500">
              {filter === 'saved' ? 'ยังไม่มีคูปองในกระเป๋า' : 'ยังไม่มีรายการในหมวดนี้'}
            </p>
            {filter === 'saved' ? (
              <Link href="/promotions" className="btn-primary mt-5 inline-flex">
                ไปเก็บคูปอง
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-4">
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
                        <PromoBookingLinks
                          code={item.code}
                          appliesTo={item.applies_to}
                          roomLabel="ใช้กับห้องพัก"
                          kayakLabel="ใช้กับเรือ"
                        />
                        <button
                          type="button"
                          className="text-xs font-medium text-charcoal-400 hover:text-red-600"
                          disabled={removingId === item.promotion_id}
                          onClick={() => {
                            void handleRemove(item.promotion_id);
                          }}
                        >
                          เอาออก
                        </button>
                        {item.remaining != null ? (
                          <span className="ml-auto text-xs text-charcoal-400">
                            เหลือ {item.remaining} ครั้ง
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <Link href="/promotions" className="text-sm font-medium text-forest-800">
                        ดูคูปองอื่น
                      </Link>
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
