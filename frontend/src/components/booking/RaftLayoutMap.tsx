'use client';

import React from 'react';
import { Check, Compass, Waves } from 'lucide-react';

export interface MapRaftRoomItem {
  room_id: number;
  room_number: string;
  status: string;
  is_available: boolean;
  is_current_type: boolean;
  room_name?: string;
  room_type_id?: number;
}

interface RaftLayoutMapProps {
  rooms: MapRaftRoomItem[];
  currentRoomTypeName?: string;
  selectedRoomIds?: number[];
  onToggleRoom?: (roomId: number) => void;
}

export default function RaftLayoutMap({
  rooms,
  selectedRoomIds = [],
  onToggleRoom,
}: RaftLayoutMapProps): React.ReactElement {
  const midIndex = Math.ceil(rooms.length / 2);
  const leftWing = rooms.slice(0, midIndex);
  const rightWing = rooms.slice(midIndex);

  const renderRoomPod = (room: MapRaftRoomItem) => {
    const isCurrent = room.is_current_type;
    const isSelected = selectedRoomIds.includes(room.room_id);
    const isAvailable = room.is_available;

    // ห้องประเภทอื่นในแถวเดียวกัน (แสดงแบบมินิมอลโปร่งแสง คลีน ไม่รบกวนสายตา)
    if (!isCurrent) {
      return (
        <div
          key={room.room_id || room.room_number}
          className="flex flex-col items-center shrink-0 w-[72px] sm:w-[84px] opacity-40 select-none"
        >
          {/* ข้อต่อทางเดิน */}
          <div className="h-3 w-1 bg-stone-300 rounded-full" />

          {/* ตัวห้องประเภทอื่น */}
          <div className="w-full rounded-2xl border border-stone-300/80 bg-stone-100/70 p-2.5 text-center">
            <span className="block font-sans text-xs font-bold text-stone-500">
              {room.room_number}
            </span>
            <span className="block text-[10px] text-stone-400 mt-1 font-medium">
              ประเภทอื่น
            </span>
          </div>

          {/* ระเบียงจำลอง */}
          <div className="mt-1.5 h-1 w-8 rounded-full bg-stone-200" />
        </div>
      );
    }

    // ห้องประเภทนี้ (Interactive คลีน เรียบหรู คลิกจองได้ทันที)
    return (
      <div
        key={room.room_id || room.room_number}
        className="group flex flex-col items-center shrink-0 w-[72px] sm:w-[84px] transition-transform duration-200"
      >
        {/* ข้อต่อทางเดินไม้เชื่อมสู่ห้อง */}
        <div
          className={`h-3 w-1 rounded-full transition-colors ${
            isSelected ? 'bg-forest-900' : 'bg-[#c5b59a]'
          }`}
        />

        {/* ตัวห้องพักลอยน้ำ */}
        <button
          type="button"
          disabled={!isAvailable}
          onClick={() => isAvailable && onToggleRoom && onToggleRoom(room.room_id)}
          className={`relative w-full rounded-2xl text-center p-2.5 transition-all duration-200 focus:outline-none ${
            isSelected
              ? 'bg-forest-900 text-white shadow-md ring-2 ring-forest-700/40 -translate-y-1'
              : isAvailable
              ? 'bg-white text-forest-950 border border-stone-200 shadow-xs hover:border-forest-600 hover:shadow-md hover:-translate-y-1 active:scale-95'
              : 'bg-stone-100/80 text-stone-400 border border-stone-200/60 cursor-not-allowed opacity-60'
          }`}
        >
          {/* หมายเลขห้อง */}
          <div className="flex items-center justify-center gap-1">
            <span
              className={`font-sans text-sm font-extrabold tracking-tight ${
                isSelected ? 'text-white' : 'text-forest-950'
              }`}
            >
              {room.room_number}
            </span>
            {isSelected && <Check size={12} strokeWidth={3} className="text-emerald-300" />}
          </div>

          {/* ปุ่มสถานะ / จอง */}
          <div className="mt-2">
            <span
              className={`inline-block w-full py-0.5 text-[10px] font-bold rounded-lg transition-colors ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : isAvailable
                  ? 'bg-forest-50 text-forest-800 group-hover:bg-forest-900 group-hover:text-white'
                  : 'bg-stone-200/50 text-stone-400'
              }`}
            >
              {isSelected ? 'เลือกแล้ว' : isAvailable ? 'จอง' : 'เต็ม'}
            </span>
          </div>
        </button>

        {/* ระเบียงไม้ริมน้ำ (Balcony Deck Line) */}
        <div
          className={`mt-1.5 h-1 w-9 rounded-full transition-colors ${
            isSelected ? 'bg-emerald-400' : 'bg-amber-400/90'
          }`}
          title="ระเบียงริมน้ำ"
        />
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-stone-200/80 bg-gradient-to-b from-[#FDFBF7] via-[#FAF7F2] to-[#F3F8F7] p-5 sm:p-6 shadow-xs">
      {/* Header & Minimal Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-stone-200/60 text-xs">
        <div>
          <h4 className="font-sans text-sm font-bold text-forest-950">
            ผังตำแหน่งห้องพักริมน้ำ
          </h4>
          <p className="text-[11px] text-stone-500 mt-0.5">
            คลิกที่หมายเลขห้องเพื่อเลือกจองลงตะกร้า
          </p>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 text-xs text-stone-600">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-md bg-white border border-stone-300 shadow-2xs" />
            <span>ห้องว่าง</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-md bg-forest-900 shadow-2xs" />
            <span className="text-forest-950 font-bold">เลือกแล้ว</span>
          </div>
          <div className="flex items-center gap-1.5 text-stone-400">
            <span className="h-3 w-3 rounded-md border border-stone-200 bg-stone-100/70" />
            <span>ห้องประเภทอื่น</span>
          </div>
        </div>
      </div>

      {/* ทางลงจากฝั่งดิน (กึ่งกลาง) */}
      <div className="flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-stone-200/70 px-3 py-1 shadow-2xs text-[11px] font-bold text-stone-600">
          <Compass size={12} className="text-forest-800" />
          <span>ทางลงจากฝั่งดิน</span>
        </div>
        <div className="h-4 w-1 bg-[#D5C7B0] rounded-full my-1 shadow-2xs" />
      </div>

      {/* สะพานทางเดินไม้และแถวห้องพัก (Scrollable on small screens) */}
      <div className="overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-fit mx-auto flex flex-col items-center px-4">
          {/* สะพานไม้ทางเดินริมน้ำ (Timber Boardwalk) */}
          <div className="w-full max-w-4xl flex items-center mb-1">
            <div className="h-2 flex-1 rounded-l-full bg-gradient-to-r from-[#DFD3BE] to-[#D5C7B0] shadow-2xs" />
            <div className="h-3.5 w-3.5 rounded-full bg-[#BFAEA0] mx-1 shrink-0 border border-white shadow-2xs" />
            <div className="h-2 flex-1 rounded-r-full bg-gradient-to-r from-[#D5C7B0] to-[#DFD3BE] shadow-2xs" />
          </div>

          {/* แถวห้องพักลอยน้ำริมน้ำ W1 ➔ W10 */}
          <div className="flex items-start justify-center gap-2 sm:gap-3.5">
            {/* ซีกซ้าย */}
            <div className="flex items-start gap-2 sm:gap-3.5">
              {leftWing.map(renderRoomPod)}
            </div>

            {/* ช่องกึ่งกลางทางลงบันได */}
            <div className="w-4 sm:w-6 shrink-0 flex flex-col items-center pt-2">
              <div className="h-8 w-px border-l border-dashed border-stone-300" />
            </div>

            {/* ซีกขวา */}
            <div className="flex items-start gap-2 sm:gap-3.5">
              {rightWing.map(renderRoomPod)}
            </div>
          </div>
        </div>
      </div>

      {/* แถบผืนน้ำแม่น้ำธรรมชาติ (Clean Serene Water Surface) */}
      <div className="mt-5 pt-3.5 border-t border-stone-200/50 flex items-center justify-center gap-2.5 text-stone-400">
        <span className="h-px w-16 bg-gradient-to-r from-transparent via-teal-200 to-transparent" />
        <div className="flex items-center gap-1.5 text-teal-800/60 font-sans text-[11px] font-bold tracking-widest uppercase">
          <Waves size={13} className="text-teal-600/70" />
          <span>แม่น้ำ</span>
        </div>
        <span className="h-px w-16 bg-gradient-to-r from-transparent via-teal-200 to-transparent" />
      </div>
    </div>
  );
}
