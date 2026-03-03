'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Eye, Power, PowerOff, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';

export default function StaffManagementPage() {
  const router = useRouter();
  const { ready, user } = useAuthGuard({ allowedRoles: ['admin'] });
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffForm, setStaffForm] = useState({ 
    name: '', email: '', password: '', phone: '', role: 'room_staff',
    address: '', subdistrict: '', district: '', province: '', postal_code: ''
  });

  // Modal State
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    fetchStaff();
  }, [ready]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/staff');
      setStaffList(res.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลพนักงานได้');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/staff', staffForm);
      toast.success('สร้างบัญชีพนักงานสำเร็จ');
      setStaffForm({ 
        name: '', email: '', password: '', phone: '', role: 'room_staff',
        address: '', subdistrict: '', district: '', province: '', postal_code: ''
      });
      fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'สร้างพนักงานไม่สำเร็จ');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    if (user?.id === id) {
      toast.error('ไม่สามารถเปลี่ยนสถานะตัวเองได้');
      return;
    }
    try {
      await api.put(`/auth/staff/${id}/status`, { status: !currentStatus });
      toast.success(currentStatus ? 'ระงับบัญชีสำเร็จ' : 'เปิดใช้งานบัญชีสำเร็จ');
      fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เปลี่ยนสถานะไม่สำเร็จ');
    }
  };

  const handleDeleteStaff = async (id: number) => {
     if (user?.id === id) {
      toast.error('ไม่สามารถลบบัญชีตัวเองได้');
      return;
    }
    if(confirm('คุณแน่ใจหรือไม่ว่าต้องการลบพนักงานคนนี้? ข้อมูลที่เกี่ยวข้องอาจทำให้ลบไม่ได้ ให้ใช้การระงับบัญชีแทน')) {
        try {
            await api.delete(`/auth/staff/${id}`);
            toast.success('ลบพนักงานสำเร็จ');
            fetchStaff();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'ลบพนักงานไม่สำเร็จ (อาจมีข้อมูลผูกพัน ให้ลองระงับบัญชีแทน)');
        }
    }
  }

  const openStaffDetails = (staff: any) => {
    setSelectedStaff(staff);
    setIsModalOpen(true);
  };

  const closeStaffDetails = () => {
    setIsModalOpen(false);
    setSelectedStaff(null);
  };

  return (
    <div className="min-h-screen pt-16 bg-gray-50 relative">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/admin')} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">จัดการพนักงาน</h1>
            <p className="text-gray-500 mt-1">เพิ่มและดูรายชื่อพนักงานในระบบ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6 lg:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <UserPlus size={20} className="text-indigo-600" />
              เพิ่มพนักงานใหม่
            </h2>
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
                <input type="text" required className="input-field" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                <input type="email" required className="input-field" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
                  <input type="password" required className="input-field" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                  <input type="tel" className="input-field" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ตำแหน่ง</label>
                <select className="input-field" value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}>
                  <option value="room_staff">พนักงานจัดการห้องพัก</option>
                  <option value="boat_staff">พนักงานจัดการเรือ</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3">ที่อยู่ (ตัวเลือก)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ที่อยู่ / หมู่บ้าน / ถนน</label>
                    <textarea className="input-field" rows={2} value={staffForm.address} onChange={(e) => setStaffForm({ ...staffForm, address: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">ตำบล/แขวง</label>
                      <input type="text" className="input-field" value={staffForm.subdistrict} onChange={(e) => setStaffForm({ ...staffForm, subdistrict: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">อำเภอ/เขต</label>
                      <input type="text" className="input-field" value={staffForm.district} onChange={(e) => setStaffForm({ ...staffForm, district: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">จังหวัด</label>
                      <input type="text" className="input-field" value={staffForm.province} onChange={(e) => setStaffForm({ ...staffForm, province: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">รหัสไปรษณีย์</label>
                      <input type="text" className="input-field" value={staffForm.postal_code} onChange={(e) => setStaffForm({ ...staffForm, postal_code: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full mt-4">สร้างบัญชี</button>
            </form>
          </div>

          <div className="card overflow-hidden lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อ</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ติดต่อ</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ตำแหน่ง</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">กำลังโหลด...</td></tr>
                  ) : staffList.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">ยังไม่มีพนักงาน</td></tr>
                  ) : (
                    staffList.map((s: any) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{s.first_name} {s.last_name}</td>
                        <td className="px-4 py-3">
                          <p className="text-gray-900">{s.email}</p>
                          <p className="text-xs text-gray-500">{s.phone || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            s.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            s.role === 'room_staff' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'
                          }`}>
                            {s.role === 'admin' ? 'Admin' : s.role === 'room_staff' ? 'Room Staff' : 'Boat Staff'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {s.status ? 'ใช้งาน' : 'ระงับ'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                             <button onClick={() => openStaffDetails(s)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="ดูข้อมูลพนักงาน">
                                <Eye size={18} />
                             </button>
                             {s.id !== user?.id && (
                                <>
                                    <button 
                                        onClick={() => handleToggleStatus(s.id, s.status)} 
                                        className={`p-1.5 rounded-lg transition-colors ${s.status ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : 'text-green-500 hover:text-green-700 hover:bg-green-50'}`} 
                                        title={s.status ? "ระงับการใช้งาน" : "เปิดใช้งาน"}
                                    >
                                        {s.status ? <PowerOff size={18} /> : <Power size={18} />}
                                    </button>
                                </>
                             )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Details Modal */}
      {isModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">ข้อมูลพนักงาน</h3>
              <button onClick={closeStaffDetails} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4 border-b border-gray-100 pb-4">
                    <div className="text-sm text-gray-500 font-medium">ชื่อ-นามสกุล</div>
                    <div className="col-span-2 text-sm text-gray-900 font-medium">{selectedStaff.first_name} {selectedStaff.last_name}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-gray-100 pb-4">
                    <div className="text-sm text-gray-500 font-medium">อีเมล</div>
                    <div className="col-span-2 text-sm text-gray-900">{selectedStaff.email}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-gray-100 pb-4">
                    <div className="text-sm text-gray-500 font-medium">เบอร์โทร</div>
                    <div className="col-span-2 text-sm text-gray-900">{selectedStaff.phone || '-'}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-gray-100 pb-4">
                    <div className="text-sm text-gray-500 font-medium">ตำแหน่ง</div>
                    <div className="col-span-2 text-sm text-gray-900">
                        {selectedStaff.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 
                         selectedStaff.role === 'room_staff' ? 'พนักงานจัดการห้องพัก' : 'พนักงานจัดการเรือ'}
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-gray-100 pb-4">
                    <div className="text-sm text-gray-500 font-medium">สถานะ</div>
                    <div className="col-span-2 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${selectedStaff.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {selectedStaff.status ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'}
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pb-2">
                    <div className="text-sm text-gray-500 font-medium">ที่อยู่</div>
                    <div className="col-span-2 text-sm text-gray-900">
                        {selectedStaff.address ? (
                            <p className="leading-relaxed">
                                {selectedStaff.address} <br/>
                                ต.{selectedStaff.subdistrict || '-'} อ.{selectedStaff.district || '-'} <br/>
                                จ.{selectedStaff.province || '-'} {selectedStaff.postal_code || ''}
                            </p>
                        ) : '-'}
                    </div>
                </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                {selectedStaff.id !== user?.id && (
                    <button 
                        onClick={() => handleDeleteStaff(selectedStaff.id)}
                        className="text-sm text-red-600 hover:text-red-800 hover:underline font-medium"
                    >
                        ลบพนักงาน
                    </button>
                )}
                <button onClick={closeStaffDetails} className="btn-primary ml-auto px-6">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
