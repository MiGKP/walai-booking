'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, Loader2, Navigation, MapPin } from 'lucide-react';
import { notify } from "@/lib/admin-notify";

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// พิกัดสำคัญของสถาบันวิจัยวลัยรุกขเวช
const PRESET_LOCATIONS = [
  {
    name: 'สถาบันฯ (สถานีบ้านเกิ้ง)',
    coords: [16.219313, 103.329219] as [number, number], // 689H+RM8
  },
  {
    name: 'สถาบันฯ (สถานีนาดูน)',
    coords: [15.713500, 103.228100] as [number, number],
  },
  {
    name: 'ม.มหาสารคาม (ขามเรียง)',
    coords: [16.246473, 103.251916] as [number, number],
  },
];

function ChangeView({ center }: { center: [number, number] }): null {
  const map = useMap();
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
      map.setView(center, 16, { animate: false });
    });
    const timeout = window.setTimeout(() => {
      map.invalidateSize();
      map.setView(center, 16, { animate: false });
    }, 200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [map, center]);
  return null;
}

function LocationMarker({
  position,
  setPosition,
}: {
  position: [number, number];
  setPosition: (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position ? (
    /* @ts-ignore */
    <Marker position={position} icon={customIcon} />
  ) : null;
}

interface LeafletMapProps {
  position: [number, number];
  setPosition: (pos: [number, number]) => void;
  showControls?: boolean;
}

export default function LeafletMap({
  position,
  setPosition,
  showControls = true,
}: LeafletMapProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async (
    e?: React.FormEvent | React.KeyboardEvent | React.MouseEvent
  ) => {
    if (e && "preventDefault" in e) {
      e.preventDefault();
    }
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchQuery
      )}&countrycodes=th&limit=5`;

      const res = await fetch(url, {
        headers: { 'Accept-Language': 'th,en' },
      });
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setPosition([lat, lon]);
      } else {
        notify.error('ไม่พบสถานที่ดังกล่าว ลองพิมพ์ชื่ออำเภอ/จังหวัด');
      }
    } catch {
      notify.error('เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setSearching(false);
    }
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
        },
        () => notify.error('ไม่สามารถดึงตำแหน่งปัจจุบันของคุณได้')
      );
    }
  };

  return (
    <div className="relative w-full h-full z-0">
      {/* ส่วนค้นหาและปุ่มลัดสถานที่สำคัญ (แสดงเฉพาะเมื่อ showControls = true) */}
      {showControls && (
        <div className="absolute top-2.5 left-2.5 right-2.5 z-[500] flex flex-col gap-1.5 max-w-lg mx-auto">
          {/* ช่องค้นหา + ปุ่ม GPS */}
          <div className="flex gap-1.5">
            <div
              className="flex-1 flex items-center bg-white/95 backdrop-blur-xs rounded-xl shadow-md border border-cream-200 overflow-hidden px-3 py-1"
            >
              <input
                type="text"
                className="w-full text-xs py-1 focus:outline-none text-charcoal-800 placeholder:text-charcoal-400"
                placeholder="พิมพ์ค้นหา อําเภอ, จังหวัด (เช่น บรบือ, มหาสารคาม)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSearch(e);
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="text-charcoal-400 hover:text-forest-800 p-1 cursor-pointer"
              >
                {searching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-forest-800" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleCurrentLocation}
              title="ตำแหน่งปัจจุบัน"
              className="p-2 bg-white/95 backdrop-blur-xs text-charcoal-700 hover:text-forest-800 rounded-xl shadow-md border border-cream-200 flex items-center justify-center cursor-pointer shrink-0"
            >
              <Navigation className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ปุ่มลัดตำแหน่งที่ใช้บ่อย (Quick Preset Buttons) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="text-[11px] font-bold text-charcoal-600 bg-white/95 px-2 py-0.5 rounded-lg border border-cream-200 shrink-0 shadow-2xs">
              ทางลัด:
            </span>
            {PRESET_LOCATIONS.map((loc) => (
              <button
                key={loc.name}
                type="button"
                onClick={() => setPosition(loc.coords)}
                className="text-[11px] font-bold bg-forest-800 hover:bg-forest-900 text-white px-2.5 py-0.5 rounded-lg shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <MapPin className="w-2.5 h-2.5" />
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <MapContainer center={position} zoom={15} scrollWheelZoom={true} className="w-full h-full">
        <ChangeView center={position} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} setPosition={setPosition} />
      </MapContainer>
    </div>
  );
}
