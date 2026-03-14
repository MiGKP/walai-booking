'use client';

import { useState, useEffect } from 'react';
import { Star, Trash2, Search, Filter, MessageSquare } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          className={s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const { ready } = useAuthGuard({ allowedRoles: ['admin', 'room_staff'] });
  const [reviews, setReviews] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRoomType, setFilterRoomType] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    fetchRoomTypes();
    fetchReviews();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    fetchReviews();
  }, [filterRoomType, filterRating]);

  const fetchRoomTypes = async () => {
    try {
      const res = await api.get('/rooms');
      setRoomTypes(res.data?.data || []);
    } catch {}
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterRoomType) params.room_type_id = filterRoomType;
      if (filterRating) params.min_rating = filterRating;
      const res = await api.get('/reviews/admin/all', { params });
      setReviews(res.data?.data || []);
      setAvgRating(res.data?.avg_rating ?? null);
    } catch {
      toast.error('ไม่สามารถโหลดรีวิวได้');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ต้องการลบรีวิวนี้?')) return;
    try {
      await api.delete(`/reviews/admin/${id}`);
      toast.success('ลบรีวิวสำเร็จ');
      setReviews((prev) => prev.filter((r) => r.review_id !== id));
    } catch {
      toast.error('ลบรีวิวไม่สำเร็จ');
    }
  };

  const filtered = reviews.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.first_name + ' ' + r.last_name).toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.room_name?.toLowerCase().includes(q) ||
      r.comment?.toLowerCase().includes(q)
    );
  });

  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Number(r.rating) === star).length,
  }));

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">รีวิวจากผู้เข้าพัก</h1>
          <p className="text-gray-500 mt-1">ดูและจัดการรีวิวทั้งหมดในระบบ</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-5 col-span-2 md:col-span-1 flex flex-col items-center justify-center text-center">
            <p className="text-4xl font-bold text-yellow-500">{avgRating ?? '-'}</p>
            {avgRating && <StarDisplay rating={Math.round(avgRating)} />}
            <p className="text-xs text-gray-400 mt-1">คะแนนเฉลี่ย</p>
          </div>
          <div className="card p-5 flex flex-col items-center justify-center text-center">
            <p className="text-3xl font-bold text-teal-600">{reviews.length}</p>
            <p className="text-xs text-gray-500 mt-1">รีวิวทั้งหมด</p>
          </div>
          <div className="card p-5 col-span-2 flex flex-col justify-center gap-1.5">
            {ratingCounts.map(({ star, count }) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-4 text-right">{star}</span>
                <Star size={11} className="fill-yellow-400 text-yellow-400 flex-shrink-0" />
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: reviews.length > 0 ? `${Math.round((count / reviews.length) * 100)}%` : '0%' }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-5 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล, ห้อง, ความคิดเห็น..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-teal-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <select
              value={filterRoomType}
              onChange={(e) => setFilterRoomType(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-400"
            >
              <option value="">ห้องพักทั้งหมด</option>
              {roomTypes.map((rt: any) => (
                <option key={rt.id} value={rt.id}>{rt.room_name} — {rt.type_name}</option>
              ))}
            </select>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-400"
            >
              <option value="">คะแนนทั้งหมด</option>
              <option value="5">⭐ 5 ดาว</option>
              <option value="4">⭐ 4 ดาวขึ้นไป</option>
              <option value="3">⭐ 3 ดาวขึ้นไป</option>
              <option value="2">⭐ 2 ดาวขึ้นไป</option>
              <option value="1">⭐ 1 ดาวขึ้นไป</option>
            </select>
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} รายการ</span>
        </div>

        {/* Reviews List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card h-24 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <MessageSquare size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">ไม่มีรีวิวในขณะนี้</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r: any) => (
              <div key={r.review_id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Reviewer Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    {r.image_profile ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`http://localhost:5000${r.image_profile}`}
                        alt={r.first_name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-100"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-teal-600">
                          {r.first_name?.[0]}{r.last_name?.[0]}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">
                        {r.first_name} {r.last_name}
                      </p>
                      <p className="text-xs text-gray-400">{r.email}</p>
                    </div>
                  </div>

                  {/* Room + Rating */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-gray-700">{r.room_name}</p>
                    <p className="text-xs text-gray-400">{r.type_name}</p>
                    <div className="flex justify-end mt-1">
                      <StarDisplay rating={Number(r.rating)} />
                    </div>
                  </div>
                </div>

                {/* Comment */}
                {r.comment && (
                  <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
                    "{r.comment}"
                  </p>
                )}

                {/* Footer */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>
                      เข้าพัก{' '}
                      {r.check_in
                        ? new Date(r.check_in).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                        : '-'}
                      {' '}–{' '}
                      {r.check_out
                        ? new Date(r.check_out).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                        : '-'}
                    </span>
                    <span>
                      รีวิวเมื่อ{' '}
                      {new Date(r.review_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(r.review_id)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} /> ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
