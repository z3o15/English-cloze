// 公共JavaScript功能文件

// 语音合成对象
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let isReading = false;

// 朗读队列和文本位置标记系统
let readingQueue = [];
let currentReadingIndex = 0;
let textSegments = [];
let isProcessingQueue = false;

// 朗读管理器 - 统一管理所有朗读相关操作
class ReadingManager {
    constructor() {
        this.isReading = false;
        this.isProcessingQueue = false;
        this.readingQueue = [];
        this.currentReadingIndex = 0;
        this.textSegments = [];
        this.currentUtterance = null;
        this.currentButton = null;
    }
    
    // 重置所有状态
    reset() {
        this.isReading = false;
        this.isProcessingQueue = false;
        this.readingQueue = [];
        this.currentReadingIndex = 0;
        this.textSegments = [];
        this.currentUtterance = null;
        this.currentButton = null;
        
        // 更新全局变量以保持兼容性
        isReading = false;
        isProcessingQueue = false;
        readingQueue = [];
        currentReadingIndex = 0;
        textSegments = [];
        currentUtterance = null;
        
        console.log('朗读管理器已重置');
    }
    
    // 文本分段和标识系统
    segmentTextWithIds(text) {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            console.warn('无效的文本输入:', text);
            return [];
        }
        
        // 首先清理文本
        const cleanText = cleanTextForSpeech(text);
        
        // 如果文本长度不超过300个字符，作为单个段落处理
        if (cleanText.length <= 300) {
            return [{
                id: 'short_segment_0',
                text: cleanText,
                index: 0
            }];
        }
        
