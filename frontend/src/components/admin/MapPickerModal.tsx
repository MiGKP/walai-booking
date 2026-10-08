'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, Check } from 'lucide-react';

// Import ตัวแผนที่แบบ Dynamic และปิด SSR (ป้องกัน window is not defined)
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-cream-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 bg-cream-50/50">
          <div>
            <h3 className="font-bold text-forest-900 text-base">ปักหมุดเลือกพิกัดแผนที่</h3>
            <p className="text-xs text-charcoal-500 mt-0.5">คลิกบนแผนที่หรือค้นหาสถานที่เพื่อเลือกตำแหน่ง</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-charcoal-400 hover:text-charcoal-700 hover:bg-cream-100 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map Body */}
        <div className="w-full h-[400px] relative">
          <LeafletMap position={position} setPosition={setPosition} showControls={true} />
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-cream-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="text-xs text-charcoal-700 font-mono bg-cream-50 border border-cream-200 px-3.5 py-2 rounded-xl w-full sm:w-auto text-center sm:text-left">
            พิกัดที่เลือก: <span className="font-bold text-forest-800">{position[0].toFixed(6)}, {position[1].toFixed(6)}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-charcoal-700 bg-cream-100 hover:bg-cream-200 rounded-xl transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold text-white bg-forest-800 hover:bg-forest-900 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>ใช้พิกัดนี้</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
