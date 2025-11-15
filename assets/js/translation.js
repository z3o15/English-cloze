/**
 * 交互式翻译功能核心模块 - 修复版本
 * 解决事件冲突、初始化顺序和区域选择器问题
 */

// 默认配置选项
const defaultConfig = {
    // 弹窗显示时间（毫秒）
    displayDuration: 5000,
    
    // 动画持续时间（毫秒）
    animationDuration: 200,
    
    // 是否启用声音反馈
    enableSound: true,
    
    // 是否启用自动发音
    autoPronounce: false,
    
    // 缓存大小限制（条目数）
    cacheSizeLimit: 1000,
    
    // 模糊匹配阈值
    fuzzyMatchThreshold: 0.8,
    
    // 调试模式
    debugMode: false
};

/**
 * 数据加载模块
 * 负责加载翻译数据，实现缓存机制，处理加载错误
 */
class DataLoader {
    constructor() {
        // 内存缓存 - 快速访问
        this.memoryCache = new Map();
        
        // 缓存大小限制
        this.cacheSizeLimit = defaultConfig.cacheSizeLimit;
        
        // 当前页面类型
        this.pageType = this.detectPageType();
        
        // 翻译数据
        this.translations = null;
        
        // 加载状态
        this.isLoading = false;
        this.loadPromise = null;
    }
    
    /**
     * 检测当前页面类型
     * @returns {string} 页面类型：letter或chart
     */
    detectPageType() {
        const path = window.location.pathname;
        if (path.includes('letter') || path.includes('letter/')) {
            return 'letter';
        } else if (path.includes('chart') || path.includes('chart/')) {
            return 'chart';
        }
        // 检查页面标题或其他标识
        const title = document.title || '';
        if (title.includes('书信') || title.includes('letter')) {
            return 'letter';
        } else if (title.includes('图表') || title.includes('chart')) {
            return 'chart';
        }
        // 默认返回letter
        return 'letter';
    }
    
    /**
     * 加载翻译数据
     * @param {string} source 数据源路径
     * @returns {Promise<Object>} 翻译数据
     */
    async loadData(source = 'assets/data/translations.json') {
        // 如果已经在加载中，返回现有的Promise
        if (this.isLoading && this.loadPromise) {
            return this.loadPromise;
        }
        
        // 如果数据已加载，直接返回
        if (this.translations) {
            return this.translations;
        }
        
        // 检查内存缓存
        const cacheKey = `translations_${this.pageType}`;
        const cachedData = this.getCachedData(cacheKey);
        if (cachedData) {
            this.translations = cachedData;
            return cachedData;
        }
        
        this.isLoading = true;
        this.loadPromise = this.fetchTranslationData(source);
        
        try {
            const data = await this.loadPromise;
            this.translations = data[this.pageType] || data.letter || {};
            this.setCachedData(cacheKey, this.translations);
            return this.translations;
        } catch (error) {
            console.error('翻译数据加载失败:', error);
            console.error('错误详情:', {
                message: error.message,
                stack: error.stack,
                pageType: this.pageType,
                source: source
            });
            
            // 降级策略：使用本地缓存数据
            const fallbackData = this.getFallbackData();
            if (fallbackData) {
                console.log('使用降级数据:', fallbackData);
                this.translations = fallbackData;
                return fallbackData;
            }
            
            // 最终降级：返回空对象（只包含单词翻译）
            console.warn('使用最小降级数据');
            this.translations = { words: {} };
            return this.translations;
        } finally {
            this.isLoading = false;
            this.loadPromise = null;
        }
    }
    
    /**
     * 获取翻译数据 - 简化为只支持单词翻译
     * @param {string} type 翻译类型：words
     * @returns {Promise<Object>} 指定类型的翻译数据
     */
    async getTranslations(type) {
        await this.loadData();
        // 只返回单词翻译数据
        return this.translations.words || {};
    }
    
    /**
     * 获取缓存数据
     * @param {string} key 缓存键
     * @returns {any} 缓存数据
     */
    getCachedData(key) {
        // 优先使用内存缓存
        if (this.memoryCache.has(key)) {
            return this.memoryCache.get(key);
        }
        
        // 尝试从localStorage获取
        try {
            const cached = localStorage.getItem(`translation_${key}`);
            if (cached) {
                const data = JSON.parse(cached);
                // 同时更新内存缓存
                this.memoryCache.set(key, data);
                return data;
            }
        } catch (error) {
            console.warn('读取localStorage缓存失败:', error);
        }
        
        return null;
    }
    
    /**
     * 设置缓存数据
     * @param {string} key 缓存键
     * @param {any} data 要缓存的数据
     */
    setCachedData(key, data) {
        // 更新内存缓存
        this.memoryCache.set(key, data);
        
        // 检查缓存大小限制
        if (this.memoryCache.size > this.cacheSizeLimit) {
            // 实现LRU淘汰策略
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }
        
        // 更新localStorage缓存
        try {
            localStorage.setItem(`translation_${key}`, JSON.stringify(data));
        } catch (error) {
            console.warn('写入localStorage缓存失败:', error);
        }
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        this.memoryCache.clear();
        
        // 清除localStorage中的翻译缓存
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('translation_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('清除localStorage缓存失败:', error);
        }
    }
    
    /**
     * 获取降级数据
     * @returns {Object|null} 降级数据
     */
    getFallbackData() {
        // 尝试从全局变量获取
        if (window.EnglishLearningCommon && window.EnglishLearningCommon.wordTranslations) {
            const wordTranslations = window.EnglishLearningCommon.wordTranslations;
            return {
                words: wordTranslations
            };
        }
        
        return null;
    }
    
    /**
     * 获取翻译数据 - 修复CORS问题
     * @param {string} source 数据源
     * @returns {Promise<Object>} 翻译数据
     */
    async fetchTranslationData(source) {
        // 优先使用嵌入的翻译数据，完全避免CORS问题
        console.log('使用嵌入的翻译数据，避免CORS问题');
        const embeddedData = this.getEmbeddedTranslations();
        if (embeddedData) {
            return embeddedData;
        }
        
        // 如果嵌入数据不可用（理论上不应该发生），尝试从网络加载
        console.warn('嵌入数据不可用，尝试从网络加载:', source);
        try {
            const response = await fetch(source);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('网络加载翻译数据失败:', error);
            // 返回最基本的降级数据
            return {
                letter: { words: {} },
                chart: { words: {} }
            };
        }
    }
    
