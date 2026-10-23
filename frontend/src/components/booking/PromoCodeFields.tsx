'use client';

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, Tag, X } from 'lucide-react';
import axios from 'axios';
import api, { getApiErrorMessage } from '@/lib/api';
import { STACKING_NOTE } from '@/lib/promotions';
import { PromoNotice, usePromoNotice } from '@/components/promotions/PromoNotice';

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
  scope: 'room' | 'kayak';
  roomTypeIds?: number[];
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

// ดึงรหัสโปรโมชั่นที่ต้องกดเก็บก่อนใช้งานจากข้อมูลข้อผิดพลาดของ API
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

// แปลงข้อมูลผลลัพธ์การตรวจสอบคูปองจาก API ให้เป็นโครงสร้างสำหรับแสดงผลส่วนลด
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

// แสดงส่วนกรอกและตรวจสอบรหัสโปรโมชั่นที่ครอบด้วย Suspense
export default function PromoCodeFields(props: PromoCodeFieldsProps): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <PromoCodeFieldsInner {...props} />
    </Suspense>
  );
}

// จัดการสถานะการกรอก ตรวจสอบ เก็บคูปอง และคำนวณส่วนลดโปรโมชั่น
function PromoCodeFieldsInner({
  basePrice,
  nights,
  scope,
  roomTypeIds,
  onChange,
}: PromoCodeFieldsProps): React.ReactElement {
  const searchParams = useSearchParams();
  const urlPromo = (searchParams.get('promo_code') ?? searchParams.get('promo') ?? '').trim().toUpperCase();
  const roomTypeKey = roomTypeIds?.join(',') ?? '';
  const contextKey = JSON.stringify([basePrice, nights, scope, roomTypeKey, urlPromo]);
  const contextRef = useRef(contextKey);
  const [promoCode, setPromoCode] = useState(urlPromo);
  const { notice, showNotice } = usePromoNotice();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PromoPreview | null>(null);
  const [collectId, setCollectId] = useState<number | null>(null);
  const lineIdsRef = useRef<number[]>([]);
  const userClearedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    contextRef.current = contextKey;
    onChangeRef.current = onChange;
  }, [contextKey, onChange]);

  const canStack =
    preview != null &&
    preview.lines.length > 0 &&
    preview.lines.every((line) => line.stackable);

  // บันทึกผลลัพธ์ส่วนลดโปรโมชั่นที่ผ่านการตรวจสอบและส่งค่ากลับไปยังฟอร์มหลัก
  const applyPayload = (data: ValidatePayload): void => {
    const next = previewFromPayload(data);
    setPreview(next);
    setPromoCode('');
    setCollectId(null);
    lineIdsRef.current = next.lines.map((line) => line.id);
    onChangeRef.current(
      next.lines.map((line) => line.id),
      next
    );
  };

  // ล้างรายการโปรโมชั่นที่ใช้อยู่ทั้งหมดออกจากรายการจอง
  const clearApplied = (): void => {
    setPreview(null);
    setCollectId(null);
    lineIdsRef.current = [];
    onChangeRef.current([], null);
  };

  // ส่งคำขอตรวจสอบความถูกต้องของโปรโมชั่นไปยังเซิร์ฟเวอร์
  const validateRequest = async (
    body: Record<string, unknown>
  ): Promise<ValidatePayload> => {
    const res = await api.post('/promotions/validate', {
      ...body,
      scope,
      ...(scope === 'room' && roomTypeIds ? { room_type_ids: roomTypeIds } : {}),
    });
    return res.data.data as ValidatePayload;
  };

  // ตรวจสอบและใช้รหัสโปรโมชั่นพร้อมรองรับการใช้คูปองซ้อนกันได้
  const applyByCode = async (code: string, silent: boolean): Promise<void> => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || basePrice <= 0) return;
    const requestContext = contextKey;
    setLoading(true);
    try {
      const first = await validateRequest({
        code: trimmed,
        price: basePrice,
        ...(nights != null ? { nights } : {}),
      });
      if (contextRef.current !== requestContext) return;
      if (canStack && preview) {
        const stacked = await validateRequest({
          promotion_ids: [...preview.lines.map((line) => line.id), first.id],
          price: basePrice,
          ...(nights != null ? { nights } : {}),
        });
        if (contextRef.current !== requestContext) return;
        applyPayload(stacked);
      } else {
        applyPayload(first);
      }
      if (!silent) {
        // ไม่ต้องแสดงข้อความซ้ำเมื่อแสดงรายการส่วนลดด้านล่างแล้ว
      }
    } catch (error: unknown) {
      if (contextRef.current !== requestContext) return;
      const needId = collectIdFromError(error);
      if (needId != null) {
        setCollectId(needId);
        setPromoCode(trimmed);
        showNotice('error', getApiErrorMessage(error, 'ต้องเก็บโปรโมชั่นนี้ก่อนใช้'));
      } else {
        setCollectId(null);
        setPromoCode(trimmed);
        const message = getApiErrorMessage(error, 'โปรโมชั่นไม่ถูกต้องหรือหมดอายุ');
        const stackingBlocked = message.includes('ใช้ร่วมกับโปรโมชั่นอื่นไม่ได้');
        showNotice('error', stackingBlocked ? `${message} ${STACKING_NOTE}` : message);
      }
    } finally {
      if (contextRef.current === requestContext) setLoading(false);
    }
  };

  useEffect(() => {
    if (urlPromo && !userClearedRef.current) {
      setPromoCode(urlPromo);
    }
  }, [urlPromo]);

  useEffect(() => {
    let cancelled = false;

    // คำนวณส่วนลดโปรโมชั่นใหม่เมื่อราคา จำนวนคืน หรือพารามิเตอร์เปลี่ยน
    const syncPromo = async (): Promise<void> => {
      setLoading(false);
      const ids = lineIdsRef.current;
      if (ids.length > 0 && basePrice > 0) {
        try {
          const data = await validateRequest({
            promotion_ids: ids,
            price: basePrice,
            ...(nights != null ? { nights } : {}),
          });
          if (!cancelled) applyPayload(data);
        } catch {
          if (!cancelled) clearApplied();
        }
        return;
      }

      if (urlPromo && basePrice > 0 && !userClearedRef.current && ids.length === 0) {
        await applyByCode(urlPromo, true);
      }
    };

    void syncPromo();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePrice, nights, urlPromo, scope, roomTypeKey]);

  // กดปุ่มใช้รหัสโปรโมชั่นที่ผู้ใช้กรอก
  const handleApply = async (): Promise<void> => {
    userClearedRef.current = false;
    await applyByCode(promoCode, false);
  };

  // กดเก็บคูปองเข้ากระเป๋าสมาชิกและนำมาใช้ลดราคาทันที
  const handleCollect = async (): Promise<void> => {
    if (collectId == null) return;
    setLoading(true);
    try {
      await api.post(`/promotions/${collectId}/collect`);
      showNotice('success', 'เก็บโปรโมชั่นแล้ว');
      await applyByCode(promoCode || urlPromo, false);
    } catch (error: unknown) {
      showNotice('error', getApiErrorMessage(error, 'เก็บโปรโมชั่นไม่สำเร็จ'));
      setLoading(false);
    }
  };

  // ล้างรหัสโปรโมชั่นและยกเลิกส่วนลดทั้งหมดตามคำสั่งผู้ใช้
  const handleClear = (): void => {
    userClearedRef.current = true;
    setPromoCode('');
    clearApplied();
  };

  // ลบโปรโมชั่นรายการล่าสุดออกและคำนวณยอดส่วนลดที่เหลือใหม่
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
        showNotice('error', getApiErrorMessage(error, 'ลบคูปองไม่สำเร็จ'));
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="space-y-2">
      <PromoNotice notice={notice} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-charcoal-500 flex items-center gap-1">
          <Tag size={12} aria-hidden="true" />
          โปรโมชั่นส่วนลด
        </p>
        <Link href="/promotions" className="text-xs font-medium text-forest-800 hover:underline">
          ดูโปรโมชั่นทั้งหมด
        </Link>
      </div>
      {urlPromo && basePrice <= 0 ? (
        <p className="text-xs text-charcoal-400">
          จะใช้โปรโมชั่น <span className="font-mono font-semibold">{urlPromo}</span> เมื่อมีรายการจอง
        </p>
      ) : null}
      {preview && preview.lines.length > 0 ? (
        <div className="space-y-2">
          {preview.lines.map((line) => (
            <div
              key={line.id}
              className="flex items-center justify-between rounded-xl bg-forest-50 px-3 py-2 text-sm text-forest-900"
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
            ลบโปรโมชั่นล่าสุด
          </button>
        </div>
      ) : null}

      {(!preview || canStack) && (
        <div className="flex gap-2">
          <input
            className="input-field font-mono text-sm uppercase"
            placeholder="กรอกชื่อโปรโมชั่น"
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
            disabled={loading || !promoCode.trim() || basePrice <= 0}
            className="shrink-0 rounded-xl bg-forest-900 px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'ใช้โปรโมชั่น'}
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
          เก็บโปรโมชั่น
        </button>
      )}
    </div>
  );
}
