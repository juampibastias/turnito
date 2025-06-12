'use client';
import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Home() {
    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState('');
    const [availableDates, setAvailableDates] = useState([]);
    const [zones, setZones] = useState([]);
    const [selectedZones, setSelectedZones] = useState([]);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [clientData, setClientData] = useState({
        name: '',
        lastName: '',
        phone: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Cargar fechas disponibles
    useEffect(() => {
        fetchAvailableDates();
    }, []);

    const fetchAvailableDates = async () => {
        try {
            setError('');
            const response = await fetch('/api/admin/available-days');
            if (!response.ok) {
                throw new Error('Error al cargar fechas disponibles');
            }
            const data = await response.json();
            const enabledDates = data.filter((day) => day.isEnabled);
            setAvailableDates(enabledDates);
        } catch (error) {
            console.error('Error fetching available dates:', error);
            setError(
                'Error al cargar las fechas disponibles. Por favor, recarga la página.'
            );
        }
    };

    const fetchZones = async (date) => {
        try {
            setError('');
            const response = await fetch(`/api/zones?date=${date}`);
            if (!response.ok) {
                throw new Error('Error al cargar zonas');
            }
            const data = await response.json();
            setZones(data);
        } catch (error) {
            console.error('Error fetching zones:', error);
            setError('Error al cargar las zonas disponibles.');
        }
    };

    const fetchAvailableSlots = async (date, duration) => {
        try {
            setError('');
            const response = await fetch(
                `/api/available-slots?date=${date}&duration=${duration}`
            );
            if (!response.ok) {
                throw new Error('Error al cargar horarios');
            }
            const data = await response.json();
            console.log('[FRONT] Slots recibidos:', data);
            setAvailableSlots(data);
        } catch (error) {
            console.error('Error fetching slots:', error);
            setError('Error al cargar los horarios disponibles.');
            setAvailableSlots([]);
        }
    };

    const handleDateSelect = (date) => {
        const dateString =
            date instanceof Date ? date.toISOString().split('T')[0] : date;
        console.log('[FRONT] Fecha seleccionada:', dateString);

        setSelectedDate(dateString);
        setError('');
        fetchZones(dateString);
        setStep(2);
    };

    const handleZoneToggle = (zone) => {
        setSelectedZones((prev) => {
            const exists = prev.find((z) => z.name === zone.name);
            if (exists) {
                return prev.filter((z) => z.name !== zone.name);
            } else {
                return [...prev, zone];
            }
        });
    };

    const getTotalPrice = () => {
        return selectedZones.reduce((sum, zone) => sum + zone.price, 0);
    };

    const getTotalDuration = () => {
        return selectedZones.reduce((sum, zone) => sum + zone.duration, 0);
    };

    const proceedToTimeSelection = () => {
        if (selectedZones.length === 0) {
            setError('Por favor selecciona al menos una zona.');
            return;
        }
        setError('');
        setStep(3);
    };

    const proceedToClientData = () => {
        if (!selectedSlot) {
            setError('Por favor selecciona un horario.');
            return;
        }
        setError('');
        setStep(4);
    };

    const validateClientData = () => {
        if (!clientData.name.trim()) {
            setError('El nombre es requerido.');
            return false;
        }
        if (!clientData.lastName.trim()) {
            setError('El apellido es requerido.');
            return false;
        }
        if (!clientData.phone.trim()) {
            setError('El teléfono es requerido.');
            return false;
        }

        // Validar formato de teléfono básico
        const phonePattern = /^[\d\s\-\+\(\)]+$/;
        if (!phonePattern.test(clientData.phone)) {
            setError('Por favor ingresa un número de teléfono válido.');
            return false;
        }

        return true;
    };

    const handleBooking = async (e) => {
        e.preventDefault();

        if (!validateClientData()) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clientName: clientData.name.trim(),
                    clientLastName: clientData.lastName.trim(),
                    clientPhone: clientData.phone.trim(),
                    selectedZones,
                    appointmentDate: selectedDate,
                    timeSlot: selectedSlot,
                }),
            });

            const data = await response.json();

            if (response.ok && data.initPoint) {
                // Redirigir a MercadoPago
                window.location.href = data.initPoint;
            } else {
                setError(
                    data.message ||
                        'Error al crear la reserva. Por favor intenta nuevamente.'
                );
            }
        } catch (error) {
            console.error('Error creating booking:', error);
            setError(
                'Error de conexión. Por favor verifica tu internet e intenta nuevamente.'
            );
        } finally {
            setLoading(false);
        }
    };

    const goBackToStep = (stepNumber) => {
        setStep(stepNumber);
        setError('');
    };

    useEffect(() => {
        if (step === 3 && selectedDate && selectedZones.length > 0) {
            const duration = getTotalDuration();
            console.log('[FRONT] Buscando horarios con duración:', duration);
            fetchAvailableSlots(selectedDate, duration);
        }
    }, [step, selectedDate, selectedZones]);

    return (
        <div className='min-h-screen px-4 py-12 bg-gradient-to-br from-pink-50 to-purple-100'>
            <div className='max-w-4xl mx-auto'>
                <div className='overflow-hidden bg-white shadow-2xl rounded-3xl'>
                    <div className='p-8 text-white bg-gradient-to-r from-pink-500 to-purple-600'>
                        <h1 className='mb-2 text-4xl font-bold text-center'>
                            Reserva tu Turno
                        </h1>
                        <p className='text-center text-pink-100'>
                            Depilación profesional con la mejor atención
                        </p>
                    </div>

                    <div className='p-4 sm:p-8'>
                        {/* Indicador de pasos */}
                        <div className='flex justify-center mb-8'>
                            <div className='flex items-center space-x-2 sm:space-x-4'>
                                {[1, 2, 3, 4].map((num) => (
                                    <div
                                        key={num}
                                        className='flex items-center'
                                    >
                                        <div
                                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base ${
                                                step >= num
                                                    ? 'bg-pink-500 text-white'
                                                    : 'bg-gray-200 text-gray-700'
                                            }`}
                                        >
                                            {num}
                                        </div>
                                        {num < 4 && (
                                            <div
                                                className={`w-4 sm:w-8 h-1 ${
                                                    step > num
                                                        ? 'bg-pink-500'
                                                        : 'bg-gray-200'
                                                }`}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Mostrar errores */}
                        {error && (
                            <div className='p-4 mb-6 border border-red-200 rounded-lg bg-red-50'>
                                <div className='flex'>
                                    <div className='flex-shrink-0'>
                                        <svg
                                            className='w-5 h-5 text-red-400'
                                            viewBox='0 0 20 20'
                                            fill='currentColor'
                                        >
                                            <path
                                                fillRule='evenodd'
                                                d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                                                clipRule='evenodd'
                                            />
                                        </svg>
                                    </div>
                                    <div className='ml-3'>
                                        <p className='text-sm text-red-800'>
                                            {error}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Paso 1: Seleccionar fecha */}
                        {step === 1 && (
                            <div className='text-center'>
                                <h2 className='mb-6 text-xl font-bold text-gray-800 sm:text-2xl'>
                                    Selecciona una fecha
                                </h2>

                                {availableDates.length === 0 ? (
                                    <div className='p-6 text-center'>
                                        <p className='mb-4 text-gray-500'>
                                            No hay fechas disponibles en este
                                            momento.
                                        </p>
                                        <button
                                            onClick={fetchAvailableDates}
                                            className='px-4 py-2 text-white bg-pink-500 rounded-lg hover:bg-pink-600'
                                        >
                                            Recargar fechas
                                        </button>
                                    </div>
                                ) : (
                                    <div className='grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4'>
                                        {availableDates.map((day) => (
                                            <button
                                                key={day._id}
                                                onClick={() =>
                                                    handleDateSelect(day.date)
                                                }
                                                className='p-3 transition-all duration-200 border-2 border-pink-200 rounded-lg sm:p-4 hover:border-pink-500 hover:bg-pink-50 active:bg-pink-100'
                                            >
                                                <div className='text-sm font-semibold text-gray-800 sm:text-base'>
                                                    {format(
                                                        new Date(day.date),
                                                        'dd MMM',
                                                        { locale: es }
                                                    )}
                                                </div>
                                                <div className='text-xs text-gray-700 sm:text-sm'>
                                                    {format(
                                                        new Date(day.date),
                                                        'EEEE',
                                                        { locale: es }
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Paso 2: Seleccionar zonas */}
                        {step === 2 && (
                            <div>
                                <h2 className='mb-6 text-xl font-bold text-center text-gray-800 sm:text-2xl'>
                                    Selecciona las zonas a depilar
                                </h2>

                                {zones.length === 0 ? (
                                    <div className='p-6 text-center'>
                                        <p className='mb-4 text-gray-500'>
                                            No hay zonas disponibles para esta
                                            fecha.
                                        </p>
                                        <button
                                            onClick={() => goBackToStep(1)}
                                            className='px-4 py-2 text-white bg-gray-500 rounded-lg hover:bg-gray-600'
                                        >
                                            Seleccionar otra fecha
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className='grid grid-cols-1 gap-4 mb-6 md:grid-cols-2'>
                                            {zones.map((zone) => (
                                                <div
                                                    key={zone.name}
                                                    onClick={() =>
                                                        handleZoneToggle(zone)
                                                    }
                                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 active:scale-95 ${
                                                        selectedZones.find(
                                                            (z) =>
                                                                z.name ===
                                                                zone.name
                                                        )
                                                            ? 'border-pink-500 bg-pink-50'
                                                            : 'border-gray-200 hover:border-pink-300'
                                                    }`}
                                                >
                                                    <div className='flex items-center justify-between'>
                                                        <div>
                                                            <h3 className='text-sm font-semibold text-gray-800 sm:text-base'>
                                                                {zone.name}
                                                            </h3>
                                                            <p className='text-sm text-gray-700'>
                                                                {zone.duration}{' '}
                                                                minutos
                                                            </p>
                                                        </div>
                                                        <div className='text-lg font-bold text-pink-600 sm:text-xl'>
                                                            ${zone.price}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {selectedZones.length > 0 && (
                                            <div className='p-4 mb-6 border border-pink-200 rounded-lg bg-pink-50'>
                                                <h3 className='mb-2 font-semibold text-gray-800'>
                                                    Resumen:
                                                </h3>
                                                <div className='space-y-1 text-sm text-gray-800 sm:text-base'>
                                                    <p>
                                                        Zonas seleccionadas:{' '}
                                                        <span className='font-semibold'>
                                                            {
                                                                selectedZones.length
                                                            }
                                                        </span>
                                                    </p>
                                                    <p>
                                                        Tiempo total:{' '}
                                                        <span className='font-semibold'>
                                                            {getTotalDuration()}{' '}
                                                            minutos
                                                        </span>
                                                    </p>
                                                    <p>
                                                        Precio total:{' '}
                                                        <span className='font-semibold'>
                                                            ${getTotalPrice()}
                                                        </span>
                                                    </p>
                                                    <p className='font-bold text-pink-600'>
                                                        Seña (50%): $
                                                        {getTotalPrice() * 0.5}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className='flex flex-col justify-between gap-3 sm:flex-row sm:gap-0'>
                                    <button
                                        onClick={() => goBackToStep(1)}
                                        className='px-6 py-3 font-medium text-gray-700 transition-colors bg-gray-300 rounded-lg hover:bg-gray-400 active:bg-gray-500'
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        onClick={proceedToTimeSelection}
                                        disabled={selectedZones.length === 0}
                                        className='px-6 py-3 font-medium text-white transition-colors bg-pink-500 rounded-lg hover:bg-pink-600 active:bg-pink-700 disabled:bg-gray-300 disabled:text-gray-500'
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Paso 3: Seleccionar horario */}
                        {step === 3 && (
                            <div>
                                <h2 className='mb-6 text-xl font-bold text-center text-gray-800 sm:text-2xl'>
                                    Selecciona un horario
                                </h2>

                                {availableSlots.length === 0 ? (
                                    <div className='p-4 mb-6 text-center text-gray-700 border border-yellow-200 rounded-lg bg-yellow-50'>
                                        <p className='font-medium'>
                                            No hay turnos disponibles para ese
                                            día.
                                        </p>
                                        <p className='mt-1 text-sm'>
                                            Por favor, selecciona otra fecha o
                                            diferentes zonas.
                                        </p>
                                        <div className='mt-4 space-x-3'>
                                            <button
                                                onClick={() => goBackToStep(1)}
                                                className='px-4 py-2 text-white bg-gray-500 rounded-lg hover:bg-gray-600'
                                            >
                                                Cambiar fecha
                                            </button>
                                            <button
                                                onClick={() => goBackToStep(2)}
                                                className='px-4 py-2 text-white bg-pink-500 rounded-lg hover:bg-pink-600'
                                            >
                                                Cambiar zonas
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className='grid grid-cols-2 gap-3 mb-6 sm:gap-4 md:grid-cols-3 lg:grid-cols-4'>
                                        {availableSlots.map((slot, index) => (
                                            <button
                                                key={index}
                                                onClick={() =>
                                                    setSelectedSlot(slot)
                                                }
                                                className={`p-3 sm:p-4 border-2 rounded-lg transition-all duration-200 active:scale-95 ${
                                                    selectedSlot?.start ===
                                                        slot.start &&
                                                    selectedSlot?.end ===
                                                        slot.end
                                                        ? 'border-pink-500 bg-pink-50'
                                                        : 'border-gray-200 hover:border-pink-300'
                                                }`}
                                            >
                                                <div className='text-sm font-semibold text-gray-800 sm:text-base'>
                                                    {slot.start} - {slot.end}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className='flex flex-col justify-between gap-3 sm:flex-row sm:gap-0'>
                                    <button
                                        onClick={() => goBackToStep(2)}
                                        className='px-6 py-3 font-medium text-gray-700 transition-colors bg-gray-300 rounded-lg hover:bg-gray-400 active:bg-gray-500'
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        onClick={proceedToClientData}
                                        disabled={!selectedSlot}
                                        className='px-6 py-3 font-medium text-white transition-colors bg-pink-500 rounded-lg hover:bg-pink-600 active:bg-pink-700 disabled:bg-gray-300 disabled:text-gray-500'
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Paso 4: Datos del cliente */}
                        {step === 4 && (
                            <div>
                                <h2 className='mb-6 text-xl font-bold text-center text-gray-800 sm:text-2xl'>
                                    Completa tus datos
                                </h2>
                                <form
                                    onSubmit={handleBooking}
                                    className='space-y-6'
                                >
                                    <div className='max-w-md mx-auto space-y-4'>
                                        <div>
                                            <label className='block mb-2 text-sm font-medium text-gray-800'>
                                                Nombre *
                                            </label>
                                            <input
                                                type='text'
                                                value={clientData.name}
                                                onChange={(e) =>
                                                    setClientData((prev) => ({
                                                        ...prev,
                                                        name: e.target.value,
                                                    }))
                                                }
                                                className='w-full px-4 py-3 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent'
                                                placeholder='Tu nombre'
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className='block mb-2 text-sm font-medium text-gray-800'>
                                                Apellido *
                                            </label>
                                            <input
                                                type='text'
                                                value={clientData.lastName}
                                                onChange={(e) =>
                                                    setClientData((prev) => ({
                                                        ...prev,
                                                        lastName:
                                                            e.target.value,
                                                    }))
                                                }
                                                className='w-full px-4 py-3 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent'
                                                placeholder='Tu apellido'
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className='block mb-2 text-sm font-medium text-gray-800'>
                                                Teléfono *
                                            </label>
                                            <input
                                                type='tel'
                                                value={clientData.phone}
                                                onChange={(e) =>
                                                    setClientData((prev) => ({
                                                        ...prev,
                                                        phone: e.target.value,
                                                    }))
                                                }
                                                className='w-full px-4 py-3 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent'
                                                placeholder='Tu número de teléfono'
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className='p-4 border border-pink-200 rounded-lg sm:p-6 bg-pink-50'>
                                        <h3 className='mb-4 text-lg font-bold text-gray-800'>
                                            Resumen de tu turno:
                                        </h3>
                                        <div className='space-y-2 text-sm text-gray-800 sm:text-base'>
                                            <p>
                                                <strong>Fecha:</strong>{' '}
                                                {format(
                                                    new Date(selectedDate),
                                                    "dd 'de' MMMM 'de' yyyy",
                                                    { locale: es }
                                                )}
                                            </p>
                                            <p>
                                                <strong>Horario:</strong>{' '}
                                                {selectedSlot?.start} -{' '}
                                                {selectedSlot?.end}
                                            </p>
                                            <p>
                                                <strong>Zonas:</strong>{' '}
                                                {selectedZones
                                                    .map((z) => z.name)
                                                    .join(', ')}
                                            </p>
                                            <p>
                                                <strong>Duración total:</strong>{' '}
                                                {getTotalDuration()} minutos
                                            </p>
                                            <p>
                                                <strong>Precio total:</strong> $
                                                {getTotalPrice()}
                                            </p>
                                            <p className='text-base font-bold text-pink-600 sm:text-lg'>
                                                <strong>Seña a pagar:</strong> $
                                                {getTotalPrice() * 0.5}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Política de cancelación */}
                                    <div className='p-4 border border-red-200 rounded-lg bg-red-50'>
                                        <h4 className='mb-2 font-semibold text-red-800'>
                                            ⚠️ Política de Cancelación
                                        </h4>
                                        <p className='text-sm text-red-700'>
                                            Las cancelaciones deben realizarse
                                            con{' '}
                                            <strong>
                                                mínimo 36 horas de anticipación
                                            </strong>{' '}
                                            para ser elegibles al reembolso de
                                            la seña. Cancelaciones con menos
                                            tiempo no son reembolsables.
                                        </p>
                                    </div>

                                    <div className='flex flex-col justify-between gap-3 sm:flex-row sm:gap-0'>
                                        <button
                                            type='button'
                                            onClick={() => goBackToStep(3)}
                                            className='px-6 py-3 font-medium text-gray-700 transition-colors bg-gray-300 rounded-lg hover:bg-gray-400 active:bg-gray-500'
                                        >
                                            Atrás
                                        </button>
                                        <button
                                            type='submit'
                                            disabled={loading}
                                            className='px-6 sm:px-8 py-3 font-semibold text-white rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 active:from-pink-700 active:to-purple-800 disabled:bg-gray-300 disabled:text-gray-500 transition-all duration-200 min-h-[48px] touch-manipulation'
                                        >
                                            {loading
                                                ? 'Procesando...'
                                                : 'Reservar y Pagar'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
