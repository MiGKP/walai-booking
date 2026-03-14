'use client';

import { useState, useEffect } from 'react';
import { Star, MessageSquare, PenLine, Trash2, X, Check } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface ReviewableBooking {
  room_booking_id: number;
  room_name: string;
  type_name: string;
  room_image: string;
  check_in: string;
  check_out: string;
}

interface MyReview {
  review_id: number;
  room_booking_id: number;
  rating: number;
  comment: string;
  review_date: string;
  room_name: string;
  type_name: string;
  room_image: string;
  check_in: string;
  check_out: string;
}

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <Star
            size={readonly ? 16 : 28}
            className={`transition-colors ${(hovered || value) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReviewsPage() {
  const { ready } = useAuthGuard();

  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [reviewable, setReviewable] = useState<ReviewableBooking[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [creating, setCreating] = useState<ReviewableBooking | null>(null);
  const [form, setForm] = useState({ rating: 0, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<MyReview | null>(null);
  const [editForm, setEditForm] = useState({ rating: 0, comment: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    fetchAll();
  }, [ready]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pendingRes, doneRes] = await Promise.all([
        api.get('/reviews/reviewable'),
        api.get('/reviews/my'),
      ]);
      setReviewable(pendingRes.data.data || []);
      setMyReviews(doneRes.data.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = (booking: ReviewableBooking) => {
    setCreating(booking);
    setForm({ rating: 0, comment: '' });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.rating === 0) { toast.error('กรุณาเลือกคะแนน'); return; }
    setSubmitting(true);
    try {
      await api.post('/reviews', {
        room_booking_id: creating!.room_booking_id,
        rating: form.rating,
        comment: form.comment,
      });
      toast.success('รีวิวสำเร็จ!');
      setCreating(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'รีวิวไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (review: MyReview) => {
    setEditing(review);
    setEditForm({ rating: review.rating, comment: review.comment || '' });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editForm.rating === 0) { toast.error('กรุณาเลือกคะแนน'); return; }
    setEditSubmitting(true);
    try {
      await api.put(`/reviews/${editing!.review_id}`, editForm);
      toast.success('แก้ไขรีวิวสำเร็จ');
      setEditing(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'แก้ไขไม่สำเร็จ');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: number) => {
    if (!confirm('ต้องการลบรีวิวนี้หรือไม่?')) return;
    try {
      await api.delete(`/reviews/${reviewId}`);
      toast.success('ลบรีวิวสำเร็จ');
      fetchAll();
    } catch {
      toast.error('ลบรีวิวไม่สำเร็จ');
    }
  };

  const ratingLabel = (r: number) => ['', 'แย่มาก', 'แย่', 'พอใช้', 'ดี', 'ดีมาก'][r] || '';

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 to-cyan-600 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-2">รีวิวของฉัน</h1>
          <p className="text-teal-100">แบ่งปันประสบการณ์การพักผ่อนของคุณ</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 w-fit">
          <button
            onClick={() => setTab('pending')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'pending' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            รอรีวิว
            {reviewable.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{reviewable.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('done')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'done' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            รีวิวแล้ว ({myReviews.length})
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="card animate-pulse">
                <div className="flex gap-4 p-5">
                  <div className="w-20 h-20 bg-gray-200 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'pending' ? (
          reviewable.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Check size={56} className="mx-auto mb-4 text-gray-200" />
              <p className="text-lg font-medium text-gray-500">ไม่มีรายการรอรีวิว</p>
              <p className="text-sm mt-1">การจองที่ผ่านมาถูกรีวิวครบแล้ว</p>
              <Link href="/rooms" className="inline-block mt-4 btn-primary text-sm">จองห้องพักใหม่</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {reviewable.map((booking) => (
                <div key={booking.room_booking_id} className="card flex flex-col sm:flex-row gap-4 p-5">
                  <div className="w-full sm:w-24 h-40 sm:h-24 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                    {booking.room_image ? (
                      <img src={`http://localhost:5000${booking.room_image}`} alt={booking.room_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">🌊</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-base">{booking.room_name} {booking.type_name ? `(${booking.type_name})` : ''}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      เช็คอิน {formatDate(booking.check_in)} — เช็คเอาต์ {formatDate(booking.check_out)}
                    </p>
                    <button
                      onClick={() => openCreate(booking)}
                      className="mt-3 inline-flex items-center gap-1.5 btn-primary text-sm py-2 px-4"
                    >
                      <Star size={14} /> เขียนรีวิว
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          myReviews.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <MessageSquare size={56} className="mx-auto mb-4 text-gray-200" />
              <p className="text-lg font-medium text-gray-500">ยังไม่มีรีวิว</p>
              <p className="text-sm mt-1">รีวิวการพักของคุณจะแสดงที่นี่</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myReviews.map((review) => (
                <div key={review.review_id} className="card p-5">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                      {review.room_image ? (
                        <img src={`http://localhost:5000${review.room_image}`} alt={review.room_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">🌊</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-gray-900 text-sm">{review.room_name} {review.type_name ? `(${review.type_name})` : ''}</p>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEdit(review)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-teal-600">
                            <PenLine size={15} />
                          </button>
                          <button onClick={() => handleDelete(review.review_id)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-red-600">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        {formatDate(review.check_in)} — {formatDate(review.check_out)}
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <StarRating value={review.rating} readonly />
                        <span className="text-xs font-semibold text-yellow-600">{ratingLabel(review.rating)}</span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg px-3 py-2">{review.comment}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">รีวิวเมื่อ {formatDate(review.review_date)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Create Review Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">เขียนรีวิว</h3>
              <button onClick={() => setCreating(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="px-6 pt-4 pb-2">
              <p className="font-semibold text-gray-800">{creating.room_name} {creating.type_name ? `(${creating.type_name})` : ''}</p>
              <p className="text-sm text-gray-500">{formatDate(creating.check_in)} — {formatDate(creating.check_out)}</p>
            </div>
            <form onSubmit={handleCreate} className="p-6 pt-3 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">คะแนน <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-3">
                  <StarRating value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
                  {form.rating > 0 && (
                    <span className="text-sm font-semibold text-yellow-600">{ratingLabel(form.rating)}</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ความคิดเห็น (ถ้ามี)</label>
                <textarea
                  className="input-field resize-none"
                  rows={4}
                  placeholder="แบ่งปันประสบการณ์การพักของคุณ..."
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCreating(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">ยกเลิก</button>
                <button type="submit" disabled={submitting || form.rating === 0} className="flex-1 btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
                  {submitting ? 'กำลังบันทึก...' : 'ส่งรีวิว'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Review Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">แก้ไขรีวิว</h3>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="px-6 pt-4 pb-2">
              <p className="font-semibold text-gray-800">{editing.room_name} {editing.type_name ? `(${editing.type_name})` : ''}</p>
              <p className="text-sm text-gray-500">{formatDate(editing.check_in)} — {formatDate(editing.check_out)}</p>
            </div>
            <form onSubmit={handleEdit} className="p-6 pt-3 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">คะแนน <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-3">
                  <StarRating value={editForm.rating} onChange={(v) => setEditForm({ ...editForm, rating: v })} />
                  {editForm.rating > 0 && (
                    <span className="text-sm font-semibold text-yellow-600">{ratingLabel(editForm.rating)}</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ความคิดเห็น</label>
                <textarea
                  className="input-field resize-none"
                  rows={4}
                  placeholder="แบ่งปันประสบการณ์การพักของคุณ..."
                  value={editForm.comment}
                  onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">ยกเลิก</button>
                <button type="submit" disabled={editSubmitting || editForm.rating === 0} className="flex-1 btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
                  {editSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
