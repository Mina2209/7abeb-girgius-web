import { Download, Eye } from 'lucide-react';

const copticResources = [
  {
    id: 1,
    title: 'الأبجدية القبطية',
    description: 'تعليم الحروف القبطية ونطقها',
    type: 'عرض تقديمي',
    size: '5.2 MB',
  },
  {
    id: 2,
    title: 'قواعد اللغة القبطية',
    description: 'القواعد الأساسية للغة القبطية',
    type: 'مستند',
    size: '8.4 MB',
  },
  {
    id: 3,
    title: 'الألحان القبطية',
    description: 'نصوص الألحان باللغة القبطية',
    type: 'عرض تقديمي',
    size: '12.1 MB',
  },
  {
    id: 4,
    title: 'قاموس قبطي - عربي',
    description: 'مجموعة من الكلمات القبطية الشائعة',
    type: 'مستند',
    size: '6.8 MB',
  },
  {
    id: 5,
    title: 'صلوات باللغة القبطية',
    description: 'نصوص الصلوات الكنسية بالقبطية',
    type: 'عرض تقديمي',
    size: '9.5 MB',
  },
  {
    id: 6,
    title: 'تمارين وتدريبات',
    description: 'تمارين عملية لتعلم اللغة القبطية',
    type: 'مستند',
    size: '4.7 MB',
  },
];

export function CopticLanguageSection() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 font-bold text-[36px]">لغة قبطية</h1>
        <p className="text-muted-foreground">
          موارد ومراجع لتعلم اللغة القبطية
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {copticResources.map((resource) => (
          <div
            key={resource.id}
            className="bg-card rounded-xl p-6 hover:bg-muted transition-colors border border-border"
          >
            <div className="mb-4">
              <h3 className="mb-2">{resource.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {resource.description}
              </p>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-5 pb-5 border-b border-border">
              <span>{resource.type}</span>
              <span>{resource.size}</span>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                <Download className="w-4 h-4" />
                <span>تحميل</span>
              </button>
              <button className="px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors">
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}