        // 如果文本长度超过300个字符，按句子结束标点分段
        const sentences = cleanText.match(/[^.!?]*[.!?]+/g) || [cleanText];
        const segments = [];
        let currentSegment = '';
        let segmentIndex = 0;
        
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            
            // 如果当前段落加上新句子不超过300个字符，添加到当前段落
            if ((currentSegment + sentence).length <= 300) {
                currentSegment += sentence;
            } else {
                // 如果当前段落不为空，保存当前段落
                if (currentSegment.trim().length > 0) {
                    segments.push({
                        id: 'segment_' + segmentIndex++,
                        text: currentSegment.trim(),
                        index: segmentIndex - 1
                    });
                }
                // 开始新的段落
                currentSegment = sentence;
            }
        }
        
        // 保存最后一个段落
        if (currentSegment.trim().length > 0) {
            segments.push({
                id: 'segment_' + segmentIndex++,
                text: currentSegment.trim(),
                index: segmentIndex - 1
            });
        }
        
        console.log('文本分段完成，共', segments.length, '段');
        this.textSegments = segments;
        return segments;
    }
    
    // 朗读队列控制系统
    processReadingQueue(button) {
        // 检查是否已经在处理队列或队列为空
        if (this.isProcessingQueue || !this.readingQueue || this.readingQueue.length === 0) {
            console.log('队列正在处理或为空，跳过');
            return;
        }
        
        // 设置处理状态和索引
        this.isProcessingQueue = true;
        this.currentReadingIndex = 0;
        this.currentButton = button;
        
        // 更新读取状态
        this.isReading = true;
        
        // 更新按钮状态
        if (button && button.classList) {
            button.classList.add('reading');
        }
        
        // 更新全局变量以保持兼容性
        isReading = true;
        isProcessingQueue = true;
        
        console.log('开始处理朗读队列，共', this.readingQueue.length, '段');
        
        // 立即调用 speakNextSegment，移除不必要的延迟
        this.speakNextSegment();
    }
    
    // 基于API回调的朗读触发机制
    speakNextSegment() {
        try {
            // 检查队列状态和索引有效性
            if (!this.readingQueue || this.readingQueue.length === 0 || this.currentReadingIndex >= this.readingQueue.length) {
                // 所有段落朗读完毕
                this.completeReading();
                return;
            }
            
            const currentSegment = this.readingQueue[this.currentReadingIndex];
            
            // 检查当前段落是否存在
            if (!currentSegment || !currentSegment.text) {
                console.warn('段落数据无效，跳过:', currentSegment);
                this.currentReadingIndex++;
                setTimeout(() => this.speakNextSegment(), 50);
                return;
            }
            
            const cleanText = cleanTextForSpeech(currentSegment.text);
            
            // 只在第一次处理段落时输出日志，避免重复输出
            if (!currentSegment.logged) {
                // 输出正在朗读的句子内容和ID
                console.log('正在朗读句子 - ID:', currentSegment.id, '内容:', cleanText);
                // 标记已输出日志
                currentSegment.logged = true;
            }
            
            if (cleanText.length === 0) {
                console.log('跳过空段落:', currentSegment.id);
                this.currentReadingIndex++;
                setTimeout(() => this.speakNextSegment(), 50);
                return;
            }
            
            // 确保语音合成器就绪
            if (speechSynthesis.speaking) {
                // 添加检查，防止无限循环
                if (this.currentReadingIndex >= this.readingQueue.length) {
                    this.completeReading();
                    return;
                }
                setTimeout(() => this.speakNextSegment(), 100);
                return;
            }
            
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 1;
            
            // 添加错误处理
            utterance.onerror = (event) => {
                console.error('朗读段落时出错:', event.error, '段落ID:', currentSegment?.id || 'unknown');
                // 检查索引是否已经超出队列长度，防止重复调用
                if (this.currentReadingIndex < this.readingQueue.length) {
                    this.currentReadingIndex++;
                    setTimeout(() => this.speakNextSegment(), 200);
                }
            };
            
            // 核心解决思路：通过API回调（onend事件）触发下一段
            utterance.onend = () => {
                // 检查索引是否已经超出队列长度，防止重复调用
                if (this.currentReadingIndex < this.readingQueue.length) {
                    this.currentReadingIndex++;
                    // 使用短暂延迟确保浏览器状态更新
                    setTimeout(() => this.speakNextSegment(), 100);
                }
            };
            
            // 记录当前要读的标识
            this.currentUtterance = utterance;
            
            // 触发朗读
            speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('处理朗读段落时发生异常:', error);
            // 检查索引是否已经超出队列长度，防止重复调用
            if (this.currentReadingIndex < this.readingQueue.length) {
                this.currentReadingIndex++;
                setTimeout(() => this.speakNextSegment(), 200);
            }
        }
    }
    
    // 完成朗读
    completeReading() {
        this.isReading = false;
        if (this.currentButton && this.currentButton.classList) {
            this.currentButton.classList.remove('reading');
        }
        this.isProcessingQueue = false;
        this.readingQueue = [];
        this.currentReadingIndex = 0;
        this.currentUtterance = null;
        this.currentButton = null;
        
        // 更新全局变量以保持兼容性
        isReading = false;
        isProcessingQueue = false;
        readingQueue = [];
        currentReadingIndex = 0;
        currentUtterance = null;
        
        console.log('朗读队列处理完毕');
    }
    
    // 停止朗读
    stopReading() {
        console.log('停止朗读被调用，当前状态');
        
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        
        this.completeReading();
        
        // 移除所有按钮的reading状态
        const readingButtons = document.querySelectorAll('.read-btn.reading, .read-section-btn.reading, .read-directions-btn.reading');
        readingButtons.forEach(button => {
            button.classList.remove('reading');
        });
        removeHighlight();
        
        console.log('朗读已停止，所有状态已重置');
    }

    // 新增：统一的文本朗读接口
    readText(text, useSegmentation = false) {
        // 重置管理器状态
        this.reset();

        // 检查文本是否有效
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            console.warn('无效的朗读文本:', text);
            return;
        }

        // 分段或作为整体处理
        if (useSegmentation) {
            this.readingQueue = this.segmentTextWithIds(text);
        } else {
            const cleanText = cleanTextForSpeech(text);
            if (cleanText.length === 0) {
                console.warn('清理后的文本为空:', text);
                return;
            }
            this.readingQueue = [{
                id: 'single_segment',
                text: cleanText,
                index: 0
            }];
        }

        // 检查队列是否为空
        if (this.readingQueue.length === 0) {
            console.warn('朗读队列为空');
            return;
        }

        // 开始处理队列
        this.processReadingQueue(this.currentButton);
    }
    
    // 检查按钮是否正在朗读
    isButtonReading(button) {
        const currentReadingButtons = document.querySelectorAll('.read-btn.reading, .read-section-btn.reading, .read-directions-btn.reading');
        
        // 检查当前点击的按钮是否已经在朗读状态
        let isSameButton = false;
        currentReadingButtons.forEach(readingBtn => {
            if (readingBtn === button) {
                isSameButton = true;
            }
        });
        
        return isSameButton;
    }
    
    // 检查按钮是否应该被忽略（同一位置的其他按钮正在朗读）
    shouldIgnoreButton(button) {
        // 如果没有正在朗读，不忽略
        if (!this.isReading) {
            return false;
        }
        
        // 如果是同一个按钮，不忽略
        if (this.isButtonReading(button)) {
            return false;
        }
        
        // 检查是否是同一位置的不同按钮
        const buttonTitle = button.getAttribute('title') || '';
        const buttonText = button.parentElement ? button.parentElement.textContent.trim() : '';
        
        // 获取当前正在朗读的按钮
        const currentReadingButtons = document.querySelectorAll('.read-btn.reading, .read-section-btn.reading, .read-directions-btn.reading');
        
        for (let readingBtn of currentReadingButtons) {
            const readingTitle = readingBtn.getAttribute('title') || '';
            const readingText = readingBtn.parentElement ? readingBtn.parentElement.textContent.trim() : '';
            
            // 检查是否是同一位置的按钮（相同或相似的title和buttonText）
            if (buttonTitle === readingTitle && buttonText === readingText) {
                // 如果是相同位置的按钮，但不是同一个按钮实例，则忽略
                if (readingBtn !== button) {
                    return true;
                }
            }
        }
        
        return false;
    }
}

