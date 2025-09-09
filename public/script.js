document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded and parsed");
    
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const skipFirstPages = document.getElementById('skipFirstPages');
    const skipLastPages = document.getElementById('skipLastPages');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadStatus = document.getElementById('uploadStatus');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analysisProgress = document.getElementById('analysisProgress');
    const analysisSection = document.getElementById('analysisSection');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const tabButtons = document.querySelectorAll('.tab-button');
    
    let currentFileId = null;
    let wordCount = 0;
    
    // Проверяем, что все элементы существуют
    if (!uploadForm || !fileInput || !analyzeBtn) {
        console.error("Не найдены необходимые элементы на странице");
        return;
    }
    
    // Инициализация вкладок
    function initTabs() {
        console.log("Инициализация вкладок");
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                console.log(`Переключение на вкладку: ${tabId}`);
                
                // Деактивируем все вкладки
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));
                
                // Активируем выбранную вкладку
                button.classList.add('active');
                const targetPane = document.getElementById(tabId);
                if (targetPane) {
                    targetPane.classList.add('active');
                } else {
                    console.error(`Вкладка с ID ${tabId} не найдена`);
                }
            });
        });
    }
    
    // Инициализируем вкладки при загрузке
    initTabs();
    
    // Обработчик отправки формы загрузки
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log("Отправка формы загрузки");
        
        if (!fileInput.files[0]) {
            showMessage(uploadStatus, 'Пожалуйста, выберите файл', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('skipFirstPages', skipFirstPages.value);
        formData.append('skipLastPages', skipLastPages.value);
        
        try {
            uploadBtn.disabled = true;
            showMessage(uploadStatus, 'Загрузка и обработка файла...', 'info');
            
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            console.log("Ответ от сервера:", data);
            
            if (response.ok) {
                showMessage(uploadStatus, `Файл успешно загружен. Текст подготовлен для анализа. Символов: ${data.textLength}, слов: ${data.wordCount}`, 'success');
                currentFileId = data.fileId;
                wordCount = data.wordCount;
                analyzeBtn.disabled = false;
                
                // Показываем предупреждение для больших текстов
                if (data.wordCount > 10000) {
                    showMessage(analysisProgress, `Внимание: большой текст (${data.wordCount} слов). Анализ может занять несколько минут.`, 'warning');
                }
                
                // Показываем предупреждение для маленьких текстов
                if (data.wordCount < 10) {
                    showMessage(analysisProgress, `Внимание: текст очень короткий (${data.wordCount} слов). Возможно, PDF не был правильно обработан.`, 'warning');
                }
            } else {
                showMessage(uploadStatus, data.error, 'error');
            }
        } catch (error) {
            console.error("Ошибка при загрузке файла:", error);
            showMessage(uploadStatus, 'Ошибка при загрузке файла: ' + error.message, 'error');
        } finally {
            uploadBtn.disabled = false;
        }
    });
    
    // Обработчик запуска анализа
    analyzeBtn.addEventListener('click', async function() {
        console.log("Запуск анализа");
        
        if (!currentFileId) {
            showMessage(analysisProgress, 'Сначала загрузите файл', 'error');
            return;
        }
        
        try {
            analyzeBtn.disabled = true;
            showMessage(analysisProgress, 'Начинаем анализ... Это может занять несколько минут.', 'info');
            
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fileId: currentFileId })
            });
            
            const data = await response.json();
            console.log("Результаты анализа:", data);
            
            if (response.ok) {
                showMessage(analysisProgress, 'Анализ завершен! Результаты загружаются...', 'success');
                setTimeout(() => {
                    displayResults(data.results);
                }, 100);
            } else {
                showMessage(analysisProgress, data.error, 'error');
            }
        } catch (error) {
            console.error("Ошибка при анализе:", error);
            showMessage(analysisProgress, 'Ошибка при анализе: ' + error.message, 'error');
        } finally {
            analyzeBtn.disabled = false;
        }
    });
    
    // Функция для отображения результатов
    function displayResults(results) {
        console.log("Отображение результатов:", results);
        
        try {
            // Отображаем результаты каждого шага в соответствующей вкладке
            for (const [key, value] of Object.entries(results)) {
                const stepElement = document.getElementById(key);
                if (stepElement) {
                    stepElement.innerHTML = `<div class="step-result">${formatText(value)}</div>`;
                    console.log(`Загружен шаг ${key}`);
                } else {
                    console.warn(`Элемент для шага ${key} не найден`);
                }
            }
            
            // Особо выделяем итоговые результаты (шаг 6)
            const step6Element = document.getElementById('step6');
            if (step6Element && results.step6) {
                step6Element.innerHTML += `<div class="final-results highlight">
                    <h3>Итоговый отчет</h3>
                    ${formatText(results.step6)}
                </div>`;
            }
            
            // Активируем вкладку с итоговыми результатами
            const step6Tab = document.querySelector('[data-tab="step6"]');
            if (step6Tab) {
                step6Tab.click();
            } else {
                // Если вкладка не найдена, активируем первую вкладку
                if (tabButtons.length > 0) {
                    tabButtons[0].click();
                }
            }
            
            // Показываем уведомление о завершении
            showMessage(analysisProgress, 'Анализ завершен! Результаты отображены на вкладках.', 'success');
            
        } catch (error) {
            console.error('Ошибка при отображении результатов:', error);
            showMessage(analysisProgress, 'Ошибка при отображении результатов: ' + error.message, 'error');
        }
    }
    
    // Функция для форматирования текста
    function formatText(text) {
        if (!text) return '<p>Нет данных для отображения</p>';
        
        try {
            // Заменяем переносы строк на HTML-теги
            let formatted = text
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Жирный текст
                .replace(/\*(.*?)\*/g, '<em>$1</em>') // Курсив
                .replace(/## (.*?)<br>/g, '<h3>$1</h3>') // Заголовки
                .replace(/- (.*?)<br>/g, '<li>$1</li>') // Списки
                .replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>') // Обертывание списков
                .replace(/<\/ul><ul>/g, ''); // Удаление лишних оберток
            
            // Обрабатываем таблицы
            formatted = formatted.replace(/\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/g, 
                '<table><tr><td>$1</td><td>$2</td><td>$3</td><td>$4</td><td>$5</td></tr></table>');
            
            return formatted;
        } catch (error) {
            console.error('Ошибка при форматировании текста:', error);
            return `<pre>${text}</pre>`;
        }
    }
    
    // Функция для отображения сообщений
    function showMessage(element, message, type) {
        if (!element) {
            console.error("Элемент для отображения сообщения не найден");
            return;
        }
        
        element.innerHTML = message;
        element.className = type;
    }
    
    // Очистка при закрытии/обновлении страницы
    window.addEventListener('beforeunload', async () => {
        if (currentFileId) {
            try {
                await fetch('/cleanup', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ fileId: currentFileId })
                });
            } catch (error) {
                console.error('Ошибка при очистке файлов:', error);
            }
        }
    });
});