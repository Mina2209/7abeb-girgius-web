import React, { useState, useEffect } from 'react';
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
  Edit3, 
  Check, 
  X, 
  GripVertical,
  Settings2,
  Upload,
  RefreshCw
} from 'lucide-react';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/app/components/ui/accordion";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useAuth } from '@/app/contexts/AuthContext';

// Mock data for initial state if localStorage is empty
const initialPowerpointCategories = [
  {
    id: "cat1",
    title: "طقوس وألحان الكنيسة",
    icon: "🕯️",
    files: [
      { id: "p1", name: "بوربوينت القداس الغريغوري - كامل" },
      { id: "p2", name: "ألحان أسبوع الآلام - بصخة" },
      { id: "p3", name: "طقس رفع بخور عشية وباكر" },
      { id: "p4", name: "ألحان القداس الباسيلي للمؤمنين" },
      { id: "p5", name: "تسبحة كيهك - السبع وأربع" },
      { id: "p6", name: "طقس سيامة الشمامسة" },
    ]
  },
  {
    id: "cat2",
    title: "سير القديسين والشهداء",
    icon: "⛪",
    files: [
      { id: "p7", name: "حياة الأنبا أنطونيوس كوكب البرية" },
      { id: "p8", name: "الشهيد العظيم مارجرجس الروماني" },
      { id: "p9", name: "القديس البابا كيرلس السادس" },
      { id: "p10", name: "الشهيدة دميانة والأربعين عذراء" },
      { id: "p11", name: "قصة حياة القديس أبانوب النهيسي" },
    ]
  },
  {
    id: "cat3",
    title: "عقيدة ودفاعيات",
    icon: "🛡️",
    files: [
      { id: "p12", name: "شرح قانون الإيمان الأرثوذكسي" },
      { id: "p13", name: "عقيدة التجسد الإلهي" },
      { id: "p14", name: "سر القربان - الأفخارستيا" },
      { id: "p15", name: "الرد على الشكوك حول الكتاب المقدس" },
    ]
  }
];

