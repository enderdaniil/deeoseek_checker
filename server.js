require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processPDF } = require('./utils/pdfProcessor');
const { analyzeWithDeepSeek } = require('./utils/deepseek'); // Добавлен импорт

const app = express();
const PORT = process.env.PORT || 3000;

// Создаем папку uploads если ее нет
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка загрузки файлов - используем простые имена без кириллицы
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя без оригинального названия
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.pdf';
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Только PDF файлы разрешены'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Маршруты
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    console.log(`Загружен файл: ${req.file.filename}`);
    
    const skipFirstPages = parseInt(req.body.skipFirstPages) || 1;
    const skipLastPages = parseInt(req.body.skipLastPages) || 0;
    
    console.log(`Пропуск первых страниц: ${skipFirstPages}, последних: ${skipLastPages}`);
    
    const result = await processPDF(
      req.file.path, 
      skipFirstPages, 
      skipLastPages
    );
    
    // Проверяем, что текст не пустой
    if (!result.text || result.text.trim().length === 0) {
      throw new Error('Извлеченный текст пуст. Возможно, PDF содержит только изображения или защищен от копирования.');
    }
    
    // Сохраняем извлеченный текст во временный файл
    const textFilePath = req.file.path + '.txt';
    fs.writeFileSync(textFilePath, result.text, 'utf8');
    
    console.log(`Текст сохранен в: ${textFilePath}`);
    console.log(`Длина текста: ${result.text.length} символов`);
    console.log(`Количество слов: ${result.wordCount}`);
    
    res.json({ 
      success: true, 
      fileId: req.file.filename,
      textLength: result.text.length,
      wordCount: result.wordCount
    });
  } catch (error) {
    console.error('Ошибка при загрузке файла:', error);
    
    // Удаляем временные файлы при ошибке
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: error.message });
  }
});

app.post('/analyze', async (req, res) => {
  try {
    const { fileId } = req.body;
    
    if (!fileId) {
      return res.status(400).json({ error: 'ID файла не указан' });
    }
    
    const textFilePath = path.join('uploads', fileId + '.txt');
    if (!fs.existsSync(textFilePath)) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    const text = fs.readFileSync(textFilePath, 'utf8');
    
    console.log(`Анализ файла: ${fileId}`);
    console.log(`Длина текста для анализа: ${text.length} символов`);
    
    if (!text || text.trim().length === 0) {
      console.log('Текст для анализа отсутствует или пустой');
      return res.status(400).json({ error: 'Текст для анализа отсутствует' });
    }
    
    // Вызываем функцию анализа с DeepSeek
    const analysisResults = await analyzeWithDeepSeek(text);
    
    res.json({ 
      success: true, 
      results: analysisResults 
    });
  } catch (error) {
    console.error('Ошибка при анализе:', error);
    res.status(500).json({ error: error.message });
  }
});

// Очистка временных файлов
app.delete('/cleanup', async (req, res) => {
  try {
    const { fileId } = req.body;
    
    if (fileId) {
      const filePath = path.join('uploads', fileId);
      const textFilePath = path.join('uploads', fileId + '.txt');
      
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(textFilePath)) fs.unlinkSync(textFilePath);
      
      console.log(`Очищены файлы для: ${fileId}`);
    } else {
      // Очищаем всю папку uploads
      const files = fs.readdirSync('uploads');
      for (const file of files) {
        fs.unlinkSync(path.join('uploads', file));
      }
      console.log('Очищена вся папка uploads');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при очистке:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});