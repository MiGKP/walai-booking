'use client';

import { useState, useEffect } from 'react';
import { X, Tag, Loader2, CheckCircle2 } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface PromotionItem {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  applies_to: 'room' | 'kayak' | 'both';
  is_collectible?: boolean;
}

interface WalletPromotion {
  promotion_id: number;
  promotion: PromotionItem;
}

interface PromotionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPromoCode: string | null;
  onApply: (code: string) => void;
  scope: 'room' | 'kayak';
}

export default function PromotionDrawer({ isOpen, onClose, currentPromoCode, onApply, scope }: PromotionDrawerProps) {
  const [activePromos, setActivePromos] = useState<PromotionItem[]>([]);
  const [myPromos, setMyPromos] = useState<WalletPromotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [collectingId, setCollectingId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCoupons();
    }
  }, [isOpen]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const [activeRes, mineRes] = await Promise.all([
        api.get('/promotions/active').catch(() => ({ data: { data: [] } })),
        api.get('/promotions/mine').catch(() => ({ data: { data: [] } })),
      ]);

      let allActive: PromotionItem[] = activeRes.data?.data || [];
      let mine: WalletPromotion[] = mineRes.data?.data || [];

      allActive = allActive.filter((p) => p.applies_to === scope || p.applies_to === 'both');
      mine = mine.filter((p) => p.promotion?.applies_to === scope || p.promotion?.applies_to === 'both');

      setActivePromos(allActive);
      setMyPromos(mine);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async (id: number) => {
    setCollectingId(id);
    try {
      await api.post(`/promotions/${id}/collect`);
      toast.success('เก็บโปรโมชั่นสำเร็จ');
      await fetchCoupons();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'ไม่สามารถเก็บโปรโมชั่นได้'));
    } finally {
      setCollectingId(null);
    }
  };

  if (!isOpen) return null;

  const myPromoIds = new Set(myPromos.map((p) => p.promotion_id));
  const availableToCollect = activePromos.filter(p => p.is_collectible && !myPromoIds.has(p.id));
  const globalPromos = activePromos.filter(p => !p.is_collectible);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-900/50 backdrop-blur-sm transition-opacity sm:items-center">
      <div 
        className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl flex flex-col max-h-[85vh] animate-reveal-up"
      >
        <div className="flex items-center justify-between border-b border-stone-100 p-5">
          <h2 className="text-lg font-bold text-forest-900 flex items-center gap-2">
            <Tag size={20} className="text-bamboo-600" />
            โปรโมชั่นส่วนลดของคุณ
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-stone-400 hover:bg-stone-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-forest-800" size={32} />
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-bold text-charcoal-800 mb-3">โปรโมชั่นในกระเป๋าของฉัน</h3>
                {myPromos.length === 0 && globalPromos.length === 0 ? (
                  <div className="text-center py-6 text-sm text-stone-400 border border-dashed rounded-xl border-stone-200">
                    ยังไม่มีโปรโมชั่นในกระเป๋า
                  </div>
                ) : (
                  <div className="space-y-3">
                    {globalPromos.map(p => (
                      <PromotionCard 
                        key={p.id} 
                        promo={p} 
                        isCollected={true}
                        isActive={currentPromoCode === p.code}
                        onApply={() => { onApply(p.code); onClose(); }} 
                      />
                    ))}
                    {myPromos.map(p => (
                      <PromotionCard 
                        key={p.promotion_id} 
                        promo={p.promotion} 
                        isCollected={true}
                        isActive={currentPromoCode === p.promotion.code}
                        onApply={() => { onApply(p.promotion.code); onClose(); }} 
                      />
                    ))}
                  </div>
                )}
              </div>

              {availableToCollect.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-charcoal-800 mb-3">โปรโมชั่นพิเศษที่เก็บได้เพิ่ม</h3>
                  <div className="space-y-3">
                    {availableToCollect.map(p => (
                      <PromotionCard 
                        key={p.id} 
                        promo={p} 
                        isCollected={false}
                        isActive={false}
                        loading={collectingId === p.id}
                        onCollect={() => handleCollect(p.id)} 
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface PromotionCardProps {
  promo: PromotionItem | null | undefined;
  isCollected: boolean;
  isActive: boolean;
  loading?: boolean;
  onCollect?: () => void;
  onApply?: () => void;
}

function PromotionCard({ promo, isCollected, isActive, loading, onCollect, onApply }: PromotionCardProps) {
  if (!promo) return null;
  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 transition-all ${isActive ? 'border-forest-500 bg-forest-50' : 'border-stone-200 bg-white'}`}>
      {isActive && (
        <div className="absolute top-0 right-0 bg-forest-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
          ใช้อยู่
        </div>
      )}
      <div className="flex gap-4">
        <div className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-forest-50 p-3 text-forest-700 w-[80px]">
          <span className="text-xl font-extrabold leading-none">
            {promo.discount_type === 'percent' ? `${promo.discount_value}%` : `${Number(promo.discount_value)}`}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide mt-1">
            {promo.discount_type === 'percent' ? 'ลดเลย' : 'บาท'}
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-forest-900">{promo.name}</h4>
            <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-2">{promo.description || 'ไม่มีเงื่อนไขเพิ่มเติม'}</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] font-medium text-stone-400">โค้ด: {promo.code}</span>
            {isCollected ? (
              <button 
                onClick={onApply}
                disabled={isActive}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${isActive ? 'bg-forest-200 text-forest-800' : 'bg-forest-900 text-white hover:bg-forest-800'}`}
              >
                {isActive ? 'กำลังใช้' : 'ใช้โปรโมชั่น'}
              </button>
            ) : (
              <button 
                onClick={onCollect}
                disabled={loading}
                className="rounded-full bg-bamboo-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-bamboo-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : 'เก็บโปรโมชั่น'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