// 创建全局朗读管理器实例
const readingManager = new ReadingManager();

// 单词翻译数据，包含难度级别 (1=基础级, 2=中级, 3=高级)
// 这个对象将在各个页面中被扩展
let wordTranslations = {};

// 初始化函数
function initializeCommon() {
    // 移除所有现有的翻译元素，因为我们将在点击时动态创建
    const existingTranslations = document.querySelectorAll('.translation');
    existingTranslations.forEach(trans => {
        trans.remove();
    });
    
    // 为所有单词添加点击事件
    initializeWordClickEvents();
    
    // 初始化朗读按钮
    initializeReadButtons();
}

// 初始化单词点击事件
function initializeWordClickEvents() {
    const words = document.querySelectorAll('.word');
    words.forEach(wordElement => {
        wordElement.addEventListener('click', function() {
            toggleTranslation(this);
        });
    });
}

// 初始化朗读按钮
function initializeReadButtons() {
    const readButtons = document.querySelectorAll('.read-btn, .read-section-btn, .read-directions-btn');
    readButtons.forEach(button => {
        button.addEventListener('click', function() {
            const title = this.getAttribute('title') || '';
            if (title.includes('写作要求') || title.includes('directions')) {
                readDirections();
            } else {
                readSectionText(this);
            }
        });
    });
}

// 切换单词翻译显示
function toggleTranslation(element) {
    const word = element.textContent.trim();
    
    // 检查单词是否为空或只有标点
    if (!word || word.length === 0) {
        return;
    }
    
    let translation = element.nextElementSibling;
    
    // 如果翻译元素不存在，创建一个
    if (!translation || !translation.classList.contains('translation')) {
        translation = document.createElement('span');
        translation.className = 'translation';
        translation.textContent = EnglishLearningCommon.wordTranslations[word]?.translation || '';
        element.parentNode.insertBefore(translation, element.nextSibling);
    }
    
    // 清除之前的定时器
    if (translation.hideTimer) {
        clearTimeout(translation.hideTimer);
    }
    
    // 显示翻译
    translation.style.display = 'block';
    
    // 设置1秒后自动隐藏
    translation.hideTimer = setTimeout(() => {
        translation.style.display = 'none';
    }, 1000);
    
    // 发音单词（添加错误处理）
    try {
        speakWord(word);
    } catch (error) {
        console.error('发音单词时出错:', error, '单词:', word);
    }
}

