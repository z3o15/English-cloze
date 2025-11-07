// 公共JavaScript功能文件

// 语音合成对象
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let isReading = false;

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
    const readButtons = document.querySelectorAll('.read-section-btn, .read-directions-btn');
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
    const word = element.textContent;
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
    
    // 发音单词
    speakWord(word);
}

// 发音单个单词
function speakWord(word) {
    // 停止当前正在播放的语音
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    // 清理单词，移除可能导致杂音的字符
    const cleanWord = cleanTextForSpeech(word);
    
    const utterance = new SpeechSynthesisUtterance(cleanWord);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // 添加错误处理
    utterance.onerror = function(event) {
        console.error('语音合成错误:', event.error);
    };
    
    speechSynthesis.speak(utterance);
}

// 朗读指定部分的文本
function readSectionText(button) {
    if (isReading) {
        stopReading();
        return;
    }
    
    // 获取按钮所在部分的文本内容
    let textElement;
    
    // 检查按钮的title属性来确定要朗读的内容
    const buttonTitle = button.getAttribute('title') || '';
    
    // 精确查找策略：根据按钮的位置和类型确定要朗读的内容
    
    // 情况1: 按钮是letter-type（信件类型）内的按钮
    if (button.previousElementSibling && button.previousElementSibling.classList.contains('letter-type')) {
        // 查找按钮父元素的下一个兄弟元素（sentence-pattern）
        const parentDiv = button.parentElement;
        if (parentDiv && parentDiv.nextElementSibling && parentDiv.nextElementSibling.classList.contains('sentence-pattern')) {
            textElement = parentDiv.nextElementSibling;
        }
        // 如果没有找到，查找父级容器内的sentence-pattern
        else {
            const container = button.parentElement;
            textElement = container.querySelector('.sentence-pattern');
        }
    }
    // 情况2: 按钮是标题内的按钮（如"动词词组"、"模板"、"案例"）
    else if (button.parentElement.classList.contains('title') ||
             (button.parentElement.tagName === 'H2' && button.parentElement.classList.contains('title'))) {
        const parentSection = button.closest('.section');
        if (parentSection) {
            if (buttonTitle.includes('动词词组')) {
                // 查找动词词组section内的所有sentence-pattern
                const patterns = parentSection.querySelectorAll('.sentence-pattern');
                if (patterns.length > 0) {
                    // 创建一个包含所有动词词组的文本元素
                    textElement = document.createElement('div');
                    let allText = '';
                    patterns.forEach(pattern => {
                        if (pattern.textContent.trim()) {
                            allText += pattern.textContent.trim() + ' ';
                        }
                    });
                    textElement.textContent = allText;
                }
            } else if (buttonTitle.includes('模板')) {
                textElement = parentSection.querySelector('.format-box');
            } else if (buttonTitle.includes('案例')) {
                textElement = parentSection.querySelector('.english-text');
            }
        }
    }
    // 情况3: 按钮在sentence-pattern内（如主体段必备句型）
    else if (button.parentElement.classList.contains('sentence-pattern')) {
        textElement = button.parentElement;
    }
    // 情况4: 开头段部分的按钮 - 特殊处理
    else if (button.parentElement.classList.contains('section')) {
        const parentSection = button.parentElement;
        // 查找按钮所在letter-type之后的sentence-pattern
        const letterType = button.previousElementSibling;
        if (letterType && letterType.classList.contains('letter-type')) {
            // 找到letter-type之后的第一个sentence-pattern
            let nextElement = letterType.nextElementSibling;
            while (nextElement) {
                if (nextElement.classList.contains('sentence-pattern')) {
                    textElement = nextElement;
                    break;
                }
                nextElement = nextElement.nextElementSibling;
            }
        }
        // 如果没有找到，查找section内的第一个sentence-pattern
        if (!textElement) {
            const firstPattern = parentSection.querySelector('.sentence-pattern');
            if (firstPattern) {
                textElement = firstPattern;
            }
        }
    }
    // 情况5: 信件模板部分的按钮 - 特殊处理
    else if (button.parentElement && button.parentElement.parentElement &&
             button.parentElement.parentElement.classList.contains('section')) {
        const parentSection = button.parentElement.parentElement;
        // 查找按钮父元素的下一个兄弟元素（sentence-pattern）
        const parentDiv = button.parentElement;
        if (parentDiv && parentDiv.nextElementSibling && parentDiv.nextElementSibling.classList.contains('sentence-pattern')) {
            textElement = parentDiv.nextElementSibling;
        }
        // 如果没有找到，使用索引匹配方法
        else {
            // 查找最近的letter-type和对应的sentence-pattern
            const letterTypes = parentSection.querySelectorAll('.letter-type');
            const patterns = parentSection.querySelectorAll('.sentence-pattern');
            
            // 找到按钮对应的letter-type
            let buttonIndex = -1;
            letterTypes.forEach((type, index) => {
                if (type.contains(button) || type.nextElementSibling === button.parentElement) {
                    buttonIndex = index;
                }
            });
            
            // 如果找到了对应的索引，使用相同索引的pattern
            if (buttonIndex >= 0 && patterns[buttonIndex]) {
                textElement = patterns[buttonIndex];
            } else {
                // 备用方案：查找按钮附近的sentence-pattern
                if (button.nextElementSibling && button.nextElementSibling.classList.contains('sentence-pattern')) {
                    textElement = button.nextElementSibling;
                } else {
                    const container = button.parentElement;
                    textElement = container.querySelector('.sentence-pattern');
                }
            }
        }
    }
    // 情况6: 按钮在其他位置，使用通用查找
    else {
        // 查找按钮附近的文本元素
        // 先查找同级的下一个元素
        if (button.nextElementSibling &&
            (button.nextElementSibling.classList.contains('sentence-pattern') ||
             button.nextElementSibling.classList.contains('format-box') ||
             button.nextElementSibling.classList.contains('english-text'))) {
            textElement = button.nextElementSibling;
        }
        // 查找父级容器内的文本元素
        else {
            const container = button.parentElement;
            textElement = container.querySelector('.sentence-pattern') ||
                          container.querySelector('.format-box') ||
                          container.querySelector('.english-text');
        }
    }
    
    // 如果还是没找到，使用最后的备用方案
    if (!textElement) {
        const parentSection = button.closest('.section');
        if (parentSection) {
            // 查找section内所有可能的文本元素
            const candidates = parentSection.querySelectorAll('.sentence-pattern, .format-box, .english-text');
            // 找到第一个非空的候选元素
            for (let candidate of candidates) {
                if (candidate.textContent.trim().length > 0) {
                    textElement = candidate;
                    break;
                }
            }
        }
    }
    
    if (!textElement) {
        console.log('未找到文本元素', button, 'title:', buttonTitle);
        return;
    }
    
    const text = textElement.textContent;
    
    // 清理文本，移除可能导致杂音的字符
    const cleanText = cleanTextForSpeech(text);
    
    // 停止当前正在播放的语音
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    currentUtterance = new SpeechSynthesisUtterance(cleanText);
    currentUtterance.lang = 'en-US';
    currentUtterance.rate = 0.9;
    currentUtterance.pitch = 1;
    currentUtterance.volume = 1;
    
    // 设置朗读开始和结束的事件处理
    currentUtterance.onstart = function() {
        isReading = true;
        button.classList.add('reading');
        console.log('开始朗读:', text);
    };
    
    currentUtterance.onend = function() {
        isReading = false;
        button.classList.remove('reading');
        console.log('朗读结束');
    };
    
    speechSynthesis.speak(currentUtterance);
}

