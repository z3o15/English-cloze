# 英语作文学习系统

这是一个英语作文学习系统，提供书信作文和图表作文的学习内容，包括单词翻译、语音朗读等功能。

## 项目结构

```
english-learning/
├── index.html              # 首页/导航页
├── letter/                 # 书信作文页面
│   └── index.html
├── chart/                  # 图表作文页面
│   └── index.html
├── assets/                 # 共享资源
│   ├── css/
│   │   └── common.css      # 公共样式
│   └── js/
│       └── common.js       # 公共JavaScript功能
├── edgeone-config.json      # EdgeOne部署配置
└── README.md              # 项目说明文档
```

## 功能特点

### 通用功能
- **响应式设计**：适配不同设备屏幕
- **单词翻译**：点击单词显示中文翻译
- **难度分级**：单词按难度分为基础、中级、高级
- **语音朗读**：支持单词、句子和段落朗读
- **导航系统**：方便在不同模块间切换

### 书信作文模块
- 书信格式介绍（齐头式、三段式）
- 各类书信句型（感谢信、建议信、投诉信等）
- 动词词组库
- 书信模板和案例
- 完整的书信示例

### 图表作文模块
- 常见图表类型介绍（柱状图、线形图、饼图、表格）
- 图表描述常用表达
- 数据分析句型
- 图表作文结构模板
- 图表作文案例

## EdgeOne部署指南

### 1. 准备工作
- 注册腾讯云账号
- 开通EdgeOne服务
- 准备域名（可选）

### 2. 部署步骤

#### 方法一：通过EdgeOne控制台部署
1. 登录腾讯云控制台
2. 进入EdgeOne产品页面
3. 创建静态网站托管空间
4. 上传项目文件
5. 配置域名和SSL证书

#### 方法二：使用CLI工具部署
```bash
# 安装EdgeOne CLI（如果尚未安装）
npm install -g @tencent-cloud/edgeone-cli

# 配置认证信息
edgeone login

# 部署项目
edgeone deploy --config edgeone-config.json
```

### 3. 配置说明

`edgeone-config.json`文件包含以下主要配置：
- **静态网站设置**：首页文件、错误页面
- **缓存策略**：HTML文件不缓存，资源文件长期缓存
- **性能优化**：压缩、缩小文件
- **安全设置**：HTTPS、安全头
- **CDN配置**：全球加速、压缩算法

### 4. 域名配置
1. 在EdgeOne控制台添加域名
2. 配置DNS解析记录
3. 启用SSL证书
4. 设置HTTP到HTTPS重定向

## 本地开发

### 1. 环境要求
- 现代浏览器（支持ES6）
- 本地Web服务器（推荐）

### 2. 启动本地服务器
```bash
# 使用Python启动简单HTTP服务器
python -m http.server 8000

# 或使用Node.js的http-server
npx http-server

# 或使用Live Server扩展（VS Code）
```

### 3. 访问应用
- 打开浏览器访问：`http://localhost:8000`
- 或直接在VS Code中使用Live Server

## 自定义和扩展

### 1. 添加新的书信类型
在`letter/index.html`中的"开头段"部分添加新的书信类型：

```html
<div class="letter-type">新类型：<button class="read-section-btn" onclick="readSectionText(this)" title="朗读">▶</button></div>
<div class="sentence-pattern">
    <font color="#2A8ED3">表达方式</font> <font color="#FF0000">关键词</font> 具体内容
    <br>中文翻译
</div>
```

### 2. 添加新的图表类型
在`chart/index.html`中的"常见图表类型"部分添加新的图表类型：

```html
<div class="chart-type-card">
    <div class="chart-icon">📊</div>
    <div class="chart-name">新图表类型</div>
    <div class="chart-desc">图表描述</div>
</div>
```

### 3. 扩展单词翻译
在相应页面的JavaScript部分添加新的单词翻译：

```javascript
EnglishLearningCommon.wordTranslations = {
    // 现有翻译...
    "newWord": {"translation": "新词翻译", "level": 2}
};
```

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 性能优化建议

1. **图片优化**：使用WebP格式，适当压缩
2. **资源压缩**：启用Gzip/Brotli压缩
3. **CDN加速**：利用EdgeOne全球节点
4. **缓存策略**：合理设置缓存时间
5. **代码分割**：按需加载JavaScript

## 故障排除

### 常见问题

1. **语音朗读不工作**
   - 检查浏览器是否支持Web Speech API
   - 确保HTTPS环境（部分浏览器要求）

2. **单词翻译不显示**
   - 检查单词是否在翻译字典中
   - 确认CSS样式正确加载

3. **页面样式异常**
   - 检查common.css文件路径
   - 确认浏览器兼容性

4. **部署后404错误**
   - 检查EdgeOne配置中的indexDocument设置
   - 确认文件上传路径正确

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过以下方式联系：
- 邮箱：your-email@example.com
- GitHub Issues：[项目地址]

---

**注意**：图表作文页面已预留框架，您可以根据需要添加更多具体内容和案例。