    /**
     * 获取嵌入的翻译数据
     * @returns {Object} 嵌入的翻译数据
     */
    getEmbeddedTranslations() {
        return {
            "letter": {
                "words": {
                  "Dear": "亲爱的",
                  "classmates": "同学们",
                  "I": "我",
                  "am": "是",
                  "writing": "写",
                  "this": "这",
                  "email": "电子邮件",
                  "to": "为了",
                  "inform": "通知",
                  "you": "你",
                  "some": "一些",
                  "details": "细节",
                  "that": "那个",
                  "our": "我们的",
                  "class": "班级",
                  "is": "是",
                  "to": "为了",
                  "hold": "举行",
                  "a": "一个",
                  "charity": "慈善",
                  "sale": "义卖",
                  "for": "为了",
                  "kids": "孩子们",
                  "in": "在",
                  "need": "需要",
                  "of": "的",
                  "help": "帮助",
                  "on": "在",
                  "the": "这个",
                  "school": "学校",
                  "playground": "操场",
                  "evening": "晚上",
                  "May": "五月",
                  "4th": "四日",
                  "As": "正如",
                  "we": "我们",
                  "all": "都",
                  "know": "知道",
                  "there": "有",
                  "are": "是",
                  "many": "很多",
                  "benefits": "好处",
                  "participate": "参加",
                  "begin": "开始",
                  "with": "与",
                  "it": "它",
                  "would": "会",
                  "be": "是",
                  "beneficial": "有益的",
                  "can": "可以",
                  "promote": "促进",
                  "qualities": "质量",
                  "lives": "生活",
                  "and": "和",
                  "lighten": "减轻",
                  "financial": "经济",
                  "burden": "负担",
                  "them": "他们",
                  "their": "他们的",
                  "family": "家庭",
                  "In": "在",
                  "addition": "此外",
                  "us": "我们",
                  "shoulder": "承担",
                  "responsibility": "责任",
                  "concerned": "关心",
                  "about": "关于",
                  "society": "社会",
                  "Last": "最后",
                  "but": "但是",
                  "not": "不",
                  "least": "最少",
                  "another": "另一个",
                  "advantage": "好处",
                  "cultivate": "培养",
                  "strong": "强烈的",
                  "sense": "感觉",
                  "achieve": "实现",
                  "all-round": "全面",
                  "development": "发展",
                  "let": "让",
                  "me": "我",
                  "whether": "是否",
                  "come": "来",
                  "time": "时间",
                  "convenient": "方便",
                  "looking": "期待",
                  "forward": "期待",
                  "your": "你的",
                  "reply": "回复",
                  "Yours": "您的",
                  "sincerely": "真诚地",
                  "Li": "李",
                  "Ming": "明",
                  "express": "表达",
                  "gratitude": "感激",
                  "suggestions": "建议",
                  "complaint": "投诉",
                  "congratulations": "祝贺",
                  "apology": "道歉",
                  "invite": "邀请",
                  "participate": "参加",
                  "informed": "通知",
                  "necessary": "必要",
                  "choice": "选择",
                  "beneficial": "有益的",
                  "advantageous": "有利的",
                  "savor": "品味",
                  "life": "人生",
                  "freedom": "自由",
                  "youth": "青春",
                  "promote": "提升",
                  "qualities": "质量",
                  "reduce": "减轻",
                  "stress": "压力",
                  "exposed": "接触",
                  "ideas": "思想",
                  "experience": "经验",
                  "broaden": "开阔",
                  "mind": "视野",
                  "enlighten": "启迪",
                  "integrate": "交往",
                  "share": "分享",
                  "improve": "提高",
                  "skills": "技能",
                  "competence": "能力",
                  "adapt": "适应",
                  "bring": "带来",
                  "better": "更好",
                  "brighter": "光明",
                  "future": "未来",
                  "convenient": "方便",
                  "achievements": "成就",
                  "proposals": "建议",
                  "appreciate": "感激",
                  "convenience": "方便",
                  "hello": "你好",
                  "good": "好",
                  "morning": "早上",
                  "afternoon": "下午",
                  "evening": "晚上",
                  "night": "晚上",
                  "today": "今天",
                  "tomorrow": "明天",
                  "yesterday": "昨天",
                  "week": "周",
                  "month": "月",
                  "year": "年",
                  "day": "天",
                  "hour": "小时",
                  "minute": "分钟",
                  "second": "秒",
                  "please": "请",
                  "thank": "谢谢",
                  "thanks": "谢谢",
                  "welcome": "欢迎",
                  "sorry": "对不起",
                  "excuse": "原谅",
                  "pardon": "原谅",
                  "forgive": "原谅",
                  "help": "帮助",
                  "assist": "协助",
                  "support": "支持",
                  "love": "爱",
                  "like": "喜欢",
                  "enjoy": "享受",
                  "happy": "高兴",
                  "sad": "伤心",
                  "angry": "生气",
                  "excited": "兴奋",
                  "nervous": "紧张",
                  "worried": "担心",
                  "afraid": "害怕",
                  "surprised": "惊讶",
                  "interested": "感兴趣",
                  "bored": "无聊",
                  "tired": "累",
                  "hungry": "饿",
                  "thirsty": "渴",
                  "cold": "冷",
                  "hot": "热",
                  "warm": "暖和",
                  "cool": "凉爽",
                  "sunny": "晴朗",
                  "rainy": "下雨",
                  "cloudy": "多云",
                  "windy": "有风",
                  "snowy": "下雪",
                  "weather": "天气",
                  "season": "季节",
                  "spring": "春天",
                  "summer": "夏天",
                  "autumn": "秋天",
                  "fall": "秋天",
                  "winter": "冬天",
                  "food": "食物",
                  "drink": "饮料",
                  "water": "水",
                  "milk": "牛奶",
                  "bread": "面包",
                  "rice": "米饭",
                  "meat": "肉",
                  "fish": "鱼",
                  "fruit": "水果",
                  "vegetable": "蔬菜",
                  "apple": "苹果",
                  "banana": "香蕉",
                  "orange": "橙子",
                  "book": "书",
                  "pen": "笔",
                  "paper": "纸",
                  "computer": "电脑",
                  "phone": "电话",
                  "table": "桌子",
                  "chair": "椅子",
                  "door": "门",
                  "window": "窗户",
                  "house": "房子",
                  "home": "家",
                  "room": "房间",
                  "kitchen": "厨房",
                  "bedroom": "卧室",
                  "bathroom": "浴室",
                  "garden": "花园",
                  "street": "街道",
                  "road": "路",
                  "car": "汽车",
                  "bus": "公交车",
                  "train": "火车",
                  "plane": "飞机",
                  "bicycle": "自行车",
                  "walk": "走路",
                  "run": "跑步",
                  "jump": "跳",
                  "sit": "坐",
                  "stand": "站",
                  "sleep": "睡觉",
                  "wake": "醒来",
                  "work": "工作",
                  "study": "学习",
                  "read": "阅读",
                  "write": "写",
                  "draw": "画画",
                  "sing": "唱歌",
                  "dance": "跳舞",
                  "play": "玩",
                  "game": "游戏",
                  "sport": "运动",
                  "music": "音乐",
                  "movie": "电影",
                  "television": "电视",
                  "radio": "收音机",
                  "new": "新的",
                  "old": "旧的",
                  "big": "大",
                  "small": "小",
                  "long": "长",
                  "short": "短",
                  "high": "高",
                  "low": "低",
                  "fast": "快",
                  "slow": "慢",
                  "easy": "容易",
                  "difficult": "困难",
                  "hard": "困难",
                  "simple": "简单",
                  "complex": "复杂",
                  "important": "重要",
                  "necessary": "必要",
                  "possible": "可能",
                  "impossible": "不可能",
                  "right": "正确",
                  "wrong": "错误",
                  "true": "真",
                  "false": "假",
                  "yes": "是",
                  "no": "不",
                  "maybe": "可能",
                  "always": "总是",
                  "never": "从不",
                  "sometimes": "有时",
                  "often": "经常",
                  "rarely": "很少",
                  "usually": "通常",
                  "seldom": "很少",
                  "first": "第一",
                  "second": "第二",
                  "third": "第三",
                  "last": "最后",
                  "next": "下一个",
                  "before": "之前",
                  "after": "之后",
                  "during": "在...期间",
                  "while": "当...时候",
                  "when": "当...时候",
                  "where": "在哪里",
                  "why": "为什么",
                  "how": "如何",
                  "what": "什么",
                  "which": "哪个",
                  "who": "谁",
                  "when": "何时",
                  "whose": "谁的",
                  "if": "如果",
                  "unless": "除非",
                  "until": "直到",
                  "since": "自从",
                  "because": "因为",
                  "so": "所以",
                  "then": "那么",
                  "than": "比",
                  "more": "更多",
                  "less": "更少",
                  "most": "最",
                  "least": "最少",
                  "best": "最好",
                  "worst": "最差",
                  "better": "更好",
                  "worse": "更差",
                  "good": "好",
                  "bad": "坏",
                  "well": "好",
                  "ill": "生病",
                  "healthy": "健康",
                  "sick": "生病",
                  "doctor": "医生",
                  "hospital": "医院",
                  "medicine": "药",
                  "head": "头",
                  "eye": "眼睛",
                  "nose": "鼻子",
                  "mouth": "嘴",
                  "ear": "耳朵",
                  "hand": "手",
                  "foot": "脚",
                  "arm": "手臂",
                  "leg": "腿",
                  "hair": "头发",
                  "face": "脸",
                  "body": "身体",
                  "heart": "心脏",
                  "mind": "思想",
                  "brain": "大脑",
                  "think": "思考",
                  "feel": "感觉",
                  "believe": "相信",
                  "hope": "希望",
                  "wish": "希望",
                  "dream": "梦想",
                  "plan": "计划",
                  "goal": "目标",
                  "purpose": "目的",
                  "reason": "原因",
                  "result": "结果",
                  "effect": "效果",
                  "cause": "原因",
                  "problem": "问题",
                  "solution": "解决方案",
                  "answer": "答案",
                  "question": "问题",
                  "information": "信息",
                  "news": "新闻",
                  "message": "消息",
                  "letter": "信",
                  "email": "电子邮件",
                  "call": "打电话",
                  "talk": "说话",
                  "listen": "听",
                  "hear": "听到",
                  "see": "看见",
                  "look": "看",
                  "watch": "观看",
                  "find": "找到",
                  "search": "搜索",
                  "discover": "发现",
                  "create": "创造",
                  "make": "制作",
                  "build": "建造",
                  "destroy": "破坏",
                  "break": "打破",
                  "fix": "修复",
                  "repair": "修理",
                  "change": "改变",
                  "improve": "改善",
                  "develop": "发展",
                  "grow": "成长",
                  "increase": "增加",
                  "decrease": "减少",
                  "rise": "上升",
                  "fall": "下降",
                  "drop": "下降",
                  "climb": "攀登",
                  "descend": "下降",
                  "move": "移动",
                  "turn": "转弯",
                  "stop": "停止",
                  "start": "开始",
                  "continue": "继续",
                  "finish": "完成",
                  "end": "结束",
                  "begin": "开始",
                  "open": "打开",
                  "close": "关闭",
                  "enter": "进入",
                  "exit": "退出",
                  "leave": "离开",
                  "arrive": "到达",
                  "return": "返回",
                  "go": "去",
                  "come": "来",
                  "bring": "带来",
                  "take": "带走",
                  "give": "给",
                  "receive": "收到",
                  "send": "发送",
                  "buy": "买",
                  "sell": "卖",
                  "cost": "花费",
                  "price": "价格",
                  "money": "钱",
                  "pay": "支付",
                  "free": "免费",
                  "expensive": "昂贵",
                  "cheap": "便宜",
                  "worth": "值得",
                  "value": "价值",
                  "quality": "质量",
                  "quantity": "数量",
                  "amount": "数量",
                  "number": "数字",
                  "count": "计数",
                  "measure": "测量",
                  "weight": "重量",
                  "size": "大小",
                  "shape": "形状",
                  "color": "颜色",
                  "red": "红色",
                  "blue": "蓝色",
                  "green": "绿色",
                  "yellow": "黄色",
                  "black": "黑色",
                  "white": "白色",
                  "gray": "灰色",
                  "light": "浅色",
                  "dark": "深色",
                  "bright": "明亮",
                  "beautiful": "美丽",
                  "ugly": "丑陋",
                  "clean": "干净",
                  "dirty": "脏",
                  "empty": "空",
                  "full": "满",
                  "enough": "足够",
                  "too": "太",
                  "very": "非常",
                  "quite": "相当",
                  "almost": "几乎",
                  "nearly": "接近",
                  "approximately": "大约",
                  "exactly": "精确地",
                  "about": "大约",
                  "over": "超过",
                  "under": "在...下面",
                  "above": "在...上面",
                  "between": "在...之间",
                  "among": "在...之中",
                  "through": "通过",
                  "across": "穿过",
                  "along": "沿着",
                  "against": "反对",
                  "without": "没有",
                  "within": "在...之内",
                  "outside": "在...外面",
                  "inside": "在...里面",
                  "near": "靠近",
                  "far": "远",
                  "here": "这里",
                  "there": "那里",
                  "everywhere": "到处",
                  "somewhere": "某处",
                  "anywhere": "任何地方",
                  "nowhere": "无处",
                  "up": "向上",
                  "down": "向下",
                  "left": "左",
                  "right": "右",
                  "forward": "向前",
                  "backward": "向后",
                  "straight": "直的",
                  "around": "围绕",
                  "across": "横过",
                  "through": "通过",
                  "into": "进入",
                  "out": "出去",
                  "off": "离开",
                  "on": "在...上",
                  "at": "在",
                  "by": "通过",
                  "with": "与",
                  "from": "从",
                  "of": "的",
                  "for": "为了",
                  "to": "到",
                  "as": "作为",
                  "like": "像",
                  "than": "比",
                  "but": "但是",
                  "or": "或者",
                  "and": "和",
                  "if": "如果",
                  "then": "那么",
                  "else": "否则",
                  "also": "也",
                  "too": "也",
                  "either": "要么",
                  "neither": "既不",
                  "both": "两者都",
                  "all": "所有",
                  "each": "每个",
                  "every": "每一个",
                  "some": "一些",
                  "any": "任何",
                  "no": "没有",
                  "none": "没有",
                  "one": "一",
                  "two": "二",
                  "three": "三",
                  "four": "四",
                  "five": "五",
                  "six": "六",
                  "seven": "七",
                  "eight": "八",
                  "nine": "九",
                  "ten": "十",
                  "hundred": "百",
                  "thousand": "千",
                  "million": "百万",
                  "billion": "十亿",
                  "first": "第一",
                  "second": "第二",
                  "third": "第三",
                  "fourth": "第四",
                  "fifth": "第五",
                  "sixth": "第六",
                  "seventh": "第七",
                  "eighth": "第八",
                  "ninth": "第九",
                  "tenth": "第十"
                },
                "phrases": {
                  "I am writing this letter/email to": "我写这封信/邮件是为了",
                  "express my sincere gratitude for": "致以真诚的谢意",
                  "make some suggestions concerning": "给出关于...的建议",
                  "make my complaint concerning": "表达我对...的不满",
                  "show my sincere congratulations to": "向...表示我真诚的祝贺",
                  "offer my sincere apology to": "向...表示我真诚的歉意",
                  "invite you to participate in": "邀请你来参加",
                  "have informed that": "通知某人某事",
                  "As we all know": "正如我们所知",
                  "It is necessary for you to": "对你而言，做...是有必要的",
                  "Another choice is that you can": "另一个选择是你可以",
                  "It would be beneficial that": "做...是有益的",
                  "savor life": "品味人生/自由/青春",
                  "promote the qualities of life": "提升生活质量",
                  "reduce one's stress": "减轻压力",
                  "be exposed to new ideas": "接触新思想/经验",
                  "broaden the mind": "开阔视野/心胸",
                  "enlighten the mind": "启迪心灵",
                  "have a wide range of knowledge": "有广泛的知识",
                  "integrate with other people well": "与人很好地交往",
                  "share experience/ideas/knowledge": "分享经验/想法/知识",
                  "improve social skills and competence": "提高社会技能和能力",
                  "give full play to one's ability": "充分发挥能力",
                  "adapt oneself to the society": "使自己适应社会",
                  "bring you a much better and brighter future": "带来更好更光明的未来",
                  "Please let me know whether you can come and whether time is convenient for you": "请告诉我你是否能来，时间是否方便",
                  "I am looking forward to your reply": "我期待着你的答复",
                  "Once again, please accept my heartfelt gratitude": "请再次接受我衷心的感谢",
                  "I take pride in your achievements": "我为你们的成就感到骄傲",
                  "would like to extend my best wishes for your success": "向你的成功致以最美好的祝愿",
                  "I am looking forward to hearing more good news from you": "我期待着从你那里听到更多的好消息",
                  "hope you will find these proposals useful": "我希望这些建议对你有所帮助",
                  "I would be ready to discuss this matter with you to further details": "我将准备与你进一步讨论这个问题的细节",
                  "I sincerely wish you could understand my situation and accept my apology": "我真诚地希望您能理解我的情况并接受我的道歉",
                  "I apologize in advance for any inconvenience thus caused": "我对由此造成的不便表示歉意",
                  "Please let me know which solution you prefer at your earliest convenience": "请尽早告诉我您喜欢哪种解决方案",
                  "I would appreciate it a lot if you could take my complaint seriously": "如果您能认真对待我的投诉，我将不胜感激",
                  "see to it prompt": "及时处理",
                  "at your earliest convenience": "在您方便的时候尽早"
                },
                "sentences": {
                  "I am writing this letter/email to do目的+for+原因": "我写这封信/邮件是为了某事。",
                  "express my sincere gratitude for your kind help": "对你热心的帮助致以真诚的谢意",
                  "make some suggestions concerning sth./doing sth.": "给出关于某事的建议",
                  "make my complaint concerning sth./doing sth.": "表达我对某事的不满",
                  "show my sincere congratulations to you because句子/for sth./doing sth": "因为某事向你表示我真诚的祝贺",
                  "offer my sincere apology to you because句子/for sth./doing sth": "因为某事向你表示我真诚的歉意",
                  "invite you to participate in 活动 on behalf of 某人/组织": "代表某人/组织邀请你来参加活动",
                  "have 某人 informed that 句子": "通知某人某事",
                  "As we all know": "正如我们所知",
                  "It is necessary for you to do sth.": "对你而言，做某事是有必要/建议/有益的。",
                  "Another choice is that you can do sth.": "另一个选择是你可以做某事。",
                  "It would be beneficial/advantageous that+句子": "做某事是有益的。",
                  "Please let me know whether you can come and whether time is convenient for you by sending me an email or calling me. I am looking forward to your reply.": "请给我发邮件或打电话告诉我你是否能来，时间是否方便。期待您的回复。",
                  "Once again, please accept my heartfelt gratitude and I sincerely hope that I can repay your kindness in near future. I am looking forward to your reply.": "我真诚地希望在不久的将来能报答你的好意，请再次接受我衷心的感谢。我期待着你的答复。",
                  "Once again, I take pride in your achievements and would like to extend my best wishes for your success. I am looking forward to hearing more good news from you.": "我再次为你们的成就感到骄傲，并向你的成功致以最美好的祝愿。我期待着从你那里听到更多的好消息。",
                  "hope you will find these proposals useful. And I would be ready to discuss this matter with you to further details.": "我希望这些建议对你有所帮助的。我将准备与你进一步讨论这个问题的细节。",
                  "I sincerely wish you could understand my situation and accept my apology, and I apologize in advance for any inconvenience thus caused. Please let me know which solution you prefer at your earliest convenience.": "我真诚地希望您能理解我的情况并接受我的道歉，并对由此造成的不便表示歉意。请尽早告诉我您喜欢哪种解决方案。",
                  "I would appreciate it a lot if you could take my complaint seriously and see to it prompt. I am looking forward to your reply at your earliest convenience.": "如果您能认真对待我的投诉并及时处理，我将不胜感激。我期待着您在方便的时候尽早答复"
                }
            },
            "chart": {
                "words": {
                  "The": "这",
                  "chart": "图表",
                  "clearly": "清晰地",
                  "illustrates": "展示",
                  "distribution": "分布",
                  "of": "的",
                  "student": "学生",
                  "grades": "成绩",
                  "across": "在...范围内",
                  "different": "不同的",
                  "subjects": "科目",
                  "in": "在",
                  "Class": "班级",
                  "during": "在...期间",
                  "spring": "春季",
                  "semester": "学期",
                  "Overall": "总体而言",
                  "it": "它",
                  "is": "是",
                  "evident": "明显的",
                  "that": "那个",
                  "Mathematics": "数学",
                  "had": "有",
                  "highest": "最高的",
                  "average": "平均",
                  "score": "分数",
                  "while": "而",
                  "English": "英语",
                  "showed": "显示",
                  "most": "最",
                  "consistent": "一致的",
                  "performance": "表现",
                  "all": "所有",
                  "students": "学生们",
                  "bar": "柱状",
                  "line": "线形",
                  "graph": "图表",
                  "depicts": "描述",
                  "population": "人口",
                  "changes": "变化",
                  "City": "城市",
                  "between": "在...之间",
                  "According": "根据",
                  "data": "数据",
                  "experienced": "经历",
                  "steady": "稳定的",
                  "growth": "增长",
                  "this": "这个",
                  "period": "时期",
                  "increasing": "增加",
                  "from": "从",
                  "approximately": "大约",
                  "over": "超过",
                  "residents": "居民",
                  "table": "表格",
                  "presents": "呈现",
                  "comparison": "比较",
                  "sales": "销售",
                  "figures": "数据",
                  "product": "产品",
                  "categories": "类别",
                  "Notably": "值得注意的是",
                  "electronic": "电子",
                  "products": "产品",
                  "rate": "率",
                  "at": "在",
                  "clothing": "服装",
                  "decline": "下降",
                  "college": "大学",
                  "purposes": "目的",
                  "traveling": "旅行",
                  "Based": "基于",
                  "offered": "提供的",
                  "one": "我们",
                  "can": "可以",
                  "see": "看到",
                  "enjoying": "享受",
                  "beautiful": "美丽的",
                  "scenery": "风景",
                  "ranks": "排名",
                  "first": "第一",
                  "among": "在...中",
                  "accounting": "占",
                  "for": "对于",
                  "Next": "接下来",
                  "are": "是",
                  "relieving": "缓解",
                  "stress": "压力",
                  "cultivating": "培养",
                  "independent": "独立的",
                  "abilities": "能力",
                  "others": "其他",
                  "with": "与",
                  "respectively": "分别",
                  "making": "交",
                  "friends": "朋友",
                  "only": "只",
                  "constitutes": "构成",
                  "From": "从",
                  "my": "我的",
                  "perspective": "角度",
                  "no": "没有",
                  "difficulty": "困难",
                  "to": "来",
                  "come": "想出",
                  "up": "想出",
                  "two": "两个",
                  "key": "关键",
                  "factors": "因素",
                  "account": "解释",
                  "scene": "现象",
                  "To": "首先",
                  "begin": "开始",
                  "first": "第一个",
                  "contributing": "起作用的",
                  "factor": "因素",
                  "around": "环游",
                  "enables": "使能够",
                  "interact": "互动",
                  "local": "当地",
                  "people": "人",
                  "develop": "发展",
                  "interpersonal": "人际",
                  "relationship": "关系",
                  "them": "他们",
                  "They": "他们",
                  "also": "也",
                  "experience": "体验",
                  "culture": "文化",
                  "in-depth": "深入",
                  "addition": "此外",
                  "another": "另一个",
                  "significant": "重要的",
                  "cannot": "不能",
                  "be": "被",
                  "ignored": "忽视",
                  "make": "交",
                  "backgrounds": "背景",
                  "so": "以便",
                  "reduce": "减轻",
                  "their": "他们的",
                  "pressure": "压力",
                  "view": "鉴于",
                  "analysis": "分析",
                  "above": "以上",
                  "we": "我们",
                  "conclude": "得出结论",
                  "little": "不",
                  "surprise": "奇怪",
                  "current": "当今",
                  "era": "时代",
                  "An": "越来越多",
                  "number": "数量",
                  "spare": "业余",
                  "time": "时间",
                  "Therefore": "因此",
                  "predicted": "预测",
                  "will": "将",
                  "still": "仍将",
                  "take": "占据",
                  "large": "很大",
                  "share": "份额",
                  "future": "未来",
                  "remarkable": "显著的",
                  "museums": "博物馆",
                  "visitors": "访客",
                  "China": "中国",
                  "rose": "增加",
                  "significantly": "显著地",
                  "dramatic": "急剧的",
                  "increase": "增长",
                  "same": "同一",
                  "reaching": "达到",
                  "million": "亿",
                  "visiting": "参观",
                  "appreciate": "欣赏",
                  "numerous": "众多",
                  "exhibits": "展览",
                  "world": "世界",
                  "enjoy": "享受",
                  "more": "更多",
                  "diverse": "多元",
                  "obtain": "获得",
                  "fresh": "新鲜",
                  "unwind": "放松",
                  "recharge": "充电",
                  "themselves": "自己",
                  "quickly": "快速",
                  "keep": "保持",
                  "trend": "趋势"
                },
                "phrases": {
                  "The chart clearly illustrates that": "上图清晰显示，",
                  "Based on the data offered": "根据提供的数据",
                  "ranks is first/highest among all the categories": "在所有项中排名第一",
                  "accounting for": "占了",
                  "Next are": "其次是",
                  "respectively": "分别",
                  "while": "而",
                  "only constitutes": "只占了",
                  "From my perspective": "从我的角度来看",
                  "it is of no difficulty to come up with": "想出...并不困难",
                  "two key factors to account for": "解释这一现象的两个关键因素",
                  "The first contributing factor is that": "第一个起作用的因素是",
                  "Another important factor that cannot be ignored is that": "另一个不能忽视的重要因素是",
                  "In view of the analysis above": "鉴于以上分析",
                  "we can conclude that": "我们可以得出结论",
                  "it is of little surprise to see this scene": "看到这种现象并不奇怪",
                  "it is surprising to see this phenomenon": "看到这种现象是令人震惊的",
                  "it can be predicted that": "可以预测",
                  "will still take up a large share": "仍将占据很大份额",
                  "we need to take actions to address the problem": "我们需要采取行动来解决这一问题",
                  "the remarkable changes in": "...的显著变化",
                  "during the past several years": "在过去几年里",
                  "the number/amount of": "...的数量",
                  "rose/fell significantly/gradually": "显著地/平稳地上升/下降",
                  "experienced a steady/dramatic increase/decrease": "经历了平稳的/显著的上升/下降",
                  "during the same period": "在同一时期",
                  "reaching": "达到",
                  "enables people to": "使人们能够",
                  "obtain fresh visiting experience": "获得新鲜的参观体验",
                  "unwind and recharge themselves": "放松和充电",
                  "enjoy scenery": "欣赏美景",
                  "enjoy numerous exhibits from around the world": "欣赏世界各地的多种展览",
                  "undertake further study": "进行深造",
                  "start a business": "创业",
                  "learn/acquire language": "获取知识",
                  "be lured to going out of campus": "乐意走出校园",
                  "seek fun and enjoyment": "寻找快乐",
                  "unwind and recharge": "放松和充电",
                  "boost/stimulate purchasing power": "提高购买力",
                  "boost/stimulate sales in the market": "刺激市场销量",
                  "reach saturation": "达到饱和",
                  "leave little room for growth": "几乎没有增长空间",
                  "remain stagnant": "停滞不前",
                  "grow steadily": "稳步发展"
                },
                "sentences": {
                  "The chart clearly illustrates that+句子": "上图清晰显示，",
                  "调查对象 have different purposes of / show different attitudes towards 图表话题": "调查对象对于图表话题有不同的目的/有不同的态度",
                  "Based on data offered, one can clearly see that 描述对象1 ranks the first/highest among all the categories, accounting for 数据1. Next are 描述对象2 and 描述对象3 (with 数据2 and 数据3 respectively), while 描述对象4 only constitutes 数据4.": "根据提供的数据，我们可以清楚地看出描述对象1在所有项中排名第一，占了数据1。其次是描述对象2和3, 分别占数据2和3，而描述对象4只占了数据4.",
                  "From my perspective, it is of no difficulty to come up with two key factors to account for the scene.": "从我的角度来看想出解释这一现象的两个关键因素并不困难。",
                  "The first contributing factor is that +句子": "第一个起作用的因素是",
                  "Another important factor that cannot be ignored is that +句子": "另一个不能忽视的重要因素是。",
                  "In view of the analysis above, we can conclude that it is of little surprise to see this scene in the current era.": "鉴于以上分析，在当今时代看到这种现象并不奇怪。",
                  "In view of the analysis above, we can conclude that it is surprising to see this phenomenon in the current era.": "鉴于以上分析，在当今时代看到这种现象是令人震惊的。",
                  "Therefore, it can be predicted that 描述对象 will still take up a large share in the future.": "因此，可以预测描述对象在未来也将占据很大份额。",
                  "Therefore, we need to take actions to address the problem.": "因此，我们需要采取行动来解决这一问题。",
                  "The chart clearly illustrates remarkable changes in 话题 during the past several years.": "上图清晰地显示，话题在过去几年里（明显）变化。",
                  "Based on the data offered, one can clearly see that the number/amount of 描述对象1 rose/fell significantly/gradually from 数据 in 年份 to 数据 in 年份, while that of 描述对象2 experienced a steady/dramatic increase/decrease during the same period, reaching 数据 in 年份.": "根据提供的数据，我们可以清楚地看出描述对象1的数据从年份数据显著地/平稳地上升/下降到年份数据， 而描述对象2的数据在同一时期经历了平稳的/显著的上升/下降，在年份达到数据。",
                  "From my perspective, it is of no difficulty to come up with two key factors to account for this phenomenon. To begin with, the first contributing factor is that [原因1]: 话题 enables people to 话题语料 and 话题语料. Besides, another important factor that cannot be ignored is that [原因2]: they can 话题语料 and 话题语料 so that they can 话题语料.": "从我的角度来看，不难想到两个关键因素导致了这个现象。首先，第一个因素是原因1。此外，另一个不容忽视的重要因素是，原因2。",
                  "In view of the analysis above, we can conclude that it is of little surprise to see this phenomenon in the current era. Therefore, it can be predicted that 描述对象 will still keep this trend of growth/decline in the future.": "(积极) 鉴于上述分析，我们可以得出结论，在当今时代看到这种现象并不令人惊诉。因此，可以预测，描述对象1仍将在未来保持这种增长/下降趋势。",
                  "In view of the analysis above, we can conclude that it is of surprise to see this phenomenon in the current era. Therefore, we need to take actions to address the problem.": "(消极) 鉴于上述分析，我们可以得出结论，在当今时代看到这种现象令人惊诉。因此，我们需要采取行动来解决这个问题。",
                  "The chart clearly illustrates people show different attitudes towards 图表话题. Based on data provided, one can clearly see that 描述对象1 ranks the first among all the categories, accounting for 数据1. Next are 描述对象2 and 描述对象3 with 数据2 and 数据3 respectively, while 描述对象4 only constitute(s) 数据4.": "该图清晰地显示出人们对不同的话题持有不同的观点。根据提供的数据，我们可以清楚地看到，描述对象1在所有类别中排名第一，占数据1。接下来是描述对象2和描述对象3，分别占有数据2和数据3，而描述对象4只占数据4。"
                }
            }
        };
    }
}

