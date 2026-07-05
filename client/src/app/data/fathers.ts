export interface Father {
  id: string;
  name: string;
  title: string;
  bio: string;
  profileImage: string;
}

export const fathers: Father[] = [
  {
    id: 'static-1',
    name: 'القديس الأنبا أنطونيوس',
    title: 'أب الرهبان',
    bio: 'أب الرهبان وكوكب البرية، ولد عام 251م في قرية قمن العروس بصعيد مصر. ترك العالم وهو في العشرين من عمره وانطلق إلى البرية الشرقية ليعيش حياة النسك والتوحد. عاش أكثر من 105 سنة، وأسس الحياة الرهبانية في الكنيسة القبطية. تتلمذ على يديه آلاف الرهبان، وقد دافع عن الإيمان المستقيم ضد الأريوسية. كان يحمل قلباً محباً للجميع ومشهوداً له بالحكمة والمحبة والإيمان القوي.',
    profileImage: 'https://images.unsplash.com/photo-1704276864429-9ed5be4cdd25?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzYWludCUyMG9ydGhvZG94JTIwaWNvbnxlbnwxfHx8fDE3NjY5MjA1NTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'static-2',
    name: 'القديس الأنبا مقار الكبير',
    title: 'أحد آباء البرية العظام',
    bio: 'أحد آباء البرية العظام، ولد حوالي عام 300م في قرية شنشيف بمصر. لُقب بـ"أبو مقار" و"مقاريوس المصري". اعتزل في برية شيهيت (وادي النطرون حالياً) حيث أسس دير الأنبا مقاريوس الذي لا يزال قائماً حتى اليوم. اشتهر بتواضعه العميق ومحبته الفائقة وأقواله الروحية النافعة. كان يقال عنه أنه صار "كإله أرضي" لفرط قداسته وروحانيته. تنيح حوالي سنة 390م.',
    profileImage: 'https://images.unsplash.com/photo-1615477081991-16c8d0df26d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcnRob2RveCUyMG1vbmslMjBwb3J0cmFpdHxlbnwxfHx8fDE3NjY5MjA1NTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'static-3',
    name: 'القديس الأنبا بولا',
    title: 'أول السواح',
    bio: 'أول السواح، ولد عام 228م في الصعيد الأسفل بمصر. هرب إلى البرية الشرقية خوفاً من اضطهاد داكيوس وهو في الثانية والعشرين من عمره، واختار حياة الوحدة الكاملة مع الله. عاش في مغارة نائية لمدة تزيد عن 90 عاماً منقطعاً عن العالم، يتغذى من التمر وخبز يأتيه به غراب يومياً. زاره القديس أنطونيوس قبيل نياحته، وقام بدفنه مع أسدين حفرا قبره. تنيح عام 341م وله من العمر 113 سنة.',
    profileImage: 'https://images.unsplash.com/photo-1765824641850-21260565fdc6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWxpZ2lvdXMlMjBlbGRlciUyMHdpc2RvbXxlbnwxfHx8fDE3NjY5MjA1NjB8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'static-4',
    name: 'القديس الأنبا موسى الأسود',
    title: 'من أعظم التائبين',
    bio: 'من أعظم التائبين في تاريخ الكنيسة، كان في شبابه لصاً وقاطع طريق يُرهب الناس بقوته وبأسه. تحول إلى المسيحية بعد أن لمس قلبه نعمة الله، وترهب في برية شيهيت. صار راهباً عظيماً ومثالاً للتوبة والمحبة وعدم الدينونة. رسم قساً وهو في السبعين من عمره. استشهد مع سبعة من إخوته الرهبان على يد البربر عام 407م، رافضاً الدفاع عن نفسه بالعنف. يُذكر بأقواله الرائعة عن المحبة والغفران.',
    profileImage: 'https://images.unsplash.com/photo-1558295520-479f861279b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcnRob2RveCUyMHByaWVzdCUyMHBvcnRyYWl0fGVufDF8fHx8MTc2NjkyMDU2MHww&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'static-5',
    name: 'القديس الأنبا بيشوي',
    title: 'ملاك الأرض وإنسان السماء',
    bio: 'ملاك الأرض وإنسان السماء، المحبوب من الله والناس. ولد في مصر في القرن الرابع الميلادي. ترهب في برية شيهيت وهو صغير وعاش حياة التقوى والنسك الشديد. اشتهر بمحبته العميقة للمسيح وصلواته المستمرة. كرمه السيد المسيح بظهورات متعددة وأعطاه نعمة عظيمة. جسده الطاهر محفوظ كاملاً حتى اليوم في دير الأنبا بيشوي بوادي النطرون. يُعتبر شفيع الرهبنة القبطية ومثالاً للحياة الملائكية على الأرض.',
    profileImage: 'https://images.unsplash.com/photo-1704276864429-9ed5be4cdd25?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzYWludCUyMG9ydGhvZG94JTIwaWNvbnxlbnwxfHx8fDE3NjY5MjA1NTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'static-6',
    name: 'القديس يوحنا ذهبي الفم',
    title: 'أحد آباء الكنيسة الجامعة الأربعة',
    bio: 'أحد آباء الكنيسة الجامعة الأربعة، ولد في أنطاكية حوالي عام 347م. لُقب بـ"ذهبي الفم" لبلاغة عظاته وفصاحة لسانه. كان واعظاً عظيماً ومفسراً للكتاب المقدس لا يُضاهى. خدم بطريركاً للقسطنطينية، وجاهد في الإصلاح الكنسي والدفاع عن الفقراء والمظلومين. نُفي مرتين بسبب جرأته في توبيخ الخطية حتى في القصور الإمبراطورية. كتب تفاسير عميقة وعظات روحية لا تزال تُقرأ حتى اليوم. تنيح في المنفى عام 407م.',
    profileImage: 'https://images.unsplash.com/photo-1615477081991-16c8d0df26d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcnRob2RveCUyMG1vbmslMjBwb3J0cmFpdHxlbnwxfHx8fDE3NjY5MjA1NTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'static-7',
    name: 'القديس باسيليوس الكبير',
    title: 'أحد آباء الكنيسة الجامعة الثلاثة الكبادوكيين',
    bio: 'أحد آباء الكنيسة الجامعة الثلاثة الكبادوكيين، ولد حوالي عام 330م في قيصرية الكبادوك. كان فيلسوفاً وعالماً لاهوتياً عظيماً وأسقفاً ومصلحاً كنسياً. دافع عن الإيمان الأرثوذكسي ضد الأريوسية، ووضع قوانين للحياة الرهبانية لا تزال تُستخدم حتى اليوم. اهتم بالفقراء والمرضى وأسس مؤسسات خيرية لخدمتهم. كتب مؤلفات لاهوتية وروحية عميقة، وله قداس إلهي يُصلى في الكنيسة الأرثوذكسية. تنيح عام 379م.',
    profileImage: 'https://images.unsplash.com/photo-1765824641850-21260565fdc6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWxpZ2lvdXMlMjBlbGRlciUyMHdpc2RvbXxlbnwxfHx8fDE3NjY5MjA1NjB8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'static-8',
    name: 'القديس أثناسيوس الرسولي',
    title: 'عمود الإيمان',
    bio: 'البابا العشرون من باباوات الكنيسة القبطية الأرثوذكسية، ولد في الإسكندرية حوالي عام 296م. لُقب بـ"عمود الإيمان" و"أثناسيوس الرسولي" لدفاعه العنيد عن الإيمان الأرثوذكسي. حضر مجمع نيقية وهو شماس، ثم صار بطريركاً وجاهد طوال حياته ضد الأريوسية. نُفي خمس مرات ولكنه لم يتزعزع في إيمانه. كتب مؤلفات لاهوتية عظيمة منها كتاب "تجسد الكلمة". قيل عنه "أثناسيوس ضد العالم" لصموده أمام الضغوط. تنيح عام 373م.',
    profileImage: 'https://images.unsplash.com/photo-1558295520-479f861279b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcnRob2RveCUyMHByaWVzdCUyMHBvcnRyYWl0fGVufDF8fHx8MTc2NjkyMDU2MHww&ixlib=rb-4.1.0&q=80&w=1080',
  },
];

export const getFatherByName = (name: string): Father | undefined => {
  return fathers.find(father => father.name === name);
};

export const getFatherById = (id: string): Father | undefined => {
  return fathers.find(father => father.id === id);
};
