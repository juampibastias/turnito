// components/PhoneInput.js
'use client';
import { useState, useEffect } from 'react';
import {
    validateArgentinePhone,
    formatPhoneForDisplay,
} from '../lib/phoneUtils';

export default function PhoneInput({
    value,
    onChange,
    className = '',
    required = false,
}) {
    const [displayValue, setDisplayValue] = useState('');
    const [validation, setValidation] = useState({ isValid: true, error: '' });
    const [isTouched, setIsTouched] = useState(false);

    useEffect(() => {
        if (value) {
            setDisplayValue(formatPhoneForDisplay(value));
        }
    }, []);

    const handleChange = (e) => {
        const inputValue = e.target.value;
        setDisplayValue(inputValue);
        setIsTouched(true);

        // Validar el número
        const validationResult = validateArgentinePhone(inputValue);
        setValidation(validationResult);

        // Enviar el número normalizado al componente padre
        if (validationResult.isValid) {
            onChange(validationResult.normalized);
        } else {
            onChange(inputValue); // Enviar el valor original si no es válido
        }
    };

    const handleBlur = () => {
        setIsTouched(true);
        if (displayValue && validation.isValid) {
            // Formatear para mostrar cuando pierde el foco
            setDisplayValue(formatPhoneForDisplay(validation.normalized));
        }
    };

    const showError = isTouched && !validation.isValid && displayValue;

    return (
        <div>
            <label className='block mb-2 text-sm font-medium text-gray-800'>
                Teléfono {required && '*'}
            </label>
            <input
                type='tel'
                value={displayValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-4 py-3 text-gray-800 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
                    showError
                        ? 'border-red-300 bg-red-50'
                        : validation.isValid && isTouched && displayValue
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300'
                } ${className}`}
                placeholder='+54 11 1234-5678'
                required={required}
            />

            {/* Mensaje de ayuda */}
            {!isTouched && (
                <p className='mt-1 text-xs text-gray-500'>
                    Formato: +54 11 1234-5678 (código de área + número)
                </p>
            )}

            {/* Mensaje de error */}
            {showError && (
                <p className='flex items-center mt-1 text-xs text-red-600'>
                    <svg
                        className='w-4 h-4 mr-1'
                        fill='currentColor'
                        viewBox='0 0 20 20'
                    >
                        <path
                            fillRule='evenodd'
                            d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
                            clipRule='evenodd'
                        />
                    </svg>
                    {validation.error}
                </p>
            )}

            {/* Mensaje de éxito */}
            {validation.isValid && isTouched && displayValue && (
                <p className='flex items-center mt-1 text-xs text-green-600'>
                    <svg
                        className='w-4 h-4 mr-1'
                        fill='currentColor'
                        viewBox='0 0 20 20'
                    >
                        <path
                            fillRule='evenodd'
                            d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                            clipRule='evenodd'
                        />
                    </svg>
                    Número válido
                </p>
            )}
        </div>
    );
}
