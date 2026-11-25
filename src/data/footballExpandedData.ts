import { FootballPoolScope } from './footballData';

export interface FootballAuctionPrompt {
  id: string;
  text: string;
  hint: string;
  scope: 'local' | 'foreign';
}

export const FOOTBALL_AUCTION_PROMPTS: FootballAuctionPrompt[] = [
  // Local / Egyptian & Arab Prompts (42)
  { id: 'auc_l1', text: 'لاعبين لعبوا للأهلي والزمالك مع بعض', hint: 'حسام حسن، كهربا، إمام عاشور، عبد الله السعيد...', scope: 'local' },
  { id: 'auc_l2', text: 'مدربين دربوا منتخب مصر الأول', hint: 'الجوهري، حسن شحاتة، كوبر، كيروش، حسام حسن...', scope: 'local' },
  { id: 'auc_l3', text: 'حراس مرمى حرسوا مرمى منتخب مصر', hint: 'الحضري، الشناوي، إكرامي، أبو جبل، صبحي...', scope: 'local' },
  { id: 'auc_l4', text: 'لاعبين مصريين احترفوا في الدوري الإنجليزي', hint: 'صلاح، مرموش، النني، تريزيجيه، حجازي، زكي...', scope: 'local' },
  { id: 'auc_l5', text: 'لاعبين أجانب لعبوا للنادي الأهلي المصري', hint: 'معلول، جيلبرتو، فلافيو، أزارو، ديانج...', scope: 'local' },
  { id: 'auc_l6', text: 'لاعبين أجانب لعبوا لنادي الزمالك', hint: 'بن شرقي، فرجاني ساسي، كاسونجو، شيكو...', scope: 'local' },
  { id: 'auc_l7', text: 'مهاجمين ارتدوا قميص منتخب مصر في كأس الأمم', hint: 'عماد متعب، عمرو زكي، مصطفى محمد، مروان محسن...', scope: 'local' },
  { id: 'auc_l8', text: 'مدربين أجانب دربوا النادي الأهلي المصري', hint: 'مانويل جوزيه، فايلر، موسيماني، كولر...', scope: 'local' },
  { id: 'auc_l9', text: 'مدربين أجانب دربوا نادي الزمالك', hint: 'فيريرا، باتريس كارتيرون، باتشيكو، جوميز...', scope: 'local' },
  { id: 'auc_l10', text: 'لاعبين توجوا بكأس أمم أفريقيا ٢٠٠٦ و٢٠٠٨ و٢٠١٠', hint: 'أبو تريكة، أحمد حسن، وائل جمعة، عصام الحضري...', scope: 'local' },
  { id: 'auc_l11', text: 'أندية لعبت في الدوري المصري الممتاز', hint: 'الأهلي، الزمالك، الإسماعيلي، المصري، بيراميدز...', scope: 'local' },
  { id: 'auc_l12', text: 'لاعبين مغاربة لعبوا في الدوري المصري', hint: 'أشرف بن شرقي، وليد أزارو، بدر بانون، يحيى عطية الله...', scope: 'local' },
  { id: 'auc_l13', text: 'لاعبين تونسيين تألقوا في الدوري المصري', hint: 'علي معلول، فرجاني ساسي، سيف الدين الجزيري، أنيس بوجلبان...', scope: 'local' },
  { id: 'auc_l14', text: 'أندية فازت بدوري أبطال أفريقيا', hint: 'الأهلي، الزمالك، الترجي، الوداد، مازيمبي...', scope: 'local' },
  { id: 'auc_l15', text: 'لاعبين لعبوا لنادي بيراميدز', hint: 'عبد الله السعيد، رمضان صبحي، إبراهيم عادل، فيستون ماييلي...', scope: 'local' },
  { id: 'auc_l16', text: 'لاعبين لعبوا لنادي الإسماعيلي وانتقلوا للأهلي أو الزمالك', hint: 'محمد بركات، عماد النحاس، شريف عبد الفضيل، إسلام الشاطر...', scope: 'local' },
  { id: 'auc_l17', text: 'لاعبين مصريين احترفوا في الدوري السعودي', hint: 'طارق حامد، أحمد حجازي، محمد عبد الشافي، شريف...', scope: 'local' },
  { id: 'auc_l18', text: 'لاعبين مصريين سجلوا في كأس العالم', hint: 'مجدي عبد الغني، محمد صلاح، عبد الرحمن فوزي...', scope: 'local' },
  { id: 'auc_l19', text: 'لاعبين فازوا بجائزة أفضل لاعب في أفريقيا', hint: 'صلاح، ماني، محرز، دروجبا، إيتو، الخطيب...', scope: 'local' },
  { id: 'auc_l20', text: 'كباتن ارتدوا شارة قيادة منتخب مصر', hint: 'حسام حسن، أحمد حسن، عصام الحضري، محمد صلاح...', scope: 'local' },
  { id: 'auc_l21', text: 'ملاعب مصرية استضافت مباريات الدوري والمنتخب', hint: 'استاد القاهرة، برج العرب، الدفاع الجوي، السلام...', scope: 'local' },
  { id: 'auc_l22', text: 'لاعبين مصريين احترفوا في الدوري الألماني', hint: 'عمر مرموش، محمد زيدان، هاني رمزي، ياسر رضوان...', scope: 'local' },
  { id: 'auc_l23', text: 'مدافعين لعبوا لمنتخب مصر في آخر ١٥ سنة', hint: 'وائل جمعة، هاني سعيد، أحمد حجازي، الونش، عبد المنعم...', scope: 'local' },
  { id: 'auc_l24', text: 'أندية سعودية تشارك في دوري روشن', hint: 'الهلال، النصر، الاتحاد، الأهلي، الشباب...', scope: 'local' },
  { id: 'auc_l25', text: 'نجوم عرب لعبوا في الدوريات الأوروبية الخمس الكبرى', hint: 'صلاح، محرز، حكيمي، زياش، مرموش، بونو...', scope: 'local' },
  { id: 'auc_l26', text: 'معلقين كورة عرب مشهورين', hint: 'عصام الشوالي، حفيظ دراجي، فهد العتيبي، مدحت شلبي...', scope: 'local' },
  { id: 'auc_l27', text: 'منتخبات عربية وصلت لنهائيات كأس العالم', hint: 'مصر، السعودية، المغرب، تونس، الجزائر، العراق...', scope: 'local' },
  { id: 'auc_l28', text: 'أهداف مصرية لا تُنسى في القمة أو المنتخب', hint: 'القاضية ممكن، هدف زيدان في إيطاليا، جدو في غانا...', scope: 'local' },
  { id: 'auc_l29', text: 'أظهرة (باك يمين أو شمال) لعبوا للأهلي', hint: 'علي معلول، محمد هاني، أحمد فتحي، سيد معوض...', scope: 'local' },
  { id: 'auc_l30', text: 'أظهرة (باك يمين أو شمال) لعبوا للزمالك', hint: 'فتوح، عبد الشافي، حازم إمام، حمزة المثلوثي...', scope: 'local' },
  { id: 'auc_l31', text: 'لاعبين سجلوا هاتريك في الدوري المصري أو أفريقيا', hint: 'وسام أبو علي، الخطيب، حسام حسن، وليد أزارو...', scope: 'local' },
  { id: 'auc_l32', text: 'حكام مصريين أو عرب أداروا مباريات دولية', hint: 'جمال الغندور، جهاد جريشة، إبراهيم نور الدين، غربال...', scope: 'local' },
  { id: 'auc_l33', text: 'منتخبات أفريقية فازت بكأس أمم أفريقيا', hint: 'مصر، الكاميرون، غانا، نيجيريا، السنغال، كوت ديفوار...', scope: 'local' },
  { id: 'auc_l34', text: 'لاعبين ارتدوا رقم ١٠ في الأهلي أو الزمالك أو المنتخب', hint: 'الخطيب، شيكابالا، شريف، محمد صلاح، جمال حمزة...', scope: 'local' },
  { id: 'auc_l35', text: 'نجوم منتخب مصر الأوليمبي في أولمبياد باريس أو طوكيو', hint: 'إبراهيم عادل، زيزو، النني، رمضان صبحي، صبحي...', scope: 'local' },
  { id: 'auc_l36', text: 'لاعبين لعبوا للمنتخب المصري في كأس العالم ٢٠١٨', hint: 'صلاح، الحضري، تريزيجيه، طارق حامد، النني...', scope: 'local' },
  { id: 'auc_l37', text: 'أساطير الكورة المصرية في الثمانينات والتسعينات', hint: 'الخطيب، حسن شحاتة، طاهر أبو زيد، مجدي عبد الغني...', scope: 'local' },
  { id: 'auc_l38', text: 'لاعبين من قطاع ناشئين الأهلي أو الزمالك تألقوا مع الفريق الأول', hint: 'رمضان صبحي، شيكابالا، مصطفى شوبير، حسام غالي...', scope: 'local' },
  { id: 'auc_l39', text: 'أندية مغربية أو تونسية واجهت الأهلي والزمالك في أفريقيا', hint: 'الوداد، الرجاء، نهضة بركان، الترجي، النجم الساحلي...', scope: 'local' },
  { id: 'auc_l40', text: 'أجانب تألقوا في الدوري السعودي للمحترفين مؤخراً', hint: 'رونالدو، بنزيما، نيمار، كانتي، ميتروفيتش...', scope: 'local' },
  { id: 'auc_l41', text: 'أندية خليجية وأفريقية لعبت في كأس العالم للأندية', hint: 'الأهلي، الهلال، الرجاء، الوداد، العين، الاتحاد...', scope: 'local' },
  { id: 'auc_l42', text: 'لاعبين مصريين لعبوا في الدوري التركي', hint: 'مصطفى محمد، تريزيجيه، أحمد حسن كوكا، النني...', scope: 'local' },

  // Foreign / International Prompts (44)
  { id: 'auc_f1', text: 'لاعبين لعبوا لريال مدريد وبرشلونة مع بعض', hint: 'لويس فيجو، رونالدو الظاهرة، لويس إنريكي، إيتو...', scope: 'foreign' },
  { id: 'auc_f2', text: 'لاعبين لعبوا لريال مدريد ومانشستر يونايتد', hint: 'كريستيانو رونالدو، بيكهام، كاسيميرو، دي ماريا، فاران...', scope: 'foreign' },
  { id: 'auc_f3', text: 'لاعبين برازيليين لعبوا في نادي برشلونة', hint: 'رونالدينيو، نيمار، ريفالدو، روماريو، داني ألفيس، رافينيا...', scope: 'foreign' },
  { id: 'auc_f4', text: 'لاعبين برازيليين لعبوا في ريال مدريد', hint: 'فينيسيوس، رودريجو، مارسيلو، كاكا، روبرتو كارلوس...', scope: 'foreign' },
  { id: 'auc_f5', text: 'لاعبين فازوا بجائزة الكرة الذهبية (البالون دور)', hint: 'ميسي، رونالدو، بنزيما، مودريتش، رودري، زيدان...', scope: 'foreign' },
  { id: 'auc_f6', text: 'لاعبين فرنسيين لعبوا في الدوري الإنجليزي', hint: 'تييري هنري، كانتي، بوجبا، صليبا، جيرو، كانتونا...', scope: 'foreign' },
  { id: 'auc_f7', text: 'منتخبات فازت بكأس العالم', hint: 'البرازيل، ألمانيا، إيطاليا، الأرجنتين، فرنسا، إسبانيا...', scope: 'foreign' },
  { id: 'auc_f8', text: 'مدربين فازوا بدوري أبطال أوروبا', hint: 'أنشيلوتي، جوارديولا، كلوب، مورينيو، زيدان، فليك...', scope: 'foreign' },
  { id: 'auc_f9', text: 'لاعبين لعبوا مع ميسي ورونالدو في نفس الفريق', hint: 'دي ماريا، ديبالا، هيجواين، بيكيه، راموس، نافاس...', scope: 'foreign' },
  { id: 'auc_f10', text: 'أندية فازت بالدوري الإنجليزي الممتاز (البريميرليج)', hint: 'مانشستر يونايتد، سيتي، تشيلسي، أرسنال، ليفربول، ليستر...', scope: 'foreign' },
  { id: 'auc_f11', text: 'لاعبين ألمان لعبوا في بايرن ميونخ', hint: 'نوير، مولر، كيميش، كروس، ليفاندوفسكي (لا بولندي)، شفاينشتايجر...', scope: 'foreign' },
  { id: 'auc_f12', text: 'لاعبين لعبوا لباريس سان جيرمان وريال مدريد أو برشلونة', hint: 'مبابي، ميسي، نيمار، راموس، ديمبيلي، حكيمي...', scope: 'foreign' },
  { id: 'auc_f13', text: 'لاعبين إيطاليين أساطير في الدفاع أو الحراسة', hint: 'مالديني، بوفون، كانافارو، نيستا، كيليني، بونوتشي...', scope: 'foreign' },
  { id: 'auc_f14', text: 'لاعبين لعبوا لتشيلسي وأرسنال مع بعض', hint: 'تشيك، هافيرتز، جورجينيو، جيرو، أشلي كول، فابريجاس...', scope: 'foreign' },
  { id: 'auc_f15', text: 'لاعبين لعبوا لليفربول وريال مدريد', hint: 'تشابي ألونسو، مايكل أوين، فابينيو (لا)، ماكمانامان، دوديك...', scope: 'foreign' },
  { id: 'auc_f16', text: 'لاعبين أرجنتينيين فازوا بكأس العالم ٢٠٢٢', hint: 'ميسي، ألفاريز، دي ماريا، مارتينيز، إنزو، ماك أليستر...', scope: 'foreign' },
  { id: 'auc_f17', text: 'لاعبين لعبوا في ميلان وإنتر ميلان مع بعض', hint: 'إبراهيموفيتش، بيرلو، سيدورف، رونالدو الظاهرة، كاكا (لا)...', scope: 'foreign' },
  { id: 'auc_f18', text: 'هدافين تاريخيين في دوري أبطال أوروبا', hint: 'رونالدو، ميسي، ليفاندوفسكي، بنزيما، راؤول، هالاند...', scope: 'foreign' },
  { id: 'auc_f19', text: 'أندية إنجليزية شاركت في دوري أبطال أوروبا آخر ١٠ سنين', hint: 'سيتي، ليفربول، أرسنال، تشيلسي، يونايتد، توتنهام، نيوكاسل...', scope: 'foreign' },
  { id: 'auc_f20', text: 'لاعبين إنجليز مشهورين لعبوا للمنتخب الإنجليزي', hint: 'بيلينجهام، كين، ساكا، فودين، روني، جيرارد، لامبارد...', scope: 'foreign' },
  { id: 'auc_f21', text: 'لاعبين برتغاليين لعبوا في الدوري الإنجليزي', hint: 'رونالدو، برونو فرنانديز، برناردو سيلفا، دياز، جوتا...', scope: 'foreign' },
  { id: 'auc_f22', text: 'أندية فازت بدوري أبطال أوروبا', hint: 'ريال مدريد، ميلان، بايرن، ليفربول، برشلونة، إنتر، سيتي...', scope: 'foreign' },
  { id: 'auc_f23', text: 'ملاعب أوروبية شهيرة سعتها فوق ٦٠ ألف متفرج', hint: 'سانتياجو برنابيو، كامب نو، أنفيلد، أولد ترافورد، أليانز أرينا...', scope: 'foreign' },
  { id: 'auc_f24', text: 'لاعبين إسبان فازوا باليورو أو كأس العالم', hint: 'تشافي، إنييستا، راموس، كاسياس، بوسكيتس، رودري، يامال...', scope: 'foreign' },
  { id: 'auc_f25', text: 'أندية إيطالية كبيرة في الكالتشيو', hint: 'يوفنتوس، ميلان، إنتر، نابولي، روما، لاتسيو، أتالانتا...', scope: 'foreign' },
  { id: 'auc_f26', text: 'لاعبين لعبوا تحت قيادة بيب جوارديولا', hint: 'ميسي، دي بروين، هالاند، تشافي، نوير، رودري، محرز...', scope: 'foreign' },
  { id: 'auc_f27', text: 'لاعبين لعبوا تحت قيادة يورجن كلوب', hint: 'صلاح، ماني، فان دايك، ليفاندوفسكي، رويس، أرنولد...', scope: 'foreign' },
  { id: 'auc_f28', text: 'لاعبين لعبوا تحت قيادة جوزيه مورينيو', hint: 'دروجبا، رونالدو، زلاتان، جون تيري، راموس، شنايدر...', scope: 'foreign' },
  { id: 'auc_f29', text: 'لاعبين هولنديين أساطير أو نجوم حاليين', hint: 'فان دايك، روبن، فان بيرسي، شنايدر، كرويف، فان باستن...', scope: 'foreign' },
  { id: 'auc_f30', text: 'لاعبين بلجيكيين من الجيل الذهبي', hint: 'دي بروين، هازارد، لوكاكو، كورتوا، كومباني، ميرتنز...', scope: 'foreign' },
  { id: 'auc_f31', text: 'حراس مرمى عالميين مشهورين', hint: 'نوير، كورتوا، أليسون، إيدرسون، دوناروما، تير شتيجن...', scope: 'foreign' },
  { id: 'auc_f32', text: 'لاعبين ارتدوا القميص رقم ٧ في تاريخ الكورة', hint: 'كريستيانو، راؤول، فيجو، كانتونا، بيكهام، فينيسيوس، ساكا...', scope: 'foreign' },
  { id: 'auc_f33', text: 'لاعبين ارتدوا القميص رقم ١٠ في تاريخ الكورة', hint: 'مارادونا، بيليه، ميسي، زيدان، رونالدينيو، مودريتش، مبابي...', scope: 'foreign' },
  { id: 'auc_f34', text: 'أندية ألمانية في البوندسليجا', hint: 'بايرن ميونخ، دورتموند، ليفركوزن، لايبزيج، فرانكفورت...', scope: 'foreign' },
  { id: 'auc_f35', text: 'أندية إسبانية في الليجا غير الريال وبرشلونة', hint: 'أتلتيكو مدريد، إشبيلية، فالنسيا، بلباو، سوسيداد، فياريال...', scope: 'foreign' },
  { id: 'auc_f36', text: 'لاعبين أفارقة لعبوا في الدوري الإنجليزي', hint: 'صلاح، دروجبا، ماني، محرز، توريه، إيسيان، كانو...', scope: 'foreign' },
  { id: 'auc_f37', text: 'لاعبين أوروجويانيين مشهورين', hint: 'لويس سواريز، كافاني، فالفيردي، جودين، فورلان، نونيز...', scope: 'foreign' },
  { id: 'auc_f38', text: 'لاعبين كرواتيين تألقوا مع منتخب كرواتيا', hint: 'مودريتش، راكيتيتش، ماندجوكيتش، بيريشيتش، جفارديول...', scope: 'foreign' },
  { id: 'auc_f39', text: 'نجوم شباب تحت ٢٣ سنة في أوروبا دلوقتي', hint: 'لامين يامال، بيلينجهام، موسيالا، فيرتز، بالمر، بيدري...', scope: 'foreign' },
  { id: 'auc_f40', text: 'لاعبين لعبوا لبايرن ميونخ وبرشلونة أو ريال مدريد', hint: 'ليفاندوفسكي، كروس، ألابا، ألونسو، تياجو، كوتينيو...', scope: 'foreign' },
  { id: 'auc_f41', text: 'أندية فرنسية شهيرة في الدوري الفرنسي', hint: 'باريس، مارسيليا، ليون، موناكو، ليل، نيس...', scope: 'foreign' },
  { id: 'auc_f42', text: 'مهاجمين ارتدوا رقم ٩ مع أندية كبرى', hint: 'بنزيما، ليفاندوفسكي، هالاند، سواريز، مبابي، رونالدو الظاهرة...', scope: 'foreign' },
  { id: 'auc_f43', text: 'لاعبين فازوا بجائزة الحذاء الذهبي الأوروبي', hint: 'ميسي، رونالدو، ليفاندوفسكي، سواريز، هالاند، كين...', scope: 'foreign' },
  { id: 'auc_f44', text: 'لاعبين لعبوا ليوفنتوس ومانشستر يونايتد أو السيتي', hint: 'رونالدو، بوجبا، تيفيز، إيفرا، كانسيلو، دانيلو...', scope: 'foreign' },
];

