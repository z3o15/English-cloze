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
        if (!text || typeof text !== 'string') {
            console.warn('无效的文本输入:', text);
            return [];
        }
        
        // 清理文本
        const cleanText = text.trim();
        if (cleanText.length === 0) {
            console.warn('文本为空，无法分段');
            return [];
        }
        
        // 检查是否包含中文段落（连续5个以上中文字符）
        const chineseParagraphRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{5,}/;
        if (chineseParagraphRegex.test(cleanText)) {
            console.log('检测到中文段落，不进行分段处理');
            return [];
        }
        
        // 将文本按句子分割，保留标点符号
        const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
        
        // 为每个段落添加唯一标识
        this.textSegments = sentences
            .filter(sentence => sentence && sentence.trim().length > 0) // 过滤空句子
            .map((sentence, index) => ({
                id: `segment_${index}`,
                text: sentence.trim(),
                index: index
            }));
        
        console.log('文本分段完成，共', this.textSegments.length, '段');
        return this.textSegments;
    }
    
    // 朗读队列控制系统
    processReadingQueue(button) {
        if (this.isProcessingQueue || !this.readingQueue || this.readingQueue.length === 0) {
            console.log('队列正在处理或为空，跳过');
            return;
        }
        
        this.isProcessingQueue = true;
        this.currentReadingIndex = 0;
        this.currentButton = button;
        
        // 第一句开始时设置按钮状态
        this.isReading = true;
        if (button && button.classList) {
            button.classList.add('reading');
        }
        
        // 更新全局变量以保持兼容性
        isReading = true;
        isProcessingQueue = true;
        
        console.log('开始处理朗读队列，共', this.readingQueue.length, '段');
        
        // 使用延迟确保状态设置完成
        setTimeout(() => this.speakNextSegment(), 50);
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
            
            // 检查是否包含中文段落（连续5个以上中文字符）
            const chineseParagraphRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{5,}/;
            if (chineseParagraphRegex.test(cleanText)) {
                console.log('检测到中文段落，停止朗读');
                this.completeReading();
                return;
            }
            
            if (cleanText.length === 0) {
                console.log('跳过空段落:', currentSegment.id);
                this.currentReadingIndex++;
                setTimeout(() => this.speakNextSegment(), 50);
                return;
            }
            
            console.log('准备朗读段落:', currentSegment.id, cleanText);
            
            // 确保语音合成器就绪
            if (speechSynthesis.speaking) {
                console.log('语音合成器正在忙碌，等待...');
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
                this.currentReadingIndex++;
                setTimeout(() => this.speakNextSegment(), 200);
            };
            
            // 核心解决思路：通过API回调（onend事件）触发下一段
            utterance.onend = () => {
                console.log('段落朗读完成:', currentSegment?.id || 'unknown');
                this.currentReadingIndex++;
                // 使用短暂延迟确保浏览器状态更新
                setTimeout(() => this.speakNextSegment(), 100);
            };
            
            // 添加开始事件用于调试
            utterance.onstart = () => {
                console.log('开始朗读段落:', currentSegment?.id || 'unknown');
            };
            
            // 记录当前要读的标识
            this.currentUtterance = utterance;
            
            // 确保在下一个事件循环中调用speak
            setTimeout(() => {
                try {
                    speechSynthesis.speak(utterance);
                    console.log('已发送朗读指令:', currentSegment?.id || 'unknown');
                } catch (speakError) {
                    console.error('调用speak时出错:', speakError);
                    this.currentReadingIndex++;
                    setTimeout(() => this.speakNextSegment(), 200);
                }
            }, 10);
            
        } catch (error) {
            console.error('处理朗读段落时出错:', error, '段落ID:', this.readingQueue[this.currentReadingIndex]?.id || 'unknown');
            this.currentReadingIndex++;
            setTimeout(() => this.speakNextSegment(), 300);
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
        console.log('停止朗读被调用，当前状态:', {
            isReading: this.isReading,
            isProcessingQueue: this.isProcessingQueue,
            queueLength: this.readingQueue.length,
            currentIndex: this.currentReadingIndex
        });
        
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
                    console.log('同一位置的其他按钮正在朗读，忽略当前按钮', {
                        currentButton: buttonTitle,
                        readingButton: readingTitle
                    });
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

// 朗读指定部分的文本
function readSectionText(button) {
    console.log('readSectionText 被调用，当前 readingManager.isReading:', readingManager.isReading);
    
    if (readingManager.isReading) {
        console.log('正在朗读中，检查是否应该忽略当前按钮');
        
        // 检查是否应该忽略当前按钮（同一位置的其他按钮正在朗读）
        if (readingManager.shouldIgnoreButton(button)) {
            console.log('同一位置的其他按钮正在朗读，忽略当前按钮');
            return;
        }
        
        // 使用新的朗读管理器检查是否是同一个按钮
        if (readingManager.isButtonReading(button)) {
            console.log('同一个按钮被点击，忽略');
            return; // 同一个按钮被点击，不做任何操作
        }
        
        // 不同按钮被点击，停止当前朗读并开始新的
        console.log('不同按钮被点击，停止当前朗读');
        readingManager.stopReading();
        // 添加短暂延迟，确保停止完成后再开始新的朗读
        setTimeout(() => {
            console.log('延迟后重新开始朗读');
            readSectionTextInternal(button);
        }, 100);
        return;
    }
    
    // 直接调用内部函数处理朗读
    readSectionTextInternal(button);
}

// 内部朗读处理函数
function readSectionTextInternal(button) {
    try {
        // 获取按钮所在部分的文本内容
        let textElement = null;
        
        // 检查按钮的title属性来确定要朗读的内容
        const buttonTitle = button.getAttribute('title') || '';
        const buttonText = button.parentElement ? button.parentElement.textContent.trim() : '';
        
        // 使用全新的精确查找策略
        textElement = findTextElementForButton(button, buttonTitle, buttonText);
        
        if (!textElement) {
            console.log('未找到文本元素', button, 'title:', buttonTitle, 'buttonText:', buttonText);
            return;
        }
        
        // 处理可能的对象形式（如图表页面范文部分）
        const text = typeof textElement === 'object' && textElement.textContent !== undefined
                    ? textElement.textContent
                    : textElement.textContent || textElement;
        
        // 清理文本，移除可能导致杂音的字符
        const cleanText = cleanTextForSpeech(text);
        
        console.log('获取到文本，长度:', cleanText.length, '内容:', cleanText);
        console.log('文本元素详情:', {
            textElement: textElement,
            textElementType: typeof textElement,
            textElementClass: textElement?.className,
            textElementId: textElement?.id,
            rawText: text,
            cleanText: cleanText
        });
        
        // 停止当前正在播放的语音
        if (speechSynthesis.speaking) {
            console.log('停止当前语音');
            speechSynthesis.cancel();
        }
        
        // 检查文本长度，如果太长则分段处理
        const maxLength = 200; // 设置最大长度限制
        if (cleanText.length > maxLength) {
            console.log('文本较长，使用分段朗读');
            // 分段朗读长文本 - 使用新的朗读管理器
            speakLongText(cleanText, button);
        } else {
            console.log('文本较短，使用单段落朗读');
            // 朗读短文本 - 使用新的朗读管理器确保一致性
            try {
                // 重置朗读管理器状态
                readingManager.reset();
                
                // 将短文本作为单个段落加入队列
                const shortSegment = {
                    id: 'short_segment_0',
                    text: cleanText,
                    index: 0
                };
                
                readingManager.readingQueue = [shortSegment];
                
                // 使用朗读管理器处理短文本
                readingManager.processReadingQueue(button);
                
            } catch (error) {
                console.error('短文本朗读初始化时出错:', error, '文本:', cleanText);
                // 重置状态
                readingManager.reset();
                button.classList.remove('reading');
            }
        }
    } catch (error) {
        console.error('readSectionTextInternal 出错:', error);
        // 重置状态
        readingManager.reset();
        button.classList.remove('reading');
    }
}

// 精确查找按钮对应的文本元素
function findTextElementForButton(button, buttonTitle, buttonText) {
    let textElement = null;
    
    // 检测当前页面类型
    const isChartPage = window.location.pathname.includes('chart');
    const isLetterPage = window.location.pathname.includes('letter');
    
    // 添加调试信息，帮助定位问题
    console.log('查找按钮对应的文本元素', {
        buttonTitle: buttonTitle,
        buttonText: buttonText,
        isChartPage: isChartPage,
        isLetterPage: isLetterPage,
        buttonParent: button.parentElement ? button.parentElement.className : null,
        buttonElement: button,
        buttonParentElement: button.parentElement,
        buttonGrandParentElement: button.parentElement?.parentElement
    });
    
    // 策略1: 特殊处理"引出图表句型"按钮
    if (buttonTitle.includes('引出图表句型') || buttonText.includes('引出图表句型')) {
        // 查找按钮父元素（content-title）之后的所有english-expression元素
        const contentTitle = button.parentElement;
        let nextElement = contentTitle.nextElementSibling;
        let allExpressions = [];
        
        // 收集所有english-expression元素的内容
        while (nextElement) {
            if (nextElement.classList.contains('english-expression')) {
                allExpressions.push(nextElement.textContent.trim());
                if (window.location.search.includes('debug=true')) {
                    console.log('找到引出图表句型对应的english-expression元素');
                }
            }
            // 如果遇到另一个content-title，停止查找
            if (nextElement.classList.contains('content-title')) {
                break;
            }
            nextElement = nextElement.nextElementSibling;
        }
        
        // 如果找到了english-expression元素，合并所有内容
        if (allExpressions.length > 0) {
            textElement = {
                textContent: allExpressions.join(' ')
            };
            if (window.location.search.includes('debug=true')) {
                console.log('合并所有english-expression元素内容:', allExpressions.join(' '));
            }
        }
        
        // 如果没有找到english-expression，尝试查找english-text
        if (!textElement) {
            nextElement = contentTitle.nextElementSibling;
            while (nextElement) {
                if (nextElement.classList.contains('english-text')) {
                    textElement = nextElement;
                    if (window.location.search.includes('debug=true')) {
                        console.log('找到引出图表句型对应的english-text元素');
                    }
                    break;
                }
                // 如果遇到另一个content-title，停止查找
                if (nextElement.classList.contains('content-title')) {
                    break;
                }
                nextElement = nextElement.nextElementSibling;
            }
        }
        
        return textElement;
    }
    
    // 策略1.5: 通用按钮处理 - 基于按钮位置的精确查找
    if (!textElement) {
        console.log('使用通用按钮处理策略');
        
        // 获取按钮的父元素
        const buttonParent = button.parentElement;
        
        // 如果按钮在content-title内
        if (buttonParent && buttonParent.classList.contains('content-title')) {
            // 特殊处理：引出话题句型按钮需要读取所有english-expression
            if (buttonTitle.includes('引出话题句型') || buttonText.includes('引出话题句型')) {
                // 查找content-title的下一个兄弟元素
                let nextElement = buttonParent.nextElementSibling;
                let allExpressions = [];
                
                // 收集所有english-expression元素的内容
                while (nextElement) {
                    if (nextElement.classList.contains('english-expression')) {
                        allExpressions.push(nextElement.textContent.trim());
                        console.log('找到引出话题句型对应的english-expression元素');
                    }
                    // 如果遇到另一个content-title，停止查找
                    if (nextElement.classList.contains('content-title')) {
                        break;
                    }
                    nextElement = nextElement.nextElementSibling;
                }
                
                // 如果找到了english-expression元素，合并所有内容
                if (allExpressions.length > 0) {
                    textElement = {
                        textContent: allExpressions.join(' ')
                    };
                    console.log('合并所有english-expression元素内容:', allExpressions.join(' '));
                }
            }
            // 特殊处理：预测/建议句型按钮
            else if (buttonTitle.includes('预测/建议句型') || buttonText.includes('预测/建议句型')) {
                console.log('处理预测/建议句型按钮，使用通用策略');
                
                // 查找content-title的下一个兄弟元素
                let nextElement = buttonParent.nextElementSibling;
                let foundTexts = [];
                
                // 遍历后续兄弟元素，查找包含预测/建议内容的english-expression
                while (nextElement) {
                    if (nextElement.classList.contains('english-expression')) {
                        const text = nextElement.textContent.trim();
                        console.log('找到english-expression元素:', text);
                        
                        // 检查是否包含预测/建议相关内容
                        if (text.includes('Therefore') &&
                            (text.includes('predicted') || text.includes('take actions') ||
                             text.includes('address') || text.includes('problem'))) {
                            foundTexts.push(text);
                            console.log('找到预测/建议相关文本:', text);
                        }
                    }
                    
                    // 如果遇到另一个content-title，停止查找
                    if (nextElement.classList.contains('content-title')) {
                        break;
                    }
                    nextElement = nextElement.nextElementSibling;
                }
                
                if (foundTexts.length > 0) {
                    textElement = {
                        textContent: foundTexts.join(' ')
                    };
                    console.log('预测/建议句型找到的文本:', foundTexts);
                }
            }
            // 其他情况：通用查找
            else {
                // 查找content-title的下一个兄弟元素
                let nextElement = buttonParent.nextElementSibling;
                
                // 遍历后续兄弟元素，查找包含英文文本的元素
                while (nextElement) {
                    // 检查是否是content-box
                    if (nextElement.classList.contains('content-box')) {
                        // 在content-box内查找english-text或english-expression
                        const englishText = nextElement.querySelector('.english-text, .english-expression');
                        if (englishText) {
                            textElement = englishText;
                            break;
                        } else {
                            // 如果没有找到特定的英文文本元素，使用整个content-box
                            textElement = nextElement;
                            break;
                        }
                    }
                
                    // 如果遇到另一个content-title，停止查找
                    if (nextElement.classList.contains('content-title') && nextElement !== buttonParent) {
                        break;
                    }
                    
                    nextElement = nextElement.nextElementSibling;
                }
            }
        }
        
        // 如果还没找到，尝试在父级content-box内查找
        if (!textElement) {
            console.log('通用策略未找到文本，尝试在父级content-box内查找');
            const parentContentBox = button.closest('.content-box');
            if (parentContentBox) {
                // 查找父级content-box内的所有english-text和english-expression
                const allEnglishElements = parentContentBox.querySelectorAll('.english-text, .english-expression');
                
                console.log('父级content-box内找到的英文元素数量:', allEnglishElements.length);
                
                if (allEnglishElements.length > 0) {
                    // 使用第一个找到的英文元素
                    textElement = allEnglishElements[0];
                    console.log('使用第一个英文元素:', textElement.textContent.trim());
                } else {
                    // 如果没有找到特定的英文元素，使用整个content-box
                    textElement = parentContentBox;
                    console.log('使用整个content-box作为文本元素');
                }
            }
        }
    }
    
    // 如果找到了文本元素，直接返回
    if (textElement) {
        return textElement;
    }
    
    // 策略2: 处理图表页面的按钮
    if (isChartPage) {
        // 情况2.1: 按钮在content-title内
        if (button.parentElement.classList.contains('content-title')) {
            // 特殊处理：引出图表句型已在策略1中处理
            if (buttonTitle.includes('引出图表句型') || buttonText.includes('引出图表句型')) {
                // 已在策略1中处理，这里跳过
                return null;
            }
            
            // 特殊处理：比大小类和比趋势类的范文部分
            if (buttonTitle.includes('范文') || buttonText.includes('范文')) {
                // 查找当前content-box内的所有english-text
                const parentContentBox = button.closest('.content-box');
                if (parentContentBox) {
                    const allEnglishTexts = parentContentBox.querySelectorAll('.english-text');
                    if (allEnglishTexts.length > 0) {
                        // 合并所有 .english-text 的内容
                        const combinedText = Array.from(allEnglishTexts).map(el => el.textContent).join(' ');
                        textElement = {
                            textContent: combinedText
                        };
                        if (window.location.search.includes('debug=true')) {
                            console.log('找到范文部分的多个english-text元素，已合并内容');
                        }
                    } else {
                        textElement = parentContentBox;
                    }
                }
            }
            
            // 特殊处理：评价句型和预测/建议句型按钮
            if (buttonTitle.includes('评价句型') || buttonText.includes('评价句型') ||
                buttonTitle.includes('预测/建议句型') || buttonText.includes('预测/建议句型')) {
                
                console.log('处理预测/建议句型按钮，查找对应的文本内容');
                
                // 查找按钮父元素（content-title）之后的所有english-expression元素
                const contentTitle = button.parentElement;
                let nextElement = contentTitle.nextElementSibling;
                let allTexts = [];
                
                // 收集所有english-expression元素的内容
                while (nextElement) {
                    if (nextElement.classList.contains('english-expression')) {
                        const text = nextElement.textContent.trim();
                        console.log('找到english-expression元素:', text);
                        
                        // 收集所有包含实际英文内容的元素，包括分类标识后的内容
                        if (text &&
                            (text.includes('Therefore') || text.includes('In view of') ||
                             text.includes('predicted') || text.includes('take actions') ||
                             text.includes('address') || text.includes('problem'))) {
                            allTexts.push(text);
                            console.log('添加符合条件的文本:', text);
                        }
                    }
                    
                    // 如果遇到另一个content-title，停止查找
                    if (nextElement.classList.contains('content-title')) {
                        break;
                    }
                    nextElement = nextElement.nextElementSibling;
                }
                
                if (allTexts.length > 0) {
                    textElement = {
                        textContent: allTexts.join(' ')
                    };
                    console.log('找到预测/建议句型内容:', allTexts);
                } else {
                    console.log('未找到符合条件的预测/建议句型内容，尝试备用查找方案');
                    
                    // 备用方案：查找当前content-box内的所有english-expression
                    const parentContentBox = button.closest('.content-box');
                    if (parentContentBox) {
                        const allExpressions = parentContentBox.querySelectorAll('.english-expression');
                        let backupTexts = [];
                        
                        allExpressions.forEach(expr => {
                            const text = expr.textContent.trim();
                            console.log('备用方案找到english-expression:', text);
                            
                            if (text &&
                                (text.includes('Therefore') || text.includes('In view of') ||
                                 text.includes('predicted') || text.includes('take actions') ||
                                 text.includes('address') || text.includes('problem'))) {
                                backupTexts.push(text);
                                console.log('备用方案添加符合条件的文本:', text);
                            }
                        });
                        
                        if (backupTexts.length > 0) {
                            textElement = {
                                textContent: backupTexts.join(' ')
                            };
                            console.log('备用方案找到预测/建议句型内容:', backupTexts);
                        }
                    }
                }
            }
            // 其他情况：查找同级的下一个content-box
            else {
                const parentContentBox = button.closest('.content-box');
                if (parentContentBox) {
                    const nextBox = parentContentBox.nextElementSibling;
                    if (nextBox && nextBox.classList.contains('content-box')) {
                        // 查找下一个content-box中的english-text
                        const englishText = nextBox.querySelector('.english-text');
                        if (englishText) {
                            textElement = englishText;
                        } else {
                            textElement = nextBox;
                        }
                    } else {
                        // 如果没有下一个，查找当前content-box内的english-text或english-expression
                        const englishText = parentContentBox.querySelector('.english-text');
                        const englishExpression = parentContentBox.querySelector('.english-expression');
                        if (englishText) {
                            textElement = englishText;
                        } else if (englishExpression) {
                            textElement = englishExpression;
                        } else {
                            // 最后备用方案：使用当前content-box
                            textElement = parentContentBox;
                        }
                    }
                }
            }
        }
        // 情况2.2: 按钮在content-box内
        else if (button.parentElement.classList.contains('content-box')) {
            textElement = button.parentElement;
        }
        // 情况2.3: 特殊处理范文部分
        else if (buttonTitle.includes('范文')) {
            // 查找包含多个 .english-text 的容器
            const contentBox = button.closest('.content-box');
            if (contentBox) {
                const allEnglishTexts = contentBox.querySelectorAll('.english-text');
                if (allEnglishTexts.length > 0) {
                    // 合并所有 .english-text 的内容
                    const combinedText = Array.from(allEnglishTexts).map(el => el.textContent).join(' ');
                    // 直接使用合并后的文本，而不是创建临时元素
                    textElement = {
                        textContent: combinedText
                    };
                    if (window.location.search.includes('debug=true')) {
                        console.log('找到范文部分的多个english-text元素，已合并内容');
                    }
                } else {
                    // 如果没有找到english-text，尝试查找english-expression
                    const englishExpression = contentBox.querySelector('.english-expression');
                    if (englishExpression) {
                        textElement = englishExpression;
                        if (window.location.search.includes('debug=true')) {
                            console.log('找到范文部分的english-expression元素');
                        }
                    } else {
                        // 最后备用方案：使用当前content-box
                        textElement = contentBox;
                    }
                }
            }
        }
        // 情况2.4: 其他位置的按钮
        else {
            // 先尝试查找最近的content-box
            const nearestContentBox = button.closest('.content-box');
            if (nearestContentBox) {
                const englishText = nearestContentBox.querySelector('.english-text');
                const englishExpression = nearestContentBox.querySelector('.english-expression');
                if (englishText) {
                    textElement = englishText;
                } else if (englishExpression) {
                    textElement = englishExpression;
                } else {
                    textElement = nearestContentBox;
                }
            } else {
                // 如果不在content-box内，查找父级容器内的文本元素
                const container = button.parentElement;
                textElement = container.querySelector('.content-box') ||
                              container.querySelector('.format-box') ||
                              container.querySelector('.english-text') ||
                              container.querySelector('.english-expression');
            }
        }
        
        return textElement;
    }
    
    // 策略3: 处理书信页面的按钮
    if (isLetterPage) {
        // 情况3.1: 按钮在content-title内
        if (button.parentElement.classList.contains('content-title')) {
            // 特殊处理：开头段-直奔主题-必备句型1个
            if (buttonTitle.includes('开头段') || buttonText.includes('开头段')) {
                if (window.location.search.includes('debug=true')) {
                    console.log('处理开头段按钮');
                }
                
                // 对于开头段按钮，我们需要特殊处理
                // 它的结构是：content-title(包含按钮) -> content-box(包含文本)
                const titleElement = button.parentElement;
                
                // 查找content-title的下一个兄弟元素
                let nextElement = titleElement.nextElementSibling;
                
                // 查找最近的content-box
                while (nextElement) {
                    if (nextElement.classList.contains('content-box')) {
                        // 查找content-box中的文本内容
                        const textContent = nextElement.textContent.trim();
                        
                        // 检查是否包含预期的文本内容
                        if (textContent.includes('I am writing this letter/email')) {
                            if (window.location.search.includes('debug=true')) {
                                console.log('确认找到开头段对应的文本内容');
                            }
                            textElement = nextElement;
                            break;
                        }
                    }
                    nextElement = nextElement.nextElementSibling;
                }
                
                // 如果没有找到，尝试其他方法
                if (!textElement) {
                    // 查找按钮所在的content-box
                    const parentBox = button.closest('.content-box');
                    
                    if (parentBox) {
                        // 在父级content-box内查找所有content-box
                        const innerBoxes = parentBox.querySelectorAll('.content-box');
                        
                        // 遍历所有内部content-box，查找包含预期文本的元素
                        for (let box of innerBoxes) {
                            const text = box.textContent.trim();
                            if (text.includes('I am writing this letter/email')) {
                                textElement = box;
                                break;
                            }
                        }
                    }
                }
            }
            // 特殊处理：动词词组
            else if (buttonTitle.includes('动词词组')) {
                // 查找按钮父元素的下一个兄弟元素
                const titleElement = button.parentElement;
                let nextElement = titleElement.nextElementSibling;
                
                // 找到下一个content-title或content-box
                while (nextElement) {
                    if (nextElement.classList.contains('content-title') || nextElement.classList.contains('content-box')) {
                        // 检查是否有data-target属性
                        if (nextElement.hasAttribute('data-target')) {
                            textElement = nextElement;
                            break;
                        } else if (nextElement.classList.contains('content-box')) {
                            // 如果没有data-target属性，查找子元素中的english-text
                            const englishText = nextElement.querySelector('.english-text');
                            if (englishText) {
                                textElement = englishText;
                                break;
                            } else {
                                textElement = nextElement;
                                break;
                            }
                        }
                    }
                    nextElement = nextElement.nextElementSibling;
                }
                
                // 如果找到的是content-title，再查找它的下一个content-box
                if (textElement && textElement.classList.contains('content-title')) {
                    const nextBox = textElement.nextElementSibling;
                    if (nextBox && nextBox.classList.contains('content-box')) {
                        textElement = nextBox;
                    }
                }
            }
            // 特殊处理：模板
            else if (buttonTitle.includes('模板')) {
                // 查找同级的下一个content-box
                const titleElement = button.parentElement;
                let nextElement = titleElement.nextElementSibling;
                
                // 找到下一个content-box
                while (nextElement) {
                    if (nextElement.classList.contains('content-box')) {
                        // 查找子元素中的english-text
                        const englishText = nextElement.querySelector('.english-text');
                        if (englishText) {
                            textElement = englishText;
                            break;
                        } else {
                            textElement = nextElement;
                            break;
                        }
                    }
                    nextElement = nextElement.nextElementSibling;
                }
            }
            // 特殊处理：案例
            else if (buttonTitle.includes('案例')) {
                // 查找包含 .english-text 的容器
                const contentBox = button.closest('.content-box');
                if (contentBox) {
                    const englishText = contentBox.querySelector('.english-text');
                    if (englishText) {
                        textElement = englishText;
                        if (window.location.search.includes('debug=true')) {
                            console.log('找到案例部分的english-text元素');
                        }
                    }
                }
            }
            // 其他content-title内的按钮
            else {
                // 查找同级的下一个content-box
                const parentContentBox = button.closest('.content-box');
                if (parentContentBox) {
                    const nextBox = parentContentBox.nextElementSibling;
                    if (nextBox && nextBox.classList.contains('content-box')) {
                        textElement = nextBox;
                    } else {
                        // 如果没有下一个，使用当前content-box
                        textElement = parentContentBox;
                    }
                }
            }
        }
        // 情况3.2: 按钮在content-box内
        else if (button.parentElement.classList.contains('content-box')) {
            textElement = button.parentElement;
        }
        // 情况3.3: 其他位置的按钮
        else {
            // 查找按钮附近的文本元素
            // 先查找同级的下一个元素
            if (button.nextElementSibling &&
                (button.nextElementSibling.classList.contains('content-box') ||
                 button.nextElementSibling.classList.contains('format-box') ||
                 button.nextElementSibling.classList.contains('english-text'))) {
                textElement = button.nextElementSibling;
            }
            // 查找父级容器内的文本元素
            else {
                const container = button.parentElement;
                textElement = container.querySelector('.content-box') ||
                              container.querySelector('.format-box') ||
                              container.querySelector('.english-text');
            }
        }
        
        return textElement;
    }
    
    // 策略4: 通用查找方法（适用于所有页面）
    if (!textElement) {
        // 情况4.1: 按钮在content-title内
        if (button.parentElement.classList.contains('content-title')) {
            // 查找同级的下一个content-box
            const parentContentBox = button.closest('.content-box');
            if (parentContentBox) {
                const nextBox = parentContentBox.nextElementSibling;
                if (nextBox && nextBox.classList.contains('content-box')) {
                    textElement = nextBox;
                } else {
                    // 如果没有下一个，使用当前content-box
                    textElement = parentContentBox;
                }
            }
        }
        // 情况4.2: 按钮在content-box内
        else if (button.parentElement.classList.contains('content-box')) {
            textElement = button.parentElement;
        }
        // 情况4.3: 其他位置的按钮
        else {
            // 查找父级容器内的文本元素
            const container = button.parentElement;
            textElement = container.querySelector('.content-box') ||
                          container.querySelector('.format-box') ||
                          container.querySelector('.english-text') ||
                          container.querySelector('.sentence-pattern');
        }
    }
    
    // 如果还是没找到，使用最后的备用方案
    if (!textElement) {
        const parentSection = button.closest('.section');
        if (parentSection) {
            // 查找section内所有可能的文本元素
            const candidates = parentSection.querySelectorAll('.content-box, .sentence-pattern, .format-box, .english-text, .english-expression');
            // 找到第一个非空的候选元素
            for (let candidate of candidates) {
                if (candidate.textContent.trim().length > 0) {
                    textElement = candidate;
                    if (window.location.search.includes('debug=true')) {
                        console.log('使用备用方案找到文本元素:', candidate);
                    }
                    break;
                }
            }
        }
    }
    
    if (window.location.search.includes('debug=true')) {
        console.log('最终找到的文本元素:', textElement);
        if (textElement) {
            console.log('文本元素内容:', textElement.textContent ? textElement.textContent.trim() : '无内容');
        }
    }
    return textElement;
}


// 新的分段朗读长文本函数
function speakLongText(text, button) {
    try {
        // 停止当前正在播放的语音
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        
        // 重置朗读管理器状态
        readingManager.reset();
        
        // 1. 给待朗读文本分段并加唯一标识
        const segments = readingManager.segmentTextWithIds(text);
        
        // 2. 将分段加入朗读队列
        readingManager.readingQueue = [...segments];
        
        // 3. 开始处理朗读队列（避免并发朗读请求）
        readingManager.processReadingQueue(button);
        
    } catch (error) {
        console.error('分段朗读初始化时出错:', error, '文本:', text);
        // 重置状态
        readingManager.reset();
        button.classList.remove('reading');
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
        
        // 检查是否包含中文段落（连续5个以上中文字符）
        const chineseParagraphRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{5,}/;
        if (chineseParagraphRegex.test(cleanEnglishText)) {
            console.log('检测到中文段落，停止朗读');
            readingManager.completeReading();
            return;
        }
        
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
            
            // 检查是否包含中文段落（连续5个以上中文字符）
            const chineseParagraphRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{5,}/;
            if (chineseParagraphRegex.test(cleanChineseText)) {
                console.log('检测到中文段落，停止朗读');
                readingManager.completeReading();
                return;
            }
            
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
    console.log('stopReading 被调用，当前状态:', {
        isReading: readingManager.isReading,
        isProcessingQueue: readingManager.isProcessingQueue,
        queueLength: readingManager.readingQueue.length,
        currentIndex: readingManager.currentReadingIndex
    });
    
    // 使用朗读管理器停止朗读
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
        // 移除中文段落（连续5个以上中文字符）
        .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{5,}/g, '')
        // 保留更多有用的字符，包括中文和常用符号
        .replace(/[^\w\s\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff.,!?;:'"()\-]/g, '')
        // 将多个空格替换为单个空格
        .replace(/\s+/g, ' ')
        // 移除首尾空格
        .trim();
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