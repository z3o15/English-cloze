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
    
    // 清理单词，移除可能导致杂音的字符
    const cleanWord = cleanTextForSpeech(word);
    
    // 检查单词是否为空或只有标点
    if (!cleanWord || cleanWord.trim().length === 0) {
        console.log('跳过空单词或标点符号:', word);
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
        // 重置状态
        isReading = false;
    };
    
    // 添加结束处理，确保状态正确重置
    utterance.onend = function() {
        // 单词发音不需要重置isReading状态，因为这是点击事件
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
    let textElement = null;
    
    // 检查按钮的title属性来确定要朗读的内容
    const buttonTitle = button.getAttribute('title') || '';
    const buttonText = button.parentElement ? button.parentElement.textContent.trim() : '';
    
    // 使用更精确的查找策略
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
    
    // 停止当前正在播放的语音
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    // 检查文本长度，如果太长则分段处理
    const maxLength = 200; // 设置最大长度限制
    if (cleanText.length > maxLength) {
        // 分段朗读长文本
        speakLongText(cleanText, button);
    } else {
        // 朗读短文本
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
}

// 精确查找按钮对应的文本元素
function findTextElementForButton(button, buttonTitle, buttonText) {
    let textElement = null;
    
    // 检测当前页面类型
    const isChartPage = window.location.pathname.includes('chart');
    const isLetterPage = window.location.pathname.includes('letter');
    
    // 策略1: 特殊处理"引出图表句型"按钮
    if (buttonTitle.includes('引出图表句型') || buttonText.includes('引出图表句型')) {
        // 查找按钮父元素（content-title）之后的english-expression元素
        const contentTitle = button.parentElement;
        let nextElement = contentTitle.nextElementSibling;
        
        // 查找紧邻的english-expression元素，只读取第一个english-expression
        while (nextElement) {
            if (nextElement.classList.contains('english-expression')) {
                textElement = nextElement;
                console.log('找到引出图表句型对应的english-expression元素');
                break;
            }
            // 如果遇到另一个content-title，停止查找
            if (nextElement.classList.contains('content-title')) {
                break;
            }
            nextElement = nextElement.nextElementSibling;
        }
        
        return textElement;
    }
    
    // 策略2: 处理图表页面的按钮
    if (isChartPage) {
        // 情况2.1: 按钮在content-title内
        if (button.parentElement.classList.contains('content-title')) {
            // 查找同级的下一个content-box
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
                    // 如果没有下一个，查找当前content-box内的english-text
                    const englishText = parentContentBox.querySelector('.english-text');
                    if (englishText) {
                        textElement = englishText;
                    } else {
                        // 最后备用方案：使用当前content-box
                        textElement = parentContentBox;
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
                    console.log('找到范文部分的多个english-text元素，已合并内容');
                }
            }
        }
        // 情况2.4: 其他位置的按钮
        else {
            // 先尝试查找最近的content-box
            const nearestContentBox = button.closest('.content-box');
            if (nearestContentBox) {
                const englishText = nearestContentBox.querySelector('.english-text');
                if (englishText) {
                    textElement = englishText;
                } else {
                    textElement = nearestContentBox;
                }
            } else {
                // 如果不在content-box内，查找父级容器内的文本元素
                const container = button.parentElement;
                textElement = container.querySelector('.content-box') ||
                              container.querySelector('.format-box') ||
                              container.querySelector('.english-text');
            }
        }
        
        return textElement;
    }
    
    // 策略3: 处理书信页面的按钮
    if (isLetterPage) {
        // 情况3.1: 按钮在content-title内
        if (button.parentElement.classList.contains('content-title')) {
            // 特殊处理：动词词组
            if (buttonTitle.includes('动词词组')) {
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
                        console.log('找到案例部分的english-text元素');
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
                    console.log('使用备用方案找到文本元素:', candidate);
                    break;
                }
            }
        }
    }
    
    return textElement;
}

// 分段朗读长文本
function speakLongText(text, button) {
    try {
        // 将文本按句子分割
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let currentIndex = 0;
        
        function speakNextSentence() {
            try {
                if (currentIndex >= sentences.length) {
                    // 所有句子朗读完毕
                    isReading = false;
                    button.classList.remove('reading');
                    console.log('长文本朗读结束');
                    return;
                }
                
                const sentence = sentences[currentIndex].trim();
                if (sentence.length === 0) {
                    currentIndex++;
                    speakNextSentence();
                    return;
                }
                
                const utterance = new SpeechSynthesisUtterance(sentence);
                utterance.lang = 'en-US';
                utterance.rate = 0.9;
                utterance.pitch = 1;
                utterance.volume = 1;
                
                // 添加错误处理
                utterance.onerror = function(event) {
                    console.error('长文本朗读句子时出错:', event.error, '句子:', sentence);
                    // 继续下一句
                    currentIndex++;
                    setTimeout(speakNextSentence, 100);
                };
                
                utterance.onend = function() {
                    currentIndex++;
                    // 添加短暂延迟，使朗读更自然
                    setTimeout(speakNextSentence, 300);
                };
                
                // 第一句开始时设置按钮状态
                if (currentIndex === 0) {
                    isReading = true;
                    button.classList.add('reading');
                    console.log('开始长文本朗读:', text);
                }
                
                speechSynthesis.speak(utterance);
            } catch (error) {
                console.error('朗读句子时出错:', error, '句子:', sentences[currentIndex]);
                // 继续下一句
                currentIndex++;
                setTimeout(speakNextSentence, 100);
            }
        }
        
        speakNextSentence();
    } catch (error) {
        console.error('长文本朗读时出错:', error, '文本:', text);
        // 重置状态
        isReading = false;
        button.classList.remove('reading');
    }
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
        const readingButtons = document.querySelectorAll('.read-btn.reading, .read-section-btn.reading, .read-directions-btn.reading');
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
    cleanTextForSpeech
};