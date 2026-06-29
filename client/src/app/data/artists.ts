export interface Artist {
  id: string | number;
  name: string;
  bio: string;
  role: string;
  profileImage: string;
  socialMedia: {
    facebook?: string;
    instagram?: string;
    website?: string;
    email?: string;
  };
  joinDate: string;
  specialty: string[];
}

export const artists: Artist[] = [
  {
    id: 1,
    name: 'أمير موريس',
    bio: 'فنان قبطي معاصر متخصص في الفن المسيحي والأيقونات. يمزج بين الأساليب التقليدية والحديثة لإنتاج أعمال فنية تعكس الإيمان والروحانية. يهدف من خلال فنه إلى نقل رسالة المحبة والسلام إلى القلوب.',
    role: 'فنان قبطي معاصر',
    profileImage: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&h=400&fit=crop',
    socialMedia: {
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
      email: 'amir.maurice@example.com',
    },
    joinDate: '2023-01-15',
    specialty: ['الفن القبطي', 'الأيقونات', 'الرسم'],
  },
  {
    id: 2,
    name: 'Kevin Carden',
    bio: 'مصور فوتوغرافي محترف متخصص في التصوير الروحي والديني. يلتقط لحظات الصلاة والتأمل بطريقة فنية تبرز جمال الإيمان. عمل مع العديد من الكنائس والمؤسسات الدينية لتوثيق الحياة الروحية.',
    role: 'مصور فوتوغرافي',
    profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    socialMedia: {
      website: 'https://kevincarden.com',
      instagram: 'https://instagram.com/kevincarden',
      email: 'kevin@example.com',
    },
    joinDate: '2023-03-20',
    specialty: ['التصوير الفوتوغرافي', 'التصوير الروحي'],
  },
  {
    id: 3,
    name: 'مينا انطون',
    bio: 'رسام ومصمم متخصص في الفن القبطي التقليدي والتلوين. يعمل على إحياء التراث الفني القبطي من خلال أعماله التي تجمع بين الأصالة والإبداع. شارك في العديد من المعارض الفنية المحلية والدولية.',
    role: 'رسام ومصمم',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    socialMedia: {
      facebook: 'https://facebook.com/minaanton',
      instagram: 'https://instagram.com/minaanton',
      website: 'https://minaanton.com',
      email: 'mina@example.com',
    },
    joinDate: '2022-11-10',
    specialty: ['الفن القبطي', 'التلوين', 'التصميم'],
  },
];

// Helper function to get artist by name
export const getArtistByName = (name: string): Artist | undefined => {
  return artists.find(artist => artist.name === name );
};

// Helper function to get artist by ID
export const getArtistById = (id: number): Artist | undefined => {
  return artists.find(artist => artist.id === id);
};