/**
 * 文本匹配模块
 * 实现智能文本匹配算法，支持模糊匹配和精确匹配
 */
class TextMatcher {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.fuzzyMatchThreshold = defaultConfig.fuzzyMatchThreshold;
        this.similarityCache = new Map(); // 添加相似度缓存
    }
    
    /**
     * 匹配文本 - 简化为只支持单词翻译
     * @param {string} text 要匹配的文本
     * @param {string} type 文本类型：words
     * @returns {Promise<Object|null>} 匹配结果
     */
    async match(text, type) {
        // 只支持单词翻译
        const translations = await this.dataLoader.getTranslations('words');
        return this.findTranslation(text, translations, 'words');
    }
    
    /**
     * 查找翻译
     * @param {string} text 要查找的文本
     * @param {Object} translations 翻译数据
     * @param {string} type 文本类型
     * @returns {Object|null} 翻译结果
     */
    findTranslation(text, translations, type) {
        if (!text || !translations) {
            return null;
        }
        
        // 清理文本
        const cleanText = this.cleanText(text);
        
        // 精确匹配
        if (translations[cleanText]) {
            return {
                original: cleanText,
                translation: translations[cleanText],
                type: type,
                isExact: true
            };
        }
        
        // 尝试不区分大小写的匹配
        const caseInsensitiveMatch = this.findCaseInsensitiveMatch(cleanText, translations);
        if (caseInsensitiveMatch) {
            return caseInsensitiveMatch;
        }
        
        // 尝试模糊匹配
        const fuzzyResult = this.fuzzyMatch(cleanText, translations);
        if (fuzzyResult) {
            return { ...fuzzyResult, isFuzzy: true };
        }
        
        // 记录未找到的翻译
        this.logMissingTranslation(cleanText, type);
        
        // 修复：没有翻译时返回null，不显示任何内容
        return null;
    }
    
    /**
     * 清理文本
     * @param {string} text 原始文本
     * @returns {string} 清理后的文本
     */
    cleanText(text) {
        if (!text) return '';
        
        return text
            .trim()
            // 移除标点符号（保留基本标点）
            .replace(/[^\w\s.,!?;:'"-]/g, '')
            // 将多个空格替换为单个空格
            .replace(/\s+/g, ' ');
    }
    
    /**
     * 不区分大小写的匹配
     * @param {string} text 文本
     * @param {Object} translations 翻译数据
     * @returns {Object|null} 匹配结果
     */
    findCaseInsensitiveMatch(text, translations) {
        const lowerText = text.toLowerCase();
        
        for (const [key, value] of Object.entries(translations)) {
            if (key.toLowerCase() === lowerText) {
                return {
                    original: text,
                    translation: value,
                    type: 'words',
                    isCaseInsensitive: true
                };
            }
        }
        
        return null;
    }
    
    /**
     * 模糊匹配
     * @param {string} text 文本
     * @param {Object} translations 翻译数据
     * @returns {Object|null} 匹配结果
     */
    fuzzyMatch(text, translations) {
        let bestMatch = null;
        let bestScore = 0;
        
        for (const [key, value] of Object.entries(translations)) {
            const score = this.calculateSimilarity(text.toLowerCase(), key.toLowerCase());
            
            if (score > bestScore && score >= this.fuzzyMatchThreshold) {
                bestScore = score;
                bestMatch = {
                    original: text,
                    translation: value,
                    type: 'words',
                    similarity: score
                };
            }
        }
        
        return bestMatch;
    }
    
    /**
     * 计算文本相似度（使用编辑距离算法）
     * @param {string} str1 字符串1
     * @param {string} str2 字符串2
     * @returns {number} 相似度（0-1）
     */
    calculateSimilarity(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        
        // 创建距离矩阵
        const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
        
        // 初始化矩阵
        for (let i = 0; i <= len1; i++) {
            matrix[i][0] = i;
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        
        // 填充矩阵
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // 删除
                    matrix[i][j - 1] + 1,      // 插入
                    matrix[i - 1][j - 1] + cost // 替换
                );
            }
        }
        
        // 计算相似度
        const maxLen = Math.max(len1, len2);
        return maxLen === 0 ? 1 : (maxLen - matrix[len1][len2]) / maxLen;
    }
    
    /**
     * 记录未找到的翻译
     * @param {string} text 文本
     * @param {string} type 文本类型
     */
    logMissingTranslation(text, type) {
        if (defaultConfig.debugMode) {
            console.log(`未找到翻译: [${type}] ${text}`);
        }
        
        // 可以在这里添加发送缺失翻译到服务器的逻辑
    }
    
    /**
     * 设置匹配规则
     * @param {Object} rules 匹配规则
     */
    setMatchRules(rules) {
        if (rules.fuzzyMatchThreshold !== undefined) {
            this.fuzzyMatchThreshold = rules.fuzzyMatchThreshold;
        }
    }
}

