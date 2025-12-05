/**
 * 核心逻辑系统 - 从后端API加载数据
 */
// 在文件开头添加
const SAFETY_TIMEOUT = 5000; // 5秒超时

// 修改 loadDataFromBackend 函数
async function loadDataFromBackend() {
    try {
        console.log('📥 开始加载数据...');
        
        // 使用Promise.race添加超时控制
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('API请求超时')), SAFETY_TIMEOUT);
        });
        
        const fetchPromise = fetch('/api/data');
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response.ok) {
            console.warn(`API响应状态: ${response.status}`);
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 检查是否有数据
        if (!data || typeof data !== 'object') {
            throw new Error('API返回无效数据');
        }
        
        // 合并数据，确保每个分类都有数组
        ['movies', 'anime', 'games', 'study', 'shortDrama', 'other'].forEach(category => {
            database[category] = Array.isArray(data[category]) ? data[category] : [];
        });
        
        console.log('✅ 数据加载成功！');
        
        // 显示统计数据
        const total = Object.values(database).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`📊 总计: ${total} 个项目`);
        
        return true;
        
    } catch (error) {
        console.error('❌ 加载数据失败:', error.message);
        console.log('🔄 使用安全模式...');
        
        // 使用最小的回退数据
        useFallbackData();
        return false;
    }
}

// 安全回退数据
function useFallbackData() {
    const fallbackData = {
        movies: [{ title: "示例资源", url: "#", image: "", tags: ["示例"] }],
        anime: [],
        games: [],
        study: [],
        shortDrama: [],
        other: []
    };
    
    Object.assign(database, fallbackData);
    
    // 显示提示信息
    const message = document.createElement('div');
    message.style.cssText = `
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 4px;
        padding: 10px;
        margin: 10px 0;
        color: #856404;
        font-size: 14px;
    `;
    message.innerHTML = '⚠️ 数据加载中，显示示例内容...';
    document.body.prepend(message);
    
    setTimeout(() => message.remove(), 5000);
}



// 修改DOMContentLoaded事件
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 开始初始化系统...');
    
    // 第1步：从后端加载数据
    await loadDataFromBackend();
    
    // 第2步：初始化各个系统
    initRouter();
    initGlobalSearch();
    initDanmakuSystem();
    initHotSearchBars();
    initializeTestData();
    
    console.log('✨ 系统初始化完成！');
});

// ============ 1. 视图路由系统 ============
const views = {
    home: document.getElementById('home-view'),
    list: document.getElementById('list-view')
};

const listViewElements = {
    header: document.getElementById('list-view-header'),
    title: document.getElementById('list-view-title'),
    grid: document.getElementById('content-grid-container'),
    localSearchArea: document.getElementById('local-search-area'),
    localSearchInput: document.getElementById('local-search-input')
};

let currentCategoryData = [];

function initRouter() {
    // 主页模块卡片点击
    document.querySelectorAll('.js-nav-card').forEach(card => {
        card.addEventListener('click', function() {
            const targetCategory = this.getAttribute('data-target');
            switchView('list', targetCategory);
        });
    });

    // 返回主页按钮点击
    document.getElementById('back-to-home-btn').addEventListener('click', function() {
        switchView('home');
    });

    // 局部搜索输入监听
    listViewElements.localSearchInput.addEventListener('input', (e) => {
        executeLocalSearch(e.target.value.trim());
    });
}

function switchView(viewName, categoryType = null, searchResults = null) {
    window.scrollTo(0, 0);
    // 切换容器显隐
    for (const key in views) {
        views[key].classList.toggle('hidden', key !== viewName);
    }

    if (viewName === 'home') {
        // 返回主页时刷新热搜栏
        initHotSearchBars();
        return;
    }

    // 配置列表页视图
    const config = uiConfig[categoryType];
    listViewElements.header.className = `page-header ${config.theme}`;
    listViewElements.title.textContent = config.title;
    listViewElements.localSearchInput.value = '';

    // 根据类型准备数据
    if (categoryType === 'search') {
        listViewElements.localSearchArea.classList.add('hidden');
        currentCategoryData = searchResults || [];
        // 搜索结果显示使用各自对应的主题
        renderSearchGrid(currentCategoryData);
    } else {
        listViewElements.localSearchArea.classList.remove('hidden');
        // 关键修改：固定搜索栏placeholder为"在本库内筛选"
        listViewElements.localSearchInput.placeholder = "在本库内筛选";
        currentCategoryData = database[categoryType];
        renderGrid(currentCategoryData, config.theme);
    }
}

