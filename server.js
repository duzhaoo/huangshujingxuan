const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

// 输出环境变量信息（不包含敏感信息）
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('PORT:', process.env.PORT);

const app = express();
const PORT = process.env.PORT || 5000;

// 设置视图引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 静态文件服务 - 在路由定义前设置
app.use(express.static(path.join(__dirname, 'public')));

// 飞书API相关配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const BASE_ID = process.env.BASE_ID;
const TABLE_ID = process.env.TABLE_ID;

// 获取飞书访问令牌
async function getAccessToken() {
    try {
        const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            app_id: FEISHU_APP_ID,
            app_secret: FEISHU_APP_SECRET
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 200) {
            return response.data.tenant_access_token;
        }
        return null;
    } catch (error) {
        console.error('获取访问令牌失败:', error.message);
        return null;
    }
}

// 获取表格数据
async function getTableRecords() {
    try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            return [];
        }
        
        const response = await axios.get(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${BASE_ID}/tables/${TABLE_ID}/records`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.status === 200) {
            return response.data.data.items || [];
        }
        return [];
    } catch (error) {
        console.error('获取表格数据失败:', error.message);
        return [];
    }
}

// 首页路由
app.get('/', async (req, res) => {
    try {
        console.log('访问首页路由');
        console.log('环境变量检查:', {
            FEISHU_APP_ID_EXISTS: !!process.env.FEISHU_APP_ID,
            FEISHU_APP_SECRET_EXISTS: !!process.env.FEISHU_APP_SECRET,
            BASE_ID_EXISTS: !!process.env.BASE_ID,
            TABLE_ID_EXISTS: !!process.env.TABLE_ID
        });
        
        // 如果缺少必要的环境变量，显示错误信息
        if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !BASE_ID || !TABLE_ID) {
            return res.render('index', { 
                articles: [], 
                error: '缺少必要的环境变量配置，请在Vercel中设置飞书API相关的环境变量' 
            });
        }
        
        const records = await getTableRecords();
        console.log('获取到的记录数量:', records ? records.length : 0);
        
        // 如果没有记录，显示空列表
        if (!records || records.length === 0) {
            return res.render('index', { 
                articles: [], 
                error: '未能获取到飞书多维表格数据，请检查环境变量配置和飞书API权限' 
            });
        }
        
        const articles = records.map(record => {
            const fields = record.fields || {};
            
            // 提取字段值，处理可能的复杂对象
            const extractFieldValue = (field) => {
                if (!field) return '';
                
                // 如果是字符串，直接返回
                if (typeof field === 'string') return field;
                
                // 如果是对象且有text属性
                if (typeof field === 'object') {
                    // 处理数组情况
                    if (Array.isArray(field)) {
                        return field.map(item => {
                            if (typeof item === 'string') return item;
                            return item.text || item.content || JSON.stringify(item);
                        }).join(', ');
                    }
                    
                    // 处理单个对象情况
                    return field.text || field.content || field.value || JSON.stringify(field);
                }
                
                // 其他情况转为字符串
                return String(field);
            };
            
            // 提取各字段的值
            const title = extractFieldValue(fields['标题']);
            const quote = extractFieldValue(fields['金句输出']);
            const comment = extractFieldValue(fields['黄叔点评']);
            const fullContent = extractFieldValue(fields['概要内容输出']);
            const content = fullContent ? `${fullContent.substring(0, 100)}...` : '';
            
            // 提取原链接，如果没有则使用空字符串
            const originalUrl = extractFieldValue(fields['原链接']) || 
                               extractFieldValue(fields['原文链接']) || 
                               extractFieldValue(fields['链接']) || 
                               '';
            
            return { title, quote, comment, content, originalUrl };
        });
        
        res.render('index', { articles, error: null });
    } catch (error) {
        console.error('渲染首页失败:', error.message, error.stack);
        res.render('index', { 
            articles: [], 
            error: `服务器错误: ${error.message}` 
        });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err.message, err.stack);
    res.status(500).render('index', { 
        articles: [], 
        error: `服务器错误: ${err.message}` 
    });
});

// 健康检查路由，对Vercel部署有用
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// 404错误处理
app.use((req, res) => {
    console.log('404 Not Found:', req.originalUrl);
    res.status(404).render('index', { 
        articles: [], 
        error: `页面不存在: ${req.originalUrl}` 
    });
});

// 如果不是Vercel环境，启动本地服务器
// 注意: Vercel使用serverless函数，不需要显式启动服务器
if (process.env.VERCEL_ENV === undefined) {
    app.listen(PORT, () => {
        console.log(`本地服务器运行在 http://localhost:${PORT}`);
    });
}

// 为Vercel导出应用
module.exports = app;