// ---- Football Tic-Tac-Toe (3x3 Grid) Validated Matrix ----

export interface TicTacToeClub {
  id: string;
  name: string;
  scope: 'local' | 'foreign';
  primaryHex: string;
}

export interface TicTacToeCondition {
  id: string;
  label: string;
  scope: 'local' | 'foreign' | 'both';
}

export const TICTACTOE_CLUBS: TicTacToeClub[] = [
  { id: 'ahly', name: 'الأهلي', scope: 'local', primaryHex: '#DC2626' },
  { id: 'zamalek', name: 'الزمالك', scope: 'local', primaryHex: '#1E293B' },
  { id: 'pyramids', name: 'بيراميدز', scope: 'local', primaryHex: '#0284C7' },
  { id: 'hilal', name: 'الهلال السعودي', scope: 'local', primaryHex: '#2563EB' },
  { id: 'real', name: 'ريال مدريد', scope: 'foreign', primaryHex: '#4338CA' },
  { id: 'barca', name: 'برشلونة', scope: 'foreign', primaryHex: '#1D4ED8' },
  { id: 'liverpool', name: 'ليفربول', scope: 'foreign', primaryHex: '#B91C1C' },
  { id: 'city', name: 'مانشستر سيتي', scope: 'foreign', primaryHex: '#0EA5E9' },
  { id: 'united', name: 'مانشستر يونايتد', scope: 'foreign', primaryHex: '#DC2626' },
  { id: 'bayern', name: 'بايرن ميونخ', scope: 'foreign', primaryHex: '#E11D48' },
  { id: 'psg', name: 'باريس سان جيرمان', scope: 'foreign', primaryHex: '#1E3A8A' },
  { id: 'arsenal', name: 'أرسنال', scope: 'foreign', primaryHex: '#EF4444' },
  { id: 'chelsea', name: 'تشيلسي', scope: 'foreign', primaryHex: '#1D4ED8' },
  { id: 'milan', name: 'ميلان', scope: 'foreign', primaryHex: '#991B1B' },
];

