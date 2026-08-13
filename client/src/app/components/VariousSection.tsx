import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  Eye,
  Presentation,
  FolderOpen,
  Search,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Edit3,
  Check,
  X,
  Edit2,
  Upload,
  RefreshCw,
  Loader2,
  Tag,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";
import { TagFilter } from "./TagFilter";
import { useTags } from "../hooks/useTags";
import { useAuth } from "../contexts/AuthContext";
import { useIsEditor } from "../utils/adminUtils";
import { apiRequest, apiGetJson } from "../services/apiClient";
import { createTag, notifyTagsUpdated } from "../services/tagsService";
import { downloadFile } from "../utils/download";
import { trackEvent } from "../services/analytics";
import { useSearchAnalytics } from "../hooks/useSearchAnalytics";

interface PowerpointFile {
  id: string;
  name: string;
  url: string;
  tags: string[];
}

interface PowerpointCategory {
  id: string;
  title: string;
  files: PowerpointFile[];
}

type SortOption = "default" | "alpha-asc" | "alpha-desc" | "files-most" | "files-least";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function sortCategories(cats: PowerpointCategory[], sort: SortOption): PowerpointCategory[] {
  const sorted = [...cats];
  switch (sort) {
    case "alpha-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title, "ar"));
    case "alpha-desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title, "ar"));
    case "files-most":
      return sorted.sort((a, b) => b.files.length - a.files.length);
    case "files-least":
      return sorted.sort((a, b) => a.files.length - b.files.length);
    default:
      return sorted;
  }
}

// The display name intentionally drops the extension (e.g. "عرض القداس" instead of
// "عرض القداس.pptx"), so recover the real extension from the S3 key embedded in the proxy
// URL before downloading — otherwise the file saves with no extension at all.
function getDownloadName(name: string, url: string): string {
  if (/\.(ppt|pptx|pdf)$/i.test(name)) return name;
  const key = decodeURIComponent(url.match(/[?&]key=([^&]+)/)?.[1] ?? "");
  const ext = key.match(/\.[^./]+$/)?.[0] ?? "";
  if (/^\.(ppt|pptx|pdf)$/i.test(ext)) return `${name}${ext}`;
  return name;
}