// 发音单个单词
function speakWord(word) {
    // 停止当前正在播放的语音
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    // 重置朗读管理器状态，避免单词发音与队列朗读冲突
    if (readingManager.isProcessingQueue) {
        readingManager.reset();
    }
    
    // 清理单词，移除可能导致杂音的字符
    const cleanWord = cleanTextForSpeech(word);
    
    // 检查单词是否为空或只有标点
    if (!cleanWord || cleanWord.trim().length === 0) {
        console.log('跳过空单词或标点符号:', word);
        return;
    }
    
    // 检查是否包含中文段落（连续5个以上中文字符）
    const chineseParagraphRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{5,}/;
    if (chineseParagraphRegex.test(cleanWord)) {
        console.log('检测到中文段落，跳过单词发音');
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(cleanWord);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // 添加错误处理
    utterance.onerror = function(event) {
        console.error('语音合成错误:', event.error);
        // 单词发音出错时重置状态
        readingManager.isReading = false;
    };
    
    // 添加结束处理，确保状态正确重置
    utterance.onend = function() {
        // 单词发音完成后重置状态
        readingManager.isReading = false;
        console.log('单词发音完成:', cleanWord);
    };
    
    // 设置单词发音状态
    readingManager.isReading = true;
    speechSynthesis.speak(utterance);
}

// 读取并朗读章节文本
function readSectionText(button) {
    // 检查是否正在朗读
    if (readingManager.isReading) {
        // 检查是否是同一个按钮
        if (readingManager.currentButton === button) {
            return;
        }
    }
    
    // 更新当前按钮引用
    readingManager.currentButton = button;
    
    // 获取按钮的标题和文本
    const buttonTitle = button.title || '';
    const buttonText = button.textContent || button.innerText || '';
    
    // 查找按钮对应的文本元素（只通过ID查找）
    let textElement = findTextElementForButton(button, buttonTitle, buttonText);
    
    // 如果没有找到文本元素，记录日志并返回
    if (!textElement) {
        return;
    }
    
    // 获取文本内容
    let text = '';
    if (textElement.textContent !== undefined) {
        text = textElement.textContent;
    } else if (textElement.innerText !== undefined) {
        text = textElement.innerText;
    } else if (textElement.value !== undefined) {
        text = textElement.value;
    } else {
        text = getTextFromElement(textElement);
    }
    
    // 如果文本为空，记录日志并返回
    if (!text || text.trim().length === 0) {
        return;
    }
    
    // 清理文本
    const cleanText = cleanTextForSpeech(text);
    
    // 检查文本长度，决定使用单段落还是分段朗读
    if (cleanText.length > 300) {
        readingManager.readText(cleanText, true);
    } else {
        readingManager.readText(cleanText, false);
    }
}

// 朗读写作要求
function readDirections() {
    // 停止当前正在播放的语音
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    // 重置朗读管理器状态，避免与其他朗读冲突
    readingManager.reset();
    
    const directionsContent = document.querySelector('.directions-content');
    if (!directionsContent) {
        console.log('未找到写作要求内容');
        return;
    }
    
    const text = directionsContent.textContent;
    
    // 分离中英文内容
    const englishParts = [];
    const chineseParts = [];
    let currentLang = 'en';
    let currentText = '';
    
    // 简单的中英文分离逻辑
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const code = char.charCodeAt(0);
        
        // 判断是否为中文字符
        if (code > 127 || (code >= 0x4e00 && code <= 0x9fff)) {
            if (currentLang === 'en' && currentText.trim()) {
                englishParts.push(currentText.trim());
                currentText = '';
            }
            currentLang = 'zh';
            currentText += char;
        } else {
            if (currentLang === 'zh' && currentText.trim()) {
                chineseParts.push(currentText.trim());
                currentText = '';
            }
            currentLang = 'en';
            currentText += char;
        }
    }
    
    // 添加最后的部分
    if (currentText.trim()) {
        if (currentLang === 'en') {
            englishParts.push(currentText.trim());
        } else {
            chineseParts.push(currentText.trim());
        }
    }
    
    // 朗读英文部分 - 使用朗读管理器
    if (englishParts.length > 0) {
        const englishText = englishParts.join(' ');
        const cleanEnglishText = cleanTextForSpeech(englishText);
        
        
        if (cleanEnglishText.length > 0) {
            // 将英文文本分段并加入队列
            const englishSegments = readingManager.segmentTextWithIds(cleanEnglishText);
            readingManager.readingQueue = [...englishSegments];
            
            // 查找写作要求按钮并设置状态
            const directionsButton = document.querySelector('.read-directions-btn');
            if (directionsButton) {
                readingManager.processReadingQueue(directionsButton);
            }
        }
    }
    
    // 朗读中文部分 - 在英文朗读完成后
    if (chineseParts.length > 0) {
        // 延迟朗读中文，确保英文先完成
        setTimeout(() => {
            const chineseText = chineseParts.join('');
            const cleanChineseText = cleanTextForSpeech(chineseText);
            
            
            if (cleanChineseText.length > 0) {
                const chineseUtterance = new SpeechSynthesisUtterance(cleanChineseText);
                chineseUtterance.lang = 'zh-CN';
                chineseUtterance.rate = 0.9;
                chineseUtterance.pitch = 1;
                chineseUtterance.volume = 1;
                
                chineseUtterance.onend = function() {
                    console.log('写作要求朗读完成');
                };
                
                speechSynthesis.speak(chineseUtterance);
            }
        }, englishParts.length > 0 ? 2000 : 0); // 如果有英文内容，延迟2秒
    }
}

