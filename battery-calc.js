document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. КОНФИГУРАЦИЯ БИЗНЕС-ЛОГИКИ
    // ==========================================
    
    const BATTERY_PRESETS = {
        'agm': 0.50,
        'gel': 0.50,
        'lfp': 0.80,
        'lfp_pro': 0.90
    };

    // Коммерческий запас емкости при подборе (1.15 = +15%)
    const SAFETY_MARGIN = 1.15; 
    
    // Реальные рыночные номиналы (Ah)
    const STANDARD_CAPACITIES = {
        'agm': [45, 55, 65, 75, 100, 120, 150, 200, 250],
        'gel': [45, 55, 65, 75, 100, 120, 150, 200, 250],
        'lfp': [50, 100, 105, 200, 230, 280, 300],
        'lfp_pro': [50, 100, 200, 300, 400, 500]
    };

    // ==========================================
    // 2. ЭЛЕМЕНТЫ DOM
    // ==========================================
    const tabs = document.querySelectorAll('.tab-btn');
    const sections = {
        mode1: document.getElementById('section-mode-1'), 
        mode2: document.getElementById('section-mode-2') 
    };
    
    const inputType = document.getElementById('bat_type');
    const inputVoltage = document.getElementById('sys_voltage');
    const inputLoad = document.getElementById('load_watts');
    
    const checkExpert = document.getElementById('expert_check');
    const expertBox = document.getElementById('expert_box');
    const inputDod = document.getElementById('val_dod');
    const inputEff = document.getElementById('val_eff');

    const inputCapacity = document.getElementById('val_capacity'); // Mode 1
    const inputTargetTime = document.getElementById('val_target_time'); // Mode 2

    const outMain = document.getElementById('res_main');
    const outSub = document.getElementById('res_sub');

    let currentMode = 1; 

    // ==========================================
    // 3. ЛОГИКА UI
    // ==========================================

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentMode = parseInt(tab.dataset.mode);
            
            if (currentMode === 1) {
                sections.mode1.classList.remove('hidden');
                sections.mode2.classList.add('hidden');
            } else {
                sections.mode1.classList.add('hidden');
                sections.mode2.classList.remove('hidden');
            }
            calculate();
        });
    });

    checkExpert.addEventListener('change', () => {
        if (checkExpert.checked) {
            expertBox.classList.add('show');
        } else {
            expertBox.classList.remove('show');
            updateDoDFromType(); 
            inputEff.value = 0.9;
        }
        calculate();
    });

    inputType.addEventListener('change', () => {
        updateDoDFromType();
        calculate();
    });

    // Слушатели ввода на все поля
    const allInputs = document.querySelectorAll('input, select');
    allInputs.forEach(el => el.addEventListener('input', calculate));

    function updateDoDFromType() {
        const type = inputType.value;
        if (BATTERY_PRESETS[type]) {
            inputDod.value = BATTERY_PRESETS[type];
        }
    }

    // ==========================================
    // 4. МАТЕМАТИЧЕСКОЕ ЯДРО
    // ==========================================

    function calculate() {
        const V = parseFloat(inputVoltage.value) || 12;
        const P_load = parseFloat(inputLoad.value) || 0;
        const DoD = parseFloat(inputDod.value) || 0.5;
        const Eta = parseFloat(inputEff.value) || 0.9;

        if (P_load <= 0) {
            outMain.textContent = "--";
            outSub.textContent = "Введите нагрузку (Вт)";
            return;
        }

        if (currentMode === 1) {
            // === РЕЖИМ 1: РАСЧЕТ ВРЕМЕНИ ===
            const C = parseFloat(inputCapacity.value) || 0;
            
            if (C <= 0) {
                outMain.textContent = "--";
                return;
            }

            const E_total = V * C; 
            const E_usable = E_total * DoD * Eta; 
            const T_hours = E_usable / P_load; 

            // Расчет времени (исправленный баг с 60 мин)
            const totalMinutes = Math.floor(T_hours * 60);
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;

            outMain.textContent = `${h} ч ${m} мин`;
            outSub.textContent = `Доступно энергии: ${Math.round(E_usable)} Вт·ч`;

        } else {
            // === РЕЖИМ 2: ПОДБОР АКБ ===
            const T_target = parseFloat(inputTargetTime.value) || 0;

            if (T_target <= 0) {
                outMain.textContent = "--";
                return;
            }

            // 1. Чистая потребность
            const E_needed_usable = P_load * T_target;
            const E_needed_total = E_needed_usable / (DoD * Eta);
            const C_pure = E_needed_total / V;

            // 2. Добавляем коммерческий запас
            const C_required = C_pure * SAFETY_MARGIN;

            // 3. Подбор из рыночных стандартов
            const type = inputType.value;
            const standards = STANDARD_CAPACITIES[type] || [];
            
            let recommended = standards.find(cap => cap >= C_required);
            
            if (!recommended) {
                recommended = Math.ceil(C_required / 10) * 10;
            }

            outMain.textContent = `~ ${Math.ceil(C_required)} Ah`;
            outSub.textContent = `Рекомендуем стандарт: ${recommended} Ah (с запасом +15%)`;
        }
    }

    // ==========================================
    // 5. ИНТЕГРАЦИЯ: ИМПОРТ ДАННЫХ (DATA ACCEPTOR)
    // ==========================================

    function checkImport() {
        const urlParams = new URLSearchParams(window.location.search);
        const isFromAudit = urlParams.get('source') === 'audit';
        
        const rawJson = localStorage.getItem('ecowatt_project');
        if (!rawJson) return;

        try {
            const data = JSON.parse(rawJson);
            
            // Safety Check 1: Версия протокола
            if (data.version !== "1.0") return;

            // Safety Check 2: Устаревание данных (12 часов)
            const MAX_AGE = 12 * 60 * 60 * 1000; 
            if (new Date().getTime() - data.timestamp > MAX_AGE) return;

            // Если пришли по ссылке из аудита и данные валидны
            if (isFromAudit && data.audit.total_energy_wh > 0) {
                applyAuditData(data.audit.total_energy_wh);
            }

        } catch (e) {
            console.error("Ошибка чтения данных проекта", e);
        }
    }

    function applyAuditData(energyWh) {
        // 1. Переключаем на вкладку "Подбор АКБ"
        if (tabs[1]) tabs[1].click();

        // 2. Математическая декомпозиция (Сутки автономии)
        const targetHours = 24;
        const calcLoad = Math.round(energyWh / targetHours);

        // 3. Заполняем поля
        inputTargetTime.value = targetHours;
        inputLoad.value = calcLoad;

        // 4. Добавляем уведомление (UI Feedback)
        const container = document.querySelector('.card-content');
        
        // Удаляем старое уведомление, если есть (чтобы не дублировать)
        const oldAlert = container.querySelector('.audit-alert');
        if (oldAlert) oldAlert.remove();

        const alertBox = document.createElement('div');
        alertBox.className = 'audit-alert';
        alertBox.style.cssText = `
            background: #e3f2fd; 
            border-left: 4px solid #2196f3; 
            padding: 10px 15px; 
            margin-bottom: 20px; 
            border-radius: 4px; 
            font-size: 0.9rem; 
            color: #0d47a1;
        `;
        alertBox.innerHTML = `
            <strong>🔄 Данные из Аудита загружены</strong><br>
            Суточная энергия: <b>${(energyWh/1000).toFixed(2)} кВт·ч</b>.<br>
            Расчет выполнен для <b>24 часов</b> автономной работы.
        `;
        container.insertBefore(alertBox, container.firstChild);

        // 5. Запускаем пересчет
        calculate();
    }

    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ==========================================
    
    // Сначала ставим дефолтный DoD
    updateDoDFromType();
    
    // Проверяем, есть ли импорт (если да - он перепишет значения и пересчитает)
    checkImport();

    // Если импорта не было, считаем с дефолтными значениями (чтобы не было пусто)
    if (!document.querySelector('.audit-alert')) {
        calculate();
    }
	// ==========================================
    // CRM ИНТЕГРАЦИЯ (SAVE)
    // ==========================================
    
    // Слушаем запрос на сохранение
    document.addEventListener('ecowatt-save-request', () => {
        const mode = document.querySelector('.tab-btn.active').dataset.mode;
        
        const saveData = {
            mode: mode, // 1 = Время, 2 = Емкость
            // Сохраняем вводы
            capacity: document.getElementById('val_capacity').value,
            target_time: document.getElementById('val_target_time').value,
            load: document.getElementById('load_watts').value,
            type: document.getElementById('bat_type').value,
            voltage: document.getElementById('sys_voltage').value,
            // Сохраняем результаты
            result_main: document.getElementById('res_main').textContent,
            result_sub: document.getElementById('res_sub').textContent
        };

        if (typeof ProjectManager !== 'undefined') {
            ProjectManager.updateModuleData('battery', saveData);
        }
    });
});