/**
 * 弹窗管理模块
 * 控制翻译弹窗的显示和隐藏，管理弹窗位置和样式
 */
class PopupManager {
    constructor() {
        this.currentPopup = null;
        this.hideTimer = null;
        this.animationDuration = defaultConfig.animationDuration;
        
        // 创建弹窗容器
        this.createPopupContainer();
    }
    
    /**
     * 创建弹窗容器
     */
    createPopupContainer() {
        // 检查是否已存在弹窗容器
        if (document.getElementById('translation-popup-container')) {
            return;
        }
        
        const container = document.createElement('div');
        container.id = 'translation-popup-container';
        container.className = 'translation-popup-container';
        document.body.appendChild(container);
    }
    
    /**
     * 显示翻译弹窗
     * @param {string} text 原文
     * @param {Object} translation 翻译结果
     * @param {Object} position 点击位置
     * @returns {HTMLElement} 弹窗元素
     */
    showPopup(text, translation, position) {
        // 修复：检查翻译结果是否为null，如果是则不显示弹窗
        if (!translation) {
            if (defaultConfig.debugMode) {
                console.log('未找到翻译，不显示弹窗:', text);
            }
            return null;
        }
        
        // 隐藏现有弹窗
        this.hidePopup();
        
        // 创建弹窗
        const popup = this.createPopupElement(text, translation);
        
        // 计算位置
        const popupPosition = this.calculatePopupPosition(popup, position);
        
        // 设置位置
        popup.style.left = `${popupPosition.x}px`;
        popup.style.top = `${popupPosition.y}px`;
        
        // 添加到容器
        const container = document.getElementById('translation-popup-container');
        container.appendChild(popup);
        
        // 显示动画
        this.showPopupAnimation(popup);
        
        // 设置自动隐藏
        this.setAutoHide(popup);
        
        // 保存当前弹窗引用
        this.currentPopup = popup;
        
        return popup;
    }
    
