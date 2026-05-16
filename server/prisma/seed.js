import { PrismaClient, FileType } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  // Create default admin user
  const adminPassword = await bcrypt.hash('@dmin123$', 10);
  const editorPassword = await bcrypt.hash('@dmin123$', 10);
  
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      role: 'ADMIN'
    }
  });

  await prisma.user.upsert({
    where: { username: 'editor' },
    update: {},
    create: {
      username: 'editor',
      password: editorPassword,
      role: 'EDITOR'
    }
  });

  console.log('Default users created: admin/TEmPpasSWordFoRaDMin12e4## and editor/TEmPpasSWordFoRaDMin12e4##');

  const hymns = [
    {
      title: 'أصليله',
      tags: ['اجتماعات صلاه', 'تسليم', 'صلاة'],
      files: [
        { type: FileType.VIDEO_MONTAGE, fileUrl: 'blabla', duration: 289 },
        { type: FileType.MUSIC_AUDIO, fileUrl: 'blabla', duration: 289 },
        { type: FileType.POWERPOINT, fileUrl: 'blabla' }
      ],
      lyricContent: 'أصليله أصليله\nأسلمله حياتي كلها\nأصليله أصليله\nوأخليه يرتب أموري'
    },
    {
      title: 'أعروس الفادى القبطية',
      tags: ['الكنيسة', 'النيروز'],
      files: [
        { type: FileType.VIDEO_MONTAGE, fileUrl: 'blabla', duration: 284 },
        { type: FileType.MUSIC_AUDIO, fileUrl: 'blabla', duration: 284 },
        { type: FileType.POWERPOINT, fileUrl: 'blabla' }
      ],
      lyricContent: 'أعروس الفادي القبطية\nيا كنيستي يا أرثوذكسية\nمهما الزمن طال عليكي\nباقي مسيحك فاديكي'
    },
    {
      title: 'احكى يا تاريخ',
      tags: ['النيروز'],
      files: [
        { type: FileType.VIDEO_MONTAGE, fileUrl: 'blabla', duration: 208 },
        { type: FileType.MUSIC_AUDIO, fileUrl: 'blabla', duration: 208 },
        { type: FileType.POWERPOINT, fileUrl: 'blabla' }
      ],
      lyricContent: 'احكي يا تاريخ عن أمجادي\nعن إيماني وعن أجدادي\nعن شهداء قدموا حياتهم\nفداء لإيمانهم وكنيستهم'
    },
    {
      title: 'احلى ما فى حياتى انت',
      tags: ['العشرة مع الله', 'جمال ربنا'],
      files: [
        { type: FileType.VIDEO_MONTAGE, fileUrl: 'blabla', duration: 199 },
        { type: FileType.MUSIC_AUDIO, fileUrl: 'blabla', duration: 199 },
        { type: FileType.POWERPOINT, fileUrl: 'blabla' }
      ],
      lyricContent: 'أحلى ما في حياتي انت\nأغلى ما في قلبي انت\nيا يسوع حبيبي انت\nكل عمري ليك انت'
    },
    {
      title: 'اختبرتنى الهى',
      tags: ['العشرة مع الله', 'محبة الله'],
      files: [
        { type: FileType.VIDEO_MONTAGE, fileUrl: 'blabla', duration: 253 },
        { type: FileType.MUSIC_AUDIO, fileUrl: 'blabla', duration: 253 },
        { type: FileType.POWERPOINT, fileUrl: 'blabla' }
      ],
      lyricContent: 'اختبرتني إلهي\nوعرفت كل أفكاري\nسابقتني محبتك\nوملكت على قلبي'
    },
    {
      title: 'ارضى افرحى',
      tags: ['الميلاد'],
      files: [
        { type: FileType.VIDEO_MONTAGE, fileUrl: 'blabla', duration: 225 },
        { type: FileType.MUSIC_AUDIO, fileUrl: 'blabla', duration: 225 },
        { type: FileType.POWERPOINT, fileUrl: 'blabla' }
      ],
      lyricContent: 'ارضي افرحي يا بيت لحم\nميلاد المسيح فيكي تم\nنجمة في السما ظهرت\nوعلى المغارة استقرت'
    }
  ];

  for (const hymn of hymns) {
    await prisma.hymn.create({
      data: {
        title: hymn.title,
        files: { create: hymn.files },
        lyric: hymn.lyricContent ? { create: { content: hymn.lyricContent } } : undefined,
        tags: {
          connectOrCreate: hymn.tags.map(tag => ({
            where: { name: tag },
            create: { name: tag }
          }))
        }
      }
    });
  }

  console.log('Sample hymns inserted successfully.');

  const sayings = [
    {
      author: 'القديس أغسطينوس',
      authorImage: 'https://example.com/augustine.jpg',
      source: 'العظة على الجبل',
      content: 'أحبب ثم افعل ما تشاء.',
      tags: ['المحبة', 'الحياة المسيحية']
    },
    {
      author: 'القديس أنطونيوس الكبير',
      authorImage: 'https://example.com/anthony.jpg',
      source: 'سيرته',
      content: 'من يعرف ذاته يعرف الله.',
      tags: ['الاتضاع', 'معرفة الله']
    },
    {
      author: 'القديس يوحنا ذهبي الفم',
      authorImage: 'https://example.com/john.jpg',
      source: 'عظات على إنجيل متى',
      content: 'لا تطلب ما للآخرين، بل اشكر الله على ما لك.',
      tags: ['الشكر', 'القناعة']
    }
  ];

  for (const saying of sayings) {
    await prisma.saying.create({
      data: {
        author: saying.author,
        authorImage: saying.authorImage,
        source: saying.source,
        content: saying.content,
        tags: {
          connectOrCreate: saying.tags.map(tag => ({
            where: { name: tag },
            create: { name: tag }
          }))
        }
      }
    });
  }

  console.log('Sample sayings inserted successfully.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
