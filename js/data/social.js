/**
 * 灵波平台数据
 * 阿里亚斯在万界社交平台的账户内容
 */

const socialProfile = {
  name: '阿里亚斯',
  handle: '@alias_archive',
  role: '法司档录部 · 档录官',
  bio: '好好活着就是一件大事',
  following: 34,
  followers: 127,
};

// 阿里亚斯发的帖子（时间倒序，最新在前）
// 注：七七约一年前去世，因此她参与评论的帖子时间均为1年前及以上
const myPosts = [
  {
    id: 'p03',
    content: '最近感觉食欲大增。',
    likes: 2,
    time: '5天前',
    comments: [
      { author: '星河', content: '我最近食欲不好。' },
      { author: '阿里亚斯', content: '那是你没好好吃饭。' },
    ],
  },

  {
    id: 'p08',
    content: '今天整理了一批很旧的档案，但也准时下班了。',
    likes: 0,
    time: '14天前',
    comments: [],
  },
  {
    id: 'p09',
    content: '笑话一则：\n问：鱼为什么不爱说话？\n答：因为一开口就会进水。',
    likes: 0,
    time: '15天前',
    comments: [
      { author: '星河', content: '又在创作冷笑话了吗？' },
      { author: '阿里亚斯', content: '不要嫉妒我的才华。' },
    ],
  },
  {
    id: 'p10',
    content: '灵能今天又波动了。楼里的灯闪了三下，然后恢复正常。\n我在想如果万灵树打了个嗝会发生什么。',
    likes: 5,
    time: '2个月前',
    comments: [
      { author: '吴小巫', content: '没有那种事！' },
    ],
  },
  {
    id: 'p14',
    content: '今天加班到很晚，走出来发现外面在下雨。\n忘带伞了，但发现其实不介意淋雨。',
    likes: 6,
    time: '3个月前',
    comments: [],
  },
  {
    id: 'p15',
    content: '最近有点累，但说不出哪里累。\n就是那种……什么都没少，但总觉得少了点什么的感觉。',
    likes: 17,
    time: '7个月前',
    comments: [
      { author: '星河', content: '去吃饭' },
      { author: '阿里亚斯', content: '你也去吃饭' },
    ],
  },

  // ---- 以下为约一年前的帖子，七七在世时的互动 ----
  {
    id: 'p07',
    content: '跟七七讲冷笑话，她说好笑。\n跟星河讲，她说不好笑。\n结论：星河没有幽默感。',
    likes: 16,
    time: '1年1个月前',
    comments: [
      { author: '星河', content: '我只是不觉得你的笑话有什么好笑的' },
      { author: '阿里亚斯', content: '这就是没有幽默感' },
      { author: '七七', content: '姐姐说得对！' },
    ],
  },
  {
    id: 'p01',
    content: '笑话一则：\n问：什么东西有牙却不能咬人？\n答：梳子。',
    likes: 3,
    time: '1年2个月前',
    comments: [
      { author: '星河', content: '我说你为什么今早梳头一直咯咯笑' },
      { author: '七七', content: '哈哈哈哈哈！' },
    ],
  },
];