    /**
     * 创建弹窗元素
     * @param {string} text 原文
     * @param {Object} translation 翻译结果
     * @returns {HTMLElement} 弹窗元素
     */
    createPopupElement(text, translation) {
        const popup = document.createElement('div');
        popup.className = 'translation-popup';
        popup.setAttribute('role', 'tooltip');
        popup.setAttribute('aria-label', '翻译内容');
        
        // 弹窗头部
        const header = document.createElement('div');
        header.className = 'popup-header';
        
        const typeLabel = document.createElement('span');
        typeLabel.className = 'popup-type';
        typeLabel.textContent = this.getTypeLabel(translation.type);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'popup-close';
        closeButton.setAttribute('aria-label', '关闭翻译');
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => this.hidePopup());
        
        header.appendChild(typeLabel);
        header.appendChild(closeButton);
        
        // 弹窗内容
        const content = document.createElement('div');
        content.className = 'popup-content';
        
        const originalText = document.createElement('div');
        originalText.className = 'original-text';
        originalText.textContent = translation.original || text;
        
        const translatedText = document.createElement('div');
        translatedText.className = 'translated-text';
        translatedText.textContent = translation.translation;
        
        // 添加匹配信息
        const additionalInfo = document.createElement('div');
        additionalInfo.className = 'additional-info';
        
        if (translation.isFuzzy) {
            const fuzzyInfo = document.createElement('span');
            fuzzyInfo.className = 'match-info';
            fuzzyInfo.textContent = '模糊匹配';
            additionalInfo.appendChild(fuzzyInfo);
        }
        
        // 修复：移除对缺失翻译的处理，因为我们不再显示缺失翻译的内容
        // if (translation.isMissing) {
        //     const missingInfo = document.createElement('span');
        //     missingInfo.className = 'match-info missing';
        //     missingInfo.textContent = '暂无翻译';
        //     additionalInfo.appendChild(missingInfo);
        // }
        
        content.appendChild(originalText);
        content.appendChild(translatedText);
        content.appendChild(additionalInfo);
        
        // 弹窗底部
        const footer = document.createElement('div');
        footer.className = 'popup-footer';
        
        // 发音按钮
        if (defaultConfig.enableSound) {
            const pronounceBtn = document.createElement('button');
            pronounceBtn.className = 'pronounce-btn';
            pronounceBtn.setAttribute('aria-label', '发音');
            pronounceBtn.textContent = '🔊';
            pronounceBtn.addEventListener('click', () => {
                this.pronounceText(text);
            });
            footer.appendChild(pronounceBtn);
        }
        
        // 收藏按钮
        const favoriteBtn = document.createElement('button');
        favoriteBtn.className = 'add-to-favorites';
        favoriteBtn.setAttribute('aria-label', '收藏');
        favoriteBtn.textContent = '⭐';
        favoriteBtn.addEventListener('click', () => {
            this.addToFavorites(text, translation);
        });
        footer.appendChild(favoriteBtn);
        
        // 组装弹窗
        popup.appendChild(header);
        popup.appendChild(content);
        popup.appendChild(footer);
        
        return popup;
    }
    
    /**
     * 获取类型标签 - 简化为只支持单词
     * @param {string} type 类型
     * @returns {string} 类型标签
     */
    getTypeLabel(type) {
        // 只支持单词翻译
        return '单词';
    }
    
    /**
     * 计算弹窗位置
     * @param {HTMLElement} popup 弹窗元素
     * @param {Object} clickPosition 点击位置
     * @returns {Object} 计算后的位置
     */
    calculatePopupPosition(popup, clickPosition) {
        // 获取弹窗尺寸
        const popupRect = popup.getBoundingClientRect();
        const popupWidth = 300; // 默认宽度
        const popupHeight = 200; // 默认高度
        
        // 获取视口尺寸
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 计算初始位置
        let x = clickPosition.x;
        let y = clickPosition.y + 10; // 在点击位置下方10px
        
        // 水平位置调整
        if (x + popupWidth > viewportWidth) {
            // 如果右侧空间不足，显示在左侧
            x = clickPosition.x - popupWidth - 10;
        }
        
        // 确保不超出左边界
        if (x < 10) {
            x = 10;
        }
        
        // 垂直位置调整
        if (y + popupHeight > viewportHeight) {
            // 如果下方空间不足，显示在上方
            y = clickPosition.y - popupHeight - 10;
        }
        
        // 确保不超出上边界
        if (y < 10) {
            y = 10;
        }
        
        return { x, y };
    }
    
    /**
     * 显示弹窗动画
     * @param {HTMLElement} popup 弹窗元素
     */
    showPopupAnimation(popup) {
        // 初始状态
        popup.style.opacity = '0';
        popup.style.transform = 'scale(0.8)';
        popup.style.transition = `opacity ${this.animationDuration}ms ease, transform ${this.animationDuration}ms ease`;
        
        // 触发动画
        requestAnimationFrame(() => {
            popup.style.opacity = '1';
            popup.style.transform = 'scale(1)';
            
            // 添加动画完成后的回调
            if (this.onAnimationComplete) {
                this.onAnimationComplete(popup);
            }
        });
    }
    
    /**
     * 动画完成回调
     * @param {HTMLElement} popup 弹窗元素
     */
    onAnimationComplete(popup) {
        // 添加显示完成的视觉反馈
        popup.style.boxShadow = '0 0 20px rgba(0, 102, 204, 0.3)';
    }
    
    /**
     * 隐藏翻译弹窗
     */
    hidePopup() {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
        
        if (this.currentPopup) {
            const popup = this.currentPopup;
            
            // 隐藏动画
            popup.style.opacity = '0';
            popup.style.transform = 'scale(0.8)';
            
            // 动画结束后移除元素
            setTimeout(() => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            }, this.animationDuration);
            
            this.currentPopup = null;
        }
    }
    
    /**
     * 设置动画完成回调
     * @param {Function} callback 回调函数
     */
    setAnimationCallback(callback) {
        this.onAnimationComplete = callback;
    }
    
    /**
     * 设置自动隐藏
     * @param {HTMLElement} popup 弹窗元素
     */
    setAutoHide(popup) {
        this.hideTimer = setTimeout(() => {
            this.hidePopup();
        }, defaultConfig.displayDuration);
    }
    
    /**
     * 发音文本
     * @param {string} text 要发音的文本
     */
    pronounceText(text) {
        if (window.EnglishLearningCommon && window.EnglishLearningCommon.speakWord) {
            window.EnglishLearningCommon.speakWord(text);
        }
    }
    
    /**
     * 添加到收藏
     * @param {string} text 原文
     * @param {Object} translation 翻译结果
     */
    addToFavorites(text, translation) {
        // 获取现有收藏
        let favorites = [];
        try {
            const stored = localStorage.getItem('translation_favorites');
            if (stored) {
                favorites = JSON.parse(stored);
            }
        } catch (error) {
            console.warn('读取收藏失败:', error);
        }
        
        // 检查是否已收藏
        const existingIndex = favorites.findIndex(item => item.original === text);
        if (existingIndex !== -1) {
            // 已收藏，移除
            favorites.splice(existingIndex, 1);
            this.showNotification('已取消收藏');
        } else {
            // 未收藏，添加
            favorites.push({
                original: text,
                translation: translation.translation,
                type: translation.type,
                timestamp: Date.now()
            });
            this.showNotification('已添加到收藏');
        }
        
        // 保存收藏
        try {
            localStorage.setItem('translation_favorites', JSON.stringify(favorites));
        } catch (error) {
            console.warn('保存收藏失败:', error);
        }
    }
    
    /**
     * 显示通知
     * @param {string} message 通知消息
     */
    showNotification(message) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'translation-notification';
        notification.textContent = message;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示动画
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // 自动隐藏
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }
    
    /**
     * 更新弹窗位置
     * @param {Object} position 新位置
     */
    updatePosition(position) {
        if (this.currentPopup) {
            this.currentPopup.style.left = `${position.x}px`;
            this.currentPopup.style.top = `${position.y}px`;
        }
    }
    
    /**
     * 设置弹窗样式
     * @param {Object} style 样式对象
     */
    setStyle(style) {
        if (this.currentPopup) {
            Object.assign(this.currentPopup.style, style);
        }
    }
}

