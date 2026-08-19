/**
 * 今夜酒单 · 数据与推荐逻辑
 *
 * 20 款酒库（16 经典 + 4 原创 MBTI 酒）移植自 ymine-demos cocktail —— 人格实验室 IP。
 * 推荐 = 六维展示向量 → 八维风味 → 余弦相似度 + 时段加分（算留本地）。
 *
 * 与 demos 的关键差异：向量不再来自手动滑块，而是自动读取
 * baseVector 行为向量（桥接）或 MBTI 面具向量 —— 数据驱动活页面。
 */

const norm = (f) => (f || 0) / 9;

export const LIQUOR_LIBRARY = [
      { id:'old-fashioned', name:'古典之事', nameEn:'Old Fashioned', tagline:'把夜，调回它最初的样子。', base:'威士忌', baseEn:'Whisky', abv:'32%', category:'经典', difficulty:2, difficultyLabel:'中等', glass:'古典杯', garnish:'橙皮与酒渍樱桃', auraColor:'#a8842f', moods:['雅致','沉静'], archetypes:['守序者','炼金者'], story:'它诞生于一只不肯妥协的杯子，糖、苦、威士忌，三样东西便撑起一整个夜晚。守序的人懂得它的好——不必多言，每一滴都落在它该落的分毫里。', flavor:{ sweet:norm(3),sour:norm(0),bitter:norm(5),strong:norm(7),smoky:norm(4),fruity:norm(0),herbal:norm(2),creamy:norm(1) }, ingredients:[{name:'波本威士忌',amt:'60ml'},{name:'安高天娜苦精',amt:'2 dashes'},{name:'安高天娜苦精（橙味）',amt:'1 dash'},{name:'方糖',amt:'1 块'},{name:'清水',amt:'1 茶匙'}], steps:['将方糖置于古典杯底，滴入苦精与清水，用吧匙碾搅至糖化。','加入威士忌，缓缓搅匀使糖与酒融合。','投入一大块老冰，搅拌约 20 秒至杯壁冰凉。','将橙皮油脂挤落于杯面，弃皮或留作装饰，缀以酒渍樱桃。'] },
      { id:'negroni', name:'涩格罗尼', nameEn:'Negroni', tagline:'一半是夜，一半是不肯熄的火。', base:'金酒', baseEn:'Gin', abv:'28%', category:'经典', difficulty:1, difficultyLabel:'简单', glass:'古典杯', garnish:'橙皮', auraColor:'#c97b5a', moods:['叛逆','雅致'], archetypes:['守序者','夜唤者'], story:'佛罗伦萨的伯爵要一杯比美国佬更烈的酒，于是金酒、苦味酒、甜威末等比相会。它是叛逆里的守序——三股锋芒，谁也不肯让谁，却在杯中达成一种冷峻的平衡。', flavor:{ sweet:norm(1),sour:norm(1),bitter:norm(8),strong:norm(7),smoky:norm(1),fruity:norm(2),herbal:norm(3),creamy:norm(0) }, ingredients:[{name:'金酒',amt:'30ml'},{name:'金巴利',amt:'30ml'},{name:'甜红威末',amt:'30ml'}], steps:['将三种材料依次倒入古典杯。','加入大块老冰，搅拌约 20 秒至充分冰透。','将橙皮油脂喷于杯面，扭转后投入杯中作装饰。'] },
      { id:'margarita', name:'玛格丽特', nameEn:'Margarita', tagline:'盐边之上，是吻过夜的酸。', base:'龙舌兰', baseEn:'Tequila', abv:'22%', category:'经典', difficulty:2, difficultyLabel:'中等', glass:'玛格丽特杯', garnish:'青柠轮与盐边', auraColor:'#9b7bd4', moods:['浪漫','热忱'], archetypes:['月潮者','焰心者'], story:'相传它为一位名叫玛格丽特的女子而生，盐是泪的隐喻，酸是思念的形状。浪漫的人端起它，总能在龙舌兰的锋后尝到一缕温柔的果香，像回忆里不肯褪色的那一笔。', flavor:{ sweet:norm(2),sour:norm(6),bitter:norm(1),strong:norm(6),smoky:norm(0),fruity:norm(5),herbal:norm(1),creamy:norm(0) }, ingredients:[{name:'银龙舌兰',amt:'45ml'},{name:'橙味利口酒（君度）',amt:'20ml'},{name:'鲜青柠汁',amt:'20ml'},{name:'盐',amt:'适量（杯口）'}], steps:['用青柠角湿润浅碟杯口半圈，倒扣于盐上沾出盐边。','将龙舌兰、橙酒与青柠汁加入摇酒壶，加冰摇匀至壶壁结霜。','滤入备好的盐边杯，缀以青柠轮。'] },
      { id:'mojito', name:'莫吉托', nameEn:'Mojito', tagline:'把一整座夏夜，揉碎进杯里。', base:'朗姆酒', baseEn:'Rum', abv:'13%', category:'经典', difficulty:2, difficultyLabel:'中等', glass:'高球杯', garnish:'薄荷嫩尖与青柠角', auraColor:'#7c5fbf', moods:['热忱','庆典'], archetypes:['焰心者','月潮者'], story:'哈瓦那的薄荷叶与朗姆在杯中相遇，气泡升腾如夜里的笑声。它属于那些把热度递给世界的人——明亮、清新，却在草本深处藏着一缕让人安定的绿。', flavor:{ sweet:norm(3),sour:norm(4),bitter:norm(1),strong:norm(4),smoky:norm(0),fruity:norm(4),herbal:norm(8),creamy:norm(0) }, ingredients:[{name:'白朗姆',amt:'50ml'},{name:'鲜青柠汁',amt:'20ml'},{name:'甘蔗糖浆',amt:'15ml'},{name:'薄荷叶',amt:'8-10 片'},{name:'苏打水',amt:'适量'}], steps:['将薄荷叶与糖浆置于高球杯底，轻轻捣压释出香气，勿捣至发苦。','加入青柠汁与白朗姆，搅匀。','杯中加满碎冰，注入苏打水至近满。','用吧勺自下而上提拉搅拌，缀以薄荷嫩尖。'] },
      { id:'manhattan', name:'曼哈顿', nameEn:'Manhattan', tagline:'一杯之间，已是整座夜城。', base:'威士忌', baseEn:'Whisky', abv:'30%', category:'经典', difficulty:2, difficultyLabel:'中等', glass:'浅碟杯', garnish:'酒渍樱桃', auraColor:'#d4a84b', moods:['雅致','神秘'], archetypes:['守序者','暮色者'], story:'丘吉尔之母的宴会桌上，它第一次被举起。黑麦的烈、甜威末的柔、苦精的锋，恰是夜城里那种不喧不闹却句句有力的雅致。', flavor:{ sweet:norm(3),sour:norm(0),bitter:norm(4),strong:norm(8),smoky:norm(2),fruity:norm(1),herbal:norm(3),creamy:norm(1) }, ingredients:[{name:'黑麦威士忌',amt:'60ml'},{name:'甜红威末',amt:'25ml'},{name:'安高天娜苦精',amt:'2 dashes'}], steps:['将三种材料加入调酒杯，加冰搅拌约 20 秒至冰透。','滤入冰镇浅碟杯。','以酒渍樱桃沉底或缀于杯沿作装饰。'] },
      { id:'dry-martini', name:'干马天尼', nameEn:'Dry Martini', tagline:'少即是夜的全部。', base:'金酒', baseEn:'Gin', abv:'34%', category:'经典', difficulty:3, difficultyLabel:'复杂', glass:'马天尼杯', garnish:'柠檬皮扭或绿橄榄', auraColor:'#d8c9f5', moods:['雅致','沉静'], archetypes:['炼金者','守序者'], story:'金酒与干威末的比例之争，是调酒界最久的角力。它属于有耐心的人——把纷繁炼至两样材料，再用一颗橄榄封住夜的沉默。', flavor:{ sweet:norm(0),sour:norm(1),bitter:norm(3),strong:norm(8),smoky:norm(0),fruity:norm(0),herbal:norm(6),creamy:norm(0) }, ingredients:[{name:'伦敦干金酒',amt:'60ml'},{name:'干味美思',amt:'10ml'},{name:'橙味苦精（可选）',amt:'1 dash'}], steps:['将金酒、干威末与苦精加入调酒杯，加冰搅拌约 25 秒至极冰。','滤入冰镇马天尼杯。','将柠檬皮油脂喷于杯面后弃皮，或以一颗绿橄榄沉入作饰。'] },
      { id:'espresso-martini', name:'浓缩马天尼', nameEn:'Espresso Martini', tagline:'醒与醉，在杯中谈判。', base:'伏特加', baseEn:'Vodka', abv:'24%', category:'创意', difficulty:3, difficultyLabel:'复杂', glass:'浅碟杯', garnish:'咖啡豆三粒', auraColor:'#5d44a0', moods:['庆典','热忱'], archetypes:['焰心者','夜唤者'], story:'一位模特说"我要一杯能让我醒来的酒"，于是伏特加与浓缩咖啡在摇壶里相遇。苦与润交织，泡沫如夜的礼花，是庆典里的一记清醒。', flavor:{ sweet:norm(4),sour:norm(1),bitter:norm(5),strong:norm(6),smoky:norm(1),fruity:norm(0),herbal:norm(0),creamy:norm(6) }, ingredients:[{name:'伏特加',amt:'50ml'},{name:'浓缩咖啡',amt:'30ml（现萃）'},{name:'咖啡利口酒',amt:'20ml'},{name:'甘蔗糖浆',amt:'10ml'}], steps:['将所有材料加入摇酒壶，加冰用力摇匀约 15 秒以打出绵密泡沫。','双层滤入冰镇浅碟杯，使表面浮起一层细沫。','于泡沫上轻放三粒咖啡豆作装饰。'] },
      { id:'pina-colada', name:'椰林飘香', nameEn:'Piña Colada', tagline:'把夜，调成一片会发光的海。', base:'朗姆酒', baseEn:'Rum', abv:'14%', category:'经典', difficulty:2, difficultyLabel:'中等', glass:'提基杯', garnish:'菠萝叶与酒渍樱桃', auraColor:'#f0c674', moods:['浪漫','庆典'], archetypes:['月潮者','暮色者'], story:'波多黎各的海风把椰浆与菠萝揉进朗姆里。它是夜最柔软的一面——甜、润、果香缠绵，像一段不必清醒的浪漫。', flavor:{ sweet:norm(7),sour:norm(2),bitter:norm(0),strong:norm(4),smoky:norm(0),fruity:norm(6),herbal:norm(0),creamy:norm(9) }, ingredients:[{name:'白朗姆',amt:'50ml'},{name:'椰浆',amt:'30ml'},{name:'菠萝汁',amt:'60ml'},{name:'淡奶油',amt:'15ml'}], steps:['将所有材料加入摇酒壶，加冰摇匀至充分融合。','连同碎冰倒入提基杯，或滤入冰镇杯中。','以菠萝叶与酒渍樱桃缀于杯沿作装饰。'] },
      { id:'whisky-sour', name:'威士忌酸', nameEn:'Whisky Sour', tagline:'酸过之后，是夜给的甜。', base:'威士忌', baseEn:'Whisky', abv:'24%', category:'经典', difficulty:3, difficultyLabel:'复杂', glass:'古典杯', garnish:'橙皮与酒渍樱桃', auraColor:'#a8842f', moods:['怅然','沉静'], archetypes:['雾行者','独酌者'], story:'威士忌的烈被柠檬的酸剖开，又被糖浆一点点抚平。蛋清明灭如月，是怅然之人杯中那层不肯散的思绪。', flavor:{ sweet:norm(4),sour:norm(6),bitter:norm(2),strong:norm(6),smoky:norm(1),fruity:norm(1),herbal:norm(0),creamy:norm(2) }, ingredients:[{name:'波本威士忌',amt:'60ml'},{name:'鲜柠檬汁',amt:'25ml'},{name:'甘蔗糖浆',amt:'20ml'},{name:'蛋清',amt:'1 个'},{name:'安高天娜苦精',amt:'2 dashes（可选）'}], steps:['将威士忌、柠檬汁、糖浆与蛋清加入摇酒壶，先无冰干摇 15 秒使蛋清起泡。','加入冰块再摇 15 秒至冰透。','滤入古典杯，滴几滴苦精于泡沫表面，以橙皮与樱桃装饰。'] },
      { id:'gimlet', name:'吉姆雷特', nameEn:'Gimlet', tagline:'清亮一抹，夜的边角便齐整了。', base:'金酒', baseEn:'Gin', abv:'26%', category:'经典', difficulty:1, difficultyLabel:'简单', glass:'浅碟杯', garnish:'青柠轮', auraColor:'#d8c9f5', moods:['雅致','沉静'], archetypes:['守序者','炼金者'], story:'它是给水手防坏血病的方子，后来成了雅致本身的代名词。金酒与青柠的相遇干净利落，像一句不需解释的话。', flavor:{ sweet:norm(4),sour:norm(6),bitter:norm(1),strong:norm(6),smoky:norm(0),fruity:norm(3),herbal:norm(4),creamy:norm(0) }, ingredients:[{name:'伦敦干金酒',amt:'60ml'},{name:'青柠汁',amt:'20ml'},{name:'甘蔗糖浆',amt:'15ml'}], steps:['将三种材料加入摇酒壶，加冰摇匀至壶壁结霜。','滤入冰镇浅碟杯。','以青柠轮缀于杯沿作装饰。'] },
      { id:'bloody-mary', name:'血腥玛丽', nameEn:'Bloody Mary', tagline:'一杯里，藏着夜的腥红与火。', base:'伏特加', baseEn:'Vodka', abv:'12%', category:'经典', difficulty:2, difficultyLabel:'中等', glass:'高球杯', garnish:'芹菜杆与柠檬角', auraColor:'#c97b5a', moods:['叛逆','庆典'], archetypes:['夜唤者','焰心者'], story:'伏特加隐于番茄的红之后，胡椒与辣酱在喉间点燃。它是清晨与深夜交界处的叛逆，咸、辣、草本错落，谁也不肯让谁。', flavor:{ sweet:norm(1),sour:norm(3),bitter:norm(2),strong:norm(6),smoky:norm(1),fruity:norm(4),herbal:norm(6),creamy:norm(1) }, ingredients:[{name:'伏特加',amt:'45ml'},{name:'番茄汁',amt:'90ml'},{name:'鲜柠檬汁',amt:'15ml'},{name:'辣酱（塔巴斯科）',amt:'3 dashes'},{name:'伍斯特沙司',amt:'2 dashes'},{name:'黑胡椒与芹菜盐',amt:'少许'}], steps:['将所有材料加入高球杯，加冰以吧勺自下而上提拉搅匀。','视口味补足番茄汁与冰块。','以芹菜杆与柠檬角立作装饰。'] },
      { id:'aperol-spritz', name:'阿佩罗海滩', nameEn:'Aperol Spritz', tagline:'把夕阳，留到夜的边缘。', base:'利口酒', baseEn:'Liqueur', abv:'11%', category:'经典', difficulty:1, difficultyLabel:'简单', glass:'高球杯', garnish:'鲜橙片', auraColor:'#f0c674', moods:['庆典','热忱'], archetypes:['焰心者','暮色者'], story:'威尼斯的运河边，阿佩罗的橘与气泡的轻把它推成庆典的标志。它明亮、微苦、果香四溢，是夜尚未正式开始时那声欢快的招呼。', flavor:{ sweet:norm(6),sour:norm(3),bitter:norm(3),strong:norm(4),smoky:norm(0),fruity:norm(7),herbal:norm(1),creamy:norm(1) }, ingredients:[{name:'阿佩罗开胃酒',amt:'90ml'},{name:'普罗赛克起泡酒',amt:'90ml'},{name:'苏打水',amt:'30ml'},{name:'鲜橙片',amt:'1 片'}], steps:['在葡萄酒杯中加满冰块。','依次倒入普罗赛克、阿佩罗，再补入苏打水。','轻提拉搅匀，缀以鲜橙片。'] },
      { id:'penicillin', name:'盘尼西林', nameEn:'Penicillin', tagline:'一杯，治夜的轻恙。', base:'威士忌', baseEn:'Whisky', abv:'26%', category:'创意', difficulty:3, difficultyLabel:'复杂', glass:'古典杯', garnish:'糖渍姜与柠檬皮', auraColor:'#5d44a0', moods:['神秘','沉静'], archetypes:['炼金者','织梦者'], story:'它是新派调酒的处方：威士忌、柠檬、蜂蜜姜糖，再浮一层泥煤威士忌。烟熏自顶层渗下，像一剂为织梦者与炼金者开的良方。', flavor:{ sweet:norm(4),sour:norm(1),bitter:norm(3),strong:norm(7),smoky:norm(8),fruity:norm(0),herbal:norm(5),creamy:norm(1) }, ingredients:[{name:'混合苏格兰威士忌',amt:'60ml'},{name:'鲜柠檬汁',amt:'22ml'},{name:'蜂蜜姜糖浆',amt:'22ml'},{name:'艾雷岛单一麦芽威士忌',amt:'10ml（浮于顶层）'}], steps:['将混合威士忌、柠檬汁与蜂蜜姜糖浆加入摇酒壶，加冰摇匀至冰透。','滤入装有老冰的古典杯。','以吧勺背缓缓倒入艾雷岛威士忌，使其浮于顶层，缀以糖渍姜与柠檬皮。'] },
      { id:'vieux-carre', name:'老广场', nameEn:'Vieux Carré', tagline:'新奥尔良的夜，封进一只杯。', base:'威士忌', baseEn:'Whisky', abv:'30%', category:'经典', difficulty:3, difficultyLabel:'复杂', glass:'古典杯', garnish:'柠檬皮扭与酒渍樱桃', auraColor:'#7c5fbf', moods:['神秘','雅致'], archetypes:['守序者','独酌者'], story:'它诞生于法国区的一张吧台，黑麦与干邑、苦精与甜威末层层叠加。复杂、沉稳、神秘，是夜的深处那盏不灭的灯。', flavor:{ sweet:norm(3),sour:norm(1),bitter:norm(5),strong:norm(8),smoky:norm(2),fruity:norm(1),herbal:norm(4),creamy:norm(1) }, ingredients:[{name:'黑麦威士忌',amt:'30ml'},{name:'干邑白兰地',amt:'30ml'},{name:'甜红威末',amt:'20ml'},{name:'毕士苦精',amt:'1 dash'},{name:'安高天娜苦精',amt:'1 dash'}], steps:['将所有材料加入调酒杯，加冰搅拌约 25 秒至冰透。','滤入装有老冰的古典杯。','将柠檬皮油脂喷于杯面后弃皮，缀以酒渍樱桃。'] },
      { id:'aviation', name:'飞行', nameEn:'Aviation', tagline:'一抹紫罗兰，便飞过了夜。', base:'金酒', baseEn:'Gin', abv:'26%', category:'经典', difficulty:3, difficultyLabel:'复杂', glass:'浅碟杯', garnish:'马拉斯加樱桃', auraColor:'#9b7bd4', moods:['神秘','浪漫'], archetypes:['织梦者','雾行者'], story:'紫罗兰利口酒给它覆上暮色般的淡紫，马拉斯加樱桃是底下的星。它属于那些向陌生敞怀的人——飞行的姿态，正是夜的邀请。', flavor:{ sweet:norm(2),sour:norm(4),bitter:norm(2),strong:norm(7),smoky:norm(0),fruity:norm(5),herbal:norm(3),creamy:norm(0) }, ingredients:[{name:'伦敦干金酒',amt:'45ml'},{name:'马拉斯加樱桃利口酒',amt:'15ml'},{name:'紫罗兰利口酒',amt:'10ml'},{name:'鲜柠檬汁',amt:'15ml'}], steps:['将所有材料加入摇酒壶，加冰摇匀至壶壁结霜。','滤入冰镇浅碟杯。','以马拉斯加樱桃沉底作装饰。'] },
      { id:'last-word', name:'最后的话', nameEn:'Last Word', tagline:'夜将尽，留一句给你独听。', base:'金酒', baseEn:'Gin', abv:'28%', category:'经典', difficulty:2, difficultyLabel:'中等', glass:'浅碟杯', garnish:'马拉斯加樱桃', auraColor:'#7c5fbf', moods:['怅然','神秘'], archetypes:['独酌者','织梦者'], story:'禁酒令时期的方子，等比四味，谁也不压谁。草本、酸甜、樱桃的余韵在舌上轮转，是独酌者角落里那句不必对人说的话。', flavor:{ sweet:norm(3),sour:norm(5),bitter:norm(4),strong:norm(7),smoky:norm(0),fruity:norm(1),herbal:norm(6),creamy:norm(0) }, ingredients:[{name:'伦敦干金酒',amt:'22ml'},{name:'查特绿利口酒',amt:'22ml'},{name:'马拉斯加樱桃利口酒',amt:'22ml'},{name:'鲜柠檬汁',amt:'22ml'}], steps:['将四味等比材料加入摇酒壶，加冰用力摇匀至冰透。','滤入冰镇浅碟杯。','以马拉斯加樱桃沉底作装饰。'] },
      { id:'the-gauge', name:'刻度', nameEn:'The Gauge', tagline:'多一分则过，少一分不足。', base:'威士忌', baseEn:'Whisky', abv:'32%', category:'原创', difficulty:3, difficultyLabel:'复杂', glass:'浅碟杯', garnish:'柠檬皮扭与马拉斯奇诺樱桃', auraColor:'#b8842f', moods:['雅致','沉静'], archetypes:['守序者','领航者'], story:'以经典曼哈顿为骨架，加入阿玛罗增添草本复杂度，两种苦精精准校准风味刻度——就像 ISTJ 做任何事都有精确的标尺。没有花里胡哨的装饰，只有严谨到苛刻的平衡，喝下去的每一口都是"靠谱"的味道。', flavor:{ sweet:norm(2),sour:norm(1),bitter:norm(5),strong:norm(7),smoky:norm(1),fruity:norm(0),herbal:norm(4),creamy:norm(0) }, ingredients:[{name:'黑麦威士忌',amt:'45ml'},{name:'干味美思',amt:'15ml'},{name:'阿玛罗 Amaro Nonino',amt:'10ml'},{name:'安格斯特拉苦精',amt:'2 dashes'},{name:'橙味苦精',amt:'1 dash'}], steps:['将黑麦威士忌、干味美思与阿玛罗加入调酒杯，加冰搅拌约 25 秒至冰透。','滴入安格斯特拉与橙味苦精，继续搅拌 5 秒使风味校准。','滤入冰镇浅碟杯，将柠檬皮油脂喷于杯面后扭入杯中，缀以马拉斯奇诺樱桃。'] },
      { id:'wool-sweater', name:'毛衣', nameEn:'Wool Sweater', tagline:'穿在身上的温度。', base:'威士忌', baseEn:'Whisky', abv:'22%', category:'原创', difficulty:3, difficultyLabel:'复杂', glass:'古典杯', garnish:'肉豆蔻粉撒面与一小枝百里香', auraColor:'#e0b85e', moods:['沉静','浪漫'], archetypes:['月潮者','雾行者'], story:'这是一杯"穿在身上的酒"——爱尔兰威士忌的温润打底，蜂蜜和榛子像冬日的暖阳，奶油带来柔软包裹感，一点点柠檬提鲜不让甜腻泛滥。就像 ISFJ，总是用最温柔的方式照顾身边每一个人，不张扬、不抢眼，但你知道只要 TA 在，就不会冷。', flavor:{ sweet:norm(6),sour:norm(2),bitter:norm(1),strong:norm(4),smoky:norm(0),fruity:norm(2),herbal:norm(3),creamy:norm(7) }, ingredients:[{name:'爱尔兰威士忌',amt:'40ml'},{name:'蜂蜜糖浆',amt:'15ml'},{name:'榛子利口酒 Frangelico',amt:'10ml'},{name:'鲜榨柠檬汁',amt:'10ml'},{name:'浓奶油',amt:'15ml'},{name:'蛋清',amt:'半个（约15ml，可选）'}], steps:['将所有材料加入摇酒壶，先无冰干摇 15 秒使蛋清起泡。','加入冰块再摇 15 秒至冰透绵密。','滤入装有大方冰的古典杯，表面撒肉豆蔻粉，缀以一小枝百里香。'] },
      { id:'chain-of-command', name:'军令', nameEn:'Chain of Command', tagline:'一杯酒，就是一个决定。', base:'威士忌', baseEn:'Whisky', abv:'35%', category:'原创', difficulty:4, difficultyLabel:'极繁', glass:'古典杯', garnish:'柠檬皮扭（喷香后放入）', auraColor:'#7c4a3a', moods:['雅致','神秘'], archetypes:['领航者','守序者'], story:'双威士忌基底奠定力量感的基调，金巴利和甜味美思构成苦甜平衡的中层，苦精与茴香洗杯带来直击鼻腔的冲击力——每一层都有明确的分工，像一支纪律严明的军队。这不是一杯用来"小酌"的酒，这是一杯用来"做决定"的酒。喝下去，你就是那个发号施令的人。', flavor:{ sweet:norm(2),sour:norm(0),bitter:norm(6),strong:norm(9),smoky:norm(6),fruity:norm(0),herbal:norm(4),creamy:norm(0) }, ingredients:[{name:'烟熏苏格兰威士忌',amt:'30ml'},{name:'黑麦威士忌',amt:'20ml'},{name:'金巴利',amt:'15ml'},{name:'甜味美思',amt:'10ml'},{name:'安格斯特拉苦精',amt:'3 dashes'},{name:'茴香酒 Pernod',amt:'洗杯用'}], steps:['用茴香酒润冰镇古典杯内壁后倒出，使杯壁附着一层茴香气息。','将双威士忌、金巴利、甜味美思与苦精加入调酒杯，加冰搅拌约 25 秒至冰透。','滤入备好的古典杯，放一块大方冰，将柠檬皮油脂喷于杯面后扭入杯中。'] },
      { id:'the-host', name:'派对主持', nameEn:'The Host', tagline:'让每个人都开心的魔法。', base:'朗姆酒', baseEn:'Rum', abv:'14%', category:'原创', difficulty:2, difficultyLabel:'中等', glass:'笛形杯', garnish:'西柚片、百香果半颗与薄荷叶', auraColor:'#f0a050', moods:['热忱','庆典'], archetypes:['焰心者','月潮者'], story:'热带水果的热情开场，西柚的微苦增加层次，气泡带来轻盈的社交感——这是一杯"让所有人都喜欢"的酒。酒精度不高，颜值在线，入口友好，谁都能喝两杯，就像 ESFJ 总能照顾到在场每个人的感受。', flavor:{ sweet:norm(5),sour:norm(4),bitter:norm(2),strong:norm(3),smoky:norm(0),fruity:norm(8),herbal:norm(1),creamy:norm(0) }, ingredients:[{name:'白朗姆酒',amt:'30ml'},{name:'蜜桃利口酒',amt:'15ml'},{name:'西柚汁',amt:'20ml'},{name:'百香果糖浆',amt:'10ml'},{name:'青柠汁',amt:'10ml'},{name:'普罗塞克起泡酒',amt:'30ml（顶部加满）'}], steps:['将白朗姆、蜜桃利口酒、西柚汁、百香果糖浆与青柠汁加入摇酒壶，加冰摇匀至壶壁结霜。','滤入冰镇笛形杯。','缓缓注入普罗塞克至近满，缀以西柚片、百香果半颗与薄荷叶。'] },
];

