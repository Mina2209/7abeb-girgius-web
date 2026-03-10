import img1 from '../../assets/457193b7f5e9264d16ed2c788ed32db9dd4a93de.png';
import img2 from '../../assets/f6ee383194c6e932ba28b9861e539c57992b6faa.png';

export interface GalleryImage {
  id: number;
  src: string;
  title: string;
  tags: string[];
  artist: string;
  type: string;
  aiGenerated: boolean;
  uploadDate: string;
}

export const galleryImages: GalleryImage[] = [
  {
    id: 1,
    src: img1,
    title: 'فرح الطفولة',
    tags: ['الأطفال', 'الفرح', 'الحياة الكنسية'],
    artist: 'أمير موريس',
    type: 'صورة مرسومة',
    aiGenerated: false,
    uploadDate: '2024-03-15',
  },
  {
    id: 2,
    src: img2,
    title: 'التأمل والصلاة',
    tags: ['الصلاة', 'التأمل', 'الإيمان'],
    artist: 'Kevin Carden',
    type: 'صورة مصورة',
    aiGenerated: true,
    uploadDate: '2024-03-14',
  },
  {
    id: 3,
    src: img1,
    title: 'محبة الأسرة',
    tags: ['الأرة', 'المحبة', 'الحياة الكنسية'],
    artist: 'مينا انطون',
    type: 'فن قبطى',
    aiGenerated: false,
    uploadDate: '2024-03-13',
  },
  {
    id: 4,
    src: img2,
    title: 'الإيمان والرجاء',
    tags: ['الإيمان', 'الرجاء', 'التأمل'],
    artist: 'أمير موريس',
    type: 'صورة تلوين',
    aiGenerated: true,
    uploadDate: '2024-03-12',
  },
  {
    id: 5,
    src: img1,
    title: 'براءة الطفولة',
    tags: ['الأطفال', 'الفرح', 'البراءة'],
    artist: 'Kevin Carden',
    type: 'صورة مرسومة',
    aiGenerated: false,
    uploadDate: '2024-03-11',
  },
  {
    id: 6,
    src: img2,
    title: 'قوة الصلاة',
    tags: ['الصلاة', 'القوة', 'الإيمان'],
    artist: 'مينا انطون',
    type: 'صورة مصورة',
    aiGenerated: true,
    uploadDate: '2024-03-10',
  },
  {
    id: 7,
    src: img1,
    title: 'حب العائلة',
    tags: ['الأسرة', 'المحبة', 'الأطفال'],
    artist: 'أمير موريس',
    type: 'فن قبطى',
    aiGenerated: false,
    uploadDate: '2024-03-09',
  },
  {
    id: 8,
    src: img2,
    title: 'السلام الداخلي',
    tags: ['السلام', 'التأمل', 'الصلاة'],
    artist: 'Kevin Carden',
    type: 'صورة تلوين',
    aiGenerated: false,
    uploadDate: '2024-03-08',
  },
  {
    id: 9,
    src: img1,
    title: 'الفرح بالرب',
    tags: ['الفرح', 'الإيمان', 'الأطفال'],
    artist: 'مينا انطون',
    type: 'صورة مرسومة',
    aiGenerated: true,
    uploadDate: '2024-03-07',
  },
  {
    id: 10,
    src: img2,
    title: 'محبة الله',
    tags: ['المحبة', 'الإيمان', 'الصلاة'],
    artist: 'أمير موريس',
    type: 'صورة مصورة',
    aiGenerated: false,
    uploadDate: '2024-03-06',
  },
  {
    id: 11,
    src: img1,
    title: 'بركة الأطفال',
    tags: ['الأطفال', 'البركة', 'الحياة الكنسية'],
    artist: 'Kevin Carden',
    type: 'فن قبطى',
    aiGenerated: true,
    uploadDate: '2024-03-05',
  },
  {
    id: 12,
    src: img2,
    title: 'النعمة الإلهية',
    tags: ['النعمة', 'الإيمان', 'التأمل'],
    artist: 'مينا انطون',
    type: 'صورة تلوين',
    aiGenerated: false,
    uploadDate: '2024-03-04',
  },
];

// Get unique artists and types from the data
export const allArtists = Array.from(new Set(galleryImages.map(img => img.artist)));
export const allTypes = Array.from(new Set(galleryImages.map(img => img.type)));