export const TICTACTOE_CONDITIONS: TicTacToeCondition[] = [
  { id: 'egyptian', label: 'مصري 🇪🇬', scope: 'local' },
  { id: 'arab_african', label: 'عربي / أفريقي 🌍', scope: 'both' },
  { id: 'brazilian', label: 'برازيلي 🇧🇷', scope: 'both' },
  { id: 'french', label: 'فرنسي 🇫🇷', scope: 'foreign' },
  { id: 'spanish', label: 'إسباني 🇪🇸', scope: 'foreign' },
  { id: 'english', label: 'إنجليزي 🏴󠁧󠁢󠁥󠁮󠁧󠁿', scope: 'foreign' },
  { id: 'argentine', label: 'أرجنتيني 🇦🇷', scope: 'foreign' },
  { id: 'portuguese', label: 'برتغالي 🇵🇹', scope: 'foreign' },
  { id: 'ucl_winner', label: 'بطل دوري أبطال أوروبا 🏆', scope: 'foreign' },
  { id: 'afcon_winner', label: 'لعب أمم أفريقيا 🏆', scope: 'local' },
  { id: 'premier_played', label: 'لعب في الدوري الإنجليزي', scope: 'both' },
  { id: 'worldcup_played', label: 'شارك في كأس العالم 🌐', scope: 'both' },
];

