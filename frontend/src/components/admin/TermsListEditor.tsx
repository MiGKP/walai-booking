'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface TermsListEditorProps {
  /** ข้อกำหนดทั้งหมดเก็บเป็นข้อความเดียว คั่นแต่ละข้อด้วยการขึ้นบรรทัดใหม่ (ตามคอลัมน์ additional_terms) */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const parseTerms = (value: string): string[] => {
  const items = value ? value.split('\n').map((item) => item.trim()) : [];
  return items.length > 0 ? items : [''];
};

export default function TermsListEditor({
  value,
  onChange,
  disabled = false,
  placeholder = 'เช่น ห้ามส่งเสียงดังหลัง 22:00 น.',
}: TermsListEditorProps): React.ReactElement {
  const [items, setItems] = useState<string[]>(() => parseTerms(value));

  // รับค่าจากภายนอก (เช่น โหลดข้อมูลเสร็จ) โดยไม่รีเซ็ตแถวว่างที่ผู้ใช้กำลังพิมพ์
  useEffect(() => {
    setItems((prev) => (prev.filter(Boolean).join('\n') === value ? prev : parseTerms(value)));
  }, [value]);

  const commit = (next: string[]): void => {
    setItems(next);
    onChange(next.filter(Boolean).join('\n'));
  };

  const handleChange = (index: number, text: string): void => {
    commit(items.map((item, i) => (i === index ? text : item)));
  };

  const handleAdd = (): void => {
    setItems([...items, '']);
  };

  const handleRemove = (index: number): void => {
    const next = items.filter((_, i) => i !== index);
    commit(next.length > 0 ? next : ['']);
  };

  return (
    <div className="space-y-3.5">
      <div className="space-y-2.5 overflow-y-auto pr-1 max-h-72 [scrollbar-width:thin]">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <span className="w-6 shrink-0 text-center text-xs font-bold text-forest-800 bg-cream-100 rounded-lg py-1 border border-cream-200">
              {index + 1}
            </span>
            <input
              type="text"
              aria-label={`ข้อกำหนดที่ ${index + 1}`}
              disabled={disabled}
              placeholder={placeholder}
              value={item}
              onChange={(e) => handleChange(index, e.target.value)}
              className="flex-1 rounded-2xl border border-cream-300 bg-cream-50/70 px-3.5 py-2 text-xs sm:text-sm font-medium text-charcoal-900 transition-all focus:border-forest-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-800/15 disabled:opacity-50 placeholder:text-charcoal-400"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleRemove(index)}
              title="ลบข้อนี้"
              aria-label={`ลบข้อกำหนดที่ ${index + 1}`}
              className="shrink-0 cursor-pointer rounded-xl p-2 text-charcoal-400 transition-all hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={handleAdd}
        className="inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-forest-800 bg-forest-50 hover:bg-forest-100 border border-forest-200/80 transition-all active:scale-95 disabled:opacity-50 shadow-2xs"
      >
        <Plus size={14} aria-hidden="true" className="stroke-[2.5]" />
        <span>เพิ่มข้อกำหนด</span>
      </button>
    </div>
  );
}
