'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket, SlidersHorizontal, X, Star, Sailboat, Home, Check } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { setPostLoginRedirect } from '@/lib/auth-redirect';
import { type CatalogPromo, parseAppliesTo } from '@/lib/promotions';
import { PromoCollectAction, PromoVoucher } from '@/components/promotions/PromoVoucher';
import toast from 'react-hot-toast';

type AppliesFilter = 'all' | 'room' | 'kayak' | 'both';

export default function PromotionsPage(): React.ReactElement {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [promos, setPromos] = useState<CatalogPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectingId, setCollectingId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filters — เฉพาะ "ใช้ได้กับ" เท่านั้น
  const [appliesFilter, setAppliesFilter] = useState<AppliesFilter>('all');

  const loadPromos = useCallback(async (): Promise<void> => {
    try {
      const res = await api.get<{ data: CatalogPromo[] }>('/promotions/active');
      setPromos(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'โหลดโปรโมชั่นไม่สำเร็จ'));
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
      toast.success('เก็บโปรโมชั่นแล้ว');
      await loadPromos();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'เก็บโปรโมชั่นไม่สำเร็จ'));
    } finally {
      setCollectingId(null);
    }
  };

  const filtered = useMemo(() => {
    return promos.filter((p) => {
      const scope = parseAppliesTo(p.applies_to);
      if (appliesFilter !== 'all' && scope !== appliesFilter) return false;
      return true;
    });
  }, [promos, appliesFilter]);

  const activeFiltersCount = [appliesFilter !== 'all'].filter(Boolean).length;

  const resetFilters = (): void => {
    setAppliesFilter('all');
  };

  const FilterPanel = (): React.ReactElement => (
    <div className="space-y-4">
      {/* ใช้ได้กับ */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-forest-800">
          ใช้ได้กับ
        </h3>
        <div className="space-y-1.5">
          {([
            { id: 'all', label: 'ทั้งหมด', icon: Star },
            { id: 'room', label: 'ห้องพัก', icon: Home },
            { id: 'kayak', label: 'เรือคายัค', icon: Sailboat },
            { id: 'both', label: 'ห้องพักและเรือ', icon: Star },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAppliesFilter(id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left transition-all ${
                appliesFilter === id
                  ? 'bg-forest-800 text-cream-100 font-semibold shadow-sm'
                  : 'text-charcoal-500 hover:bg-forest-50 hover:text-forest-800'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              {label}
              {appliesFilter === id && <Check size={13} className="ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {activeFiltersCount > 0 && (
        <button
          type="button"
          onClick={resetFilters}
          className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
        >
          ล้างตัวกรอง
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-cream-100 pb-24 pt-4">
      <div className="container mx-auto px-4 pt-16 sm:pt-20">

        {/* Mobile Filter Toggle */}
        <div className="mb-4 flex items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-charcoal shadow-sm"
          >
            <SlidersHorizontal size={15} />
            ตัวกรอง
            {activeFiltersCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-800 text-[10px] font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <span className="text-sm text-charcoal-400">{filtered.length} รายการ</span>
          {activeFiltersCount > 0 && (
            <button type="button" onClick={resetFilters} className="ml-auto text-xs font-semibold text-red-500">
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* Mobile Filter Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <div className="relative ml-auto h-full w-[280px] overflow-y-auto bg-white p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-charcoal">ตัวกรอง</h2>
                <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-full p-1.5 hover:bg-stone-100">
                  <X size={18} className="text-charcoal-400" />
                </button>
              </div>
              <FilterPanel />
            </div>
          </div>
        )}

        <div className="flex gap-8">
          {/* Left Sidebar — Desktop */}
          <aside className="hidden w-52 shrink-0 md:block">
            <div className="sticky top-28 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(18,60,48,0.02),0_8px_24px_-8px_rgba(18,60,48,0.08)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                  <SlidersHorizontal size={14} className="text-forest-600" />
                  ตัวกรอง
                </h2>
                {activeFiltersCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-800 text-[10px] font-bold text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              <FilterPanel />
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Result count + active chips */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <p className="text-sm text-charcoal-400">
                {filtered.length} รายการ
              </p>
              {appliesFilter !== 'all' && (
                <span className="flex items-center gap-1 rounded-full border border-forest-100 bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-700">
                  {appliesFilter === 'room' ? 'ห้องพัก' : appliesFilter === 'kayak' ? 'เรือ' : 'ทั้งคู่'}
                  <button type="button" onClick={() => setAppliesFilter('all')} className="text-forest-400 hover:text-red-500">
                    <X size={10} />
                  </button>
                </span>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((key) => (
                  <div key={key} className="h-40 animate-pulse rounded-2xl bg-stone-200/60" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-8 py-20 text-center">
                <Ticket size={40} className="mx-auto mb-3 text-stone-300" />
                <p className="font-display text-base text-charcoal-400">ไม่พบโปรโมชั่นที่ตรงเงื่อนไข</p>
                <button type="button" onClick={resetFilters} className="btn-primary mt-5 px-6 py-2 text-sm">ล้างตัวกรอง</button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filtered.map((promo) => (
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
                      appliesTo={promo.applies_to}
                      minNights={promo.min_nights}
                      maxDiscount={promo.max_discount}
                      boatTicketCount={promo.boat_ticket_count}
                      boatAddonMode={promo.boat_addon_mode}
                      footer={
                        <PromoCollectAction
                          code={promo.code}
                          loading={collectingId === promo.id}
                          status={promo.wallet_status}
                          isCollectible={promo.is_collectible}
                          isCustomer={Boolean(user && user.role === 'customer')}
                          isAuthenticated={isAuthenticated}
                          appliesTo={promo.applies_to}
                          onCollect={() => void handleCollect(promo.id)}
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
      </div>
    </div>
  );
}