// 停止朗读
function stopReading() {
    readingManager.stopReading();
}

// 高亮正在朗读的单词
function highlightWords() {
    const words = document.querySelectorAll('.word');
    words.forEach(word => {
        word.classList.add('reading');
    });
}

// 移除高亮
function removeHighlight() {
    const words = document.querySelectorAll('.word');
    words.forEach(word => {
        word.classList.remove('reading');
    });
}

// 设置默认显示的翻译
function setDefaultTranslations(level = 2) {
    const words = document.querySelectorAll('.word');
    words.forEach(wordElement => {
        const word = wordElement.textContent;
        const wordData = EnglishLearningCommon.wordTranslations[word];
        
        // 去除中级难度规则，不显示任何默认翻译
        /*
        if (wordData && wordData.level === level) { // 只显示指定级别
            const translation = document.createElement('span');
            translation.className = 'translation';
            translation.textContent = wordData.translation;
            translation.style.display = 'block';
            wordElement.parentNode.insertBefore(translation, wordElement.nextSibling);
        }
        */
    });
}

// 设置案例部分显示所有超过5个字母的单词的翻译
function setCaseStudyTranslations() {
    try {
        // 先尝试处理信件页面的案例部分
        let caseSections = [];
        
        // 检测当前页面类型
        const isChartPage = window.location.pathname.includes('chart');
        
        if (isChartPage) {
            // 图表页面：查找所有包含"范文"或"模板"标题的内容框
            const contentBoxes = document.querySelectorAll('.content-box');
            contentBoxes.forEach(box => {
                try {
                    const title = box.querySelector('.content-title');
                    if (title) {
                        // 处理范文部分和模板部分（现在都使用english-text类）
                        if (title.textContent.includes('范文') ||
                            title.textContent.includes('模板') ||
                            (title.textContent.includes('第一部分：数据变化描述'))) {
                            // 获取所有的english-text元素，可能有多个
                            const englishTexts = box.querySelectorAll('.english-text');
                            englishTexts.forEach(englishText => {
                                if (englishText) {
                                    caseSections.push(englishText);
                                }
                            });
                        }
                    }
                } catch (error) {
                    console.error('处理内容框时出错:', error, '内容框:', box);
                }
            });
        } else {
            // 信件页面：查找信件页面的案例部分
            try {
                const letterCaseSection = document.querySelector('.section .content-box .english-text');
                if (letterCaseSection) {
                    caseSections.push(letterCaseSection);
                }
                
                // 查找所有包含"范文"标题的内容框
                const contentBoxes = document.querySelectorAll('.content-box');
                contentBoxes.forEach(box => {
                    try {
                        const title = box.querySelector('.content-title');
                        if (title && title.textContent.includes('范文')) {
                            const englishText = box.querySelector('.english-text');
                            if (englishText) {
                                caseSections.push(englishText);
                            }
                        }
                    } catch (error) {
                        console.error('处理信件内容框时出错:', error, '内容框:', box);
                    }
                });
            } catch (error) {
                console.error('处理信件页面时出错:', error);
            }
        }
        
        // 处理所有找到的案例部分
        caseSections.forEach(caseSection => {
            try {
                const caseWords = caseSection.querySelectorAll('.word');
                caseWords.forEach(wordElement => {
                    try {
                        const word = wordElement.textContent.trim();
                        const wordData = EnglishLearningCommon.wordTranslations[word];
                       
                        // 显示所有超过5个字母的单词的翻译
                        if (word.length > 5 && wordData) {
                            // 检查是否已经有翻译元素，避免重复添加
                            let existingTranslation = wordElement.nextElementSibling;
                            if (existingTranslation && existingTranslation.classList.contains('translation')) {
                                // 如果已存在翻译，更新其内容
                                existingTranslation.textContent = wordData.translation;
                                existingTranslation.style.display = 'block';
                            } else {
                                // 如果没有翻译，创建新的翻译元素
                                const translation = document.createElement('span');
                                translation.className = 'translation';
                                translation.textContent = wordData.translation;
                                translation.style.display = 'block';
                                wordElement.parentNode.insertBefore(translation, wordElement.nextSibling);
                            }
                        }
                    } catch (error) {
                        console.error('处理单词时出错:', error, '单词元素:', wordElement);
                    }
                });
            } catch (error) {
                console.error('处理案例部分时出错:', error, '案例部分:', caseSection);
            }
        });
    } catch (error) {
        console.error('设置案例翻译时出错:', error);
    }
}

