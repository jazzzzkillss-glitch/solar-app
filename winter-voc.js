document.addEventListener('DOMContentLoaded', () => {
    // КОНСТАНТЫ
    const IEC_TEMP = -25; // Стандарт IEC 62548

    const inputs = {
        voc: document.getElementById('voc_stc'),
        coef: document.getElementById('t_coef'),
        tmin: document.getElementById('t_min'),
        n_panels: document.getElementById('n_panels'),
        vmax: document.getElementById('vmax_inv')
    };

    const outputs = {
        delta_t: document.getElementById('out_delta_t'),
        growth: document.getElementById('out_growth'),
        v_panel: document.getElementById('out_v_panel'),
        v_string: document.getElementById('out_v_string'),
        status: document.getElementById('status_box'),
        // Новые выводы для IEC
        v_string_iec: document.getElementById('out_v_string_iec'),
        status_iec: document.getElementById('status_box_iec')
    };

    function parseInput(val) {
        if (!val) return 0;
        let normalized = val.toString().replace(/,/g, '.').replace(/[^\d.-]/g, '');
        let num = parseFloat(normalized);
        return isNaN(num) ? 0 : num;
    }

    function calculate() {
        // --- 1. Сбор данных ---
        const voc_stc = parseInput(inputs.voc.value);
        let t_coef = parseInput(inputs.coef.value);
        const t_min_user = parseInput(inputs.tmin.value); 
        const n = parseInput(inputs.n_panels.value);
        const vmax_inv = parseInput(inputs.vmax.value);

        // Валидация коэффициента (всегда отрицательный)
        t_coef = -Math.abs(t_coef);

        // --- 2. Пользовательский расчет (фактический) ---
        const delta_t_user = t_min_user - 25; 
        const growth_factor_user = (t_coef / 100) * delta_t_user;
        const v_panel_user = voc_stc * (1 + growth_factor_user);
        const v_string_user = v_panel_user * n;

        // --- 3. Расчет по IEC 62548 (-25°C) ---
        const delta_t_iec = IEC_TEMP - 25; // Всегда -50
        const growth_factor_iec = (t_coef / 100) * delta_t_iec;
        const v_panel_iec = voc_stc * (1 + growth_factor_iec);
        const v_string_iec = v_panel_iec * n;

        // --- 4. Вывод результатов ---
        
        // Пользовательский блок
        outputs.delta_t.textContent = `${delta_t_user} °C`;
        outputs.growth.textContent = `+${(growth_factor_user * 100).toFixed(2)}%`;
        outputs.v_panel.textContent = `${v_panel_user.toFixed(2)} В`;
        outputs.v_string.textContent = `${v_string_user.toFixed(1)} В`;
        
        // IEC блок
        outputs.v_string_iec.textContent = `${v_string_iec.toFixed(1)} В`;

        // --- 5. Статусы и Проверки ---
        // Проверяем фактический расчет
        updateStatusBox(outputs.status, v_string_user, vmax_inv, "Расчетное значение");
        
        // Проверяем IEC расчет
        updateStatusBox(outputs.status_iec, v_string_iec, vmax_inv, "Норматив IEC");
    }

    // Универсальная функция статусов с профессиональными формулировками
    function updateStatusBox(boxElement, currentVolt, maxVolt, labelContext) {
        boxElement.className = 'status-box'; 
        boxElement.style.display = 'none';

        if (maxVolt <= 0 || currentVolt <= 0) return;

        boxElement.style.display = 'block';

        if (currentVolt > maxVolt) {
            // ПРЕВЫШЕНИЕ
            const diff = (currentVolt - maxVolt).toFixed(1);
            boxElement.classList.add('status-danger');
            boxElement.innerHTML = `⚠ <b>Превышение допустимого V<sub>max</sub></b><br>
                                    ${labelContext}: ${currentVolt.toFixed(1)} В > ${maxVolt} В (+${diff} В)`;
        } else {
            // ПРОВЕРКА ЗАПАСА
            const margin = maxVolt - currentVolt;
            const marginPercent = (margin / maxVolt) * 100;

            if (marginPercent < 5) {
                // РИСК (Желтый)
                boxElement.classList.add('status-warning');
                boxElement.innerHTML = `⚠ <b>Низкий запас по напряжению (<5%)</b><br>
                                        Рекомендуется пересмотреть конфигурацию стринга.`;
            } else {
                // НОРМА (Зеленый)
                boxElement.classList.add('status-ok');
                boxElement.innerHTML = `✔ <b>В пределах нормы</b><br>
                                        Запас: ${margin.toFixed(1)} В (${marginPercent.toFixed(1)}%)`;
            }
        }
    }

    Object.values(inputs).forEach(input => {
        input.addEventListener('input', calculate);
    });
});