export function VariousSection() {
  const isEditor = useIsEditor();
  const { accessToken } = useAuth();
  const { tags: allTags, reloadTags } = useTags();

  const [categories, setCategories] = useState<PowerpointCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [uploadingFileId, setUploadingFileId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);
  const [tagPopoverFileId, setTagPopoverFileId] = useState<string | null>(null);
  const [tagPopoverPos, setTagPopoverPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [tagSearch, setTagSearch] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const filtersContainerRef = useRef<HTMLDivElement>(null);
  const debouncedCategories = useDebounce(categories, 800);
  const initialLoadDone = useRef(false);

  const saveToServer = useCallback(async (cats: PowerpointCategory[]) => {
    setIsSaving(true);
    try {
      await apiRequest("/api/auth/settings/powerpoint", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { powerpoint_data: cats } }),
      });
    } catch {
      toast.error("فشل حفظ البيانات");
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (debouncedCategories.length === 0 && categories.length === 0) return;
    saveToServer(debouncedCategories);
  }, [debouncedCategories, saveToServer, categories.length]);

  useEffect(() => {
    setIsLoading(true);
    (async () => {
      try {
        const data = await apiGetJson<{ settings?: { powerpoint_data?: PowerpointCategory[] } }>(
          "/api/auth/settings/powerpoint"
        );
        if (data?.settings?.powerpoint_data && Array.isArray(data.settings.powerpoint_data)) {
          const normalized = data.settings.powerpoint_data.map((cat) => ({
            ...cat,
            files: (cat.files || []).map((f: any) => ({
              ...f,
              tags: f.tags || [],
            })),
          }));
          setCategories(normalized);
        }
      } catch {
        toast.error("فشل تحميل بيانات بوربوينت متنوعة");
      } finally {
        setIsLoading(false);
        initialLoadDone.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    if (isSortOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSortOpen]);

  const uploadToS3 = async (file: File): Promise<string | null> => {
    try {
      const presignRes = await apiGetJson<{ url: string; key: string }>(
        "/api/uploads/presign",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            folder: "PowerPoints",
          }),
        }
      );
      await fetch(presignRes.url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
        body: file,
      });
      return `/api/uploads/url?key=${encodeURIComponent(presignRes.key)}`;
    } catch {
      toast.error("فشل رفع الملف");
      return null;
    }
  };

  const addCategory = () => {
    const newCat: PowerpointCategory = {
      id: `cat-${Date.now()}`,
      title: "قسم جديد",
      files: [],
    };
    setCategories([newCat, ...categories]);
  };

  const deleteCategory = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا القسم بجميع ملفاته؟")) {
      setCategories(categories.filter((cat) => cat.id !== id));
    }
  };

  const moveCategory = (index: number, direction: "up" | "down") => {
    const sorted = sortCategories(categories, sortBy);
    const newCategories = [...categories];
    const catToMove = sorted[index];
    const originalIndex = newCategories.findIndex((c) => c.id === catToMove.id);
    const swapCat = direction === "up" ? sorted[index - 1] : sorted[index + 1];
    if (!swapCat) return;
    const swapIndex = newCategories.findIndex((c) => c.id === swapCat.id);
    [newCategories[originalIndex], newCategories[swapIndex]] = [newCategories[swapIndex], newCategories[originalIndex]];
    setCategories(newCategories);
  };

  const updateCategoryTitle = (id: string, newTitle: string) => {
    setCategories(categories.map((cat) => (cat.id === id ? { ...cat, title: newTitle } : cat)));
    setEditingId(null);
  };

  const addFile = async (catId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ppt,.pptx,.pdf";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fileId = `p-${Date.now()}`;
      setUploadingFileId(fileId);
      const url = await uploadToS3(file);
      setUploadingFileId(null);
      const newFile: PowerpointFile = {
        id: fileId,
        name: file.name.split(".").slice(0, -1).join(".") || file.name,
        url: url || "",
        tags: [],
      };
      setCategories(
        categories.map((cat) =>
          cat.id === catId ? { ...cat, files: [...cat.files, newFile] } : cat
        )
      );
    };
    input.click();
  };

  const updateFileSource = async (catId: string, fileId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ppt,.pptx,.pdf";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingFileId(fileId);
      const url = await uploadToS3(file);
      setUploadingFileId(null);
      setCategories(
        categories.map((cat) => {
          if (cat.id !== catId) return cat;
          return {
            ...cat,
            files: cat.files.map((f) =>
              f.id === fileId
                ? { ...f, name: file.name.split(".").slice(0, -1).join(".") || file.name, url: url || f.url }
                : f
            ),
          };
        })
      );
    };
    input.click();
  };

  const deleteFile = (catId: string, fileId: string) => {
    setCategories(
      categories.map((cat) =>
        cat.id === catId ? { ...cat, files: cat.files.filter((f) => f.id !== fileId) } : cat
      )
    );
  };

  const moveFile = (catId: string, fileIndex: number, direction: "up" | "down") => {
    setCategories(
      categories.map((cat) => {
        if (cat.id !== catId) return cat;
        const newFiles = [...cat.files];
        const newIndex = direction === "up" ? fileIndex - 1 : fileIndex + 1;
        if (newIndex >= 0 && newIndex < newFiles.length) {
          [newFiles[fileIndex], newFiles[newIndex]] = [newFiles[newIndex], newFiles[fileIndex]];
          return { ...cat, files: newFiles };
        }
        return cat;
      })
    );
  };

  const updateFileName = (catId: string, fileId: string, newName: string) => {
    setCategories(
      categories.map((cat) => {
        if (cat.id !== catId) return cat;
        return {
          ...cat,
          files: cat.files.map((f) => (f.id === fileId ? { ...f, name: newName } : f)),
        };
      })
    );
    setEditingId(null);
  };

  const toggleFileTag = (catId: string, fileId: string, tagName: string) => {
    setCategories(
      categories.map((cat) => {
        if (cat.id !== catId) return cat;
        return {
          ...cat,
          files: cat.files.map((f) => {
            if (f.id !== fileId) return f;
            const currentTags = f.tags || [];
            const newTags = currentTags.includes(tagName)
              ? currentTags.filter((t) => t !== tagName)
              : [...currentTags, tagName];
            return { ...f, tags: newTags };
          }),
        };
      })
    );
  };

  const availableTagNames = allTags.map((t) => t.name);

  const handlePreview = (name: string, url: string) => {
    setPreviewFile({ name, url });
    trackEvent('powerpoint_view', { contentType: 'powerpoint', contentName: name });
  };

  const filteredTagNames = availableTagNames.filter((t) =>
    t.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const handleCreateAndToggleTag = async (catId: string, fileId: string, tagName: string) => {
    setCreatingTag(true);
    try {
      await createTag({ name: tagName }, accessToken);
      reloadTags();
      toggleFileTag(catId, fileId, tagName);
      notifyTagsUpdated();
      toast.success(`تم إضافة الموضوع "${tagName}"`);
    } catch {
      toast.error("فشل إضافة الموضوع");
    } finally {
      setCreatingTag(false);
    }
  };

  const hasSearch = searchQuery.trim().length > 0;
  const hasTagFilter = selectedTags.length > 0;

  const filteredCategories = sortCategories(
    categories
      .map((category) => ({
        ...category,
        files: category.files.filter(
          (file) =>
            (file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (file.tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))) &&
            (selectedTags.length === 0 ||
            selectedTags.some((tag) => (file.tags || []).includes(tag)))
        ),
      }))
      .filter((category) => hasSearch || hasTagFilter || isEditor || category.files.length > 0),
    sortBy
  );

  useSearchAnalytics(searchQuery, {
    section: "various",
    getResultCount: () =>
      filteredCategories.reduce((sum, c) => sum + c.files.length, 0),
  });

  const sortLabels: Record<SortOption, string> = {
    "default": "الترتيب الافتراضي",
    "alpha-asc": "أ - ي",
    "alpha-desc": "ي - أ",
    "files-most": "الأكثر ملفات",
    "files-least": "الأقل ملفات",
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Section Header - normal flow container, scrolls up naturally */}
      <div className="pb-6">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="mb-2 font-bold text-2xl sm:text-3xl lg:text-[36px]">
            بوربوينت متنوعة
          </h1>
          {isSaving && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              جاري الحفظ...
            </span>
          )}
        </div>
        <p className="text-muted-foreground leading-relaxed">
          مكتبة العروض التقديمية المنظمة حسب التصنيفات والخدمات الكنسية
        </p>

      {isEditor && (
        <div className="mt-4 mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                أدوات التحرير:
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={addCategory}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>قسم جديد</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Sticky Filter Toolbar - pinned at the top while scrolling */}
      <div className="sticky z-50 isolate bg-background border-b border-border/50 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] py-3 sm:py-4" style={{ top: 'var(--app-header-height)' }}>
      <div className="flex items-center gap-2 flex-wrap" ref={filtersContainerRef}>
        <div className="flex-1 sm:flex-initial">
          <TagFilter
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            onSearchChange={setSearchQuery}
            searchQuery={searchQuery}
            showSearch={false}
            icon={Tag}
            containerRef={filtersContainerRef}
            availableTopics={availableTagNames}
          />
        </div>

        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث في الملفات..."
            className="pr-10 bg-card border-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="relative flex-shrink-0" ref={sortDropdownRef}>
          <button
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="flex items-center justify-center gap-2 h-10 px-4 bg-card border border-border rounded-xl hover:bg-muted transition-colors text-sm"
          >
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <span className="hidden sm:inline text-muted-foreground">ترتيب</span>
          </button>
          {isSortOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-50 py-1 animate-in fade-in duration-150">
              {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setSortBy(option);
                    setIsSortOpen(false);
                  }}
                  className={`w-full text-right px-4 py-2.5 text-sm transition-colors ${
                    sortBy === option
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {sortLabels[option]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="mr-3 text-muted-foreground">جاري التحميل...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <Accordion
            type="multiple"
            defaultValue={filteredCategories.length > 0 ? [filteredCategories[0].id] : []}
            className="w-full space-y-3"
          >
            {filteredCategories.map((category, catIndex) => (
              <AccordionItem
                key={category.id}
                value={category.id}
                className="relative z-0 isolate border border-border rounded-xl bg-card overflow-hidden px-0"
              >
                <div className="flex items-center group/cat px-4 border-b border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                  {isEditor && (
                    <div className="flex flex-col gap-0.5 ml-3">
                      <button
                        onClick={() => moveCategory(catIndex, "up")}
                        disabled={catIndex === 0}
                        className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveCategory(catIndex, "down")}
                        disabled={catIndex === filteredCategories.length - 1}
                        className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex-1 flex items-center min-w-0">
                    {editingId === category.id ? (
                      <div className="flex items-center gap-2 flex-1 py-4">
                        <Input
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          className="h-9 py-1 bg-background"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") updateCategoryTitle(category.id, tempName);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          onClick={() => updateCategoryTitle(category.id, tempName)}
                          className="p-1.5 bg-primary text-primary-foreground rounded-md shrink-0"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 bg-muted text-muted-foreground rounded-md shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <AccordionTrigger className="flex-1 hover:no-underline py-4 text-right">
                        <div className="text-right">
                          <h3 className="font-bold text-xl md:text-2xl leading-tight">
                            {category.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {category.files.length} ملف متوفر
                          </p>
                        </div>
                      </AccordionTrigger>
                    )}
                  </div>

                  {isEditor && !editingId && (
                    <div className="flex items-center gap-1 ml-4 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingId(category.id);
                          setTempName(category.title);
                        }}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors"
                        title="تعديل الاسم"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        title="حذف القسم"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {category.files.map((file, fileIndex) => (
                      <div
                        key={file.id}
                        className="group/file flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {isEditor && (
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button
                                onClick={() => moveFile(category.id, fileIndex, "up")}
                                disabled={fileIndex === 0}
                                className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-20"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => moveFile(category.id, fileIndex, "down")}
                                disabled={fileIndex === category.files.length - 1}
                                className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-20"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <div className="shrink-0 w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                            {uploadingFileId === file.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Presentation className="w-4 h-4" />
                            )}
                          </div>

                          {editingId === file.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                className="h-8 py-0.5 text-sm bg-background"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    updateFileName(category.id, file.id, tempName);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                              />
                              <button
                                onClick={() => updateFileName(category.id, file.id, tempName)}
                                className="p-1 bg-primary text-primary-foreground rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col min-w-0 gap-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-sm font-medium truncate"
                                  title={file.name}
                                >
                                  {file.name}
                                </span>
                                {isEditor && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-all">
                                    <button
                                      onClick={() => {
                                        setEditingId(file.id);
                                        setTempName(file.name);
                                      }}
                                      className="p-1 text-muted-foreground hover:text-primary"
                                      title="تعديل الاسم"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => updateFileSource(category.id, file.id)}
                                      className="p-1 text-muted-foreground hover:text-primary"
                                      title="تحديث ملف البوربوينت"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {isEditor && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      const next = tagPopoverFileId === file.id ? null : file.id;
                                      if (next) {
                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        const dropdownWidth = 288;
                                        let right = window.innerWidth - rect.right;
                                        if (right + dropdownWidth > window.innerWidth) {
                                          right = window.innerWidth - dropdownWidth - 8;
                                        }
                                        if (right < 8) right = 8;
                                        let top = rect.bottom + 4;
                                        if (top + 320 > window.innerHeight) {
                                          top = rect.top - 4 - 320;
                                        }
                                        setTagPopoverPos({ top, right });
                                      }
                                      setTagPopoverFileId(next);
                                      if (next === null) setTagSearch("");
                                    }}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    <Tag className="w-3 h-3" />
                                    <span>
                                      {(file.tags || []).length > 0
                                        ? file.tags.join(", ")
                                        : "إضافة مواضيع"}
                                    </span>
                                  </button>
                                  {tagPopoverFileId === file.id && createPortal(
                                    <>
                                      <div
                                        className="fixed inset-0 z-[99]"
                                        onClick={() => { setTagPopoverFileId(null); setTagSearch(""); }}
                                      />
                                      <div
                                        className="fixed z-[100] w-72 bg-card border border-border rounded-xl shadow-xl max-h-[320px] overflow-hidden flex flex-col animate-in fade-in duration-150"
                                        style={{ top: tagPopoverPos.top, right: tagPopoverPos.right }}
                                      >
                                        <div className="p-2.5 border-b border-border">
                                          <div className="relative">
                                            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                            <Input
                                              placeholder="بحث في المواضيع..."
                                              className="h-8 text-xs pr-8"
                                              autoFocus
                                              value={tagSearch}
                                              onChange={(e) => setTagSearch(e.target.value)}
                                            />
                                          </div>
                                        </div>
                                        <div className="overflow-y-auto p-1.5 flex-1">
                                          {filteredTagNames.length > 0 ? (
                                            filteredTagNames.map((tagName) => {
                                              const isSelected = (file.tags || []).includes(tagName);
                                              return (
                                                <button
                                                  key={tagName}
                                                  onClick={() => {
                                                    toggleFileTag(category.id, file.id, tagName);
                                                    setTagSearch("");
                                                  }}
                                                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-colors text-xs ${
                                                    isSelected
                                                      ? "bg-primary/10 text-primary font-medium"
                                                      : "hover:bg-muted text-foreground"
                                                  }`}
                                                >
                                                  <span>{tagName}</span>
                                                  {isSelected && <Check className="w-3 h-3 shrink-0" />}
                                                </button>
                                              );
                                            })
                                          ) : (
                                            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                                              لا توجد مواضيع مطابقة
                                            </div>
                                          )}
                                        </div>
                                        {tagSearch.trim() &&
                                          !availableTagNames.some(
                                            (t) => t.toLowerCase() === tagSearch.trim().toLowerCase()
                                          ) && (
                                            <div className="p-2 border-t border-border">
                                              <button
                                                onClick={() => {
                                                  handleCreateAndToggleTag(
                                                    category.id,
                                                    file.id,
                                                    tagSearch.trim()
                                                  );
                                                  setTagSearch("");
                                                }}
                                                disabled={creatingTag}
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                                              >
                                                {creatingTag ? (
                                                  <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                  <Plus className="w-3 h-3" />
                                                )}
                                                إضافة موضوع "{tagSearch.trim()}"
                                              </button>
                                            </div>
                                          )}
                                      </div>
                                    </>,
                                    document.body
                                  )}
                                </>
                              )}
                              {(file.tags || []).length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {file.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 mr-2">
                          <div className="relative group/tooltip">
                            <button
                              onClick={() =>
                                file.url && handlePreview(file.name, file.url)
                              }
                              className={`h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted hover:text-primary transition-colors ${!file.url && "opacity-40 pointer-events-none"}`}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                              معاينة
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover" />
                            </div>
                          </div>

                          <div className="relative group/tooltip">
                            <button
                              onClick={() => {
                                if (file.url)
                                  downloadFile(file.url, getDownloadName(file.name, file.url), {
                                    contentType: "powerpoint",
                                    contentId: file.id,
                                    contentName: file.name,
                                  });
                              }}
                              className={`h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors ${!file.url && "opacity-40 pointer-events-none"}`}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                              تحميل
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover" />
                            </div>
                          </div>

                          {isEditor && (
                            <button
                              onClick={() => deleteFile(category.id, file.id)}
                              className="h-8 w-8 flex items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {isEditor && (
                      <button
                        onClick={() => addFile(category.id)}
                        disabled={uploadingFileId !== null}
                        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-primary disabled:opacity-50"
                      >
                        {uploadingFileId !== null ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>رفع ملف بوربوينت جديد</span>
                      </button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {!isLoading && filteredCategories.length === 0 && (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-muted-foreground">
            لا توجد نتائج تطابق بحثك
          </h3>
          <Button
            variant="link"
            onClick={() => setSearchQuery("")}
            className="mt-2 text-primary"
          >
            عرض الكل
          </Button>
        </div>
      )}

      {previewFile && (
        <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
          <DialogContent className="max-w-4xl w-[95vw] sm:w-[90vw] h-[85vh] max-h-[85vh] flex flex-col p-4 bg-background border-border">
            <DialogHeader className="flex flex-row items-center justify-between border-b pb-2">
              <DialogTitle className="text-lg sm:text-xl font-bold truncate max-w-[80%] text-right">
                معاينة: {previewFile.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 w-full h-full rounded-lg overflow-hidden border border-border bg-black mt-4">
              {previewFile.url ? (
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewFile.url)}`}
                  className="w-full h-full border-0"
                  allowFullScreen
                  title="PowerPoint Preview"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <Presentation className="w-16 h-16 mb-4 opacity-40 animate-pulse" />
                  <p className="text-lg font-medium">عذراً، هذا الملف لا يحتوي على رابط معاينة متاح حالياً.</p>
                  <p className="text-sm opacity-70 mt-1">يرجى رفع ملف بوربوينت جديد من أدوات التحرير لتفعيل الرابط.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
