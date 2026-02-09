document.addEventListener('DOMContentLoaded', () => {
    // --- ПРЕСЕТЫ ---
    const PRESETS = [
        { name: "Освещение (LED)", power: 10, hours: 6 },
        { name: "Роутер + ONU", power: 15, hours: 24 },
        { name: "Зарядка телефона", power: 20, hours: 4 },
        { name: "Ноутбук", power: 60, hours: 8 },
        { name: "Телевизор (LED)", power: 100, hours: 4 },
        { name: "Холодильник (инвертор)", power: 100, hours: 12 }, // Усредненно цикл
        { name: "Холодильник (старый)", power: 200, hours: 10 },
        { name: "Газовый котел (насос)", power: 100, hours: 24 },
        { name: "Циркуляционный насос", power: 60, hours: 24 },
        { name: "Микроволновка", power: 1200, hours: 0.3 }, // 20 мин
        { name: "Чайник", power: 2000, hours: 0.2 }, // 12 мин
        { name: "Бойлер", power: 1500, hours: 3 },
        { name: "Скважинный насос", power: 1000, hours: 1 }
    ];

    // --- DOM ЭЛЕМЕНТЫ ---
    const tableBody = document.getElementById('audit_body');
    const selectPreset = document.getElementById('preset_select');
    const btnAddPreset = document.getElementById('btn_add_preset');
    const btnAddEmpty = document.getElementById('btn_add_empty');
    
    // Outputs
    const outPeakRaw = document.getElementById('out_peak_raw');
    const outInvRec = document.getElementById('out_inv_rec');
    const outDailyEnergy = document.getElementById('out_daily_energy');
    
    // Settings
    const inputSim = document.getElementById('val_sim');
    const checkExpert = document.getElementById('check_expert');
    const expertPanel = document.getElementById('expert_panel');

    // --- ИНИЦИАЛИЗАЦИЯ ---
    
    // Заполняем выпадающий список
    PRESETS.forEach((p, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = `${p.name} (${p.power} Вт)`;
        selectPreset.appendChild(opt);
    });

    // Добавляем 2 типичных строки для старта
    addRow(PRESETS[0]); // Свет
    addRow(PRESETS[1]); // Роутер

    // --- ФУНКЦИИ ---

function addRow(data = null) {
        const row = document.createElement('tr');
        
        // Если данные пришли (из пресета или из сохранения), берем их. Иначе дефолт.
        const name = data ? data.name : "Новый прибор";
        const power = data ? data.power : 0;
        const qty = data ? (data.qty || 1) : 1; // Умеем принимать кол-во
        const time = data ? (data.hours || data.time || 1) : 1; // Умеем принимать время

        row.innerHTML = `
            <td><input type="text" class="inp-name" value="${name}"></td>
            <td><input type="number" class="inp-power" value="${power}" min="0"></td>
            <td><input type="number" class="inp-qty" value="${qty}" min="1"></td>
            <td><input type="number" class="inp-time" value="${time}" min="0" step="0.1"></td>
            <td class="cell-total">0</td>
            <td style="text-align: center;">
                <button class="btn-remove" title="Удалить">✖</button>
            </td>
        `;

        row.querySelector('.btn-remove').addEventListener('click', () => {
            row.remove();
            calculate();
        });

        row.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', calculate);
        });

        tableBody.appendChild(row);
        calculate();
    }
    function calculate() {
        let totalPeakRaw = 0; // Сумма мощностей (P * N)
        let totalEnergy = 0;  // Сумма энергии (P * N * T)
        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const power = parseFloat(row.querySelector('.inp-power').value) || 0;
            const qty = parseFloat(row.querySelector('.inp-qty').value) || 0;
            const time = parseFloat(row.querySelector('.inp-time').value) || 0;

            const rowPeak = power * qty;
            const rowEnergy = rowPeak * time;

            // Обновляем ячейку "Итого строка"
            row.querySelector('.cell-total').textContent = Math.round(rowEnergy);

            totalPeakRaw += rowPeak;
            totalEnergy += rowEnergy;
        });

        // === БЛОК 1: ИНВЕРТОР (МОЩНОСТЬ) ===
        // K_sim - коэффициент одновременности
        const k_sim = parseFloat(inputSim.value) || 0.7;
        
        // Реальная пиковая нагрузка (с учетом того, что не все включено сразу)
        const peakSim = totalPeakRaw * k_sim;
        
        // Рекомендуемый инвертор (Запас +20%)
        const invRecWatts = peakSim * 1.2;
        // Перевод в кВт с округлением до 0.5 (например 3.0, 3.5, 5.0)
        let invRecKw = Math.ceil((invRecWatts / 1000) * 2) / 2;
        if (invRecKw < 0.5) invRecKw = 0.5; // Минимум

        outPeakRaw.textContent = `${Math.round(peakSim)} Вт`; // Показываем уже с учетом К-одновременности
        outInvRec.textContent = `${invRecKw.toFixed(1)} кВт`;

        // === БЛОК 2: АКБ (ЭНЕРГИЯ) ===
        // Перевод в кВт*ч
        const energyKwh = totalEnergy / 1000;
        
        outDailyEnergy.textContent = `${energyKwh.toFixed(2)} кВт·ч`;
    }

    // --- СОБЫТИЯ UI ---

    // Кнопка "Добавить из списка"
    btnAddPreset.addEventListener('click', () => {
        const index = selectPreset.value;
        if (index !== "") {
            addRow(PRESETS[index]);
        }
    });

    // Кнопка "Добавить пустую"
    btnAddEmpty.addEventListener('click', () => {
        addRow();
    });

    // Expert Toggle
    checkExpert.addEventListener('change', () => {
        expertPanel.style.display = checkExpert.checked ? 'flex' : 'none';
    });

    // Изменение K_sim
    inputSim.addEventListener('input', calculate);
	// ==========================================
    // ИНТЕГРАЦИЯ: ЭКСПОРТ ДАННЫХ (DATA DONOR)
    // ==========================================
    
    // Кнопка должна быть добавлена в HTML (см. инструкцию ниже, если еще не добавил)
    // <button id="btn_transfer_bat" ...>
    const btnTransferBat = document.getElementById('btn_transfer_bat');

    if (btnTransferBat) {
        btnTransferBat.addEventListener('click', () => {
            // 1. Сбор данных "на лету"
            let totalEnergyWh = 0;
            let totalPeakWattsRaw = 0;
            const k_sim = parseFloat(document.getElementById('val_sim').value) || 0.7;

            // Пробегаем по таблице заново, чтобы гарантировать актуальность
            document.querySelectorAll('#audit_body tr').forEach(row => {
                const power = parseFloat(row.querySelector('.inp-power').value) || 0;
                const qty = parseFloat(row.querySelector('.inp-qty').value) || 0;
                const time = parseFloat(row.querySelector('.inp-time').value) || 0;
                
                const p_total = power * qty;
                totalPeakWattsRaw += p_total;
                totalEnergyWh += (p_total * time);
            });

            // Применяем инженерные коэффициенты
            const peakSim = totalPeakWattsRaw * k_sim; // Реальный пик
            const invRecWatts = peakSim * 1.2;         // Рекомендация для инвертора (+20%)

            // 2. Формирование пакета (Protocol v1.0)
            const projectData = {
                version: "1.0",
                timestamp: new Date().getTime(),
                audit: {
                    total_energy_wh: totalEnergyWh,
                    peak_power_watts: invRecWatts
                }
            };

            // 3. Сохранение (Shared State)
            localStorage.setItem('ecowatt_project', JSON.stringify(projectData));

            // 4. Редирект в модуль АКБ с флагом источника
            window.location.href = 'battery-calc.html?source=audit';
        });
    }