// 阿里亚斯关注的人的动态
const followingPosts = [
  {
    id: 'f14',
    author: '吴小巫',
    authorRole: '万灵树记录官',
    content: '刚从观测台拿到的双月轨迹数据！两条轨道交叉形成的X形太漂亮了。\n上个月重叠期已经过了，潮汐对灵能的影响已经开始收敛。\n不过大家还是记得提前做好设备校准。',
    image: 'res/images/twomoon.jpg',
    likes: 42,
    likedByUser: true,
    time: '1天前',
    comments: [
      { author: '阿里亚斯', content: '怪不得我通讯仪拍不出来，原来得用观测台的设备' },
      { author: '吴小巫', content: '你那个通讯仪拍星河都糊，就别想了' },
    ],
  },
  {
    id: 'f01',
    author: '吴小巫',
    authorRole: '万灵树记录官',
    content: '万灵树今天灵能输送特别稳定，监测数据漂亮得我忍不住截图。\n做这行最开心的时刻。',
    likes: 31,
    likedByUser: true,
    time: '7天前',
    comments: [],
  },
  {
    id: 'f02',
    author: '吴小巫',
    authorRole: '万灵树记录官',
    content: '问一下有没有人知道，法司大人的档案调取权限可以申请临时提升吗？\n问给同事的。',
    likes: 5,
    likedByUser: false,
    time: '1个月前',
    comments: [
      { author: '阿里亚斯', content: '可以，我把流程发给你。' },
      { author: '吴小巫', content: '谢谢大好人！' },
    ],
  },
  {
    id: 'f06',
    author: '星河',
    authorRole: '秩序调查局 · 调查官',
    content: '今天审讯，当事人说他忘了。\n我问他昨天的事怎么会忘？\n他说他故意忘的。\n这是我今年听过最诚实的回答……',
    likes: 58,
    likedByUser: true,
    time: '1个月前',
    comments: [
      { author: '阿里亚斯', content: '人可以故意忘记一件事吗？' },
    ],
  },
   {
    id: 'f05',
    author: '沈迟',
    authorRole: '',
    content: '好想请年假出去旅游，最近忙得快要累晕，怎么双月重叠后意识归档数上升这么多。',
    likes: 23,
    likedByUser: false,
    time: '1个月前',
    comments: [ { author: '星河', content: '不要在灵波讨论这些，下不为例。' },],
  },
   {
    id: 'f04',
    author: '陈岸',
    authorRole: '',
    content: '今天和阿里亚斯吃饭，又学到好多知识，微子团你们是知道吗？我反正不知道。\n阿里亚斯简直是法司大人的百科全书！',
    keywords: [{ word: '微子团', evidenceId: 'weizi_cluster' }],
    likes: 23,
    likedByUser: false,
    time: '2个月前',
    comments: [ { author: '阿里亚斯', content: '低调低调' },],
  },

  {
    id: 'f03',
    author: '吴小巫',
    authorRole: '万灵树记录官',
    content: '下午路过后院，有只不认识的小动物在草丛里，蹲了十分钟没动静，给它留了一块饼就走了。希望它吃了。',
    likes: 44,
    likedByUser: false,
    time: '2个月前',
    comments: [
      { author: '阿里亚斯', content: '你确定那是动物？' },
      { author: '吴小巫', content: '你这个人真的' },
    ],
  },

  {
    id: 'f11',
    author: '星河',
    authorRole: '秩序调查局 · 调查官',
    content: '今天一个人去处理了灵能断区里的一个信号异常。里面没有照明，靠摸黑走了二十分钟才找到信号源。\n弄完了。',
    likes: 29,
    likedByUser: false,
    time: '3个月前',
    comments: [
      { author: '阿里亚斯', content: '你自己一个人去的？' },
      { author: '星河', content: '有什么问题？' },
    ],
  },
  {
    id: 'f07',
    author: '星河',
    authorRole: '秩序调查局 · 调查官',
    content: '饿。',
    likes: 9,
    likedByUser: false,
    time: '4个月前',
    comments: [
      { author: '阿里亚斯', content: '去吃饭' },
      { author: '星河', content: '在审讯' },
      { author: '阿里亚斯', content: '那就忍着' },
    ],
  },
  {
    id: 'f12',
    author: '星河',
    authorRole: '秩序调查局 · 调查官',
    content: '局里让我带个新人一起去执行任务。\n我说不用，我自己去就行。\n跟领导解释了半小时。\n最后把新人丢下一个人去了。',
    likes: 71,
    likedByUser: true,
    time: '5个月前',
    comments: [{ author: '阿里亚斯', content: '我都对你无言以对了。' },],
  },
  // ---- 以下为约一年前的动态，七七在世时 ----
  {
    id: 'f10',
    author: '七七',
    authorRole: '',
    content: '有时候会想，如果某一天突然从这个世界上消失了，会有人来找我吗。\n大概会有的吧。',
    likes: 2,
    likedByUser: true,
    time: '1年前',
    comments: [
      { author: '阿里亚斯', content: '不许乱说话。' },
    ],
  },
  {
    id: 'f08',
    author: '七七',
    authorRole: '',
    content: '姐姐今天又发了一个冷笑话，我笑了很久。\n她说我品味有问题。\n我觉得恰恰相反。',
    likes: 8,
    likedByUser: true,
    time: '1年1个月前',
    comments: [],
  },
  {
    id: 'f09',
    author: '七七',
    authorRole: '',
    content: '最近总是很早醒来，然后不知道该做什么，就一直躺着。\n可能是天气的问题。',
    likes: 3,
    likedByUser: false,
    time: '1年2个月前',
    comments: [],
  },
];

// 热点榜
const trendingList = [
  {
    id: 't01',
    rank: 1,
    isHot: true,
    tag: '近期多地出现"倦怠感"聚集报告',
    content: '各地调查局反映，近期收到多起市民自述长期倦怠、对日常事务提不起兴趣的报告。法司大人数据显示该类案例同比上升14%。调查局表示正在评估。',
  },
  {
    id: 't02',
    rank: 2,
    isHot: true,
    tag: '关于"消亡倾向"案例的官方说明',
    content: '调查局发言人：目前数据尚在正常范围内，请勿过度解读。法司大人持续监测中。',
  },
  {
    id: 't03',
    rank: 3,
    isHot: false,
    tag: '本季度「意识归档」总量创新高',
    content: '法司档录部公告：本季度「意识归档」处理量较上季度增长21%，档录官加班频次明显上升。法司大人已启动自动优先级排序以缓解压力。',
  },
  {
    id: 't04',
    rank: 5,
    isHot: false,
    tag: '万灵树本月输送波动统计',
    content: '官方公告：本月第3次例行灵能输送波动已恢复正常，民众无需担心。',
  },
  {
    id: 't05',
    rank: 6,
    isHot: false,
    tag: '传统糕点「灵芝酥」重回各地摊档',
    content: '沉寂多年的传统糕点「灵芝酥」近期在各地集市重新出现，不少人表示是小时候的味道。有摊主说配方没变，只是之前没人买。',
  },

  {
    id: 't06',
    rank: 7,
    isHot: false,
    tag: '双月已过：整理与放手',
    content: '双月由重叠走向分离，依旧走在各自的轨迹，也到了人们整理旧物、记录心情的时节。',
  },
  {
    id: 't07',
    rank: 8,
    isHot: false,
    tag: '秩序调查局招募新一批档录官',
    content: '多个分局启动年度招募，欢迎有意向者向法司大人主动提交申请。',
  },
];

export { socialProfile, myPosts, followingPosts, trendingList };