/**
 * Curated compatibility matrix: VALID_CELL_PLAYERS[clubId][condId] = example real players.
 * Only combinations where EVERY cell in the 3x3 grid has >= 1 valid answer can be generated!
 */
export const VALID_CELL_PLAYERS: Record<string, Record<string, string[]>> = {
  ahly: {
    egyptian: ['أبو تريكة', 'محمد الشناوي', 'إمام عاشور'],
    arab_african: ['علي معلول', 'فلافيو', 'أشرف بن شرقي'],
    brazilian: ['جيلبرتو (أنجولي - لا!)', 'برونو سافيو', 'كينو (لا)', 'فابيو جونيور'].filter(
      (x) => !x.includes('لا')
    ),
    afcon_winner: ['أبو تريكة', 'وائل جمعة', 'محمد الشناوي'],
    premier_played: ['رمضان صبحي', 'أحمد حجازي', 'تريزيجيه'],
    worldcup_played: ['محمد الشناوي', 'علي معلول', 'أحمد فتحي'],
  },
  zamalek: {
    egyptian: ['شيكابالا', 'زيزو', 'أحمد فتوح'],
    arab_african: ['فرجاني ساسي', 'أشرف بن شرقي', 'حمزة المثلوثي'],
    brazilian: ['جونيور', 'ريكاردو'],
    afcon_winner: ['حازم إمام', 'طارق حامد', 'محمود حمدي الونش'],
    premier_played: ['عمرو زكي', 'ميدو', 'محمد النني (لا)', 'أحمد حسام ميدو'].filter(
      (x) => !x.includes('لا')
    ),
    worldcup_played: ['طارق حامد', 'فرجاني ساسي', 'شيكابالا'],
  },
  pyramids: {
    egyptian: ['عبد الله السعيد', 'رمضان صبحي', 'إبراهيم عادل'],
    arab_african: ['فيستون ماييلي', 'بلاتي توريه', 'وليد الكرتي'],
    brazilian: ['كينو', 'رودريجينيو', 'كارلوس إدواردو'],
    afcon_winner: ['أحمد فتحي', 'شريف إكرامي', 'أحمد الشناوي'],
    premier_played: ['رمضان صبحي', 'أحمد حجازي (لا)', 'علي جبر (لعب وست بروم)'].filter(
      (x) => !x.includes('لا')
    ),
    worldcup_played: ['علي جبر', 'أحمد الشناوي', 'وليد الكرتي'],
  },
  hilal: {
    egyptian: ['أشرف بن شرقي (لا)', 'أحمد علي'].filter((x) => !x.includes('لا')),
    arab_african: ['سالم الدوسري', 'ياسين بونو', 'كوليبالي'],
    brazilian: ['نيمار', 'مالكوم', 'ميشيل'],
    afcon_winner: ['ياسين بونو', 'كوليبالي'],
    premier_played: ['روبن نيفيز', 'ميتروفيتش', 'كانسيلو'],
    worldcup_played: ['سالم الدوسري', 'ياسين بونو', 'نيمار'],
  },
  real: {
    arab_african: ['أشرف حكيمي', 'إبراهيم دياز'],
    brazilian: ['فينيسيوس', 'رودريجو', 'مارسيلو'],
    french: ['مبابي', 'بنزيما', 'زيدان'],
    spanish: ['راموس', 'كاسياس', 'كارفاخال'],
    english: ['بيلينجهام', 'بيكهام', 'مايكل أوين'],
    argentine: ['دي ماريا', 'هيجواين', 'ريدوندو'],
    portuguese: ['كريستيانو رونالدو', 'فيجو', 'بيبي'],
    ucl_winner: ['مودريتش', 'كروس', 'فينيسيوس'],
    premier_played: ['كريستيانو رونالدو', 'مودريتش', 'جاريث بيل'],
    worldcup_played: ['مبابي', 'مودريتش', 'فينيسيوس'],
  },
  barca: {
    arab_african: ['عبد الصمد الزلزولي', 'سيدو كيتا', 'يايا توريه'],
    brazilian: ['نيمار', 'رونالدينيو', 'رافينيا'],
    french: ['تييري هنري', 'ديمبيلي', 'جريزمان'],
    spanish: ['تشافي', 'إنييستا', 'لامين يامال'],
    english: ['جاري لينيكر', 'مارك هيوز'],
    argentine: ['ميسي', 'ماسكيرانو', 'أجويرو'],
    portuguese: ['لويس فيجو', 'ديكو', 'كانسيلو'],
    ucl_winner: ['ميسي', 'تشافي', 'نيمار'],
    premier_played: ['لويس سواريز', 'تييري هنري', 'فابريجاس'],
    worldcup_played: ['ميسي', 'نيمار', 'بيدري'],
  },
  liverpool: {
    egyptian: ['محمد صلاح'],
    arab_african: ['محمد صلاح', 'ساديو ماني', 'نابي كيتا'],
    brazilian: ['أليسون', 'فيرمينو', 'فابينيو'],
    french: ['كوناتي', 'جبريل سيسيه', 'نيكولا أنيلكا'],
    spanish: ['تشابي ألونسو', 'فرناندو توريس', 'تياجو ألكانتارا'],
    english: ['ستيفن جيرارد', 'أرنولد', 'مايكل أوين'],
    argentine: ['ماك أليستر', 'ماسكيرانو', 'ماكسي رودريجيز'],
    portuguese: ['ديوجو جوتا', 'فابيو كارفاليو'],
    ucl_winner: ['محمد صلاح', 'فان دايك', 'أليسون'],
    premier_played: ['محمد صلاح', 'ستيفن جيرارد', 'فان دايك'],
    worldcup_played: ['محمد صلاح', 'فان دايك', 'ماك أليستر'],
  },
  city: {
    egyptian: ['عمر مرموش'],
    arab_african: ['رياض محرز', 'عمر مرموش', 'يايا توريه'],
    brazilian: ['إيدرسون', 'جابرييل جيسوس', 'فرناندينيو'],
    french: ['سمير نصري', 'لابورت (إسباني)', 'بنجمين ميندي', 'جايل كليشي'].filter(
      (x) => !x.includes('إسباني')
    ),
    spanish: ['رودري', 'ديفيد سيلفا', 'فيران توريس'],
    english: ['فيل فودين', 'كايل ووكر', 'جاك جريليش'],
    argentine: ['أجويرو', 'ألفاريز', 'أوتامندي'],
    portuguese: ['برناردو سيلفا', 'روبن دياز', 'كانسيلو'],
    ucl_winner: ['هالاند', 'دي بروين', 'رودري'],
    premier_played: ['دي بروين', 'هالاند', 'فودين'],
    worldcup_played: ['ألفاريز', 'دي بروين', 'رودري'],
  },
  united: {
    arab_african: ['نصير مزراوي', 'سفيان أمرابط', 'أونانا'],
    brazilian: ['كاسيميرو', 'أنتوني', 'فريد'],
    french: ['كانتونا', 'بوجبا', 'فاران'],
    spanish: ['دي خيا', 'خوان ماتا', 'أندير هيريرا'],
    english: ['واين روني', 'بيكهام', 'راشفورد'],
    argentine: ['دي ماريا', 'جارناتشو', 'ليساندرو مارتينيز'],
    portuguese: ['كريستيانو رونالدو', 'برونو فرنانديز', 'ناني'],
    ucl_winner: ['كريستيانو رونالدو', 'واين روني', 'فاران'],
    premier_played: ['برونو فرنانديز', 'روني', 'كريستيانو رونالدو'],
    worldcup_played: ['كريستيانو رونالدو', 'بوجبا', 'برونو فرنانديز'],
  },
  bayern: {
    arab_african: ['نصير مزراوي', 'ساديو ماني', 'مهدي بن عطية'],
    brazilian: ['لوسيو', 'زي روبرتو', 'كوتينيو'],
    french: ['ريبيري', 'كومان', 'بافارد'],
    spanish: ['تشابي ألونسو', 'تياجو ألكانتارا', 'خافي مارتينيز'],
    english: ['هاري كين', 'إريك داير', 'موسيالا (ألماني)', 'أوين هارجريفز'].filter(
      (x) => !x.includes('ألماني')
    ),
    argentine: ['ديميكيليس'],
    portuguese: ['ريناتو سانشيز', 'رافائيل جيريرو', 'جواو كانسيلو'],
    ucl_winner: ['مانويل نوير', 'توماس مولر', 'ليفاندوفسكي'],
    premier_played: ['هاري كين', 'ساديو ماني', 'ليروي ساني'],
    worldcup_played: ['نوير', 'مولر', 'هاري كين'],
  },
  psg: {
    arab_african: ['أشرف حكيمي', 'جاي جاي أوكوشا'],
    brazilian: ['نيمار', 'تياجو سيلفا', 'ماركينيوس'],
    french: ['مبابي', 'ديمبيلي', 'كيمبيمبي'],
    spanish: ['راموس', 'فابيان رويز', 'أسينسيو'],
    english: ['ديفيد بيكهام'],
    argentine: ['ميسي', 'دي ماريا', 'إيكاردي'],
    portuguese: ['فيتينيا', 'نونو مينديش', 'دانيلو بيريرا'],
    ucl_winner: ['ميسي', 'نيمار', 'أشرف حكيمي'],
    premier_played: ['دي ماريا', 'ديفيد لويز', 'بيكهام'],
    worldcup_played: ['مبابي', 'ميسي', 'حكيمي'],
  },
  arsenal: {
    egyptian: ['محمد النني'],
    arab_african: ['محمد النني', 'توماس بارتي', 'كانو'],
    brazilian: ['جابرييل جيسوس', 'مارتينيلي', 'جلبرتو سيلفا'],
    french: ['تييري هنري', 'باتريك فييرا', 'صليبا'],
    spanish: ['فابريجاس', 'أرتيتا', 'ديفيد رايا'],
    english: ['بوكايو ساكا', 'ديكلان رايس', 'إيان رايت'],
    argentine: ['إيميليانو مارتينيز'],
    portuguese: ['سيدريك سواريس', 'نونو تافاريس', 'فابيو فييرا'],
    ucl_winner: ['تييري هنري', 'أليكسيس (لا)', 'جورجينيو'].filter((x) => !x.includes('لا')),
    premier_played: ['ساكا', 'هنري', 'أوديجارد'],
    worldcup_played: ['ساكا', 'صليبا', 'جيسوس'],
  },
  chelsea: {
    egyptian: ['محمد صلاح'],
    arab_african: ['ديدييه دروجبا', 'حكيم زياش', 'مايكل إيسيان'],
    brazilian: ['تياجو سيلفا', 'أوسكار', 'ويليان'],
    french: ['كانتي', 'جيرو', 'ديسايي'],
    spanish: ['فرناندو توريس', 'فابريجاس', 'أزبيليكويتا'],
    english: ['فرانك لامبارد', 'جون تيري', 'كول بالمر'],
    argentine: ['إنزو فرنانديز', 'كريسبو', 'هيجواين'],
    portuguese: ['كارفاليو', 'ديكو', 'جواو فيليكس'],
    ucl_winner: ['دروجبا', 'كانتي', 'لامبارد'],
    premier_played: ['دروجبا', 'هازارد', 'كول بالمر'],
    worldcup_played: ['كانتي', 'إنزو فرنانديز', 'زياش'],
  },
  milan: {
    arab_african: ['إسماعيل بن ناصر', 'فرانك كيسي', 'جورج ويا'],
    brazilian: ['كاكا', 'رونالدينيو', 'تياجو سيلفا'],
    french: ['ثيو هيرنانديز', 'جيرو', 'ديسايي'],
    spanish: ['سوسو', 'ألفارو موراتا', 'براهيم دياز'],
    english: ['ديفيد بيكهام', 'توموري', 'لوفتوس تشيك'],
    argentine: ['كريسبو', 'هيجواين'],
    portuguese: ['رافائيل لياو', 'روي كوستا', 'جواو فيليكس'],
    ucl_winner: ['مالديني', 'كاكا', 'سيدورف'],
    premier_played: ['تياجو سيلفا', 'جيرو', 'بوليسيتش'],
    worldcup_played: ['كاكا', 'جيرو', 'ليايو'],
  },
};