/**
 * 事件处理模块 - 修复版本
 * 解决与common.js的事件冲突问题
 */
class EventHandler {
    constructor(translationManager) {
        this.translationManager = translationManager;
        this.lastClickTime = 0;
        this.lastClickedElement = null;
        this.clickThreshold = 300; // 300ms内的重复点击将被忽略
        this.debounceTimer = null; // 添加debounce定时器
        this.eventListenersAttached = false; // 添加事件监听器状态标记
        
        // 延迟初始化事件监听，确保与common.js不冲突
        setTimeout(() => {
            try {
                this.initEventListeners();
            } catch (error) {
                console.error('初始化事件监听器时出错:', error);
            }
        }, 100);
    }
    
    /**
     * 初始化事件监听
     */
    initEventListeners() {
        if (this.eventListenersAttached) {
            return; // 避免重复绑定
        }
        
        // 使用事件委托处理点击事件，但优先级更高
        document.addEventListener('click', this.handleClick.bind(this), true); // 使用捕获阶段
        
        // 处理键盘事件
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // 处理窗口大小变化
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // 处理滚动事件
        window.addEventListener('scroll', this.handleScroll.bind(this));
        
        // 添加触摸事件支持
        if ('ontouchstart' in window) {
            document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
        }
        
        this.eventListenersAttached = true;
        
        if (defaultConfig.debugMode) {
            console.log('翻译事件监听器已初始化');
        }
    }
    
    /**
     * 处理点击事件 - 通用版本
     * @param {Event} event 点击事件
     */
    handleClick(event) {
        const target = event.target;
        
        // 检查是否点击了弹窗内部
        if (target.closest('.translation-popup')) {
            return;
        }
        
        // 检查是否为可翻译元素
        const translatableElement = this.findTranslatableElement(target);
        if (translatableElement) {
            // 阻止事件冒泡，避免与common.js冲突
            event.stopPropagation();
            event.preventDefault();
            
            // 使用debounce机制优化性能
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            
            this.debounceTimer = setTimeout(() => {
                // 检查是否为重复点击
                if (this.isDuplicateClick(translatableElement, event.timeStamp)) {
                    return;
                }
                
                this.lastClickTime = event.timeStamp;
                this.lastClickedElement = translatableElement;
                
                // 处理翻译请求
                this.translationManager.handleTranslation(translatableElement, event);
            }, 100); // 100ms延迟，优化性能
        } else {
            // 点击了非可翻译区域，隐藏弹窗
            this.translationManager.popupManager.hidePopup();
        }
    }
    
    /**
     * 查找可翻译元素 - 通用版本
     * @param {HTMLElement} target 点击目标
     * @returns {HTMLElement|null} 可翻译元素
     */
    findTranslatableElement(target) {
        // 首先检查是否在指定的可翻译区域内
        if (!this.isInTranslatableArea(target)) {
            return null; // 不在指定区域内，不翻译
        }
        
        // 检查是否为单词元素（与现有common.js兼容）
        if (target.classList.contains('word')) {
            // 验证单词长度和内容
            const text = target.textContent.trim();
            // 仅对长度大于2个字符且不包含数字的单词生效
            if (text.length <= 2 || /\d/.test(text)) {
                return null; // 不翻译短单词或包含数字的单词
            }
            
            // 检查是否在已有翻译标注的短语和句子附近
            const nearbyTranslation = target.nextElementSibling;
            if (nearbyTranslation && nearbyTranslation.classList &&
                (nearbyTranslation.classList.contains('chinese-translation') ||
                 nearbyTranslation.classList.contains('translation'))) {
                return null; // 排除已有翻译的内容
            }
            
            return target;
        }
        
        // 新增：支持点击任意英文文本
        const text = target.textContent.trim();
        if (this.isEnglishWord(text)) {
            return target;
        }
        
        // 如果点击的是文本节点，获取其父元素
        if (target.nodeType === Node.TEXT_NODE && target.parentNode) {
            const parentText = target.parentNode.textContent.trim();
            if (this.isEnglishWord(parentText)) {
                return target.parentNode;
            }
        }
        
        return null;
    }
    
    /**
     * 检查文本是否为英文单词
     * @param {string} text 文本内容
     * @returns {boolean} 是否为英文单词
     */
    isEnglishWord(text) {
        if (!text || text.trim().length === 0) {
            return false;
        }
        
        // 清理文本，移除标点符号
        const cleanText = text.trim().replace(/[^\w\s]/g, '');
        
        // 过短或包含数字的文本不认为是单词
        if (cleanText.length <= 2 || /\d/.test(cleanText)) {
            return false;
        }
        
        // 检查是否主要由英文字母组成
        const englishChars = cleanText.match(/[a-zA-Z]/g);
        if (!englishChars || englishChars.length < 2) {
            return false;
        }
        
        // 英文字符占比超过60%认为是英文文本
        const englishRatio = englishChars.length / cleanText.length;
        return englishRatio > 0.6;
    }
    