// 处理模板部分的文本，为超过5个字符的单词添加翻译
function processTemplateText(element) {
    // 遍历所有子节点，处理文本节点
    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            // 处理文本节点
            const text = node.textContent;
            const words = text.match(/\b[a-zA-Z]+\b/g) || [];
            
            // 如果没有找到单词，直接返回
            if (words.length === 0) return;
            
            // 创建一个文档片段来存放处理后的内容
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            
            // 使用正则表达式找到所有单词位置
            const wordRegex = /\b[a-zA-Z]+\b/g;
            let match;
            
            while ((match = wordRegex.exec(text)) !== null) {
                // 添加单词前的文本
                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                }
                
                const word = match[0];
                
                // 如果单词超过5个字符且有翻译数据
                if (word.length > 5 && EnglishLearningCommon.wordTranslations[word]) {
                    // 创建单词包装元素
                    const wordWrap = document.createElement('span');
                    wordWrap.className = 'word-wrap';
                    
                    const wordSpan = document.createElement('span');
                    wordSpan.className = 'word level-2';
                    wordSpan.style.cursor = 'default';
                    wordSpan.textContent = word;
                    
                    wordWrap.appendChild(wordSpan);
                    fragment.appendChild(wordWrap);
                    
                    // 创建翻译元素
                    const translation = document.createElement('span');
                    translation.className = 'translation';
                    translation.style.display = 'block';
                    translation.textContent = EnglishLearningCommon.wordTranslations[word].translation;
                    fragment.appendChild(translation);
                } else {
                    // 如果单词不需要翻译，直接添加文本
                    fragment.appendChild(document.createTextNode(word));
                }
                
                lastIndex = wordRegex.lastIndex;
            }
            
            // 添加剩余的文本
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            
            // 用处理后的内容替换原始文本节点
            if (fragment.childNodes.length > 0) {
                node.parentNode.replaceChild(fragment, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // 递归处理子元素节点，但不处理span和已有的翻译元素
            if (!node.classList.contains('translation') && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
                // 将NodeList转换为数组，避免在遍历时修改DOM导致的问题
                const children = Array.from(node.childNodes);
                children.forEach(child => processNode(child));
            }
        }
    }
    
    // 开始处理元素的所有子节点
    const children = Array.from(element.childNodes);
    children.forEach(child => processNode(child));
}

