'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { setPostLoginRedirect } from '@/lib/auth-redirect';
import { type CatalogPromo } from '@/lib/promotions';
import { PromoCollectAction, PromoVoucher } from '@/components/promotions/PromoVoucher';
import toast from 'react-hot-toast';

export default function PromotionsPage(): React.ReactElement {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [promos, setPromos] = useState<CatalogPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectingId, setCollectingId] = useState<number | null>(null);

  const loadPromos = useCallback(async (): Promise<void> => {
    try {
      const res = await api.get<{ data: CatalogPromo[] }>('/promotions/active');
      setPromos(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'โหลดคูปองไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPromos();
  }, [loadPromos]);

  const goLogin = (): void => {
    setPostLoginRedirect('/promotions');
    router.push('/auth/login');
  };

  const handleCollect = async (id: number): Promise<void> => {
    setCollectingId(id);
    try {
      await api.post(`/promotions/${id}/collect`);
      toast.success('เก็บคูปองแล้ว');
      await loadPromos();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'เก็บคูปองไม่สำเร็จ'));
    } finally {
      setCollectingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pt-16">
      <header className="border-b border-stone-200/80 bg-gradient-to-b from-stone-100/50 to-[#FDFBF7]">
        <div className="container mx-auto px-4 py-8">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-lagoon-600">
            คูปองส่วนลด
          </span>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-forest-900">
            เก็บคูปองไปใช้ตอนจอง
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-charcoal-500">
            กดเก็บไว้ในกระเป๋าก่อน แล้วเลือกใช้ตอนจองห้องพักหรือเรือคายัค
            โค้ดที่ไม่ต้องเก็บ พิมพ์ตอนชำระได้เลย
          </p>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((key) => (
              <div key={key} className="h-36 animate-pulse rounded-[22px] bg-stone-200/60" />
            ))}
          </div>
        ) : promos.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <Ticket size={40} className="mx-auto text-stone-300" />
            <p className="mt-4 text-charcoal-500">ยังไม่มีคูปองที่เก็บได้ในตอนนี้</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {promos.map((promo) => (
              <li key={promo.id}>
                <PromoVoucher
                  code={promo.code}
                  name={promo.name}
                  description={promo.description}
                  discountType={promo.discount_type}
                  discountValue={promo.discount_value}
                  startDate={promo.start_date}
                  endDate={promo.end_date}
                  stackable={Boolean(promo.stackable)}
                  badge={promo.is_collectible ? 'ต้องเก็บก่อนใช้' : 'พิมพ์ตอนจอง'}
                  footer={
                    <PromoCollectAction
                      loading={collectingId === promo.id}
                      status={promo.wallet_status}
                      isCollectible={Boolean(promo.is_collectible)}
                      isCustomer={user?.role === 'customer'}
                      isAuthenticated={isAuthenticated}
                      onCollect={() => {
                        void handleCollect(promo.id);
                      }}
                      onLogin={goLogin}
                    />
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
