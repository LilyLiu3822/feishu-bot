// api/webhook.js - Vercel无服务器函数
export default async function handler(req, res) {
  // 设置CORS头，允许飞书访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('收到请求:', JSON.stringify(req.body, null, 2));
    
    // 处理飞书的验证请求
    if (req.body.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }

    // 处理消息事件
    if (req.body.type === 'event_callback') {
      const event = req.body.event;
      
      if (event.type === 'message.receive_v1') {
        const message = event.message;
        const content = JSON.parse(message.content || '{}');
        const text = content.text || '';
        
        console.log('收到消息:', text);
        
        // 检查是否包含分析关键词
        if (text.includes('产品分析') || text.includes('分析产品')) {
          // 提取要分析的内容
          let analyzeText = text
            .replace(/产品分析|分析产品/g, '')
            .trim();
          
          if (analyzeText.length > 10) {
            // 异步处理，避免超时
            processAnalysis(analyzeText);
            
            // 立即返回响应
            return res.json({ status: 'processing' });
          } else {
            await sendToFeishu('📝 请在"产品分析"后面提供具体的对话内容\n\n示例：产品分析 [粘贴你与AI的对话内容]');
          }
        }
        
        // 帮助指令
        if (text.includes('帮助') || text === 'help') {
          await sendToFeishu('🤖 产品分析机器人使用说明：\n\n1. 发送：产品分析 [AI对话内容]\n2. 我会自动提取产品机会\n3. 分析结果会直接发送到群里\n\n示例：\n产品分析 今天和ChatGPT讨论了智能水杯的市场机会...');
        }
      }
    }
    
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('处理请求错误:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// 异步处理分析任务
async function processAnalysis(text) {
  try {
    // 发送正在分析的提示
    await sendToFeishu('🤖 正在AI分析中，请稍等片刻...');
    
    // 进行AI分析
    const analysis = await analyzeProductOpportunities(text);
    
    // 发送分析结果
    await sendToFeishu(analysis);
  } catch (error) {
    console.error('分析处理错误:', error);
    await sendToFeishu('❌ 分析过程中出现错误，请检查对话内容或稍后再试');
  }
}

// AI分析函数
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

// 发送消息到飞书群
async function sendToFeishu(message) {
  try {
    const response = await fetch(process.env.FEISHU_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        msg_type: 'text',
        content: {
          text: message
        }
      })
    });

    if (!response.ok) {
      console.error('飞书消息发送失败:', response.status);
    }
  } catch (error) {
    console.error('发送到飞书失败:', error);
  }
}