// 从元素中提取文本内容的辅助函数
function getTextFromElement(element) {
    if (!element) return '';
    
    // 特殊处理：如果元素是content-box且包含动词词组标题，需要提取所有子内容
    if (element.classList && element.classList.contains('content-box')) {
        const titleElement = element.querySelector('.content-title');
        if (titleElement) {
            const titleText = titleElement.textContent || titleElement.innerText || '';
            if (titleText.includes('动词词组') || titleText.includes('常用词汇和短语')) {
                // 对于动词词组或常用词汇和短语部分，需要提取所有子元素的文本
                let text = '';
                const childElements = element.children;
                for (let i = 0; i < childElements.length; i++) {
                    const child = childElements[i];
                    // 跳过包含按钮的标题行
                    if (child.classList && child.classList.contains('content-title') && 
                        child.querySelector('button')) {
                        continue;
                    }
                    // 提取子元素文本
                    if (child.textContent) {
                        text += child.textContent + '\n';
                    } else if (child.innerText) {
                        text += child.innerText + '\n';
                    }
                }
                return text;
            }
        }
    }
    
    // 如果元素有直接的文本内容，返回它
    if (element.textContent) {
        return element.textContent;
    }
    
    // 如果元素有innerText属性，返回它
    if (element.innerText) {
        return element.innerText;
    }
    
    // 如果元素有value属性（如input元素），返回它
    if (element.value) {
        return element.value;
    }
    
    // 对于复杂结构，递归获取所有子元素的文本
    let text = '';
    const childNodes = element.childNodes;
    
    for (let i = 0; i < childNodes.length; i++) {
        const node = childNodes[i];
        
        // 如果是文本节点，直接添加文本内容
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
        } 
        // 如果是元素节点，递归处理
        else if (node.nodeType === Node.ELEMENT_NODE) {
            // 特殊处理br标签，替换为换行符
            if (node.tagName.toLowerCase() === 'br') {
                text += '\n';
            } else {
                // 递归获取子元素的文本
                text += getTextFromElement(node);
            }
        }
    }
    
    return text;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeCommon();
});

