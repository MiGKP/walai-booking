'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Tag, X } from 'lucide-react';
import axios from 'axios';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

export interface PromoLinePreview {
  id: number;
  code: string;
  name: string;
  discount_amount: number;
  stackable: boolean;
}

export interface PromoPreview {
  discount_amount: number;
  final_price: number;
  lines: PromoLinePreview[];
}

interface PromoCodeFieldsProps {
  basePrice: number;
  nights: number | null;
  onChange: (ids: number[], preview: PromoPreview | null) => void;
}

interface ValidatePayload {
  id: number;
  code: string;
  name: string;
  discount_amount: number;
  final_price: number | null;
  is_collectible?: boolean;
  stackable?: boolean;
  lines?: Array<{
    id: number;
    code: string;
    name: string;
    discount_amount: number;
    is_collectible?: boolean;
    stackable?: boolean;
  }>;
  needs_collect?: boolean;
}

function collectIdFromError(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;
  const data = error.response?.data as
    | { message?: string; data?: { id?: number; needs_collect?: boolean } }
    | undefined;
  if (data?.data?.needs_collect === true && typeof data.data.id === 'number') {
    return data.data.id;
  }
  return null;
}

function previewFromPayload(data: ValidatePayload): PromoPreview {
  const lines: PromoLinePreview[] =
    Array.isArray(data.lines) && data.lines.length > 0
      ? data.lines.map((line) => ({
          id: line.id,
          code: line.code,
          name: line.name,
          discount_amount: line.discount_amount,
          stackable: Boolean(line.stackable),
        }))
      : [
          {
            id: data.id,
            code: data.code,
            name: data.name,
            discount_amount: data.discount_amount,
            stackable: Boolean(data.stackable),
          },
        ];
  return {
    discount_amount: data.discount_amount,
    final_price: data.final_price ?? 0,
    lines,
  };
}

export default function PromoCodeFields({
  basePrice,
  nights,
  onChange,
}: PromoCodeFieldsProps): React.ReactElement {
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PromoPreview | null>(null);
  const [collectId, setCollectId] = useState<number | null>(null);

  useEffect(() => {
    setPreview(null);
    setPromoCode('');
    setCollectId(null);
    onChange([], null);
  }, [basePrice, nights]);

  const canStack =
    preview != null &&
    preview.lines.length > 0 &&
    preview.lines.every((line) => line.stackable);

  const applyPayload = (data: ValidatePayload): void => {
    const next = previewFromPayload(data);
    setPreview(next);
    setPromoCode('');
    setCollectId(null);
    onChange(
      next.lines.map((line) => line.id),
      next
    );
  };

  const validateRequest = async (
    body: Record<string, unknown>
  ): Promise<ValidatePayload> => {
    const res = await api.post('/promotions/validate', body);
    return res.data.data as ValidatePayload;
  };

  const handleApply = async (): Promise<void> => {
    if (!promoCode.trim() || basePrice <= 0) return;
    setLoading(true);
    try {
      const first = await validateRequest({
        code: promoCode.trim(),
        price: basePrice,
        ...(nights != null ? { nights } : {}),
      });
      if (canStack && preview) {
        const stacked = await validateRequest({
          promotion_ids: [...preview.lines.map((line) => line.id), first.id],
          price: basePrice,
          ...(nights != null ? { nights } : {}),
        });
        applyPayload(stacked);
      } else {
        applyPayload(first);
      }
      toast.success(`ใช้โค้ด "${first.code}" สำเร็จ`);
    } catch (error: unknown) {
      const needId = collectIdFromError(error);
      if (needId != null) {
        setCollectId(needId);
        toast.error(getApiErrorMessage(error, 'ต้องเก็บโค้ดนี้ก่อนใช้'));
      } else {
        setCollectId(null);
        toast.error(getApiErrorMessage(error, 'โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุ'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async (): Promise<void> => {
    if (collectId == null) return;
    setLoading(true);
    try {
      await api.post(`/promotions/${collectId}/collect`);
      toast.success('เก็บโค้ดแล้ว');
      await handleApply();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'เก็บโค้ดไม่สำเร็จ'));
      setLoading(false);
    }
  };

  const handleClear = (): void => {
    setPreview(null);
    setPromoCode('');
    setCollectId(null);
    onChange([], null);
  };

  const handleRemoveLast = (): void => {
    if (preview == null || preview.lines.length === 0) return;
    if (preview.lines.length === 1) {
      handleClear();
      return;
    }
    const nextIds = preview.lines.slice(0, -1).map((line) => line.id);
    setLoading(true);
    void (async (): Promise<void> => {
      try {
        const data = await validateRequest({
          promotion_ids: nextIds,
          price: basePrice,
          ...(nights != null ? { nights } : {}),
        });
        applyPayload(data);
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, 'ลบโค้ดไม่สำเร็จ'));
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-charcoal-500 flex items-center gap-1">
          <Tag size={12} aria-hidden="true" />
          โค้ดส่วนลด
        </p>
        <Link href="/promotions" className="text-[11px] font-medium text-forest-800 hover:underline">
          ดูคูปองทั้งหมด
        </Link>
      </div>
      {preview && preview.lines.length > 0 ? (
        <div className="space-y-2">
          {preview.lines.map((line) => (
            <div
              key={line.id}
              className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            >
              <span className="font-mono text-xs font-semibold">{line.code}</span>
              <span className="tabular-nums">-฿{line.discount_amount.toLocaleString()}</span>
            </div>
          ))}
          <button
            type="button"
            onClick={handleRemoveLast}
            className="text-xs text-charcoal-400 hover:text-red-600 inline-flex items-center gap-1"
          >
            <X size={12} aria-hidden="true" />
            ลบโค้ดล่าสุด
          </button>
        </div>
      ) : null}

      {(!preview || canStack) && (
        <div className="flex gap-2">
          <input
            className="input-field font-mono text-sm uppercase"
            placeholder="กรอกโค้ด"
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              void handleApply();
            }}
          />
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={loading || !promoCode.trim()}
            className="shrink-0 rounded-xl bg-forest-900 px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'ใช้โค้ด'}
          </button>
        </div>
      )}

      {collectId != null && (
        <button
          type="button"
          onClick={() => void handleCollect()}
          disabled={loading}
          className="btn-secondary w-full text-sm"
        >
          เก็บโค้ด
        </button>
      )}
    </div>
  );
}
