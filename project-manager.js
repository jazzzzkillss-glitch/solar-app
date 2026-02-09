/**
 * EcoWatt Project Manager Core
 * Отвечает за: LocalStorage, FAB Menu, Session Management
 */

const DB_KEY = 'ecowatt_db_v1';
const ACTIVE_KEY = 'ecowatt_active_project';

// --- 1. УПРАВЛЕНИЕ БАЗОЙ ДАННЫХ ---

const ProjectManager = {
    // Получить все проекты
    getAllProjects: () => {
        const raw = localStorage.getItem(DB_KEY);
        return raw ? JSON.parse(raw) : [];
    },

    // Получить активный проект (сессию)
    getActiveProject: () => {
        const raw = localStorage.getItem(ACTIVE_KEY);
        if (!raw) return ProjectManager.createTemplate("Новый проект");
        return JSON.parse(raw);
    },

    // Создать пустой шаблон
    createTemplate: (name) => {
        return {
            id: Date.now(),
            name: name || "Без названия",
            updatedAt: Date.now(),
            data: {
                audit: {},     // Данные аудита
                battery: {},   // Данные АКБ
                cable: {},     // Данные кабеля
                winter: {}     // Данные VOC
            }
        };
    },

    // Сохранить активную сессию в базу (SAVE)
    saveActiveToDB: () => {
        const active = ProjectManager.getActiveProject();
        active.updatedAt = Date.now(); // Обновляем дату
        
        const projects = ProjectManager.getAllProjects();
        
        // Ищем, есть ли уже такой проект
        const index = projects.findIndex(p => p.id === active.id);
        
        if (index >= 0) {
            projects[index] = active; // Обновляем
        } else {
            projects.push(active); // Добавляем новый
        }

        localStorage.setItem(DB_KEY, JSON.stringify(projects));
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
        
        alert(`✅ Проект "${active.name}" успешно сохранен!`);
    },

    // Загрузить из базы в активную сессию (LOAD)
    loadProject: (id) => {
        const projects = ProjectManager.getAllProjects();
        const target = projects.find(p => p.id == id);
        if (target) {
            localStorage.setItem(ACTIVE_KEY, JSON.stringify(target));
            return true;
        }
        return false;
    },

    // Обновить часть данных в активной сессии (из модулей)
    updateModuleData: (moduleName, data) => {
        const active = ProjectManager.getActiveProject();
        active.data[moduleName] = data;
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
        console.log(`📦 Данные модуля [${moduleName}] обновлены в сессии.`);
    },
    
    // Удалить проект
    deleteProject: (id) => {
        if(!confirm("Вы уверены? Это действие нельзя отменить.")) return;
        let projects = ProjectManager.getAllProjects();
        projects = projects.filter(p => p.id != id);
        localStorage.setItem(DB_KEY, JSON.stringify(projects));
        window.location.reload();
    }
};

// --- 2. ОТРИСОВКА ИНТЕРФЕЙСА (FAB) ---

document.addEventListener('DOMContentLoaded', () => {
    // Не рисуем меню на странице отчета
    if (window.location.pathname.includes('report.html')) return;

    const activeProject = ProjectManager.getActiveProject();
    const isDashboard = window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/');

    // Контейнер
    const fabContainer = document.createElement('div');
    fabContainer.className = 'fab-container';

    // 1. Кнопка "Главная / Меню" (Всегда)
    const btnHome = document.createElement('button');
    btnHome.className = 'fab-btn fab-main';
    btnHome.innerHTML = isDashboard ? '📄' : '🏠'; // Иконка меняется
    btnHome.dataset.tooltip = isDashboard ? 'Новый проект' : 'На главную';
    
    btnHome.addEventListener('click', () => {
        if (isDashboard) {
            // На дашборде это кнопка создания
            const name = prompt("Введите название нового проекта:");
            if (name) {
                const newProj = ProjectManager.createTemplate(name);
                localStorage.setItem(ACTIVE_KEY, JSON.stringify(newProj));
                window.location.reload(); // Перегружаем, чтобы обновилась инфа
            }
        } else {
            // В модулях это кнопка Домой
            window.location.href = 'index.html';
        }
    });

    // 2. Кнопка "Сохранить" (Только внутри модулей)
    if (!isDashboard) {
        const btnSave = document.createElement('button');
        btnSave.className = 'fab-btn';
        btnSave.innerHTML = '💾';
        btnSave.dataset.tooltip = 'Сохранить в базу';
        btnSave.addEventListener('click', () => {
            // 1. Сначала просим модуль отдать свежие данные
            // Генерируем событие, которое должны слушать скрипты модулей
            const event = new CustomEvent('ecowatt-save-request');
            document.dispatchEvent(event);
            
            // 2. Даем небольшую задержку (100мс), чтобы модуль успел записать данные
            setTimeout(() => {
                ProjectManager.saveActiveToDB();
            }, 100);
        });
        fabContainer.appendChild(btnSave);
    }
    
    // 3. Кнопка "Отчет PDF" (Везде, если проект не пустой)
    const btnPdf = document.createElement('button');
    btnPdf.className = 'fab-btn fab-pdf';
    btnPdf.innerHTML = '⎙'; // Принтер
    btnPdf.dataset.tooltip = 'Создать отчет';
    btnPdf.addEventListener('click', () => {
        window.open('report.html', '_blank');
    });
    
    fabContainer.appendChild(btnPdf);
    fabContainer.appendChild(btnHome); // Главная кнопка внизу

    document.body.appendChild(fabContainer);
    
    // --- ИНФО-ПАНЕЛЬ ВВЕРХУ ---
    // Показываем, с каким клиентом работаем
    if (!isDashboard) {
        const infoBar = document.createElement('div');
        infoBar.style.cssText = "position:absolute; top:10px; right:10px; font-size:0.8rem; color:#666; background:#eee; padding:5px 10px; border-radius:15px;";
        infoBar.innerHTML = `Клиент: <b>${activeProject.name}</b>`;
        document.body.appendChild(infoBar);
    }
});