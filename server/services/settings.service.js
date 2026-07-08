import { prisma } from './prisma.js';

const DEFAULTS = {
  default_book_cover:
    'https://images.unsplash.com/photo-1569690484582-58b478f46805?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rJTIwY292ZXIlMjBwbGFjZWhvbGRlcnxlbnwxfHx8fDE3Njg1NzEyMTd8MA&ixlib=rb-4.1.0&q=80&w=1080',
  site_sections_visibility: null,
  powerpoint_data: null,
};

export const settingsService = {
  async getSingleton() {
    const row = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    if (!row) {
      // create a row with defaults (singleton id=1)
      await prisma.siteSettings.create({
        data: {
          id: 1,
          default_book_cover: DEFAULTS.default_book_cover,
          site_sections_visibility: DEFAULTS.site_sections_visibility,
          powerpoint_data: DEFAULTS.powerpoint_data,
        },
      });
    }

    const created = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    return {
      default_book_cover: created?.default_book_cover ?? DEFAULTS.default_book_cover,
      site_sections_visibility: created?.site_sections_visibility,
      powerpoint_data: created?.powerpoint_data,
    };
  },

  async upsert({ default_book_cover, site_sections_visibility, powerpoint_data }) {
    await prisma.siteSettings.upsert({
      where: { id: 1 },
      update: {
        ...(default_book_cover !== undefined ? { default_book_cover } : {}),
        ...(site_sections_visibility !== undefined
          ? { site_sections_visibility }
          : {}),
        ...(powerpoint_data !== undefined ? { powerpoint_data } : {}),
      },
      create: {
        id: 1,
        default_book_cover:
          default_book_cover ?? DEFAULTS.default_book_cover,
        site_sections_visibility:
          site_sections_visibility ?? DEFAULTS.site_sections_visibility,
        powerpoint_data: powerpoint_data ?? DEFAULTS.powerpoint_data,
      },
    });
  },
};

