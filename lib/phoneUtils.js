// lib/phoneUtils.js

/**
 * Normaliza un número de teléfono argentino
 * @param {string} phone - Número de teléfono a normalizar
 * @returns {string} - Número normalizado con código de país
 */
export function normalizeArgentinePhone(phone) {
    if (!phone) return '';

    // Remover todos los caracteres que no sean números
    let cleanPhone = phone.replace(/\D/g, '');

    // Si empieza con 54, mantenerlo
    if (cleanPhone.startsWith('54')) {
        return cleanPhone;
    }

    // Si empieza con 9 (WhatsApp format), removerlo
    if (cleanPhone.startsWith('9')) {
        cleanPhone = cleanPhone.substring(1);
    }

    // Si empieza con 0, removerlo (formato nacional)
    if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
    }

    // Si no tiene código de país, agregarlo
    if (!cleanPhone.startsWith('54')) {
        cleanPhone = '54' + cleanPhone;
    }

    return cleanPhone;
}

/**
 * Valida un número de teléfono argentino
 * @param {string} phone - Número a validar
 * @returns {object} - Resultado de validación
 */
export function validateArgentinePhone(phone) {
    if (!phone || phone.trim() === '') {
        return {
            isValid: false,
            error: 'El teléfono es requerido',
            normalized: '',
        };
    }

    const normalized = normalizeArgentinePhone(phone);

    // Verificar longitud (54 + código de área + número)
    // Mínimo: 54 + 2 + 6 = 10 dígitos
    // Máximo: 54 + 4 + 8 = 16 dígitos
    if (normalized.length < 10 || normalized.length > 16) {
        return {
            isValid: false,
            error: 'Número de teléfono inválido',
            normalized: '',
        };
    }

    // Verificar que empiece con 54
    if (!normalized.startsWith('54')) {
        return {
            isValid: false,
            error: 'Debe incluir código de país argentino (+54)',
            normalized: '',
        };
    }

    return {
        isValid: true,
        error: '',
        normalized: normalized,
    };
}

/**
 * Formatea un número para mostrar
 * @param {string} phone - Número normalizado
 * @returns {string} - Número formateado para mostrar
 */
export function formatPhoneForDisplay(phone) {
    if (!phone) return '';

    const normalized = normalizeArgentinePhone(phone);

    if (normalized.length >= 10) {
        // Formato: +54 11 1234-5678
        const country = normalized.substring(0, 2);
        const area = normalized.substring(2, 4);
        const number = normalized.substring(4);

        if (number.length >= 6) {
            const part1 = number.substring(0, 4);
            const part2 = number.substring(4);
            return `+${country} ${area} ${part1}-${part2}`;
        } else {
            return `+${country} ${area} ${number}`;
        }
    }

    return phone;
}

/**
 * Prepara número para WhatsApp (sin +)
 * @param {string} phone - Número a preparar
 * @returns {string} - Número para WhatsApp
 */
export function formatPhoneForWhatsApp(phone) {
    const normalized = normalizeArgentinePhone(phone);
    return normalized; // WhatsApp usa el formato sin +
}