    /**
     * 检查元素是否在指定的可翻译区域内 - 修复版本
     * @param {HTMLElement} element 要检查的元素
     * @returns {boolean} 是否在指定区域内
     */
    isInTranslatableArea(element) {
        // 获取当前页面类型
        const pageType = this.translationManager.dataLoader.detectPageType();
        
        // 根据页面类型定义指定区域的CSS选择器
        const translatableSelectors = this.getTranslatableSelectors(pageType);
        
        // 检查元素是否在任一指定区域内
        for (const selector of translatableSelectors) {
            const parentArea = element.closest(selector);
            if (parentArea) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 获取指定区域的CSS选择器 - 修复版本
     * @param {string} pageType 页面类型：letter或chart
     * @returns {Array} CSS选择器数组
     */
    getTranslatableSelectors(pageType) {
        if (pageType === 'letter') {
            // 书信页面的5个指定区域 - 使用更精确的选择器
            return [
                // 1. 开头段-直奔主题-必备句型1个
                '.container > .section > .content-box:nth-child(2)',
                // 2. 主体段-问啥答啥-引出话题1个
                '.container > .section > .content-box:nth-child(3)',
                // 3. 主体段-必备句型3个动词词组(do sth.)
                '.container > .section > .content-box:nth-child(4) > .content-box[data-target="verb-phrases-beneficial"]',
                // 4. 信件模板
                '.container > .section > .content-box:nth-child(5)',
                // 5. 书信类小作文模版
                '.container > .section > .content-box:nth-child(6)'
            ];
        } else if (pageType === 'chart') {
            // 图表页面的7个指定区域 - 使用更精确的选择器
            return [
                // 6. "比大小"类图表写作指南
                '.container > .section > .content-box:nth-child(2)',
                // 7. "比趋势"类图表写作指南
                '.container > .section > .content-box:nth-child(3)',
                // 8. 图表「比趋势」类模板
                '.container > .section > .content-box:nth-child(4)',
                // 9. 图表「比大小」类模板
                '.container > .section > .content-box:nth-child(5)',
                // 10. 常用词汇和短语
                '.container > .section > .content-box:nth-child(6)',
                // 11. 2016饼图范文（静态图通用）
                '.container > .section > .content-box:nth-child(7)',
                // 12. 2017折线图范文（动态图通用）
                '.container > .section > .content-box:nth-child(7)'
            ];
        }
        
        return [];
    }
    
    /**
     * 检查元素是否包含英文内容
     * @param {HTMLElement} element 要检查的元素
     * @returns {boolean} 是否包含英文内容
     */
    hasEnglishContent(element) {
        const text = element.textContent || '';
        // 简单判断：如果文本中英文字符占大部分，认为是英文文本
        const cleanText = text.trim().replace(/[^\w\s]/g, '');
        const englishChars = cleanText.match(/[a-zA-Z]/g);
        
        if (!englishChars || englishChars.length < 2) {
            return false;
        }
        
        const englishRatio = englishChars.length / cleanText.length;
        return englishRatio > 0.6;
    }
    
    /**
     * 判断是否为英文文本
     * @param {string} text 文本内容
     * @returns {boolean} 是否为英文文本
     */
    isEnglishText(text) {
        if (!text || text.trim().length === 0) {
            return false;
        }
        
        // 简单判断：如果文本中英文字符占大部分，认为是英文文本
        const cleanText = text.trim().replace(/[^\w\s]/g, '');
        const englishChars = cleanText.match(/[a-zA-Z]/g);
        
        if (!englishChars || englishChars.length < 2) {
            return false;
        }
        
        const englishRatio = englishChars.length / cleanText.length;
        return englishRatio > 0.6;
    }
    
    /**
     * 检查是否为重复点击
     * @param {HTMLElement} element 元素
     * @param {number} timestamp 时间戳
     * @returns {boolean} 是否为重复点击
     */
    isDuplicateClick(element, timestamp) {
        return element === this.lastClickedElement && 
               (timestamp - this.lastClickTime) < this.clickThreshold;
    }
    
    /**
     * 处理键盘事件
     * @param {Event} event 键盘事件
     */
    handleKeyDown(event) {
        // ESC键隐藏弹窗
        if (event.key === 'Escape') {
            this.translationManager.popupManager.hidePopup();
        }
    }
    
    /**
     * 处理窗口大小变化
     */
    handleResize() {
        // 防抖处理
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        
        this.resizeTimer = setTimeout(() => {
            // 重新计算弹窗位置
            if (this.translationManager.popupManager.currentPopup) {
                // 这里可以添加重新定位逻辑
            }
        }, 250);
    }
    
    /**
     * 处理滚动事件
     */
    handleScroll() {
        // 防抖处理
        if (this.scrollTimer) {
            clearTimeout(this.scrollTimer);
        }
        
        this.scrollTimer = setTimeout(() => {
            // 滚动时隐藏弹窗
            this.translationManager.popupManager.hidePopup();
        }, 100);
    }
}

/**
 * 翻译管理器 - 修复版本
 * 统一管理所有翻译功能，协调各模块之间的交互
 */
class TranslationManager {
    constructor() {
        // 初始化各模块
        this.dataLoader = new DataLoader();
        this.textMatcher = new TextMatcher(this.dataLoader);
        this.popupManager = new PopupManager();
        this.eventHandler = new EventHandler(this);
        
        // 配置选项
        this.config = { ...defaultConfig };
        
        // 初始化状态
        this.isInitialized = false;
        this.isEnabled = true;
        
        // 延迟初始化，确保与common.js不冲突
        setTimeout(() => {
            this.init();
        }, 200);
    }
    
    /**
     * 初始化翻译系统 - 修复版本
     */
    async init() {
        try {
            if (defaultConfig.debugMode) {
                console.log('开始初始化翻译系统...');
            }
            
            // 预加载翻译数据
            await this.dataLoader.loadData();
            
            // 标记可翻译区域
            this.markTranslatableAreas();
            
            // 标记为已初始化
            this.isInitialized = true;
            
            if (defaultConfig.debugMode) {
                console.log('翻译系统初始化完成');
            }
        } catch (error) {
            console.error('翻译系统初始化失败:', error);
        }
    }
    
    /**
     * 标记可翻译区域，添加视觉提示 - 通用版本
     */
    markTranslatableAreas() {
        // 获取当前页面类型
        const pageType = this.dataLoader.detectPageType();
        
        // 获取指定区域的选择器
        const translatableSelectors = this.eventHandler.getTranslatableSelectors(pageType);
        
        if (defaultConfig.debugMode) {
            console.log(`标记${pageType}页面的可翻译区域，选择器数量:`, translatableSelectors.length);
        }
        
        // 为每个指定区域添加视觉标识
        translatableSelectors.forEach((selector, index) => {
            const elements = document.querySelectorAll(selector);
            if (defaultConfig.debugMode) {
                console.log(`选择器${index + 1}: ${selector}, 匹配元素数量: ${elements.length}`);
            }
            
            elements.forEach(element => {
                // 添加可翻译区域的标识类
                element.classList.add('translatable-area');
                
                // 添加区域编号标识（用于调试和视觉提示）
                if (!element.hasAttribute('data-area-id')) {
                    element.setAttribute('data-area-id', `area-${pageType}-${index + 1}`);
                }
                
                // 为区域内的所有英文单词添加视觉提示
                this.addVisualCuesToAllEnglishWords(element);
            });
        });
        
        // 添加全局样式提示（如果不存在）
        this.addGlobalTranslationStyles();
    }
    
    /**
     * 为区域内的所有英文单词添加视觉提示 - 通用版本
     * @param {HTMLElement} area 区域元素
     */
    addVisualCuesToAllEnglishWords(area) {
        // 首先处理已有的单词元素
        const wordElements = area.querySelectorAll('.word');
        wordElements.forEach(word => {
            this.addVisualCueToWord(word);
        });
        
        // 然后处理其他英文文本节点
        this.processTextNodes(area);
    }
    
    /**
     * 为单个单词添加视觉提示 - 移除悬停效果
     * @param {HTMLElement} word 单词元素
     */
    addVisualCueToWord(word) {
        // 添加可翻译提示类
        word.classList.add('translatable-word');
        
        // 移除悬停效果，只保留基本功能
        if (!word.hasAttribute('data-translation-enhanced')) {
            word.setAttribute('data-translation-enhanced', 'true');
            
            // 移除悬停事件，只保留基本点击功能
            word.addEventListener('mouseenter', () => {
                word.style.cursor = 'pointer';
                // 移除背景色变化
                // word.style.backgroundColor = 'rgba(0, 102, 204, 0.1)';
            });
            
            word.addEventListener('mouseleave', () => {
                // 移除背景色变化
                // word.style.backgroundColor = '';
            });
        }
    }
    
    /**
     * 处理文本节点，识别并标记英文单词
     * @param {HTMLElement} element 父元素
     */
    processTextNodes(element) {
        // 遍历所有子节点
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let textNode;
        const textNodesToProcess = [];
        
        // 收集所有文本节点
        while (textNode = walker.nextNode()) {
            if (textNode.textContent.trim().length > 0) {
                textNodesToProcess.push(textNode);
            }
        }
        
        // 处理每个文本节点
        textNodesToProcess.forEach(node => {
            const text = node.textContent;
            const words = this.extractEnglishWords(text);
            
            if (words.length > 0) {
                // 创建新元素替换文本节点
                const fragment = document.createDocumentFragment();
                let lastIndex = 0;
                
                words.forEach(word => {
                    // 添加单词前的文本
                    if (word.index > lastIndex) {
                        const beforeText = text.substring(lastIndex, word.index);
                        fragment.appendChild(document.createTextNode(beforeText));
                    }
                    
                    // 创建单词元素
                    const wordSpan = document.createElement('span');
                    wordSpan.textContent = word.text;
                    wordSpan.className = 'word translatable-word';
                    wordSpan.setAttribute('data-translation-enhanced', 'true');
                    
                    // 移除悬停事件，只保留基本点击功能
                    wordSpan.addEventListener('mouseenter', () => {
                        wordSpan.style.cursor = 'pointer';
                        // 移除背景色变化
                        // wordSpan.style.backgroundColor = 'rgba(0, 102, 204, 0.1)';
                    });
                    
                    wordSpan.addEventListener('mouseleave', () => {
                        // 移除背景色变化
                        // wordSpan.style.backgroundColor = '';
                    });
                    
                    fragment.appendChild(wordSpan);
                    lastIndex = word.index + word.text.length;
                });
                
                // 添加剩余文本
                if (lastIndex < text.length) {
                    const afterText = text.substring(lastIndex);
                    fragment.appendChild(document.createTextNode(afterText));
                }
                
                // 替换原始文本节点
                node.parentNode.replaceChild(fragment, node);
            }
        });
    }
    
    /**
     * 从文本中提取英文单词
     * @param {string} text 文本内容
     * @returns {Array} 英文单词数组
     */
    extractEnglishWords(text) {
        // 使用正则表达式匹配英文单词
        const wordRegex = /\b[a-zA-Z]{3,}\b/g;
        const words = [];
        let match;
        
        while ((match = wordRegex.exec(text)) !== null) {
            words.push({
                text: match[0],
                index: match.index
            });
        }
        
        return words;
    }
    
    /**
     * 添加全局翻译样式
     */
    addGlobalTranslationStyles() {
        // 检查是否已添加样式
        if (document.getElementById('translation-area-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'translation-area-styles';
        style.textContent = `
            /* 可翻译区域样式 - 移除蓝色边框 */
            .container > .section > .content-box.translatable-area {
                position: relative;
                /* 移除蓝色边框及相关样式 */
                /* border-left: 3px solid rgba(0, 102, 204, 0.3); */
                /* padding-left: 8px !important; */
                /* margin-left: -11px; */
            }
            
            /* 确保嵌套的content-box不会继承边框样式 */
            .container > .section > .content-box.translatable-area .content-box {
                border-left: none;
                padding-left: 0;
                margin-left: 0;
            }
            
            /* 可翻译单词样式 - 移除悬停效果 */
            .translatable-word {
                position: relative;
                /* 移除transition以避免悬停效果 */
                border-radius: 2px;
            }
            
            .translatable-word:hover {
                /* 移除悬停效果 */
                background-color: transparent !important;
            }
            
            /* 移除区域标识提示 */
            /* .container > .section > .content-box.translatable-area::before {
                content: '';
                position: absolute;
                top: 0;
                left: -3px;
                width: 3px;
                height: 100%;
                background-color: rgba(0, 102, 204, 0.3);
                border-radius: 2px 0 0 2px;
            } */
            
            /* 移动设备优化 */
            @media (max-width: 768px) {
                .container > .section > .content-box.translatable-area {
                    /* 移除蓝色边框及相关样式 */
                    /* border-left-width: 2px; */
                    /* padding-left: 6px; */
                    /* margin-left: -8px; */
                }
                
                .translatable-word {
                    padding: 1px 0;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 启用翻译功能
     */
    enable() {
        this.isEnabled = true;
    }
    
    /**
     * 禁用翻译功能
     */
    disable() {
        this.isEnabled = false;
        this.popupManager.hidePopup();
    }
    
    /**
     * 处理翻译请求 - 通用版本
     * @param {HTMLElement} element 元素
     * @param {Event} event 事件
     */
    async handleTranslation(element, event) {
        if (!this.isEnabled || !this.isInitialized) {
            if (defaultConfig.debugMode) {
                console.log('翻译功能未启用或未初始化');
            }
            return;
        }
        
        // 获取文本内容
        const text = this.getElementText(element);
        if (!text) {
            if (defaultConfig.debugMode) {
                console.log('无法获取元素文本');
            }
            return;
        }
        
        // 处理图表页面特有的错误情况
        if (this.handleChartSpecificErrors(text, event)) {
            return;
        }
        
        // 判断文本类型
        const textType = this.determineTextType(text);
        
        try {
            // 显示加载状态
            this.showLoadingState(event);
            
            // 查找翻译
            const translation = await this.textMatcher.match(text, textType);
            
            // 隐藏加载状态
            this.hideLoadingState();
            
            // 修复：检查翻译结果是否为null，如果是则不显示任何内容
            if (!translation) {
                if (defaultConfig.debugMode) {
                    console.log('未找到翻译，不显示弹窗:', text);
                }
                return;
            }
            
            // 显示弹窗
            const position = {
                x: event.clientX,
                y: event.clientY
            };
            
            this.popupManager.showPopup(text, translation, position);
            
            // 自动发音（如果启用）
            if (this.config.autoPronounce) {
                setTimeout(() => {
                    this.popupManager.pronounceText(text);
                }, 500);
            }
        } catch (error) {
            // 隐藏加载状态
            this.hideLoadingState();
            
            console.error('翻译处理失败:', error);
            
            // 修复：移除错误提示，不显示任何内容
            // this.showErrorMessage('翻译服务暂时不可用，请稍后再试', event);
        }
    }
    
    /**
     * 处理图表页面特有的错误情况
     * @param {string} text 文本
     * @param {Event} event 事件
     */
    handleChartSpecificErrors(text, event) {
        // 检查是否为特殊字符或格式问题
        if (text && text.includes('<span') && text.includes('</span>')) {
            // 处理包含HTML标签的文本
            const cleanText = text.replace(/<[^>]*>/g, '').trim();
            if (cleanText.length === 0) {
                this.showErrorMessage('无法翻译空内容或纯HTML标签', event);
                return true;
            }
        }
        
        // 检查是否为数据格式（如37%、4165等）
        if (text && /^\d+%?$/.test(text.trim())) {
            this.showErrorMessage('数据格式内容，请查看上下文获取完整含义', event);
            return true;
        }
        
        // 检查是否为占位符文本（如描述对象1、数据等）
        if (text && (text.includes('描述对象') || text.includes('数据') || text.includes('年份'))) {
            this.showErrorMessage('这是占位符文本，请替换为实际内容后再翻译', event);
            return true;
        }
        
        return false;
    }
    
    /**
     * 显示加载状态
     * @param {Event} event 点击事件
     */
    showLoadingState(event) {
        // 创建加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'translation-loading-indicator';
        loadingIndicator.innerHTML = '<div class="loading-spinner"></div>翻译中...';
        
        // 设置位置
        loadingIndicator.style.position = 'fixed';
        loadingIndicator.style.left = `${event.clientX + 10}px`;
        loadingIndicator.style.top = `${event.clientY + 10}px`;
        loadingIndicator.style.zIndex = '10002';
        
        // 添加到页面
        document.body.appendChild(loadingIndicator);
        
        // 保存引用
        this.currentLoadingIndicator = loadingIndicator;
    }
    
    /**
     * 隐藏加载状态
     */
    hideLoadingState() {
        if (this.currentLoadingIndicator) {
            document.body.removeChild(this.currentLoadingIndicator);
            this.currentLoadingIndicator = null;
        }
    }
    
    /**
     * 显示错误消息
     * @param {string} message 错误消息
     * @param {Event} event 点击事件
     */
    showErrorMessage(message, event) {
        // 创建错误提示
        const errorTip = document.createElement('div');
        errorTip.className = 'translation-error-tip';
        errorTip.textContent = message;
        
        // 设置位置
        errorTip.style.position = 'fixed';
        errorTip.style.left = `${event.clientX + 10}px`;
        errorTip.style.top = `${event.clientY + 10}px`;
        errorTip.style.zIndex = '10002';
        
        // 添加到页面
        document.body.appendChild(errorTip);
        
        // 自动隐藏
        setTimeout(() => {
            if (errorTip.parentNode) {
                document.body.removeChild(errorTip);
            }
        }, 3000);
    }
    
    /**
     * 获取元素文本
     * @param {HTMLElement} element 元素
     * @returns {string} 文本内容
     */
    getElementText(element) {
        if (!element) return '';
        
        // 如果是单词元素，直接返回文本
        if (element.classList.contains('word')) {
            return element.textContent.trim();
        }
        
        // 特殊处理：对于english-text元素，获取纯英文内容
        if (element.classList.contains('english-text')) {
            return this.extractEnglishText(element);
        }
        
        // 对于content-box元素，尝试获取主要英文内容
        if (element.classList.contains('content-box')) {
            // 首先尝试获取内部的english-text
            const englishText = element.querySelector('.english-text');
            if (englishText) {
                return this.extractEnglishText(englishText);
            }
            
            // 如果没有english-text，检查是否主要是英文内容
            if (this.hasEnglishContent(element)) {
                return element.textContent.trim();
            }
        }
        
        // 特殊处理：对于english-expression元素，获取纯英文内容
        if (element.classList.contains('english-expression')) {
            return this.extractEnglishFromExpression(element);
        }
        
        // 特殊处理：对于包含图表数据的元素
        if (this.isChartDataElement(element)) {
            return this.extractChartData(element);
        }
        
        // 对于其他元素，获取纯文本内容
        return element.textContent.trim();
    }
    
    /**
     * 从英文表达式中提取英文文本
     * @param {HTMLElement} element 元素
     * @returns {string} 英文文本内容
     */
    extractEnglishFromExpression(element) {
        let text = element.textContent || '';
        
        // 移除中文翻译部分，保留英文
        const chineseTranslation = element.nextElementSibling;
        if (chineseTranslation && chineseTranslation.classList.contains('chinese-translation')) {
            // 如果有对应的中文翻译，只取英文部分
            return text.trim();
        }
        
        // 移除HTML标签和多余空格
        return text.replace(/<[^>]*>/g, '').trim();
    }
    
    /**
     * 检查是否为图表数据元素
     * @param {HTMLElement} element 元素
     * @returns {boolean} 是否为图表数据元素
     */
    isChartDataElement(element) {
        const text = element.textContent || '';
        // 检查是否包含数据格式（如37%、4165等）
        return /\d+%/.test(text) || /^\d{4}$/.test(text.trim());
    }
    
    /**
     * 提取图表数据
     * @param {HTMLElement} element 元素
     * @returns {string} 图表数据
     */
    extractChartData(element) {
        const text = element.textContent || '';
        
        // 如果是百分比数据
        if (/\d+%/.test(text)) {
            return text.trim();
        }
        
        // 如果是年份数据
        if (/^\d{4}$/.test(text.trim())) {
            return text.trim();
        }
        
        return text.trim();
    }
    
    /**
     * 提取英文文本
     * @param {HTMLElement} element 元素
     * @returns {string} 英文文本内容
     */
    extractEnglishText(element) {
        let text = element.textContent || '';
        
        // 移除中文内容，保留英文
        // 简单的中英文分离逻辑
        const lines = text.split('\n');
        const englishLines = lines.filter(line => {
            const cleanLine = line.trim().replace(/[^\w\s]/g, '');
            const englishChars = cleanLine.match(/[a-zA-Z]/g);
            
            if (!englishChars || englishChars.length < 2) {
                return false;
            }
            
            const englishRatio = englishChars.length / cleanLine.length;
            return englishRatio > 0.6;
        });
        
        return englishLines.join(' ').trim();
    }
    
    /**
     * 判断文本类型 - 简化为只支持单词翻译
     * @param {string} text 文本
     * @returns {string} 文本类型：words
     */
    determineTextType(text) {
        if (!text) return 'words';
        
        // 清理文本
        const cleanText = text.trim().replace(/[^\w\s]/g, ' ');
        const words = cleanText.split(/\s+/).filter(word => word.length > 0);
        
        // 只支持单词翻译
        return 'words';
    }
    
    
    /**
     * 更新翻译数据
     * @param {Object} data 新的翻译数据
     */
    async updateTranslations(data) {
        try {
            // 清除现有缓存
            this.dataLoader.clearCache();
            
            // 更新数据
            this.dataLoader.translations = data;
            
            // 重新缓存
            const cacheKey = `translations_${this.dataLoader.pageType}`;
            this.dataLoader.setCachedData(cacheKey, data);
            
            console.log('翻译数据更新完成');
        } catch (error) {
            console.error('翻译数据更新失败:', error);
        }
    }
    
    /**
     * 设置配置选项
     * @param {Object} config 配置选项
     */
    setConfig(config) {
        // 更新配置
        this.config = { ...this.config, ...config };
        
        // 更新各模块的配置
        if (config.displayDuration !== undefined) {
            defaultConfig.displayDuration = config.displayDuration;
        }
        
        if (config.animationDuration !== undefined) {
            defaultConfig.animationDuration = config.animationDuration;
            this.popupManager.animationDuration = config.animationDuration;
        }
        
        if (config.enableSound !== undefined) {
            defaultConfig.enableSound = config.enableSound;
        }
        
        if (config.autoPronounce !== undefined) {
            defaultConfig.autoPronounce = config.autoPronounce;
        }
        
        if (config.fuzzyMatchThreshold !== undefined) {
            defaultConfig.fuzzyMatchThreshold = config.fuzzyMatchThreshold;
            this.textMatcher.fuzzyMatchThreshold = config.fuzzyMatchThreshold;
        }
        
        if (config.debugMode !== undefined) {
            defaultConfig.debugMode = config.debugMode;
        }
    }
}

// 创建全局翻译管理器实例 - 修复版本
const translationManager = new TranslationManager();

// 导出模块
window.TranslationManager = TranslationManager;
window.translationManager = translationManager;

// 与现有的common.js兼容 - 修复版本
if (window.EnglishLearningCommon) {
    // 保留原有的单词翻译功能
    // 新的翻译功能将作为增强功能存在
    
    // 修复：禁用common.js中的单词点击事件，避免冲突
    const originalToggleTranslation = window.EnglishLearningCommon.toggleTranslation;
    if (originalToggleTranslation) {
        window.EnglishLearningCommon.toggleTranslation = function(element) {
            // 如果翻译系统已初始化，使用新的翻译系统
            if (window.translationManager && window.translationManager.isInitialized) {
                // 不执行原有的toggleTranslation，避免冲突
                return;
            }
            
            // 否则使用原有的翻译功能
            return originalToggleTranslation.call(this, element);
        };
    }
}

// 页面加载完成后确保翻译系统已初始化 - 修复版本
document.addEventListener('DOMContentLoaded', function() {
    // 等待common.js初始化完成
    setTimeout(() => {
        if (window.EnglishLearningCommon) {
            // 翻译系统已经在构造函数中初始化
            // 翻译系统与common.js集成完成
            
            // 重新初始化单词点击事件，确保新系统生效
            const words = document.querySelectorAll('.word');
            words.forEach(word => {
                // 移除原有的事件监听器（如果存在）
                word.removeEventListener('click', window.EnglishLearningCommon.toggleTranslation);
            });
        }
    }, 500);
});