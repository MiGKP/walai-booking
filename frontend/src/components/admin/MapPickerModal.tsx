'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, Check } from 'lucide-react';

// 🌟 Import ตัวแผนที่แบบ Dynamic และปิด SSR (ป้องกัน window is not defined)
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-stone-100 animate-pulse flex flex-col items-center justify-center text-xs text-stone-400 gap-2">
      <span>กำลังโหลดแผนที่...</span>
    </div>
  ),
});

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCoordinates: string;
  onSelectCoordinates: (coords: string) => void;
}

export default function MapPickerModal({
  isOpen,
  onClose,
  currentCoordinates,
  onSelectCoordinates,
}: MapPickerModalProps) {
  const defaultLat = 16.2196;
  const defaultLng = 103.3293;

  const [position, setPosition] = useState<[number, number]>([defaultLat, defaultLng]);

  useEffect(() => {
    if (currentCoordinates) {
      const parts = currentCoordinates.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setPosition([parts[0], parts[1]]);
      }
    }
  }, [currentCoordinates, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const formattedCoords = `${position[0].toFixed(6)}, ${position[1].toFixed(6)}`;
    onSelectCoordinates(formattedCoords);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/50">
          <div>
            <h3 className="font-bold text-stone-900 text-base">ปักหมุดเลือกพิกัดแผนที่</h3>
            <p className="text-xs text-stone-500 mt-0.5">คลิกบนแผนที่เพื่อเลือกตำแหน่งที่ต้องการ</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map Body */}
        <div className="w-full h-[380px] relative">
          <LeafletMap position={position} setPosition={setPosition} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="text-xs text-stone-600 font-mono bg-stone-100 px-3 py-1.5 rounded-lg w-full sm:w-auto text-center sm:text-left">
            พิกัดที่เลือก: <span className="font-bold text-emerald-800">{position[0].toFixed(6)}, {position[1].toFixed(6)}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-white bg-[#064e3b] hover:bg-[#04392b] rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              ใช้พิกัดนี้
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}