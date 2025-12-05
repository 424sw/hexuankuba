const XLSX = require('xlsx');
const { createReadStream } = require('fs');

// 注意：Vercel环境中文件路径处理不同
module.exports = async (req, res) => {
  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  try {
    // 在Vercel中读取Excel文件
    const filePath = process.cwd() + '/data/library.xlsx';
    
    // 使用XLSX读取Excel
    const workbook = XLSX.readFile(filePath);
    const result = {};
    
    const categories = ['movies', 'anime', 'games', 'study', 'shortDrama', 'other'];
    
    categories.forEach(category => {
      if (workbook.Sheets[category]) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[category]);
        result[category] = rows.map(row => ({
          title: row['名称'] || row['标题'] || '未命名',
          url: row['链接'] || row['网址'] || '#',
          image: row['图片'] || '',
          tags: processTags(row['标签'] || '')
        }));
      } else {
        result[category] = [];
      }
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('API错误:', error);
    res.status(500).json({ 
      error: '读取数据失败',
      message: error.message 
    });
  }
};

function processTags(tagStr) {
  if (!tagStr) return [];
  
  const tags = tagStr.split(/[,，、]/).map(tag => tag.trim()).filter(tag => tag);
  
  return tags.map(tagText => {
    const highlightKeywords = ['推荐', '热门', '最新', '精选', '必看', '必备'];
    const shouldHighlight = highlightKeywords.some(keyword => tagText.includes(keyword));
    return shouldHighlight ? { text: tagText, highlight: true } : tagText;
  });
}