import { User, Mail, Church, Briefcase, Calendar, Edit, Camera, Lock, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ChurchRoleDropdown } from './ChurchRoleDropdown';
import { ServicesDropdown } from './ServicesDropdown';
import { getImageUrl } from '../utils/getImageUrl';

interface ProfilePageProps {
  onNavigateToFavorites?: () => void;
}

export function ProfilePage({ onNavigateToFavorites }: ProfilePageProps) {
  const { profile, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    fullName: '',
    churchName: '',
    churchRole: '',
    services: [] as string[],
  });

  useEffect(() => {
    if (profile) {
      setEditedProfile({
        fullName: profile.full_name,
        churchName: profile.church_name,
        churchRole: profile.church_role,
        services: Array.isArray(profile.services) ? profile.services : [],
      });
    }
  }, [profile]);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">جارٍ تحميل الملف الشخصي...</p>
        </div>
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert image to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      
      // Upload avatar to server (base64)
      if (!profile?.id) return;
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ avatar_url: base64String }),
      });

      // Refresh profile to show new image
      refreshProfile();

    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      if (!profile?.id) return;

      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          full_name: editedProfile.fullName,
          church_name: editedProfile.churchName,
          church_role: editedProfile.churchRole,
          services: editedProfile.services,
        }),
      });

      setIsEditing(false);
      await refreshProfile();
    } catch {
      // Keep UI stable; refreshProfile will re-sync from server when possible
      setIsEditing(false);
    }
  };


  // Get join date
  const joinDate = new Date(profile.created_at).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <div className="relative group flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden">
              {profile.avatar_url ? (
                <img src={getImageUrl(profile.avatar_url)} alt={profile.full_name} loading="lazy" decoding="async" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-12 h-12" />
              )}
            </div>
            {/* Edit button overlay */}
            <label 
              htmlFor="avatar-upload"
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="تغيير الصورة الشخصية"
            >
              <Camera className="w-8 h-8 text-white" />
            </label>
            <input
              id="avatar-upload"
              name="avatar"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{profile.full_name}</h1>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <Edit className="w-4 h-4" />
                <span>{isEditing ? 'إلغاء' : 'تعديل الملف الشخصي'}</span>
              </button>
            </div>
            <div className="space-y-2 text-muted-foreground text-sm sm:text-base">
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>انضم في {joinDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-card rounded-xl p-4 sm:p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4">المعلومات الشخصية</h2>
        <div className="space-y-4">
          {isEditing ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">الاسم الكامل</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    id="profile-full-name"
                    name="full_name"
                    type="text"
                    value={editedProfile.fullName}
                    onChange={(e) => setEditedProfile({ ...editedProfile, fullName: e.target.value })}
                    className="w-full pr-10 pl-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm sm:text-base"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">اسم الكنيسة</label>
                <div className="relative">
                  <Church className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    id="profile-church-name"
                    name="church_name"
                    type="text"
                    value={editedProfile.churchName}
                    onChange={(e) => setEditedProfile({ ...editedProfile, churchName: e.target.value })}
                    className="w-full pr-10 pl-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm sm:text-base"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">الدور في الكنيسة</label>
                <ChurchRoleDropdown
                  value={editedProfile.churchRole}
                  onChange={(value) => setEditedProfile({ ...editedProfile, churchRole: value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">خدمات مسؤول عنها/ تخدم بها</label>
                <ServicesDropdown
                  value={editedProfile.services}
                  onChange={(value) => setEditedProfile({ ...editedProfile, services: value })}
                  required
                />
              </div>
              <button
                onClick={handleSave}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition-opacity text-sm sm:text-base"
              >
                حفظ التغييرات
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm sm:text-base">
                <Church className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">اسم الكنيسة</p>
                  <p className="font-medium">{profile.church_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm sm:text-base">
                <Briefcase className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">الدور في الكنيسة</p>
                  <p className="font-medium">{profile.church_role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm sm:text-base">
                <Users className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">الخدمات التي تقدمها</p>
                  <p className="font-medium">
                    {profile.services && Array.isArray(profile.services) && profile.services.length > 0 
                      ? profile.services.join(' • ') 
                      : 'لا يوجد'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-card rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold mb-2">الأمان</h2>
            <p className="text-sm text-muted-foreground">إدارة كلمة المرور وإعدادات الأمان</p>
          </div>
        </div>
        <button
          onClick={() => setIsChangePasswordOpen(true)}
          className="flex items-center gap-2 px-4 py-3 border border-border rounded-lg hover:bg-muted transition-colors w-full md:w-auto"
        >
          <Lock className="w-5 h-5" />
          <span>تغيير كلمة المرور</span>
        </button>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}