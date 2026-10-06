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
    <div className="space-y-3">
      <div className="space-y-2 overflow-y-auto pr-1 max-h-72">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-xs font-bold text-stone-400">{index + 1}.</span>
            <input
              type="text"
              aria-label={`ข้อกำหนดที่ ${index + 1}`}
              disabled={disabled}
              placeholder={placeholder}
              value={item}
              onChange={(e) => handleChange(index, e.target.value)}
              className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800 transition-all focus:border-forest-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 disabled:opacity-50"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleRemove(index)}
              title="ลบข้อนี้"
              aria-label={`ลบข้อกำหนดที่ ${index + 1}`}
              className="shrink-0 cursor-pointer rounded-lg p-2 text-stone-400 transition-all hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={handleAdd}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-forest-800 transition-colors hover:text-forest-700 disabled:opacity-50"
      >
        <Plus size={14} aria-hidden="true" />
        <span>เพิ่มข้อกำหนด</span>
      </button>
    </div>
  );
}
