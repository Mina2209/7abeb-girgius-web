export type ContentId = string | number;

export type HymnFileType = 'Video montage' | 'Video PowerPoint' | 'PowerPoint file' | 'Music';

export interface HymnFile {
  type: HymnFileType;
  name: string;
  url: string;
  size?: number;
  uid?: string;
}

export interface Hymn {
  id: ContentId;
  title: string;
  duration: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  fileTypes: HymnFileType[];
  lyrics: string;
  files?: HymnFile[];
}

export interface GalleryImage {
  id: ContentId;
  src: string;
  title: string;
  tags: string[];
  artist: string;
  type: string;
  aiGenerated: boolean;
  uploadDate: string;
  published: boolean;
}

export interface Saying {
  id: ContentId;
  quote: string;
  author: string;
  authorImage: string;
  tags: string[];
  source: string;
  dateAdded: string;
}