// 清理文本以优化语音合成
function cleanTextForSpeech(text) {
    if (!text) return '';
    
    return text
        // 移除HTML标签
        .replace(/<[^>]*>/g, '')
        // 保留英文、中文、数字和常用标点符号及换行符
        .replace(/[^\w\s\u4e00-\u9fff.,!?;:'"()\-\/\n]/g, '')
        // 将多个空格替换为单个空格
        .replace(/\s+/g, ' ')
        // 移除首尾空格
        .trim();
}

// 将文本分段并为每个段落分配ID
function segmentTextWithIds(text) {
    if (!text || text.trim().length === 0) {
        return [];
    }
    
    // 首先清理文本
    const cleanText = cleanTextForSpeech(text);
    
    // 如果文本长度不超过300个字符，作为单个段落处理
    if (cleanText.length <= 300) {
        return [{
            id: 'short_segment_0',
            text: cleanText
        }];
    }
    
    // 优先按换行符分割段落（保留有意义的段落边界）
    const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // 如果只有一个段落或段落数量较少，尝试进一步按句子分割
    const allSentences = [];
    paragraphs.forEach(paragraph => {
        // 清理段落内的多余空白
        const cleanParagraph = paragraph.trim();
        
        // 按句子结束标点分割
        const sentences = cleanParagraph.match(/[^.!?。！？]*[.!?。！？]+/g) || [cleanParagraph];
        
        // 过滤掉空句子并添加到总句子列表
        sentences.filter(s => s.trim().length > 0).forEach(sentence => {
            allSentences.push(sentence.trim());
        });
        
        // 在段落之间添加特殊标记，表示这是一个重要的分隔点
        allSentences.push('\n\n');
    });
    
    // 移除末尾的分隔符
    if (allSentences.length > 0 && allSentences[allSentences.length - 1] === '\n\n') {
        allSentences.pop();
    }
    
    const segments = [];
    let currentSegment = '';
    let segmentIndex = 0;
    
    for (let i = 0; i < allSentences.length; i++) {
        const sentence = allSentences[i];
        
        // 特殊处理：如果遇到段落分隔符，先完成当前段落
        if (sentence === '\n\n') {
            if (currentSegment.trim().length > 0) {
                segments.push({
                    id: 'segment_' + segmentIndex++,
                    text: currentSegment.trim()
                });
                currentSegment = '';
            }
            continue;
        }
        
        // 检查添加当前句子后是否超出长度限制
        const potentialSegment = currentSegment ? currentSegment + ' ' + sentence : sentence;
        
        if (potentialSegment.length <= 300) {
            currentSegment = potentialSegment;
        } else {
            // 如果当前段落不为空，保存当前段落
            if (currentSegment.trim().length > 0) {
                segments.push({
                    id: 'segment_' + segmentIndex++,
                    text: currentSegment.trim()
                });
            }
            
            // 如果单个句子就超过300字符，需要强制分割
            if (sentence.length > 300) {
                // 按每290字符分割长句
                for (let j = 0; j < sentence.length; j += 290) {
                    const chunk = sentence.substr(j, 290);
                    segments.push({
                        id: 'segment_' + segmentIndex++,
                        text: chunk.trim()
                    });
                }
            } else {
                // 开始新的段落
                currentSegment = sentence;
            }
        }
    }
    
    // 保存最后一个段落
    if (currentSegment.trim().length > 0) {
        segments.push({
            id: 'segment_' + segmentIndex++,
            text: currentSegment.trim()
        });
    }
    
    return segments;
}

// 精确查找按钮对应的文本元素
function findTextElementForButton(button, buttonTitle, buttonText) {
    // 检查按钮是否在.content-box内，如果是，则直接返回该.content-box作为文本元素
    const buttonParent = button.parentElement;
    if (buttonParent && buttonParent.classList.contains('content-box')) {
        return buttonParent;
    }
    
    // 特殊处理：如果按钮在"常用词汇和短语"或"动词词组"标题内，需要找到包含所有相关内容的父级.content-box
    if (buttonParent && buttonParent.classList.contains('content-title')) {
        // 检查是否是"常用词汇和短语"或"动词词组"标题
        const titleText = buttonParent.textContent || buttonParent.innerText || '';
        if (titleText.includes('常用词汇和短语') || titleText.includes('动词词组')) {
            // 返回包含所有相关内容的父级.content-box
            const grandParent = buttonParent.parentElement;
            if (grandParent && grandParent.classList.contains('content-box')) {
                return grandParent;
            }
        }
    }
    
    // 如果按钮在.content-title内，则查找同级的.content-box元素
    if (buttonParent && buttonParent.classList.contains('content-title')) {
        // 查找同级的.content-box元素
        let nextElement = buttonParent.nextElementSibling;
        while (nextElement) {
            if (nextElement.classList.contains('content-box')) {
                return nextElement;
            }
            // 如果遇到另一个content-title，停止查找
            if (nextElement.classList.contains('content-title')) {
                break;
            }
            nextElement = nextElement.nextElementSibling;
        }
    }
    
    // 特殊情况处理：如果按钮在.content-title内，但.content-title本身在.content-box内
    // 则返回.content-title的父元素（即.content-box）
    if (buttonParent && buttonParent.classList.contains('content-title')) {
        const titleParent = buttonParent.parentElement;
        if (titleParent && titleParent.classList.contains('content-box')) {
            return titleParent;
        }
    }
    
    // 处理chart页面的结构：按钮在.content-title内，同级有.readable-content元素
    if (buttonParent && buttonParent.classList.contains('content-title')) {
        // 查找同级的.readable-content元素
        let nextElement = buttonParent.nextElementSibling;
        while (nextElement) {
            if (nextElement.classList.contains('readable-content')) {
                return nextElement;
            }
            // 如果遇到另一个content-title，停止查找
            if (nextElement.classList.contains('content-title')) {
                break;
            }
            nextElement = nextElement.nextElementSibling;
        }
    }
    
    // 处理Cross-Cultural Invitation.html页面的结构：按钮在.title或.letter-type内，查找同级的.sentence-pattern元素
    if (buttonParent && (buttonParent.classList.contains('title') || buttonParent.classList.contains('letter-type'))) {
        // 查找同级的.sentence-pattern元素
        let nextElement = buttonParent.nextElementSibling;
        while (nextElement) {
            if (nextElement.classList.contains('sentence-pattern')) {
                return nextElement;
            }
            // 如果遇到另一个title或letter-type，停止查找
            if (nextElement.classList.contains('title') || nextElement.classList.contains('letter-type')) {
                break;
            }
            nextElement = nextElement.nextElementSibling;
        }
    }
    
    // 处理Cross-Cultural Invitation.html页面的结构：按钮直接在.sentence-pattern内
    if (buttonParent && buttonParent.classList.contains('sentence-pattern')) {
        return buttonParent;
    }
    
    // 如果没有找到，返回null
    return null;
}

// 导出函数供其他脚本使用
window.EnglishLearningCommon = {
    toggleTranslation,
    speakWord,
    readSectionText,
    readDirections,
    stopReading,
    setDefaultTranslations,
    setCaseStudyTranslations,
    wordTranslations,
    cleanTextForSpeech,
    readingManager // 导出朗读管理器实例，供外部脚本使用
};