// ============ 2. 数据渲染与交互 - 修复搜索结果颜色匹配 ============
function getItemCategory(item) {
    // 确定项目属于哪个类别
    for (const category in database) {
        if (database[category].some(dataItem => dataItem.title === item.title)) {
            return category;
        }
    }
    return 'other'; // 默认类别
}

function getItemTheme(item) {
    const category = getItemCategory(item);
    return uiConfig[category] ? uiConfig[category].theme : 'other-theme';
}

function renderGrid(dataArray, themeClass) {
    const container = listViewElements.grid;
    container.innerHTML = '';

    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999; padding: 50px 0;">暂无相关内容。</p>';
        return;
    }

    let htmlStr = '';
    dataArray.forEach(item => {
        const tagsHtml = item.tags.map(tagObj => {
            const text = typeof tagObj === 'string' ? tagObj : tagObj.text;
            const highlightClass = (typeof tagObj === 'object' && tagObj.highlight) ? 'highlight' : '';
            return `<span class="tag ${highlightClass}">${text}</span>`;
        }).join('');

        // 生成主题相关的背景色
        const themeColors = {
            'movie-theme': 'linear-gradient(135deg, #1E90FF, #87CEFA)',
            'anime-theme': 'linear-gradient(135deg, #FF69B4, #FFB6C1)',
            'game-theme': 'linear-gradient(135deg, #2E8B57, #3CB371)',
            'study-theme': 'linear-gradient(135deg, #9C27B0, #BA68C8)',
            'short-drama-theme': 'linear-gradient(135deg, #FF9800, #FFB74D)',
            'other-theme': 'linear-gradient(135deg, #607D8B, #90A4AE)',
            'search-theme': 'linear-gradient(135deg, #666666, #888888)'
        };
        
        const backgroundStyle = themeColors[themeClass] || 'linear-gradient(135deg, #667eea, #764ba2)';

        // 关键修改：智能判断是否显示图片
        // 如果item.image存在且不是空字符串，则显示图片，否则显示大号文字
        const hasImage = item.image && item.image.trim() !== '';
        
        htmlStr += `
            <a href="${item.url}" target="_blank" class="data-card-link" onclick="recordInteraction('${item.title.replace(/'/g, "\\'")}')">
                <div class="data-item-card ${themeClass}">
                    <div class="card-img-wrapper" style="background: ${backgroundStyle}">
                        <!-- 根据是否有图片来决定显示内容 -->
                        ${hasImage ? 
                            `<img src="${item.image}" alt="${item.title}" class="data-item-image" style="display: block;">
                             <div class="image-title-display" style="display: none;">${item.title}</div>` :
                            `<img src="${item.image}" alt="${item.title}" class="data-item-image" style="display: none;">
                             <div class="image-title-display">${item.title}</div>`
                        }
                    </div>
                    <div class="data-item-info">
                        <h3 class="data-item-title">${item.title}</h3>
                        <div class="tags-container">
                            ${tagsHtml}
                        </div>
                    </div>
                </div>
            </a>
        `;
    });
    container.innerHTML = htmlStr;
}

