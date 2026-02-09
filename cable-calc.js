document.addEventListener('DOMContentLoaded', () => {
    // --- КОНСТАНТЫ И ТАБЛИЦЫ ---

    // Удельное сопротивление (Ом * мм² / м)
    const RHO = {
        'cu': 0.0175,
        'al': 0.028
    };

    // Стандартные сечения кабелей (мм²)
    const CABLE_SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95];

    // Таблица допустимых токов (Ampacity) для открытой прокладки (упрощенная)
    // Формат: { сечение: ток_А }
    const AMPACITY_CU = {
        1.5: 19, 2.5: 27, 4: 41, 6: 50, 10: 80, 
        16: 100, 25: 140, 35: 170, 50: 215, 70: 270, 95: 330
    };

    const AMPACITY_AL = {
        2.5: 20, 4: 28, 6: 36, 10: 50, 
        16: 65, 25: 85, 35: 105, 50: 135, 70: 165, 95: 200
    };

    // Стандартные номиналы автоматов/предохранителей (А)
    const FUSE_SIZES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250];

    // --- DOM ЭЛЕМЕНТЫ ---
    const btnsToggle = document.querySelectorAll('.toggle-btn');
    const inputSys = document.getElementById('sys_voltage');
    const inputPower = document.getElementById('val_power');
    const inputDist = document.getElementById('val_dist');
    const inputLoss = document.getElementById('val_loss');
    const inputMat = document.getElementById('val_mat');
    
    const labelPower = document.getElementById('label_power');
    
    // Outputs
    const outCable = document.getElementById('out_cable');
    const outCriteria = document.getElementById('out_criteria');
    const outFuse = document.getElementById('out_fuse');
    
    const blockLosses = document.getElementById('block_losses');
    const outLossWatts = document.getElementById('out_loss_watts');
    const outLossMoney = document.getElementById('out_loss_money');

    let inputMode = 'watts'; // 'watts' or 'amps'

    // --- ЛОГИКА UI ---

    // Переключатель Ватты / Амперы
    btnsToggle.forEach(btn => {
        btn.addEventListener('click', () => {
            btnsToggle.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            inputMode = btn.dataset.mode;
            
            if (inputMode === 'watts') {
                labelPower.textContent = 'Мощность нагрузки [Вт]';
                inputPower.placeholder = 'Например: 3000';
            } else {
                labelPower.textContent = 'Сила тока [А]';
                inputPower.placeholder = 'Например: 60';
            }
            calculate();
        });
    });

    // --- РАСЧЕТНОЕ ЯДРО ---

    function calculate() {
        // 1. Сбор данных
        const U_sys = parseFloat(inputSys.value);
        const val_in = parseFloat(inputPower.value) || 0;
        const L_one_way = parseFloat(inputDist.value) || 0;
        const loss_percent = parseFloat(inputLoss.value);
        const mat = inputMat.value; // 'cu' or 'al'
        
        if (val_in <= 0 || L_one_way <= 0) {
            outCable.textContent = "-- mm²";
            outCriteria.textContent = "";
            outFuse.textContent = "-- A";
            blockLosses.style.display = 'none';
            return;
        }

        // 2. Определение тока (I)
        let I_load = 0;
        if (inputMode === 'watts') {
            I_load = val_in / U_sys;
        } else {
            I_load = val_in;
        }

        // 3. Подбор защиты (Автомат/Предохранитель)
        // Правило: Запас +25% от рабочего тока, округление до стандарта вверх
        const I_target_fuse = I_load * 1.25;
        // Ищем ближайший стандартный номинал >= расчетного
        let fuse_rating = FUSE_SIZES.find(f => f >= I_target_fuse);
        if (!fuse_rating) fuse_rating = FUSE_SIZES[FUSE_SIZES.length - 1]; // Берем макс если за шкалой
        
        // Если ток нагрузки больше максимального предохранителя в списке - предупреждаем (но считаем)
        if (I_load > 250) fuse_rating = Math.ceil(I_target_fuse / 10) * 10; 

        // 4. Расчет сечения по НАГРЕВУ (Thermal)
        // Кабель должен держать ток ПРЕДОХРАНИТЕЛЯ, а не нагрузки!
        const ampacity_table = (mat === 'cu') ? AMPACITY_CU : AMPACITY_AL;
        let S_thermal = 0;
        
        // Ищем первое сечение, где допустимый ток >= номинала автомата
        for (const [s, i_max] of Object.entries(ampacity_table)) {
            if (i_max >= fuse_rating) {
                S_thermal = parseFloat(s);
                break;
            }
        }
        // Если не нашли (ток слишком большой)
        if (S_thermal === 0) S_thermal = 95; 

        // 5. Расчет сечения по ПАДЕНИЮ напряжения (Voltage Drop)
        // Formula: S = (2 * L * I * rho) / delta_U
        const delta_U_allowed = U_sys * (loss_percent / 100);
        const rho = RHO[mat];
        const L_total = 2 * L_one_way; // Туда и обратно
        
        const S_drop_calc = (L_total * I_load * rho) / delta_U_allowed;
        
        // Округляем до ближайшего стандарта вверх
        let S_drop = CABLE_SIZES.find(s => s >= S_drop_calc);
        if (!S_drop) S_drop = 95; // Максимум

        // 6. Итоговый выбор (Худший сценарий)
        let S_final = Math.max(S_thermal, S_drop);
        let reason = "";

        if (S_drop > S_thermal) {
            reason = `Лимитировано потерями напряжения (расчет ${S_drop_calc.toFixed(1)} мм²)`;
        } else {
            reason = `Лимитировано током защиты (нужно держать ${fuse_rating} А)`;
        }

        // Если вышли за 95 квадрат
        if (S_drop_calc > 95 || (I_load * 1.25) > 330) {
            outCable.textContent = "> 95 mm²";
            outCriteria.textContent = "Требуется шина или параллельная прокладка";
            outFuse.textContent = `${fuse_rating} A`;
            blockLosses.style.display = 'none';
            return;
        }

        // 7. Расчет потерь (Sales Tool)
        // R = (2 * L * rho) / S
        const R_final = (2 * L_one_way * rho) / S_final;
        const P_loss = Math.pow(I_load, 2) * R_final;
        
        // Считаем потери для "тонкого" кабеля (чисто по нагреву, без запаса)
        // Чтобы показать клиенту разницу
        const S_bad = S_thermal; // Минимально допустимый
        let P_loss_bad = 0;
        if (S_bad < S_final) {
            const R_bad = (2 * L_one_way * rho) / S_bad;
            P_loss_bad = Math.pow(I_load, 2) * R_bad;
        }

        // 8. Вывод результатов
        outCable.textContent = `${S_final} mm²`;
        outCriteria.textContent = reason;
        outFuse.textContent = `${fuse_rating} A`;

        // Блок потерь
        blockLosses.style.display = 'block';
        outLossWatts.textContent = `${P_loss.toFixed(1)} Вт`;
        
        // Считаем энергию за 10 часов работы (кВт*ч)
        const energy_loss = (P_loss * 10) / 1000;
        
        if (S_bad < S_final && P_loss_bad > 0) {
            // Если мы заставили купить кабель толще
            const diff = P_loss_bad - P_loss;
            outLossMoney.innerHTML = `Экономия по сравнению с ${S_bad}мм²: <span class="loss-good">${diff.toFixed(1)} Вт</span> (тепла)`;
        } else {
            // Если кабель и так минимальный
            outLossMoney.innerHTML = `Потери за 10ч работы: <b>${energy_loss.toFixed(2)} кВт·ч</b>`;
        }
    }

    // Слушатели событий
    const inputs = [inputSys, inputPower, inputDist, inputLoss, inputMat];
    inputs.forEach(el => el.addEventListener('input', calculate));
	// ==========================================
    // ИНТЕГРАЦИЯ: ИМПОРТ МОЩНОСТИ
    // ==========================================
    
    (function initFromProject() {
        const rawJson = localStorage.getItem('ecowatt_project');
        if (!rawJson) return;

        try {
            const data = JSON.parse(rawJson);
            
            // Проверка свежести (12 часов)
            const MAX_AGE = 12 * 60 * 60 * 1000;
            if (new Date().getTime() - data.timestamp > MAX_AGE) return;

            const watts = data.audit.peak_power_watts;
            
            if (watts > 0) {
                // 1. Переключаем в режим Ватт
                btnsToggle.forEach(b => b.classList.remove('active'));
                const btnWatt = document.querySelector('.toggle-btn[data-mode="watts"]');
                if (btnWatt) btnWatt.classList.add('active');
                
                inputMode = 'watts';
                labelPower.textContent = 'Мощность нагрузки [Вт]';

                // 2. Заполняем значение
                inputPower.value = Math.round(watts);

                // 3. Добавляем метку источника
                // Проверяем, нет ли уже метки, чтобы не дублировать
                if (!labelPower.querySelector('.source-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'source-badge';
                    badge.style.cssText = "color: #27ae60; font-size: 0.8em; margin-left: 5px; font-weight: normal;";
                    badge.innerHTML = "(из Аудита)";
                    labelPower.appendChild(badge);
                }

                // 4. Считаем
                calculate();
            }

        } catch (e) {
            console.error("Ошибка импорта в Cable Calc", e);
        }
    })();
	// ==========================================
    // CRM ИНТЕГРАЦИЯ (SAVE)
    // ==========================================
    
    document.addEventListener('ecowatt-save-request', () => {
        const saveData = {
            voltage: document.getElementById('sys_voltage').value,
            power: document.getElementById('val_power').value,
            dist: document.getElementById('val_dist').value,
            mat: document.getElementById('val_mat').value,
            // Результаты
            cable_size: document.getElementById('out_cable').textContent,
            fuse: document.getElementById('out_fuse').textContent,
            loss: document.getElementById('out_loss_watts').textContent
        };

        if (typeof ProjectManager !== 'undefined') {
            ProjectManager.updateModuleData('cable', saveData);
        }
    });
});