// 朗读写作要求
function readDirections() {
    // 停止当前正在播放的语音
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
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
    
    // 朗读英文部分
    if (englishParts.length > 0) {
        const englishUtterance = new SpeechSynthesisUtterance(englishParts.join(' '));
        englishUtterance.lang = 'en-US';
        englishUtterance.rate = 0.9;
        englishUtterance.pitch = 1;
        englishUtterance.volume = 1;
        speechSynthesis.speak(englishUtterance);
    }
    
    // 朗读中文部分
    if (chineseParts.length > 0) {
        const chineseUtterance = new SpeechSynthesisUtterance(chineseParts.join(''));
        chineseUtterance.lang = 'zh-CN';
        chineseUtterance.rate = 0.9;
        chineseUtterance.pitch = 1;
        chineseUtterance.volume = 1;
        speechSynthesis.speak(chineseUtterance);
    }
}

// 停止朗读
function stopReading() {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        isReading = false;
        // 移除所有按钮的reading状态
        const readingButtons = document.querySelectorAll('.read-section-btn.reading, .read-directions-btn.reading');
        readingButtons.forEach(button => {
            button.classList.remove('reading');
        });
        removeHighlight();
    }
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
        
        if (wordData && wordData.level === level) { // 只显示指定级别
            const translation = document.createElement('span');
            translation.className = 'translation';
            translation.textContent = wordData.translation;
            translation.style.display = 'block';
            wordElement.parentNode.insertBefore(translation, wordElement.nextSibling);
        }
    });
}

// 设置案例部分显示所有超过3个字母的单词的翻译
function setCaseStudyTranslations() {
    const caseSection = document.querySelector('.section .format-box .english-text');
    if (caseSection) {
        const caseWords = caseSection.querySelectorAll('.word');
        caseWords.forEach(wordElement => {
            const word = wordElement.textContent.trim();
            const wordData = EnglishLearningCommon.wordTranslations[word];
            
            // 显示所有超过3个字母的单词的翻译
            if (word.length > 3 && wordData) {
                const translation = document.createElement('span');
                translation.className = 'translation';
                translation.textContent = wordData.translation;
                translation.style.display = 'block';
                wordElement.parentNode.insertBefore(translation, wordElement.nextSibling);
            }
        });
    }
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
        // 移除特殊字符和符号，保留基本标点
        .replace(/[^\w\s.,!?;:'"-]/g, '')
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
    cleanTextForSpeech
};