function renderSearchGrid(dataArray) {
    const container = listViewElements.grid;
    container.innerHTML = '';

    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999; padding: 50px 0;">暂无相关内容。</p>';
        return;
    }

    let htmlStr = '';
    dataArray.forEach(item => {
        const tagsHtml = item.tags.map(tagObj => {
            const text = typeof tagObj === 'string' ? tagObj : tagObj.text;
            const highlightClass = (typeof tagObj === 'object' && tagObj.highlight) ? 'highlight' : '';
            return `<span class="tag ${highlightClass}">${text}</span>`;
        }).join('');

        // 为每个搜索结果项目确定其主题
        const itemTheme = getItemTheme(item);
        
        // 生成主题相关的背景色
        const themeColors = {
            'movie-theme': 'linear-gradient(135deg, #1E90FF, #87CEFA)',
            'anime-theme': 'linear-gradient(135deg, #FF69B4, #FFB6C1)',
            'game-theme': 'linear-gradient(135deg, #2E8B57, #3CB371)',
            'study-theme': 'linear-gradient(135deg, #9C27B0, #BA68C8)',
            'short-drama-theme': 'linear-gradient(135deg, #FF9800, #FFB74D)',
            'other-theme': 'linear-gradient(135deg, #607D8B, #90A4AE)',
            'search-theme': 'linear-gradient(135deg, #666666, #888888)'
        };
        
        const backgroundStyle = themeColors[itemTheme] || 'linear-gradient(135deg, #667eea, #764ba2)';

        // 关键修改：智能判断是否显示图片
        // 如果item.image存在且不是空字符串，则显示图片，否则显示大号文字
        const hasImage = item.image && item.image.trim() !== '';
        
        htmlStr += `
            <a href="${item.url}" target="_blank" class="data-card-link" onclick="recordInteraction('${item.title.replace(/'/g, "\\'")}')">
                <div class="data-item-card ${itemTheme}">
                    <div class="card-img-wrapper" style="background: ${backgroundStyle}">
                        <!-- 根据是否有图片来决定显示内容 -->
                        ${hasImage ? 
                            `<img src="${item.image}" alt="${item.title}" class="data-item-image" style="display: block;">
                             <div class="image-title-display" style="display: none;">${item.title}</div>` :
                            `<img src="${item.image}" alt="${item.title}" class="data-item-image" style="display: none;">
                             <div class="image-title-display">${item.title}</div>`
                        }
                    </div>
                    <div class="data-item-info">
                        <h3 class="data-item-title">${item.title}</h3>
                        <div class="tags-container">
                            ${tagsHtml}
                        </div>
                    </div>
                </div>
            </a>
        `;
    });
    container.innerHTML = htmlStr;
}

function executeLocalSearch(query) {
    if (!query) {
        const currentTheme = listViewElements.header.className.split(' ').pop();
        renderGrid(currentCategoryData, currentTheme);
        return;
    }
    const lowerQuery = query.toLowerCase();
    const filtered = currentCategoryData.filter(item => {
        if (item.title.toLowerCase().includes(lowerQuery)) return true;
        return item.tags.some(tag => (typeof tag === 'string' ? tag : tag.text).toLowerCase().includes(lowerQuery));
    });
    const currentTheme = listViewElements.header.className.split(' ').pop();
    renderGrid(filtered, currentTheme);
}

// ============ 3. 全局搜索系统 ============
function initGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const btn = document.getElementById('global-search-btn');

    const performGlobalSearch = () => {
        const query = input.value.trim();
        if (!query) return;

        const allData = [...database.movies, ...database.anime, ...database.games, ...database.study, ...database.shortDrama, ...database.other];
        const lowerQuery = query.toLowerCase();

        const results = allData.filter(item => {
             if (item.title.toLowerCase().includes(lowerQuery)) return true;
             return item.tags.some(tag => (typeof tag === 'string' ? tag : tag.text).toLowerCase().includes(lowerQuery));
        });

        uiConfig.search.title = `🔍 "${query}" 的搜索结果 (${results.length})`;
        switchView('list', 'search', results);
    };

    btn.addEventListener('click', performGlobalSearch);
    input.addEventListener('keypress', (e) => { if(e.key === 'Enter') performGlobalSearch(); });
}

// ============ 4. 弹幕与热搜系统 ============
function recordInteraction(word, type = 'click') {
    let history = JSON.parse(localStorage.getItem(hotWordConfig.storageKey)) || {
        lastUpdate: new Date().toDateString(),
        search: {},
        click: {}
    };

    // 检查是否需要每日重置
    const today = new Date().toDateString();
    if (history.lastUpdate !== today) {
        history = {
            lastUpdate: today,
            search: {},
            click: {}
        };
    }

    // 只记录点击事件
    if (type === 'click') {
        if (!history.click[word]) {
            history.click[word] = 0;
        }
        history.click[word] += 1;
    }

    localStorage.setItem(hotWordConfig.storageKey, JSON.stringify(history));
}

