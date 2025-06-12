'use client';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BookingPage() {
    const [step, setStep] = useState(1);
    const [selectedZones, setSelectedZones] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
    const [availableDays, setAvailableDays] = useState([]);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [clientInfo, setClientInfo] = useState({
        clientName: '',
        clientLastName: '',
        clientPhone: '',
    });
    const [loading, setLoading] = useState(false);
    const [totalDuration, setTotalDuration] = useState(0);

    useEffect(() => {
        fetchAvailableDays();
    }, []);

    useEffect(() => {
        if (selectedZones.length > 0) {
            const duration = selectedZones.reduce(
                (sum, zone) => sum + zone.duration,
                0
            );
            setTotalDuration(duration);
        }
    }, [selectedZones]);

    const fetchAvailableDays = async () => {
        try {
            const response = await fetch('/api/admin/available-days');
            const data = await response.json();
            setAvailableDays(data.filter((day) => day.isEnabled));
        } catch (error) {
            console.error('Error fetching available days:', error);
        }
    };

    const fetchAvailableSlots = async (date, duration) => {
        try {
            setLoading(true);
            const response = await fetch(
                `/api/available-slots?date=${date}&duration=${duration}`
            );
            const data = await response.json();

            // VALIDACIÓN ESTRICTA
            if (data && Array.isArray(data)) {
                setAvailableSlots(data);
            } else {
                console.error('API Error:', data);
                setAvailableSlots([]);
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            setAvailableSlots([]);
        } finally {
            setLoading(false);
        }
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

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        setSelectedTimeSlot(null);
        setAvailableSlots([]);
        setStep(3);
        if (totalDuration > 0) {
            fetchAvailableSlots(date, totalDuration);
        }
    };

    const handleTimeSlotSelect = (slot) => {
        setSelectedTimeSlot(slot);
        setStep(4);
    };

    const handleBooking = async () => {
        if (!selectedDate || !selectedTimeSlot || selectedZones.length === 0) {
            alert('Por favor completa todos los campos');
            return;
        }
        if (
            !clientInfo.clientName ||
            !clientInfo.clientLastName ||
            !clientInfo.clientPhone
        ) {
            alert('Por favor completa tu información de contacto');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...clientInfo,
                    selectedZones,
                    appointmentDate: selectedDate,
                    timeSlot: selectedTimeSlot,
                }),
            });
            const data = await response.json();
            if (response.ok && data.initPoint) {
                window.location.href = data.initPoint;
            } else {
                alert(
                    'Error al crear la reserva: ' +
                        (data.message || 'Error desconocido')
                );
            }
        } catch (error) {
            console.error('Error creating appointment:', error);
            alert('Error al crear la reserva');
        } finally {
            setLoading(false);
        }
    };

    const getTotalPrice = () =>
        selectedZones.reduce((sum, zone) => sum + zone.price, 0);
    const getDepositAmount = () => getTotalPrice() * 0.5;

    return (
        <div className='min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50'>
            <div className='container px-4 py-8 mx-auto'>
                <div className='max-w-4xl mx-auto'>
                    <div className='mb-8 text-center'>
                        <h1 className='mb-4 text-4xl font-bold text-gray-800'>
                            Reserva tu Turno
                        </h1>
                        <p className='text-lg text-gray-600'>
                            Selecciona los servicios y horario que prefieras
                        </p>
                    </div>

                    <div className='flex justify-center mb-8'>
                        <div className='flex items-center space-x-4'>
                            {[1, 2, 3, 4].map((num) => (
                                <div key={num} className='flex items-center'>
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                            step >= num
                                                ? 'bg-pink-500 text-white'
                                                : 'bg-gray-200 text-gray-500'
                                        }`}
                                    >
                                        {num}
                                    </div>
                                    {num < 4 && (
                                        <div
                                            className={`w-8 h-1 ${
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

                    <div className='p-6 bg-white shadow-lg rounded-xl'>
                        {step === 1 && (
                            <div>
                                <h2 className='mb-6 text-2xl font-bold text-center text-gray-800'>
                                    Selecciona los servicios
                                </h2>
                                {availableDays.length > 0 &&
                                availableDays[0].zones ? (
                                    <div className='grid grid-cols-1 gap-4 mb-6 md:grid-cols-2'>
                                        {availableDays[0].zones.map(
                                            (zone, index) => (
                                                <div
                                                    key={index}
                                                    onClick={() =>
                                                        handleZoneToggle(zone)
                                                    }
                                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
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
                                                            <h3 className='font-semibold text-gray-800'>
                                                                {zone.name}
                                                            </h3>
                                                            <p className='text-sm text-gray-600'>
                                                                {zone.duration}{' '}
                                                                minutos
                                                            </p>
                                                        </div>
                                                        <div className='text-right'>
                                                            <p className='font-bold text-pink-600'>
                                                                ${zone.price}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                ) : (
                                    <div className='py-8 text-center'>
                                        <p className='text-gray-600'>
                                            Cargando servicios disponibles...
                                        </p>
                                    </div>
                                )}

                                {selectedZones.length > 0 && (
                                    <div className='p-4 mb-6 rounded-lg bg-gray-50'>
                                        <h3 className='mb-2 font-semibold'>
                                            Resumen de servicios:
                                        </h3>
                                        <div className='space-y-2'>
                                            {selectedZones.map(
                                                (zone, index) => (
                                                    <div
                                                        key={index}
                                                        className='flex justify-between text-sm'
                                                    >
                                                        <span>
                                                            {zone.name} (
                                                            {zone.duration} min)
                                                        </span>
                                                        <span>
                                                            ${zone.price}
                                                        </span>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <div className='pt-2 mt-2 border-t'>
                                            <div className='flex justify-between font-semibold'>
                                                <span>
                                                    Total: {totalDuration}{' '}
                                                    minutos
                                                </span>
                                                <span>${getTotalPrice()}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className='flex justify-end'>
                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={selectedZones.length === 0}
                                        className='px-6 py-2 text-white bg-pink-500 rounded-lg hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div>
                                <h2 className='mb-6 text-2xl font-bold text-center text-gray-800'>
                                    Selecciona una fecha
                                </h2>
                                <div className='grid grid-cols-2 gap-4 mb-6 md:grid-cols-4'>
                                    {availableDays.map((day) => (
                                        <button
                                            key={day._id}
                                            onClick={() =>
                                                handleDateSelect(
                                                    format(
                                                        new Date(day.date),
                                                        'yyyy-MM-dd'
                                                    )
                                                )
                                            }
                                            className='p-4 transition-all border-2 border-gray-200 rounded-lg hover:border-pink-300 hover:bg-pink-50'
                                        >
                                            <div className='text-center'>
                                                <div className='font-semibold text-gray-800'>
                                                    {format(
                                                        new Date(day.date),
                                                        'dd',
                                                        { locale: es }
                                                    )}
                                                </div>
                                                <div className='text-sm text-gray-600'>
                                                    {format(
                                                        new Date(day.date),
                                                        'MMM',
                                                        { locale: es }
                                                    )}
                                                </div>
                                                <div className='text-xs text-gray-500'>
                                                    {format(
                                                        new Date(day.date),
                                                        'EEEE',
                                                        { locale: es }
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className='flex justify-between'>
                                    <button
                                        onClick={() => setStep(1)}
                                        className='px-6 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300'
                                    >
                                        Volver
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div>
                                <h2 className='mb-6 text-2xl font-bold text-center text-gray-800'>
                                    Selecciona un horario
                                </h2>
                                {loading ? (
                                    <div className='py-8 text-center'>
                                        <div className='w-12 h-12 mx-auto mb-4 border-b-2 border-pink-500 rounded-full animate-spin'></div>
                                        <p className='text-gray-600'>
                                            Cargando horarios disponibles...
                                        </p>
                                    </div>
                                ) : (
                                    <div className='mb-6'>
                                        {availableSlots.length > 0 ? (
                                            <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
                                                {availableSlots.map(
                                                    (slot, index) => (
                                                        <button
                                                            key={index}
                                                            onClick={() =>
                                                                handleTimeSlotSelect(
                                                                    slot
                                                                )
                                                            }
                                                            className='p-3 transition-all border-2 border-gray-200 rounded-lg hover:border-pink-300 hover:bg-pink-50'
                                                        >
                                                            <div className='text-center'>
                                                                <div className='font-semibold text-gray-800'>
                                                                    {slot.start}
                                                                </div>
                                                                <div className='text-sm text-gray-600'>
                                                                    {slot.end}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <div className='py-8 text-center text-gray-600'>
                                                <div className='p-6 rounded-lg bg-gray-50'>
                                                    <p className='mb-4 text-lg'>
                                                        No hay horarios
                                                        disponibles para esta
                                                        fecha.
                                                    </p>
                                                    <p className='mb-4 text-sm text-gray-500'>
                                                        El día no está
                                                        configurado o todos los
                                                        horarios están ocupados.
                                                    </p>
                                                    <button
                                                        onClick={() =>
                                                            setStep(2)
                                                        }
                                                        className='px-4 py-2 text-white bg-gray-500 rounded-lg hover:bg-gray-600'
                                                    >
                                                        Seleccionar otra fecha
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className='flex justify-between'>
                                    <button
                                        onClick={() => setStep(2)}
                                        className='px-6 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300'
                                    >
                                        Volver
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div>
                                <h2 className='mb-6 text-2xl font-bold text-center text-gray-800'>
                                    Información de contacto
                                </h2>
                                <div className='mb-6 space-y-4'>
                                    <div>
                                        <label className='block mb-2 text-sm font-medium text-gray-700'>
                                            Nombre
                                        </label>
                                        <input
                                            type='text'
                                            value={clientInfo.clientName}
                                            onChange={(e) =>
                                                setClientInfo((prev) => ({
                                                    ...prev,
                                                    clientName: e.target.value,
                                                }))
                                            }
                                            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500'
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className='block mb-2 text-sm font-medium text-gray-700'>
                                            Apellido
                                        </label>
                                        <input
                                            type='text'
                                            value={clientInfo.clientLastName}
                                            onChange={(e) =>
                                                setClientInfo((prev) => ({
                                                    ...prev,
                                                    clientLastName:
                                                        e.target.value,
                                                }))
                                            }
                                            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500'
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className='block mb-2 text-sm font-medium text-gray-700'>
                                            Teléfono
                                        </label>
                                        <input
                                            type='tel'
                                            value={clientInfo.clientPhone}
                                            onChange={(e) =>
                                                setClientInfo((prev) => ({
                                                    ...prev,
                                                    clientPhone: e.target.value,
                                                }))
                                            }
                                            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500'
                                            required
                                        />
                                    </div>
                                </div>

                                <div className='p-4 mb-6 rounded-lg bg-gray-50'>
                                    <h3 className='mb-3 font-semibold'>
                                        Resumen de tu reserva:
                                    </h3>
                                    <div className='space-y-2 text-sm'>
                                        <div className='flex justify-between'>
                                            <span>Fecha:</span>
                                            <span>
                                                {format(
                                                    new Date(selectedDate),
                                                    'dd MMM yyyy',
                                                    { locale: es }
                                                )}
                                            </span>
                                        </div>
                                        <div className='flex justify-between'>
                                            <span>Horario:</span>
                                            <span>
                                                {selectedTimeSlot?.start} -{' '}
                                                {selectedTimeSlot?.end}
                                            </span>
                                        </div>
                                        <div className='flex justify-between'>
                                            <span>Servicios:</span>
                                            <span>
                                                {selectedZones
                                                    .map((z) => z.name)
                                                    .join(', ')}
                                            </span>
                                        </div>
                                        <div className='flex justify-between'>
                                            <span>Duración total:</span>
                                            <span>{totalDuration} minutos</span>
                                        </div>
                                        <div className='pt-2 mt-2 border-t'>
                                            <div className='flex justify-between font-semibold'>
                                                <span>Total:</span>
                                                <span>${getTotalPrice()}</span>
                                            </div>
                                            <div className='flex justify-between text-pink-600'>
                                                <span>Seña (50%):</span>
                                                <span>
                                                    ${getDepositAmount()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className='flex justify-between'>
                                    <button
                                        onClick={() => setStep(3)}
                                        className='px-6 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300'
                                    >
                                        Volver
                                    </button>
                                    <button
                                        onClick={handleBooking}
                                        disabled={loading}
                                        className='px-6 py-2 text-white bg-pink-500 rounded-lg hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
                                    >
                                        {loading
                                            ? 'Procesando...'
                                            : 'Reservar y Pagar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
