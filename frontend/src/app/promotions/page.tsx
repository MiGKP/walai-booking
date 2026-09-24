'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket, SlidersHorizontal, X, Star, Sailboat, Home, Check } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { setPostLoginRedirect } from '@/lib/auth-redirect';
import { type CatalogPromo, appliesToLabel, parseAppliesTo } from '@/lib/promotions';
import { PromoCollectAction, PromoVoucher } from '@/components/promotions/PromoVoucher';
import toast from 'react-hot-toast';

type AppliesFilter = 'all' | 'room' | 'kayak' | 'both';
type TypeFilter = 'all' | 'percent' | 'fixed';
type CollectFilter = 'all' | 'collectible' | 'code-only';

export default function PromotionsPage(): React.ReactElement {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [promos, setPromos] = useState<CatalogPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectingId, setCollectingId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filters
  const [appliesFilter, setAppliesFilter] = useState<AppliesFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [collectFilter, setCollectFilter] = useState<CollectFilter>('all');
  const [stackableOnly, setStackableOnly] = useState(false);

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
      if (typeFilter !== 'all' && p.discount_type !== typeFilter) return false;
      if (collectFilter === 'collectible' && !p.is_collectible) return false;
      if (collectFilter === 'code-only' && p.is_collectible) return false;
      if (stackableOnly && !p.stackable) return false;
      return true;
    });
  }, [promos, appliesFilter, typeFilter, collectFilter, stackableOnly]);

  const activeFiltersCount = [
    appliesFilter !== 'all',
    typeFilter !== 'all',
    collectFilter !== 'all',
    stackableOnly,
  ].filter(Boolean).length;

  const resetFilters = (): void => {
    setAppliesFilter('all');
    setTypeFilter('all');
    setCollectFilter('all');
    setStackableOnly(false);
  };

  const FilterPanel = (): React.ReactElement => (
    <div className="space-y-6">
      {/* ใช้ได้กับ */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-forest-800">
          ใช้ได้กับ
        </h3>
        <div className="space-y-2">
          {([
            { id: 'all', label: 'ทั้งหมด', icon: Star },
            { id: 'room', label: 'ห้องพัก', icon: Home },
            { id: 'kayak', label: 'เรือคายัค', icon: Sailboat },
            { id: 'both', label: 'ทั้งห้องพักและเรือ', icon: Star },
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

      {/* ประเภทส่วนลด */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-forest-800">
          ประเภทส่วนลด
        </h3>
        <div className="space-y-2">
          {([
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'percent', label: 'ส่วนลด (%)' },
            { id: 'fixed', label: 'ส่วนลดเป็นบาท (฿)' },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTypeFilter(id)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-left transition-all ${
                typeFilter === id
                  ? 'bg-forest-800 text-cream-100 font-semibold shadow-sm'
                  : 'text-charcoal-500 hover:bg-forest-50 hover:text-forest-800'
              }`}
            >
              {label}
              {typeFilter === id && <Check size={13} className="ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* วิธีรับ */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-forest-800">
          วิธีรับโปรโมชั่น
        </h3>
        <div className="space-y-2">
          {([
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'collectible', label: 'กดเก็บไว้ในกระเป๋า' },
            { id: 'code-only', label: 'พิมพ์โค้ดตอนจอง' },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCollectFilter(id)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-left transition-all ${
                collectFilter === id
                  ? 'bg-forest-800 text-cream-100 font-semibold shadow-sm'
                  : 'text-charcoal-500 hover:bg-forest-50 hover:text-forest-800'
              }`}
            >
              {label}
              {collectFilter === id && <Check size={13} className="ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* ใช้ซ้อนได้ */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-forest-800">
          อื่นๆ
        </h3>
        <button
          type="button"
          onClick={() => setStackableOnly(!stackableOnly)}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left transition-all ${
            stackableOnly
              ? 'bg-forest-800 text-cream-100 font-semibold shadow-sm'
              : 'text-charcoal-500 hover:bg-forest-50 hover:text-forest-800'
          }`}
        >
          <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] transition-all ${stackableOnly ? 'border-cream-300 bg-forest-600' : 'border-stone-300 bg-white'}`}>
            {stackableOnly && <Check size={10} strokeWidth={3} className="text-cream-100" />}
          </span>
          ใช้ซ้อนโค้ดอื่นได้
        </button>
      </div>

      {activeFiltersCount > 0 && (
        <button
          type="button"
          onClick={resetFilters}
          className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
        >
          ล้างตัวกรองทั้งหมด
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] pt-16">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-forest-900 via-forest-800 to-lagoon-800">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
        }} />
        <div className="container relative mx-auto px-6 py-10 md:py-14">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full bg-bamboo-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-bamboo-300 border border-bamboo-300/30">
              🏝️ วลัย ฟลอตติ้ง รีสอร์ท
            </span>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              ส่วนลดพิเศษสำหรับคุณ
            </h1>
            <p className="mt-2 text-base text-cream-100/80 leading-relaxed">
              เก็บโค้ดก่อน ใช้ตอนจอง — ส่วนลดห้องพักและเรือคายัคมาแล้ว อย่าพลาด!
            </p>
            <div className="mt-4 flex items-center gap-4 text-sm text-cream-100/70">
              <span className="flex items-center gap-1.5"><Ticket size={14} className="text-bamboo-300" /> {promos.length} โปรโมชั่น</span>
              {promos.filter(p => p.is_collectible).length > 0 && (
                <span className="flex items-center gap-1.5"><Check size={14} className="text-green-400" /> {promos.filter(p => p.is_collectible).length} กดเก็บได้เลย</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filter Toggle */}
      <div className="sticky top-16 z-20 flex items-center gap-3 border-b border-stone-200 bg-[#FDFBF7]/95 px-4 py-3 backdrop-blur-sm md:hidden">
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
        <span className="text-sm text-charcoal-400">
          {filtered.length} รายการ
        </span>
        {activeFiltersCount > 0 && (
          <button type="button" onClick={resetFilters} className="ml-auto text-xs text-red-500 font-semibold">
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

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="flex gap-8">
          {/* Left Sidebar — Desktop */}
          <aside className="hidden w-56 shrink-0 md:block">
            <div className="sticky top-28 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display font-semibold text-charcoal flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-forest-600" />
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
            {/* Result count bar */}
            <div className="mb-5 flex items-center gap-2">
              <p className="text-sm text-charcoal-500">
                แสดง <span className="font-semibold text-forest-800">{filtered.length}</span> จาก {promos.length} รายการ
              </p>
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-1.5 ml-2">
                  {appliesFilter !== 'all' && (
                    <span className="flex items-center gap-1 rounded-full bg-forest-50 border border-forest-100 px-2.5 py-1 text-xs font-semibold text-forest-700">
                      {appliesFilter === 'room' ? 'ห้องพัก' : appliesFilter === 'kayak' ? 'เรือ' : 'ทั้งคู่'}
                      <button type="button" onClick={() => setAppliesFilter('all')} className="text-forest-400 hover:text-red-500"><X size={10} /></button>
                    </span>
                  )}
                  {typeFilter !== 'all' && (
                    <span className="flex items-center gap-1 rounded-full bg-forest-50 border border-forest-100 px-2.5 py-1 text-xs font-semibold text-forest-700">
                      {typeFilter === 'percent' ? 'ส่วนลด%' : 'ส่วนลดบาท'}
                      <button type="button" onClick={() => setTypeFilter('all')} className="text-forest-400 hover:text-red-500"><X size={10} /></button>
                    </span>
                  )}
                  {collectFilter !== 'all' && (
                    <span className="flex items-center gap-1 rounded-full bg-forest-50 border border-forest-100 px-2.5 py-1 text-xs font-semibold text-forest-700">
                      {collectFilter === 'collectible' ? 'กดเก็บ' : 'พิมพ์โค้ด'}
                      <button type="button" onClick={() => setCollectFilter('all')} className="text-forest-400 hover:text-red-500"><X size={10} /></button>
                    </span>
                  )}
                  {stackableOnly && (
                    <span className="flex items-center gap-1 rounded-full bg-forest-50 border border-forest-100 px-2.5 py-1 text-xs font-semibold text-forest-700">
                      ใช้ซ้อนได้
                      <button type="button" onClick={() => setStackableOnly(false)} className="text-forest-400 hover:text-red-500"><X size={10} /></button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {[1, 2, 3, 4].map((key) => (
                  <div key={key} className="h-48 animate-pulse rounded-2xl bg-stone-200/60" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-8 py-20 text-center">
                <Ticket size={44} className="mx-auto mb-4 text-stone-300" />
                <p className="font-display text-lg text-charcoal-400">ไม่พบโปรโมชั่นที่ตรงเงื่อนไข</p>
                <p className="mt-1 text-sm text-charcoal-300">ลองเปลี่ยนตัวกรองดูนะครับ</p>
                <button type="button" onClick={resetFilters} className="btn-primary mt-6 px-6 py-2">ล้างตัวกรอง</button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                      badge={promo.is_collectible ? 'กดเก็บ' : 'พิมพ์โค้ด'}
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