function getHotWordsByCategory(category) {
    const history = JSON.parse(localStorage.getItem(hotWordConfig.storageKey)) || {
        lastUpdate: new Date().toDateString(),
        search: {},
        click: {}
    };

    // 只使用点击数据
    const clickWords = history.click || {};
    
    // 获取对应分类的真实数据标题作为热搜候选
    const categoryTitles = database[category] ? database[category].map(item => item.title) : [];
    
    // 只考虑点击数据，并且只考虑对应分类的数据
    const allWords = new Set([
        ...Object.keys(clickWords).filter(word => 
            categoryTitles.some(title => title.includes(word)) || 
            (hotWordConfig.dailyHotWords[category] && hotWordConfig.dailyHotWords[category].includes(word))
        ),
        ...(hotWordConfig.dailyHotWords[category] || [])
    ]);

    const wordScores = [];
    allWords.forEach(word => {
        const clickCount = clickWords[word] || 0;
        const score = clickCount; // 只使用点击计数
        
        // 额外加分：如果单词出现在对应分类的数据标题中
        const titleMatchBonus = categoryTitles.some(title => title.includes(word)) ? 5 : 0;
        
        wordScores.push({ word, score: score + titleMatchBonus });
    });

    // 按分数排序，取前5个
    return wordScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.word);
}

function initHotSearchBars() {
    ['movies', 'anime', 'games', 'study', 'shortDrama', 'other'].forEach(category => {
        const container = document.getElementById(`${category}-hot-search`);
        if (!container) return;

        const hotWords = getHotWordsByCategory(category);
        container.innerHTML = '';

        hotWords.forEach((word, index) => {
            const rank = index + 1;
            const rankClass = rank <= 3 ? 'top3' : 'top4-10';
            
            const item = document.createElement('div');
            item.className = 'hot-search-item';
            item.innerHTML = `
                <div class="hot-search-rank ${rankClass}">${rank}</div>
                <div class="hot-search-text">${word}</div>
                <div class="hot-search-tag">热</div>
            `;
            
            item.onclick = (e) => {
                e.stopPropagation();
                document.getElementById('global-search-input').value = word;
                document.getElementById('global-search-btn').click();
            };
            container.appendChild(item);
        });
    });
}

function initDanmakuSystem() {
    const tracks = [
        document.getElementById('danmaku-track-1'),
        document.getElementById('danmaku-track-2')
    ];

    // 清空现有弹幕
    tracks.forEach(track => track.innerHTML = '');

    // 获取所有分类的热词并合并
    const allHotWords = [];
    ['movies', 'anime', 'games', 'study', 'shortDrama', 'other'].forEach(category => {
        const categoryWords = getHotWordsByCategory(category);
        allHotWords.push(...categoryWords.map(word => ({ word, category })));
    });

    // 去重并随机打乱
    const uniqueWords = [];
    const seenWords = new Set();
    
    allHotWords.forEach(({ word, category }) => {
        if (!seenWords.has(word)) {
            seenWords.add(word);
            uniqueWords.push({ word, category });
        }
    });

    // 随机打乱
    uniqueWords.sort(() => Math.random() - 0.5);

    // 确保每个轨道都有足够的弹幕
    const wordsPerTrack = Math.max(8, Math.ceil(uniqueWords.length / 2));
    
    // 分发到轨道，确保每个轨道都有内容
    for (let i = 0; i < wordsPerTrack * 2; i++) {
        const wordData = uniqueWords[i % uniqueWords.length];
        const trackIndex = i % 2;
        
        const item = document.createElement('span');
        item.className = 'danmaku-item';
        item.textContent = wordData.word;
        item.onclick = () => {
            document.getElementById('global-search-input').value = wordData.word;
            document.getElementById('global-search-btn').click();
        };
        
        // 只添加一次，不克隆
        tracks[trackIndex].appendChild(item);
        
        // 如果需要连续效果，添加不同的内容而不是克隆
        if (i < uniqueWords.length) {
            const nextWordData = uniqueWords[(i + 1) % uniqueWords.length];
            const nextItem = document.createElement('span');
            nextItem.className = 'danmaku-item';
            nextItem.textContent = nextWordData.word;
            nextItem.onclick = () => {
                document.getElementById('global-search-input').value = nextWordData.word;
                document.getElementById('global-search-btn').click();
            };
            tracks[trackIndex].appendChild(nextItem);
        }
    }

    // 设置随机动画延迟和持续时间
    tracks.forEach((track, index) => {
        const delays = ['0s', '-5s'];
        const durations = ['35s', '28s'];
        
        track.style.animationDelay = delays[index];
        track.style.animationDuration = durations[index];
    });

    // 修复移动端显示问题
    setTimeout(() => {
        tracks.forEach(track => {
            const items = track.querySelectorAll('.danmaku-item');
            items.forEach(item => {
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            });
        });
    }, 100);
}

