const pdfjsLib = require('pdfjs-dist');
const fs = require('fs');

// Указываем путь к worker'у
const pdfjsWorker = require('pdfjs-dist/build/pdf.worker.entry');
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Обрабатывает PDF файл: извлекает текст и удаляет указанные страницы
 * @param {string} filePath - путь к PDF файлу
 * @param {number} skipFirstPages - количество страниц для пропуска в начале
 * @param {number} skipLastPages - количество страниц для пропуска в конце
 * @returns {Promise<{text: string, wordCount: number}>} обработанный текст и количество слов
 */
async function processPDF(filePath, skipFirstPages = 1, skipLastPages = 0) {
  try {
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл не найден: ${filePath}`);
    }
    
    console.log(`Обработка PDF: ${filePath}`);
    
    // Читаем файл как ArrayBuffer
    const data = new Uint8Array(fs.readFileSync(filePath));
    
    // Загружаем PDF документ
    const pdfDocument = await pdfjsLib.getDocument({ data }).promise;
    const numPages = pdfDocument.numPages;
    
    console.log(`Всего страниц в PDF: ${numPages}`);
    
    // Проверяем параметры пропуска страниц
    if (skipFirstPages + skipLastPages >= numPages) {
      throw new Error('Нельзя пропустить больше страниц, чем есть в документе');
    }
    
    // Определяем диапазон страниц для обработки
    const startPage = Math.min(skipFirstPages + 1, numPages);
    const endPage = Math.max(1, numPages - skipLastPages);
    
    console.log(`Обрабатываем страницы с ${startPage} по ${endPage}`);
    
    let fullText = '';
    
    // Извлекаем текст с каждой страницы
    for (let i = startPage; i <= endPage; i++) {
      console.log(`Обработка страницы ${i} из ${numPages}`);
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      
      // Объединяем все текстовые элементы
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
      
      console.log(`Страница ${i}: извлечено ${pageText.length} символов`);
    }
    
    // Очищаем текст
    const processedText = cleanText(fullText);
    const wordCount = countWords(processedText);
    
    console.log(`Текст после очистки: ${processedText.substring(0, 200)}...`);
    console.log(`Подсчитано слов: ${wordCount}`);
    
    // Удаляем временный файл PDF
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return {
      text: processedText,
      wordCount: wordCount
    };
  } catch (error) {
    console.error('Ошибка при обработке PDF:', error);
    
    // Удаляем временный файл PDF даже при ошибке
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkError) {
        console.error('Ошибка при удалении временного файла:', unlinkError);
      }
    }
    
    throw error;
  }
}

/**
 * Очищает текст от лишних символов и нормализует пробелы
 * @param {string} text - текст для очистки
 * @returns {string} очищенный текст
 */
function cleanText(text) {
  if (!text) return '';
  
  // Заменяем все последовательности пробельных символов на одинарные пробелы
  let cleaned = text.replace(/\s+/g, ' ');
  
  // Удаляем непечатаемые символы
  cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // Обрезаем пробелы в начале и конце
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Подсчитывает слова в тексте
 * @param {string} text - текст для анализа
 * @returns {number} количество слов
 */
function countWords(text) {
  if (!text || text.trim().length === 0) {
    return 0;
  }
  
  // Разделяем на слова по пробелам и фильтруем пустые строки
  const words = text.split(/\s+/).filter(word => {
    return word.length > 0 && /[\p{L}\p{N}]/u.test(word);
  });
  
  return words.length;
}

module.exports = { processPDF, countWords, cleanText };