export interface ValidatedTicTacToeGrid {
  cols: TicTacToeClub[];
  rows: TicTacToeCondition[];
  examples: Record<string, string[]>; // key `${rowIdx}_${colIdx}`
}

export function generateValidatedFootballGrid(scope: FootballPoolScope): ValidatedTicTacToeGrid {
  const clubCandidates = TICTACTOE_CLUBS.filter((c) =>
    scope === 'both' ? true : c.scope === scope
  );
  const condCandidates = TICTACTOE_CONDITIONS.filter((cond) =>
    scope === 'both' ? true : cond.scope === 'both' || cond.scope === scope
  );

  // Shuffle candidates and search for a 3x3 set where every cell has >= 1 valid answer
  for (let attempt = 0; attempt < 220; attempt++) {
    const shuffledClubs = [...clubCandidates].sort(() => Math.random() - 0.5);
    const cols = shuffledClubs.slice(0, 3);
    if (cols.length < 3) break;

    const validCondsForCols = condCandidates.filter((cond) =>
      cols.every((club) => (VALID_CELL_PLAYERS[club.id]?.[cond.id]?.length ?? 0) > 0)
    );

    if (validCondsForCols.length >= 3) {
      const rows = [...validCondsForCols].sort(() => Math.random() - 0.5).slice(0, 3);
      const examples: Record<string, string[]> = {};
      rows.forEach((r, rIdx) => {
        cols.forEach((c, cIdx) => {
          examples[`${rIdx}_${cIdx}`] = VALID_CELL_PLAYERS[c.id]?.[r.id] ?? [];
        });
      });
      return { cols, rows, examples };
    }
  }

  // Deterministic guaranteed fallback per scope
  if (scope === 'local') {
    const cols = [TICTACTOE_CLUBS[0], TICTACTOE_CLUBS[1], TICTACTOE_CLUBS[2]];
    const rows = [
      TICTACTOE_CONDITIONS.find((c) => c.id === 'egyptian')!,
      TICTACTOE_CONDITIONS.find((c) => c.id === 'arab_african')!,
      TICTACTOE_CONDITIONS.find((c) => c.id === 'worldcup_played')!,
    ];
    const examples: Record<string, string[]> = {};
    rows.forEach((r, rIdx) => {
      cols.forEach((c, cIdx) => {
        examples[`${rIdx}_${cIdx}`] = VALID_CELL_PLAYERS[c.id]?.[r.id] ?? [];
      });
    });
    return { cols, rows, examples };
  }

  const cols = [
    TICTACTOE_CLUBS.find((c) => c.id === 'real')!,
    TICTACTOE_CLUBS.find((c) => c.id === 'barca')!,
    TICTACTOE_CLUBS.find((c) => c.id === 'city')!,
  ];
  const rows = [
    TICTACTOE_CONDITIONS.find((c) => c.id === 'brazilian')!,
    TICTACTOE_CONDITIONS.find((c) => c.id === 'spanish')!,
    TICTACTOE_CONDITIONS.find((c) => c.id === 'ucl_winner')!,
  ];
  const examples: Record<string, string[]> = {};
  rows.forEach((r, rIdx) => {
    cols.forEach((c, cIdx) => {
      examples[`${rIdx}_${cIdx}`] = VALID_CELL_PLAYERS[c.id]?.[r.id] ?? [];
    });
  });
  return { cols, rows, examples };
}