// ============ 5. 测试数据初始化 ============
function initializeTestData() {
    // 从真实数据中随机选取名称作为初始测试数据
    const getAllTitles = () => {
        const allTitles = [];
        Object.values(database).forEach(categoryData => {
            categoryData.forEach(item => {
                allTitles.push(item.title);
            });
        });
        return allTitles;
    };

    const allTitles = getAllTitles();
    
    // 随机选取一些标题作为测试数据
    const getRandomTitles = (count) => {
        const shuffled = [...allTitles].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    };

    const testInteractions = {
        lastUpdate: new Date().toDateString(),
        search: {},
        click: {}
    };

    // 为每个分类随机选取一些点击数据
    ['movies', 'anime', 'games', 'study', 'shortDrama', 'other'].forEach(category => {
        const categoryTitles = database[category] ? database[category].map(item => item.title) : [];
        const randomTitles = getRandomTitles(Math.min(5, categoryTitles.length));
        
        randomTitles.forEach(title => {
            testInteractions.click[title] = Math.floor(Math.random() * 10) + 5; // 5-15次点击
        });
    });

    // 只有当本地存储为空时才设置测试数据
    if (!localStorage.getItem(hotWordConfig.storageKey)) {
        localStorage.setItem(hotWordConfig.storageKey, JSON.stringify(testInteractions));
    }
}

// 窗口调整大小时重新初始化弹幕
window.addEventListener('resize', function() {
    setTimeout(initDanmakuSystem, 300);
});

// 界面配置
const uiConfig = {
    movies: { title: "🎬 影视大片库", theme: "movie-theme" },
    anime: { title: "📺 二次元动漫库", theme: "anime-theme" },
    games: { title: "🎮 热门游戏库", theme: "game-theme" },
    study: { title: "📚 学习资料库", theme: "study-theme" },
    shortDrama: { title: "🎭 精品短剧库", theme: "short-drama-theme" },
    other: { title: "🔮 其他资源库", theme: "other-theme" },
    search: { title: "🔍 全局搜索结果", theme: "search-theme" }
};

// 弹幕和热搜系统配置 - 优化为只使用点击数据
const hotWordConfig = {
    storageKey: 'userInteractionHistory_v3',
    maxPoolSize: 100,
    // 每日热词（会与用户点击数据混合）
    dailyHotWords: {
        movies: ["啥也没有","阿巴阿巴","再等等","马上更新","嗯嗯嗯"],
        anime: ["克金玩家","紫川","师兄啊师兄","灵笼","云深不知梦","神国之上","斗罗大陆","完美世界","沧元图","斗罗大陆4终极斗罗 动态动漫","仙逆","遮天",
            "诡秘之主","凡人修仙传","斗破苍穹","画江湖之不良人","君有云","练气十万年","龙蛇演绎","牧神记","神墓","神印王座","星辰变","仙武转","妖神记",
            "诛仙","吞噬星空"],
        games: ["植物大战僵尸全系列","遨游中国","饥荒","迷你世界","米塔手机版","侠盗猎车","小黄人快跑","异形：隔离","黑悟空神话像素版",
            "合战忍者村","石器大战","成长城堡","僵尸尖叫","登山赛车","要塞围城","饥荒","无尽之战","打工生活模拟器","奇幻射击","星露谷物语",
            "英雄大作战","荒野大镖客","生化危机","滑雪大冒险","极限摩托","小小梦魇","暴打老板","主驾驶","后室","愤怒的小鸟","水果忍者",
            "疯狂喷气机","僵尸榨汁机","老爸曾是小偷","亡灵杀手：夏侯惇满级","愤怒的火柴人","方舟生存","西游斗神","超音速飞行","模拟城市：我是市长",
            "激战王","REPO","空洞骑士","泰瑞利亚","猴子传奇","崩溃大陆","死亡之门","猛兽派对","死亡空间","死亡细胞","激流快艇","滑板少年",],
        study: ["啥也没有","阿巴阿巴","再等等","马上更新","嗯嗯嗯"],
        shortDrama: ["啥也没有","阿巴阿巴","再等等","马上更新","嗯嗯嗯"],
        other: ["啥也没有","阿巴阿巴","再等等","马上更新","嗯嗯嗯"]
    }
};
