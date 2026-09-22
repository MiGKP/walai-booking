'use client';

import { useState, useEffect } from 'react';
import { Star, MessageSquare, PenLine, Trash2, X, Check } from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import toast from 'react-hot-toast';
import { toastConfirm } from '@/lib/toastConfirm';

interface ReviewableBooking {
  room_booking_id: number;
  room_type_id: number;
  room_name: string;
  type_name: string;
  room_image: string;
  check_in: string;
  check_out: string;
}

interface MyReview {
  review_id: number;
  room_booking_id: number;
  room_type_id: number;
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
            size={readonly ? 15 : 26}
            className={`transition-colors ${(hovered || value) >= star ? 'text-bamboo-500 fill-bamboo-500' : 'text-stone-300'}`}
          />
        </button>
      ))}
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// แท็บ "รีวิวของฉัน" แบบฝังในหน้า dashboard เดียวกัน ไม่ต้องสลับไปหน้า /reviews
export default function MyReviewsSection(): React.ReactElement {
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [reviewable, setReviewable] = useState<ReviewableBooking[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState<ReviewableBooking | null>(null);
  const [form, setForm] = useState({ rating: 0, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState<MyReview | null>(null);
  const [editForm, setEditForm] = useState({ rating: 0, comment: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

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
        room_type_id: creating!.room_type_id,
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

  const handleDelete = (reviewId: number) => {
    toastConfirm({
      title: 'ต้องการลบรีวิวนี้หรือไม่?',
      confirmText: 'ลบรีวิว',
      onConfirm: async () => {
        try {
          await api.delete(`/reviews/${reviewId}`);
          toast.success('ลบรีวิวสำเร็จ');
          fetchAll();
        } catch {
          toast.error('ลบรีวิวไม่สำเร็จ');
        }
      }
    });
  };

  const ratingLabel = (r: number) => ['', 'แย่มาก', 'แย่', 'พอใช้', 'ดี', 'ดีมาก'][r] || '';

  return (
    <div>
      <div className="mb-4 flex w-fit gap-1 rounded-xl bg-stone-100 p-1">
        <button
          onClick={() => setTab('pending')}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${tab === 'pending' ? 'bg-white text-forest-900 shadow-sm' : 'text-charcoal-500 hover:text-forest-800'}`}
        >
          รอรีวิว
          {reviewable.length > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">{reviewable.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('done')}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${tab === 'done' ? 'bg-white text-forest-900 shadow-sm' : 'text-charcoal-500 hover:text-forest-800'}`}
        >
          รีวิวแล้ว ({myReviews.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-stone-100" />)}
        </div>
      ) : tab === 'pending' ? (
        reviewable.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 py-16 text-center">
            <Check size={40} className="mx-auto mb-3 text-stone-300" />
            <p className="text-sm font-medium text-charcoal-500">ไม่มีรายการรอรีวิว</p>
            <p className="mt-1 text-xs text-charcoal-400">การจองที่ผ่านมาถูกรีวิวครบแล้ว</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewable.map((booking) => (
              <div key={`${booking.room_booking_id}-${booking.room_type_id}`} className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 sm:flex-row">
                <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:h-20 sm:w-24">
                  {booking.room_image ? (
                    <img src={resolveMediaUrl(booking.room_image)} alt={booking.room_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-forest-300">🌊</div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-forest-900">{booking.room_name} {booking.type_name ? `(${booking.type_name})` : ''}</p>
                  <p className="mt-0.5 text-xs text-charcoal-400">
                    เช็คอิน {formatDate(booking.check_in)} — เช็คเอาต์ {formatDate(booking.check_out)}
                  </p>
                  <button
                    onClick={() => openCreate(booking)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-forest-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-forest-800"
                  >
                    <Star size={13} /> เขียนรีวิว
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : myReviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 py-16 text-center">
          <MessageSquare size={40} className="mx-auto mb-3 text-stone-300" />
          <p className="text-sm font-medium text-charcoal-500">ยังไม่มีรีวิว</p>
          <p className="mt-1 text-xs text-charcoal-400">รีวิวการพักของคุณจะแสดงที่นี่</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myReviews.map((review) => (
            <div key={review.review_id} className="rounded-2xl border border-stone-200/80 bg-white p-4">
              <div className="flex gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                  {review.room_image ? (
                    <img src={resolveMediaUrl(review.room_image)} alt={review.room_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-forest-300">🌊</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-bold text-forest-900">{review.room_name} {review.type_name ? `(${review.type_name})` : ''}</p>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => openEdit(review)} className="rounded-lg p-1.5 text-charcoal-400 transition-colors hover:bg-stone-50 hover:text-forest-700">
                        <PenLine size={14} />
                      </button>
                      <button onClick={() => handleDelete(review.review_id)} className="rounded-lg p-1.5 text-charcoal-400 transition-colors hover:bg-stone-50 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mb-2 text-xs text-charcoal-400">
                    {formatDate(review.check_in)} — {formatDate(review.check_out)}
                  </p>
                  <div className="mb-2 flex items-center gap-2">
                    <StarRating value={review.rating} readonly />
                    <span className="text-xs font-semibold text-bamboo-600">{ratingLabel(review.rating)}</span>
                  </div>
                  {review.comment && (
                    <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-charcoal-600">{review.comment}</p>
                  )}
                  <p className="mt-2 text-xs text-charcoal-400">รีวิวเมื่อ {formatDate(review.review_date)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Review Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/40 p-4 backdrop-blur-sm" onClick={() => setCreating(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-6 py-4">
              <h3 className="font-sans text-base font-bold text-forest-900">เขียนรีวิว</h3>
              <button onClick={() => setCreating(null)} className="rounded-full p-1 transition-colors hover:bg-stone-200">
                <X size={18} className="text-charcoal-400" />
              </button>
            </div>
            <div className="px-6 pb-2 pt-4">
              <p className="text-sm font-semibold text-charcoal-700">{creating.room_name} {creating.type_name ? `(${creating.type_name})` : ''}</p>
              <p className="text-xs text-charcoal-400">{formatDate(creating.check_in)} — {formatDate(creating.check_out)}</p>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 p-6 pt-3">
              <div>
                <label className="mb-2 block text-xs font-semibold text-charcoal-600">คะแนน <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-3">
                  <StarRating value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
                  {form.rating > 0 && <span className="text-xs font-semibold text-bamboo-600">{ratingLabel(form.rating)}</span>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-charcoal-600">ความคิดเห็น (ถ้ามี)</label>
                <textarea
                  className="input-field resize-none"
                  rows={4}
                  placeholder="แบ่งปันประสบการณ์การพักของคุณ..."
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCreating(null)} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-bold text-charcoal-600 transition-colors hover:bg-stone-50">ยกเลิก</button>
                <button type="submit" disabled={submitting || form.rating === 0} className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? 'กำลังบันทึก...' : 'ส่งรีวิว'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Review Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/40 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-6 py-4">
              <h3 className="font-sans text-base font-bold text-forest-900">แก้ไขรีวิว</h3>
              <button onClick={() => setEditing(null)} className="rounded-full p-1 transition-colors hover:bg-stone-200">
                <X size={18} className="text-charcoal-400" />
              </button>
            </div>
            <div className="px-6 pb-2 pt-4">
              <p className="text-sm font-semibold text-charcoal-700">{editing.room_name} {editing.type_name ? `(${editing.type_name})` : ''}</p>
              <p className="text-xs text-charcoal-400">{formatDate(editing.check_in)} — {formatDate(editing.check_out)}</p>
            </div>
            <form onSubmit={handleEdit} className="space-y-4 p-6 pt-3">
              <div>
                <label className="mb-2 block text-xs font-semibold text-charcoal-600">คะแนน <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-3">
                  <StarRating value={editForm.rating} onChange={(v) => setEditForm({ ...editForm, rating: v })} />
                  {editForm.rating > 0 && <span className="text-xs font-semibold text-bamboo-600">{ratingLabel(editForm.rating)}</span>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-charcoal-600">ความคิดเห็น</label>
                <textarea
                  className="input-field resize-none"
                  rows={4}
                  placeholder="แบ่งปันประสบการณ์การพักของคุณ..."
                  value={editForm.comment}
                  onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-bold text-charcoal-600 transition-colors hover:bg-stone-50">ยกเลิก</button>
                <button type="submit" disabled={editSubmitting || editForm.rating === 0} className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60">
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
