// Initial curriculum data. It is copied into D1 once and thereafter edited through Admin.
type SeedNode = {id:string; curriculum:string; parent:string|null; type:string; bn:string; en:string; ref:string; sort:number; marks:number|null};
const nodes:SeedNode[]=[];
const counters={bar:0,bjs:0};
function add(curriculum:"bar"|"bjs",parent:string|null,type:string,bn:string,en="",marks:number|null=null,ref=""){
  const id=`seed-${curriculum}-${++counters[curriculum]}`;
  nodes.push({id,curriculum,parent,type,bn,en,marks,ref,sort:nodes.filter(x=>x.parent===parent&&x.curriculum===curriculum).length+1});
  return id;
}
function list(curriculum:"bar"|"bjs",parent:string,type:string,items:string|string[]){
  const lines=Array.isArray(items)?items:items.trim().split(/\n/).map(x=>x.trim()).filter(Boolean);
  return lines.map(x=>add(curriculum,parent,type,x));
}
const barLaws:[string,string][]=[
 ["দেওয়ানি কার্যবিধি, ১৯০৮","The Code of Civil Procedure, 1908 (CPC)"],
 ["ফৌজদারি কার্যবিধি, ১৮৯৮","The Code of Criminal Procedure, 1898 (CrPC)"],
 ["দণ্ডবিধি, ১৮৬০","The Penal Code, 1860"],
 ["সাক্ষ্য আইন, ১৮৭২","The Evidence Act, 1872"],
 ["সুনির্দিষ্ট প্রতিকার আইন, ১৮৭৭","The Specific Relief Act, 1877"],
 ["তামাদি আইন, ১৯০৮","The Limitation Act, 1908"],
 ["বাংলাদেশ বার কাউন্সিল অর্ডার ও বিধিমালা, ১৯৭২","Legal Ethics"],
];
for(const [bn,en] of barLaws)add("bar",null,"act",bn,en);
const general=add("bjs",null,"category","প্রথম ভাগ: সাধারণ বিষয়","",40);
const bangla=add("bjs",general,"subject","সাধারণ বাংলা","",10);
const grammar=add("bjs",bangla,"topic","বাংলা ব্যাকরণ","",5);
list("bjs",grammar,"topic",`ধ্বনি ও বর্ণ
দ্বিরুক্ত শব্দ
উপসর্গ
ধাতু
প্রত্যয়
শব্দের গঠন ও শ্রেণিবিভাগ
পদ-প্রকরণ
ভাষার রীতি ও প্রকৃতি
ক্রিয়াপদ
কাল ও পুরুষ
কালের বিশেষ প্রয়োগ
সমাপিকা, অসমাপিকা ও যৌগিক ক্রিয়া
বাংলা অনুজ্ঞা
ক্রিয়া-বিভক্তি
সাধু ও চলিত ভাষা
কারক ও বিভক্তি
সম্বন্ধ পদ ও সম্বোধন পদ
অনুসর্গ
বাক্য শুদ্ধিকরণ
সন্ধি
সমাস
বচন
সমার্থক শব্দ
বিপরীতার্থক শব্দ
উপযুক্ত শব্দ বা শব্দগুচ্ছ দিয়ে শূন্যস্থান পূরণ
বাগধারা
প্রবাদ-প্রবচন
দাপ্তরিক পরিভাষা দিয়ে বাক্য গঠন
যতি চিহ্ন
এক কথায় প্রকাশ
একই শব্দের ভিন্ন অর্থে প্রয়োগ
উক্তি পরিবর্তন
বাক্য রূপান্তর`);
const literature=add("bjs",bangla,"topic","বাংলা সাহিত্য","",5);
list("bjs",literature,"literature_period",`প্রাচীন যুগ
মধ্যযুগ
আধুনিক যুগ`);
list("bjs",literature,"author",`ঈশ্বরচন্দ্র বিদ্যাসাগর
বঙ্কিমচন্দ্র চট্টোপাধ্যায়
মাইকেল মধুসূদন দত্ত
মীর মোশাররফ হোসেন
রবীন্দ্রনাথ ঠাকুর
কাজী নজরুল ইসলাম
জীবনানন্দ দাশ
সুকান্ত ভট্টাচার্য
জসীম উদ্দীন
বেগম রোকেয়া
ফররুখ আহমদ
কায়কোবাদ
শরৎচন্দ্র চট্টোপাধ্যায়
শামসুর রাহমান
হুমায়ূন আহমেদ
রফিক আজাদ
নির্মলেন্দু গুণ
হাসান হাফিজুর রহমান
সৈয়দ শামসুল হক
সৈয়দ ওয়ালীউল্লাহ
হাসান আজিজুল হক
অন্যান্য আধুনিক যুগের কবি, সাহিত্যিক ও নাট্যকার`);
const english=add("bjs",general,"subject","সাধারণ ইংরেজি","General English",10);
const engGrammar=add("bjs",english,"topic","Grammar","",5);
list("bjs",engGrammar,"topic",`Correction of errors in composition
Fill in the blanks
Use of Idioms and Phrases
Transformation and Conversion of Sentences
Use of Verbs and Prepositions
Parts of Speech
Voice
Narration
Antonyms and Synonyms
Use of Articles
Tense
Degrees`);
const engLit=add("bjs",english,"topic","English Literature","",5);
list("bjs",engLit,"literature_period",`The Old English (Anglo-Saxon) Period (449–1066)
The Middle English Period (1066–1500)
The Renaissance / Early Modern Period (1500–1660)
The Neoclassical Period (1660–1798)
The Romantic Period (1798–1837)
The Victorian Period (1837–1901)
The Modern Period (1901–1945)
The Postmodern / Contemporary Period (1945–Present)`);
const affairs=add("bjs",general,"subject","বাংলাদেশ ও আন্তর্জাতিক বিষয়সমূহ","",10);
const bd=add("bjs",affairs,"topic","বাংলাদেশ বিষয়াবলি","",5);
list("bjs",bd,"topic",`বাংলাদেশের ভূপ্রকৃতি ও জনমিতিক বৈশিষ্ট্য
বাংলাদেশের ঐতিহাসিক পটভূমি
ভাষা আন্দোলন
ছয় দফা আন্দোলন
গণঅভ্যুত্থান
মুক্তিযুদ্ধ ও স্বাধীনতা
বাংলাদেশের সামাজিক, অর্থনৈতিক ও রাজনৈতিক জীবন
বাংলাদেশের শিল্প ও সাহিত্য
সাংস্কৃতিক ঐতিহ্য
প্রাকৃতিক সম্পদ, উদ্ভিদ, প্রাণী ও খনিজসম্পদ
প্রাকৃতিক সম্পদের সংরক্ষণ
পানি ও জ্বালানি সম্পদের ব্যবস্থাপনা
উন্নয়ন কৌশল ও নীতি
বাংলাদেশের পররাষ্ট্রনীতি ও বৈদেশিক সম্পর্ক
কেন্দ্রীয় ও স্থানীয় সরকারের প্রশাসনিক কাঠামো
আইনসভা, নির্বাহী বিভাগ ও বিচার বিভাগ
দুর্নীতি প্রতিরোধ
আর্থসামাজিক উন্নয়নে দুর্নীতির প্রভাব
বেসরকারি সংস্থার ভূমিকা
বেসামরিক-সামরিক সম্পর্ক
মানবসম্পদ উন্নয়নে শিক্ষার ভূমিকা
গণমাধ্যম ও তথ্যপ্রযুক্তির ভূমিকা
নারীর ক্ষমতায়ন
রাজনৈতিক ও অর্থনৈতিক প্রতিষ্ঠানের জবাবদিহি
সুশাসন ও সরকারি প্রতিষ্ঠানের জবাবদিহি
নাগরিক সমাজ, গণতন্ত্র ও রাষ্ট্র গঠন
প্রশাসনিক, ভূমি ও শিক্ষা সংস্কার
আন্তর্জাতিক মুদ্রা তহবিল, এশীয় উন্নয়ন ব্যাংক, ইসলামি উন্নয়ন ব্যাংক ও বিশ্বব্যাংকের ভূমিকা
সিকিউরিটিজ অ্যান্ড এক্সচেঞ্জ কমিশনের ভূমিকা
মুক্তবাজার অর্থনীতি ও বিশ্বায়নের প্রভাব
কৃষি, শিল্প, বাণিজ্য ও সেবা খাতের অবদান
মোট জাতীয় উৎপাদন, মোট দেশজ উৎপাদন ও মাথাপিছু আয়
মানবসম্পদ উন্নয়ন ও অভিবাসন কৌশল
পরিবেশগত সমস্যা
গুরুত্বপূর্ণ সমসাময়িক ঘটনা`);
const intl=add("bjs",affairs,"topic","আন্তর্জাতিক বিষয়াবলি","",5);
list("bjs",intl,"topic",`আন্তর্জাতিক আইন ও দেশীয় আইনের সম্পর্ক
রাষ্ট্রীয় ভূখণ্ডে আন্তর্জাতিক আইনের প্রয়োগ
আন্তর্জাতিক আইনের বিষয় হিসেবে রাষ্ট্র
রাষ্ট্রের অধিকার ও কর্তব্য
রাষ্ট্রীয় দায়
রাষ্ট্রীয় উত্তরাধিকার
রাষ্ট্রের ভূখণ্ডগত এখতিয়ার
আন্তর্জাতিক বিরোধ নিষ্পত্তি
রাষ্ট্রীয় সার্বভৌমত্ব
আন্তর্জাতিক আইনে ব্যক্তি
ক্ষমতার ভারসাম্য
সমুদ্র আইন
জাতিসংঘ
কায়রো জনসংখ্যা সম্মেলন
স্টকহোম পরিবেশ ঘোষণা, ১৯৭২
রিও পরিবেশ ও উন্নয়ন ঘোষণা, ১৯৯২
জলাভূমিবিষয়ক রামসার কনভেনশন, ১৯৭১
বিপন্ন বন্যপ্রাণী ও উদ্ভিদের আন্তর্জাতিক বাণিজ্যবিষয়ক কনভেনশন, ১৯৭৩
জীববৈচিত্র্য কনভেনশন, ১৯৯২
জাতিসংঘ জলবায়ু পরিবর্তন কাঠামো কনভেনশন, ১৯৯২
কিয়োটো প্রটোকল, ১৯৯৭
আন্তর্জাতিক জলপ্রবাহের ব্যবহারবিষয়ক জাতিসংঘ কনভেনশন, ১৯৯৭
স্থায়ী জৈব দূষণবিষয়ক স্টকহোম কনভেনশন
কোপেনহেগেন সামাজিক উন্নয়ন সম্মেলন
বেইজিং নারী সম্মেলন
আন্তর্জাতিক শ্রম সংস্থা
বিশ্ব বাণিজ্য সংস্থা
অ্যামনেস্টি ইন্টারন্যাশনাল
ন্যাটো
জোটনিরপেক্ষ আন্দোলন
কমনওয়েলথ
কূটনৈতিক ও কনস্যুলার আইন
কূটনৈতিক প্রতিনিধির দায়িত্ব ও দায়মুক্তি
অস্ত্র নিয়ন্ত্রণ ও নিরস্ত্রীকরণ
শুল্ক, কার্টেল, ডাম্পিং, কোটা ও লাইসেন্স
ঋণ, অনুদান ও পণ্য বিনিময় চুক্তি
বৈদেশিক মুদ্রা নিয়ন্ত্রণ ও শত্রুসম্পত্তি নিয়ন্ত্রণ
আঞ্চলিকতাবাদ ও আঞ্চলিক সংস্থা
দক্ষিণ-পূর্ব এশিয়া, লাতিন আমেরিকা, মধ্যপ্রাচ্য ও সাব-সাহারান আফ্রিকার রাজনীতি
বাংলাদেশ, ভারত, পাকিস্তান, চীন, উত্তর কোরিয়া, যুক্তরাজ্য, যুক্তরাষ্ট্র, ফ্রান্স, জার্মানি, দক্ষিণ আফ্রিকা, ইসরায়েল ও রাশিয়ার পররাষ্ট্রনীতি
জি-৮, জি-২০, জি-৭৭ ও স্বল্পোন্নত দেশ
বিশ্বব্যাংক, আন্তর্জাতিক মুদ্রা তহবিল, এশীয় উন্নয়ন ব্যাংক ও ইসলামি উন্নয়ন ব্যাংক
গুরুত্বপূর্ণ সমসাময়িক আন্তর্জাতিক ঘটনা`);
const mathScience=add("bjs",general,"subject","সাধারণ গণিত ও দৈনন্দিন বিজ্ঞান","",10);
const math=add("bjs",mathScience,"topic","সাধারণ গণিত","",5);
list("bjs",add("bjs",math,"chapter","পাটিগণিত"),"topic",`সরলীকরণ
গড়
গরিষ্ঠ সাধারণ গুণনীয়ক
লঘিষ্ঠ সাধারণ গুণিতক
ঐকিক নিয়ম
শতকরা
সরল সুদ
লাভ ও ক্ষতি
কাজ ও সময়
অনুপাত ও সমানুপাত`);
list("bjs",add("bjs",math,"chapter","বীজগণিত"),"topic",`সরলীকরণ
বর্গ ও ঘনের সূত্র
সূত্রের প্রয়োগ
বহুপদী
ভাগশেষ উপপাদ্য
দ্বিঘাত ও ঘন বহুপদীর উৎপাদক
সরল সমীকরণ
দুই চলকবিশিষ্ট যুগপৎ সরল সমীকরণ
সরল সমীকরণের লেখচিত্র`);
list("bjs",add("bjs",math,"chapter","জ্যামিতি"),"topic",`সরলরেখা
কোণ
ত্রিভুজ
সমান্তরাল রেখা
সামান্তরিক
বৃত্ত
পিথাগোরাসের উপপাদ্য
ত্রিভুজের ক্ষেত্রফল
সংশ্লিষ্ট মৌলিক উপপাদ্য ও অনুসিদ্ধান্ত`);
const science=add("bjs",mathScience,"topic","দৈনন্দিন বিজ্ঞান","",5);
list("bjs",add("bjs",science,"chapter","তথ্য ও যোগাযোগপ্রযুক্তি"),"topic",`কম্পিউটার ও তথ্যপ্রযুক্তির সাধারণ ধারণা
কম্পিউটারের গঠন
হার্ডওয়্যার ও সফটওয়্যার
অপারেটিং সিস্টেম
ওয়ার্ড প্রসেসিং
স্প্রেডশিট
ডাটাবেজ
কম্পিউটার প্রোগ্রামিংয়ের প্রাথমিক ধারণা
কম্পিউটার নেটওয়ার্ক
ইন্টারনেট
ই-মেইল
মাল্টিমিডিয়া
কম্পিউটারের ব্যবহার`);
list("bjs",add("bjs",science,"chapter","সাধারণ বিজ্ঞান"),"topic",`আলো
শব্দ
বিদ্যুৎ
চুম্বক
রোগ ও স্বাস্থ্যসেবা
চিকিৎসা প্রযুক্তি
বায়ুমণ্ডল, জীবমণ্ডল ও জলমণ্ডল
জীবপ্রযুক্তি
প্রাথমিক পদার্থবিজ্ঞান
দৈনন্দিন জীবনের রসায়ন`);
const law=add("bjs",null,"category","দ্বিতীয় ভাগ: আবশ্যিক আইন বিষয়","",60);
const civil=add("bjs",law,"subject","দেওয়ানী মামলা সংক্রান্ত আইন","",10);
list("bjs",civil,"act",`The Code of Civil Procedure, 1908
The Specific Relief Act, 1877
The Civil Courts Act, 1887
The Limitation Act, 1908`);
add("bjs",civil,"topic","বিকল্প বিরোধ নিষ্পত্তির ধারণা ও এতদসংক্রান্ত আইন");
const crime=add("bjs",law,"subject","অপরাধ সংক্রান্ত আইন","",10);
list("bjs",crime,"act",`The Code of Criminal Procedure, 1898
The Penal Code, 1860
The Evidence Act, 1872`);
const family=add("bjs",law,"subject","পারিবারিক সম্পর্ক বিষয়ক আইন","",10);
list("bjs",family,"topic",`মুসলিম আইন
হিন্দু আইন
অন্যান্য আইন`);
const familyOther=add("bjs",family,"topic","Other Laws");
list("bjs",familyOther,"act",`The Dissolution of Muslim Marriages Act, 1939
The Muslim Family Laws Ordinance, 1961
পারিবারিক আদালত আইন, ২০২৩`);
const constLaw=add("bjs",law,"subject","সাংবিধানিক আইন, General Clauses Act ও আইনের ব্যাখ্যার ধারণা","",10);
add("bjs",constLaw,"act","সাংবিধানিক আইন");add("bjs",constLaw,"act","The General Clauses Act, 1897");add("bjs",constLaw,"topic","আইনের ব্যাখ্যার ধারণা");
const property=add("bjs",law,"subject","সম্পত্তি সংশ্লিষ্ট অন্যান্য আইন","",10);
list("bjs",property,"act",`The Contract Act, 1872
The Transfer of Property Act, 1882
The Registration Act, 1908
The State Acquisition and Tenancy Act, 1950
The Non-Agricultural Tenancy Act, 1949`);
const optional=add("bjs",null,"category","তৃতীয় ভাগ: ঐচ্ছিক আইন বিষয়সমূহ","",10);
list("bjs",add("bjs",optional,"subject","ঐচ্ছিক বিষয়-১"),"act",`শিশু আইন, ২০১৩
নারী ও শিশু নির্যাতন দমন আইন, ২০০০
আইনগত সহায়তা প্রদান সংক্রান্ত আইন
The Special Powers Act, 1974
মাদকদ্রব্য নিয়ন্ত্রণ আইন, ২০১৮`);
list("bjs",add("bjs",optional,"subject","ঐচ্ছিক বিষয়-২"),"act",`দুর্নীতি দমন সংক্রান্ত আইন
আইন-শৃঙ্খলা বিঘ্নকারী অপরাধ (দ্রুত বিচার) আইন, ২০০২
The Negotiable Instruments Act, 1881
মানব পাচার ও অভিবাসী চোরাচালান প্রতিরোধ ও দমন আইন, ২০২৬
সাইবার সুরক্ষা আইন, ২০২৬`);
export const initialStudyNodes=nodes;