// ==========================================
    // CRM ИНТЕГРАЦИЯ (SAVE / LOAD)
    // ==========================================

    // 1. Слушаем команду "Сохранить" от плавающей кнопки
    document.addEventListener('ecowatt-save-request', () => {
        const rowsData = [];
        // Собираем данные каждой строки
        document.querySelectorAll('#audit_body tr').forEach(row => {
            rowsData.push({
                name: row.querySelector('.inp-name').value,
                power: parseFloat(row.querySelector('.inp-power').value) || 0,
                qty: parseFloat(row.querySelector('.inp-qty').value) || 0,
                time: parseFloat(row.querySelector('.inp-time').value) || 0
            });
        });

        // Формируем пакет данных модуля
        const saveData = {
            rows: rowsData,
            sim_factor: document.getElementById('val_sim').value,
            // Сохраняем и результаты, чтобы в отчете не пересчитывать
            summary: {
                peak: document.getElementById('out_peak_raw').textContent,
                inv: document.getElementById('out_inv_rec').textContent,
                energy: document.getElementById('out_daily_energy').textContent
            }
        };

        // Отправляем в ProjectManager
        if (typeof ProjectManager !== 'undefined') {
            ProjectManager.updateModuleData('audit', saveData);
        }
    });

    // 2. Автозагрузка при старте (если есть активный проект)
    if (typeof ProjectManager !== 'undefined') {
        const active = ProjectManager.getActiveProject();
        const saved = active.data.audit;

        // Если в базе есть сохраненные строки
        if (saved && saved.rows && saved.rows.length > 0) {
            console.log("📥 Восстановление сессии Аудита...");
            
            // 1. Очищаем таблицу (удаляем дефолтные строки)
            tableBody.innerHTML = '';
            
            // 2. Восстанавливаем настройки
            if (saved.sim_factor) document.getElementById('val_sim').value = saved.sim_factor;

            // 3. Создаем строки из памяти
            saved.rows.forEach(rowData => {
                // rowData уже содержит {name, power, qty, time}
                // Наша новая addRow умеет это читать
                addRow(rowData); 
            });
            
            // 4. Принудительный пересчет
            calculate();
        }
    }
});