export function VariousSection() {
  const { profile } = useAuth();
  const isAuthorized = profile?.role === 'admin' || profile?.role === 'editor';
  
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('powerpoint_data');
    return saved ? JSON.parse(saved) : initialPowerpointCategories;
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");

  // Save to localStorage whenever categories change
  useEffect(() => {
    localStorage.setItem('powerpoint_data', JSON.stringify(categories));
  }, [categories]);

  // Management functions
  const addCategory = () => {
    const newCat = {
      id: `cat-${Date.now()}`,
      title: "قسم جديد",
      icon: "📁",
      files: []
    };
    setCategories([newCat, ...categories]);
  };

  const deleteCategory = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا القسم بجميع ملفاته؟")) {
      setCategories(categories.filter((cat: any) => cat.id !== id));
    }
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    const newCategories = [...categories];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newCategories.length) {
      [newCategories[index], newCategories[newIndex]] = [newCategories[newIndex], newCategories[index]];
      setCategories(newCategories);
    }
  };

  const updateCategoryTitle = (id: string, newTitle: string) => {
    setCategories(categories.map((cat: any) => 
      cat.id === id ? { ...cat, title: newTitle } : cat
    ));
    setEditingId(null);
  };

  const addFile = (catId: string) => {
    // Create a hidden input to trigger file selection
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ppt,.pptx,.pdf'; // Allowed formats
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const newFile = {
          id: `p-${Date.now()}`,
          name: file.name.split('.').slice(0, -1).join('.') || file.name
        };
        setCategories(categories.map((cat: any) => 
          cat.id === catId ? { ...cat, files: [...cat.files, newFile] } : cat
        ));
      }
    };
    input.click();
  };

  const updateFileSource = (catId: string, fileId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ppt,.pptx,.pdf';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        setCategories(categories.map((cat: any) => {
          if (cat.id !== catId) return cat;
          return {
            ...cat,
            files: cat.files.map((f: any) => 
              f.id === fileId ? { ...f, name: file.name.split('.').slice(0, -1).join('.') || file.name } : f
            )
          };
        }));
      }
    };
    input.click();
  };

  const deleteFile = (catId: string, fileId: string) => {
    setCategories(categories.map((cat: any) => 
      cat.id === catId ? { ...cat, files: cat.files.filter((f: any) => f.id !== fileId) } : cat
    ));
  };

  const moveFile = (catId: string, fileIndex: number, direction: 'up' | 'down') => {
    setCategories(categories.map((cat: any) => {
      if (cat.id !== catId) return cat;
      const newFiles = [...cat.files];
      const newIndex = direction === 'up' ? fileIndex - 1 : fileIndex + 1;
      if (newIndex >= 0 && newIndex < newFiles.length) {
        [newFiles[fileIndex], newFiles[newIndex]] = [newFiles[newIndex], newFiles[fileIndex]];
        return { ...cat, files: newFiles };
      }
      return cat;
    }));
  };

  const updateFileName = (catId: string, fileId: string, newName: string) => {
    setCategories(categories.map((cat: any) => {
      if (cat.id !== catId) return cat;
      return {
        ...cat,
        files: cat.files.map((f: any) => f.id === fileId ? { ...f, name: newName } : f)
      };
    }));
    setEditingId(null);
  };

  const filteredCategories = categories.map((category: any) => ({
    ...category,
    files: category.files.filter((file: any) => 
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter((category: any) => isEditMode || category.files.length > 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="font-bold text-[36px] text-primary">بوربوينت متنوعة</h1>
            {isAuthorized && (
              <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isEditMode 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                <span>{isEditMode ? "إغلاق وضع التعديل" : "وضع الإدارة"}</span>
              </button>
            )}
          </div>
          <p className="text-muted-foreground text-lg">
            مكتبة العروض التقديمية المنظمة حسب التصنيفات والخدمات الكنسية
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {isEditMode && (
            <Button 
              onClick={addCategory}
              className="bg-primary text-primary-foreground flex items-center gap-2 h-10 px-4"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قسم</span>
            </Button>
          )}
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="بحث في الملفات..." 
              className="pr-10 bg-card border-border"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Accordion type="multiple" defaultValue={["cat1"]} className="w-full space-y-3">
          {filteredCategories.map((category: any, catIndex: number) => (
            <AccordionItem 
              key={category.id} 
              value={category.id}
              className="border border-border rounded-xl bg-card overflow-hidden px-0"
            >
              <div className="flex items-center group/cat px-4 border-b border-border bg-card">
                {isEditMode && (
                  <div className="flex flex-col gap-0.5 ml-3">
                    <button 
                      onClick={() => moveCategory(catIndex, 'up')}
                      disabled={catIndex === 0}
                      className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => moveCategory(catIndex, 'down')}
                      disabled={catIndex === categories.length - 1}
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
                        onChange={e => setTempName(e.target.value)}
                        className="h-9 py-1 bg-background"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') updateCategoryTitle(category.id, tempName);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <button onClick={() => updateCategoryTitle(category.id, tempName)} className="p-1.5 bg-primary text-primary-foreground rounded-md shrink-0">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 bg-muted text-muted-foreground rounded-md shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <AccordionTrigger className="flex-1 hover:no-underline py-4 hover:bg-muted/30 transition-colors text-right">
                      <div className="text-right">
                        <h3 className="font-bold text-xl md:text-2xl leading-tight">{category.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {category.files.length} ملف متوفر
                        </p>
                      </div>
                    </AccordionTrigger>
                  )}
                </div>

                {isEditMode && !editingId && (
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
                  {category.files.map((file: any, fileIndex: number) => (
                    <div 
                      key={file.id} 
                      className="group/file flex items-center justify-between p-3 rounded-lg border border-border bg-[#f4f5f6] dark:bg-muted/40 hover:bg-muted transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isEditMode && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button 
                              onClick={() => moveFile(category.id, fileIndex, 'up')}
                              disabled={fileIndex === 0}
                              className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-20"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => moveFile(category.id, fileIndex, 'down')}
                              disabled={fileIndex === category.files.length - 1}
                              className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-20"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        
                        <div className="shrink-0 w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                          <Presentation className="w-4 h-4" />
                        </div>
                        
                        {editingId === file.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input 
                              value={tempName}
                              onChange={e => setTempName(e.target.value)}
                              className="h-8 py-0.5 text-sm bg-background"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') updateFileName(category.id, file.id, tempName);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <button onClick={() => updateFileName(category.id, file.id, tempName)} className="p-1 bg-primary text-primary-foreground rounded">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate" title={file.name}>
                              {file.name}
                            </span>
                            {isEditMode && (
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
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0 mr-2">
                        {!isEditMode ? (
                          <>
                            <div className="relative group/tooltip">
                              <button 
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted hover:text-primary transition-colors"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                                معاينة
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover"></div>
                              </div>
                            </div>

                            <div className="relative group/tooltip">
                              <button 
                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                                تحميل
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover"></div>
                              </div>
                            </div>
                          </>
                        ) : (
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
                  
                  {isEditMode && (
                    <button 
                      onClick={() => addFile(category.id)}
                      className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-primary"
                    >
                      <Upload className="w-4 h-4" />
                      <span>رفع ملف بوربوينت جديد</span>
                    </button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {filteredCategories.length === 0 && !isEditMode && (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-muted-foreground">لا توجد نتائج تطابق بحثك</h3>
          <Button 
            variant="link" 
            onClick={() => setSearchQuery("")}
            className="mt-2 text-primary"
          >
            عرض الكل
          </Button>
        </div>
      )}
    </div>
  );
}
