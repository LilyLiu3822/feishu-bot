# 飞书产品机会分析机器人

这是一个基于DeepSeek AI的飞书群机器人，可以自动分析AI对话内容中的产品机会。

## 功能特点

- 🤖 智能分析AI对话内容
- 🎯 自动提取产品机会
- 📊 提供详细的市场分析
- 💰 成本极低（使用DeepSeek API）

## 使用方法

在飞书群中发送：
产品分析 [你与AI的对话内容]
机器人会自动分析并返回产品机会报告。

## 部署说明

1. 获取DeepSeek API密钥
2. 创建飞书群机器人获取Webhook地址
3. 在Vercel中设置环境变量
4. 一键部署

## 环境变量

- `DEEPSEEK_API_KEY`: DeepSeek AI的API密钥
- `FEISHU_WEBHOOK`: 飞书群机器人的Webhook地址
