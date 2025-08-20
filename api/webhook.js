// api/webhook.js - 支持飞书应用机器人
import crypto from 'crypto';

export default async function handler(req, res) {
  // 优先处理飞书验证请求，确保快速响应
  if (req.body && req.body.type === 'url_verification') {
    console.log('处理验证请求:', req.body.challenge);
    return res.status(200).json({ challenge: req.body.challenge });
  }

  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Lark-Signature');

  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 处理GET请求（用于状态检查）
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'running', 
      timestamp: new Date().toISOString(),
      message: 'Feishu bot webhook is active' 
    });
  }

  // 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('收到请求:', JSON.stringify(req.body, null, 2));

    // 处理消息事件
    if (req.body.type === 'event_callback') {
      const event = req.body.event;
      
      if (event.type === 'im.message.receive_v1') {
        const message = event.message;
        const content = JSON.parse(message.content || '{}');
        const text = content.text || '';
        const chatId = message.chat_id;
        
        console.log('收到消息:', text);
        console.log('Chat ID:', chatId);
        
        // 避免回复自己的消息
        if (message.message_type === 'reply') {
          return res.json({ status: 'ignored_reply' });
        }
        
        // 检查是否包含分析关键词
        if (text.includes('产品分析') || text.includes('分析产品')) {
          // 提取要分析的内容
          let analyzeText = text
            .replace(/产品分析|分析产品/g, '')
            .replace(/@[^\s]+/g, '') // 移除@提及
            .trim();
          
          if (analyzeText.length > 10) {
            // 异步处理，避免超时
            processAnalysis(analyzeText, chatId);
            
            // 立即返回响应
            return res.json({ status: 'processing' });
          } else {
            await sendMessage(chatId, '📝 请在"产品分析"后面提供具体的对话内容\n\n示例：产品分析 [粘贴你与AI的对话内容]');
          }
        }
        
        // 帮助指令
        if (text.includes('帮助') || text === 'help' || text.includes('@产品分析助手')) {
          await sendMessage(chatId, '🤖 产品分析机器人使用说明：\n\n1. 发送：产品分析 [AI对话内容]\n2. 我会自动提取产品机会\n3. 分析结果会直接发送到群里\n\n示例：\n产品分析 今天和ChatGPT讨论了智能水杯的市场机会...');
        }
      }
    }
    
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('处理请求错误:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// 获取访问令牌
async function getTenantAccessToken() {
  try {
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: process.env.FEISHU_APP_ID,
        app_secret: process.env.FEISHU_APP_SECRET
      })
    });
    
    const data = await response.json();
    return data.tenant_access_token;
  } catch (error) {
    console.error('获取访问令牌失败:', error);
    return null;
  }
}

// 发送消息到飞书
async function sendMessage(chatId, message) {
  try {
    const accessToken = await getTenantAccessToken();
    if (!accessToken) {
      console.error('无法获取访问令牌');
      return;
    }

    const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text: message })
      })
    });

    if (!response.ok) {
      console.error('飞书消息发送失败:', response.status);
    }
  } catch (error) {
    console.error('发送消息失败:', error);
  }
}

// 异步处理分析任务
async function processAnalysis(text, chatId) {
  try {
    // 发送正在分析的提示
    await sendMessage(chatId, '🤖 正在AI分析中，请稍等片刻...');
    
    // 进行AI分析
    const analysis = await analyzeProductOpportunities(text);
    
    // 发送分析结果
    await sendMessage(chatId, analysis);
  } catch (error) {
    console.error('分析处理错误:', error);
    await sendMessage(chatId, '❌ 分析过程中出现错误，请检查对话内容或稍后再试');
  }
}

// AI分析函数（保持不变）
async function analyzeProductOpportunities(text) {
  const prompt = `你是专业的亚马逊产品选品专家。请仔细分析以下AI对话内容，识别所有具有商业潜力的产品机会。

对话内容：
${text}

请按照以下格式输出分析结果：

🎯 **产品机会分析报告**

**发现的产品机会：**

1. **【产品名称】** - 产品类别
   • 市场机会：具体描述市场需求和机会点
   • 需求等级：⭐⭐⭐⭐⭐ (1-5星)
   • 竞争程度：高/中/低
   • 预估利润：高/中/低
   • 选品建议：具体的采购、定价、推广建议

2. **【产品名称】** - 产品类别  
   • 市场机会：...
   
**总结建议：**
- 最值得关注的前3个产品
- 需要进一步调研的方向
- 风险提示

如果没有发现明确的产品机会，请回复：
❌ 在此对话中未识别到明确的产品商机，建议：
1. 提供更具体的产品讨论内容
2. 包含市场需求、竞争情况等信息
3. 重新整理对话内容后再次分析`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('AI分析错误:', error);
    return '❌ AI分析服务暂时不可用，可能的原因：\n• API密钥无效\n• 网络连接问题\n• 服务暂时不可用\n\n请稍后再试或检查配置。';
  }
}
