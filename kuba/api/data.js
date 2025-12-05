const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

module.exports = async (req, res) => {
    // 设置CORS和响应头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    
    try {
        console.log('📡 API请求开始处理...');
        
        // 1. 检查Excel文件是否存在
        const excelPath = path.join(process.cwd(), 'data', 'library.xlsx');
        console.log('📍 Excel路径:', excelPath);
        
        if (!fs.existsSync(excelPath)) {
            console.warn('⚠️ Excel文件不存在，返回空数据');
            return res.json(createEmptyResponse());
        }
        
        // 2. 安全地读取Excel文件
        let workbook;
        try {
            workbook = XLSX.readFile(excelPath);
            console.log('✅ Excel文件读取成功');
        } catch (readError) {
            console.error('❌ 读取Excel文件失败:', readError.message);
            return res.json(createEmptyResponse());
        }
        
        // 3. 处理所有工作表
        const result = processWorkbook(workbook);
        
        console.log('🎉 API处理完成，返回数据');
        return res.json(result);
        
    } catch (error) {
        console.error('💥 未预期的API错误:', error);
        return res.json(createEmptyResponse());
    }
};

// 创建空的响应数据
function createEmptyResponse() {
    return {
        movies: [],
        anime: [],
        games: [],
        study: [],
        shortDrama: [],
        other: [],
        _metadata: {
            generatedAt: new Date().toISOString(),
            status: 'empty_fallback',
            message: '使用空数据回退'
        }
    };
}

// 处理工作簿的主要逻辑
function processWorkbook(workbook) {
    const categories = ['movies', 'anime', 'games', 'study', 'shortDrama', 'other'];
    const result = {};
    
    categories.forEach(category => {
        console.log(`📋 处理分类: ${category}`);
        
        if (workbook.Sheets[category]) {
            try {
                // 读取工作表数据
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[category], {
                    defval: '', // 为空单元格提供默认值
                    blankrows: false // 跳过空行
                });
                
                // 处理每一行数据（安全地）
                result[category] = rows
                    .map((row, index) => processRowData(row, index, category))
                    .filter(item => item !== null); // 过滤掉处理失败的行
                
                console.log(`  找到 ${result[category].length} 个有效项目`);
                
            } catch (sheetError) {
                console.error(`  处理工作表 ${category} 失败:`, sheetError.message);
                result[category] = [];
            }
        } else {
            console.log(`  ⚠️ 工作表 ${category} 不存在`);
            result[category] = [];
        }
    });
    
    // 添加元数据
    result._metadata = {
        generatedAt: new Date().toISOString(),
        status: 'success',
        totalItems: Object.values(result).reduce((sum, arr) => sum + arr.length, 0)
    };
    
    return result;
}

// 安全地处理单行数据
function processRowData(row, index, category) {
    try {
        // 检查是否为空行
        if (isEmptyRow(row)) {
            console.log(`    跳过第 ${index + 1} 行（空行）`);
            return null;
        }
        
        // 提取标题（支持多种列名）
        const title = getSafeValue(row, ['名称', '标题', 'title', 'Title', '项目名'], `项目_${category}_${index + 1}`);
        
        // 如果标题是空或默认值，跳过
        if (!title || title === `项目_${category}_${index + 1}`) {
            return null;
        }
        
        // 提取链接
        const url = getSafeValue(row, ['链接', '网址', 'url', 'URL', 'address'], '#');
        
        // 处理标签
        const tags = processTags(row);
        
        // 尝试查找图片
        const image = getSafeValue(row, ['图片', 'image', 'Image'], '');
        
        return {
            title: title.trim(),
            url: url.trim(),
            image: image.trim(),
            tags: tags
        };
        
    } catch (rowError) {
        console.warn(`    处理第 ${index + 1} 行时出错:`, rowError.message);
        return null;
    }
}

// 检查是否为空行
function isEmptyRow(row) {
    if (!row || typeof row !== 'object') return true;
    
    const values = Object.values(row);
    return values.every(value => 
        value === undefined || 
        value === null || 
        value === '' || 
        (typeof value === 'string' && value.trim() === '')
    );
}

// 安全地获取值
function getSafeValue(row, possibleKeys, defaultValue = '') {
    for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
            const value = String(row[key]).trim();
            if (value) return value;
        }
    }
    return defaultValue;
}

// 处理标签
function processTags(row) {
    const tagStr = getSafeValue(row, ['标签', 'tags', 'Tags', '分类', 'categories']);
    
    if (!tagStr) return [];
    
    try {
        // 分割标签（支持多种分隔符）
        const tags = tagStr.split(/[,，、;；\s]+/)
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        
        // 格式化标签
        return tags.map(tagText => {
            const highlightKeywords = ['推荐', '热门', '最新', '精选', '必看', '必备', '精品', '重点'];
            const shouldHighlight = highlightKeywords.some(keyword => 
                tagText.toLowerCase().includes(keyword.toLowerCase())
            );
            return shouldHighlight ? { text: tagText, highlight: true } : tagText;
        });
        
    } catch (error) {
        console.warn('处理标签时出错:', error.message);
        return [];
    }
}