// ============================================================
// 六维展示向量 → 八维风味偏好
// ============================================================
export function vectorToFlavor(vec) {
  return {
    sweet: vec.INF * 0.7 + vec.SPD * 0.3,
    sour: (1 - vec.LEAD) * 0.6 + vec.SPD * 0.4,
    bitter: vec.TOL * 0.8 + vec.ENT * 0.2,
    strong: vec.ENT * 0.8 + vec.TOL * 0.2,
    smoky: vec.TOL * 0.9,
    fruity: vec.INF * 0.9,
    herbal: (1 - vec.INF) * 0.7 + vec.LEAD * 0.3,
    creamy: (1 - vec.ENT) * 0.5 + vec.VIS * 0.5,
  };
}

export function cosineSimilarity(a, b) {
  const keys = Object.keys(a);
  let dot = 0, normA = 0, normB = 0;
  for (const k of keys) {
    dot += a[k] * b[k];
    normA += a[k] * a[k];
    normB += b[k] * b[k];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const FLAVOR_LABELS = {
  sweet: '🍬 甜度', sour: '🍋 酸度', bitter: '🔥 苦味', strong: '💪 酒体',
  smoky: '🌫️ 烟熏', fruity: '🍊 果香', herbal: '🌿 草本', creamy: '🥛 醇厚',
};

// 匹配理由：最贴合的 2-3 个风味维度 + 时段/气质兜底
export function getMatchReasons(cocktail, userFlavor, slotKey) {
  const reasons = [];
  const flavorKeys = Object.keys(FLAVOR_LABELS);
  const diffs = flavorKeys.map((k) => ({
    key: k,
    diff: Math.abs(userFlavor[k] - cocktail.flavor[k]),
    weight: Math.max(userFlavor[k], cocktail.flavor[k]),
  }));
  diffs.sort((a, b) => (a.diff * 0.7 + (1 - a.weight) * 0.3) - (b.diff * 0.7 + (1 - b.weight) * 0.3));
  for (const d of diffs.slice(0, 3)) {
    if (d.diff < 0.35) {
      const dir = cocktail.flavor[d.key] > userFlavor[d.key] ? '偏高' : '偏低';
      reasons.push(`${FLAVOR_LABELS[d.key]} ${dir}（${(cocktail.flavor[d.key] * 100).toFixed(0)}%）`);
    }
  }
  if (reasons.length < 2) {
    if (slotKey === 'midnight' && cocktail.difficulty >= 3) reasons.push('🌙 午夜 · 复杂酒款加分');
    if (slotKey === 'dusk' && cocktail.moods.includes('浪漫')) reasons.push('🌅 黄昏 · 浪漫酒款加分');
    if (slotKey === 'dawn' && cocktail.category === '经典') reasons.push('🌄 黎明 · 经典酒款加分');
    if (reasons.length < 2 && cocktail.moods.length) reasons.push(`🎭 气质匹配 · ${cocktail.moods[0]}`);
  }
  return reasons.slice(0, 4);
}

// ============================================================
// 今夜推荐：六维向量 + 时段 key → Top N（默认 3）
// ============================================================
export function recommendTonight(vec, slotKey, topN = 3) {
  const userFlavor = vectorToFlavor(vec);
  const scored = LIQUOR_LIBRARY.map((cocktail) => {
    const flavorScore = cosineSimilarity(userFlavor, cocktail.flavor);
    let timeBonus = 0;
    if (slotKey === 'midnight' && cocktail.difficulty >= 3) timeBonus = 0.05;
    if (slotKey === 'dawn' && cocktail.category === '经典') timeBonus = 0.03;
    if (slotKey === 'dusk' && cocktail.moods.includes('浪漫')) timeBonus = 0.04;
    const score = clamp(flavorScore + timeBonus, 0, 1);
    return { ...cocktail, score, flavorScore };
  });
  scored.sort((a, b) => b.score - a.score);
  return { picks: scored.slice(0, topN), userFlavor };
}
