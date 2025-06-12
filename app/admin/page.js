'use client';
import { useState, useEffect } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminPanel() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Estado de carga inicial
    const [password, setPassword] = useState('');
    const [availableDays, setAvailableDays] = useState([]);
    const [newDay, setNewDay] = useState({
        date: '',
        timeSlots: [{ start: '09:00', end: '18:00' }],
        zones: [
            { name: 'Piernas completas', price: 3000, duration: 60 },
            { name: 'Axilas', price: 800, duration: 15 },
            { name: 'Bozo', price: 600, duration: 10 },
            { name: 'Bikini', price: 1500, duration: 30 },
            { name: 'Brazos completos', price: 2000, duration: 45 },
        ],
    });
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);

    // Estados para cancelación
    const [cancellingId, setCancellingId] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    // Estados para refresh automático
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [autoRefresh, setAutoRefresh] = useState(false);

    // Agregar estos estados al inicio del componente AdminPanel, después de los estados existentes:

    // Estados adicionales para WhatsApp
    const [selectedAppointments, setSelectedAppointments] = useState(new Set());
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

    // Funciones para manejar WhatsApp manual
    const generateDefaultMessage = (appointment) => {
        const date = format(
            new Date(appointment.appointmentDate),
            "EEEE d 'de' MMMM 'de' yyyy",
            { locale: es }
        );
        const zones = appointment.selectedZones.map((z) => z.name).join(', ');

        return `🎉 *¡Tu turno está confirmado!*

👤 *Cliente:* ${appointment.clientName} ${appointment.clientLastName}
📅 *Fecha:* ${date}
🕐 *Horario:* ${appointment.timeSlot.start} - ${appointment.timeSlot.end}
💆‍♀️ *Zonas:* ${zones}
💰 *Total:* $${appointment.totalPrice}
✅ *Seña pagada:* $${appointment.depositAmount || appointment.totalPrice * 0.5}

📝 *Detalles importantes:*
• Llega 5-10 minutos antes de tu turno
• El resto del pago se realiza el día del turno
• Para cancelaciones, mínimo 36hs de anticipación

📞 Si tienes dudas, contáctanos por este mismo WhatsApp.

¡Te esperamos! 💕`;
    };

    const toggleAppointmentSelection = (appointmentId) => {
        setSelectedAppointments((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(appointmentId)) {
                newSet.delete(appointmentId);
            } else {
                newSet.add(appointmentId);
            }
            return newSet;
        });
    };

    const selectAllConfirmed = () => {
        const confirmedIds = appointments
            .filter((apt) => apt.status === 'confirmed')
            .map((apt) => apt._id);
        setSelectedAppointments(new Set(confirmedIds));
    };

    const clearSelection = () => {
        setSelectedAppointments(new Set());
    };

    const openWhatsAppModal = () => {
        if (selectedAppointments.size === 0) {
            alert('Selecciona al menos un turno para enviar WhatsApp');
            return;
        }

        // Generar mensaje por defecto para el primer appointment seleccionado
        const firstSelectedId = Array.from(selectedAppointments)[0];
        const firstAppointment = appointments.find(
            (apt) => apt._id === firstSelectedId
        );

        if (firstAppointment) {
            setWhatsappMessage(generateDefaultMessage(firstAppointment));
        }

        setIsWhatsAppModalOpen(true);
    };

    const sendManualWhatsApp = async () => {
        if (selectedAppointments.size === 0 || !whatsappMessage.trim()) {
            alert('Selecciona turnos y escribe un mensaje');
            return;
        }

        setSendingWhatsApp(true);

        try {
            const selectedAppts = appointments.filter((apt) =>
                selectedAppointments.has(apt._id)
            );
            const encodedMessage = encodeURIComponent(whatsappMessage);

            // Abrir WhatsApp Web para cada cliente
            selectedAppts.forEach((appointment, index) => {
                const clientPhone = appointment.clientPhone.replace(/\D/g, '');
                const whatsappUrl = `https://web.whatsapp.com/send?phone=${clientPhone}&text=${encodedMessage}`;

                // Abrir cada WhatsApp con un pequeño delay para evitar bloqueos
                setTimeout(() => {
                    window.open(whatsappUrl, `whatsapp_${appointment._id}`);
                }, index * 1000); // 1 segundo entre cada ventana
            });

            // Marcar como enviados en la base de datos
            const updatePromises = selectedAppts.map(async (appointment) => {
                try {
                    const response = await fetch('/api/whatsapp/send', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            appointmentId: appointment._id,
                            manualSend: true,
                            message: whatsappMessage,
                        }),
                    });

                    if (!response.ok) {
                        console.error(
                            `Error marking WhatsApp as sent for ${appointment._id}`
                        );
                    }
                } catch (error) {
                    console.error(
                        'Error marcando WhatsApp como enviado:',
                        error
                    );
                }
            });

            await Promise.all(updatePromises);

            // Actualizar la lista de appointments
            await fetchAppointments();

            setSendingWhatsApp(false);
            setIsWhatsAppModalOpen(false);
            clearSelection();
            setWhatsappMessage('');

            alert(
                `✅ Se abrieron ${selectedAppts.length} chats de WhatsApp.\n\nLos turnos han sido marcados como "WhatsApp enviado".`
            );
        } catch (error) {
            console.error('Error en envío masivo de WhatsApp:', error);
            setSendingWhatsApp(false);
            alert('❌ Error al procesar el envío de WhatsApp');
        }
    };

    // Verificar autenticación al cargar
    useEffect(() => {
        checkAuthStatus();
    }, []);

    // Auto-refresh cada 30 segundos si está habilitado
    useEffect(() => {
        let interval;
        if (autoRefresh && isAuthenticated) {
            interval = setInterval(() => {
                refreshData();
            }, 30000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh, isAuthenticated]);

    // Verificar estado de autenticación mejorado
    const checkAuthStatus = async () => {
        try {
            const response = await fetch('/api/admin/auth-status', {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                setIsAuthenticated(true);
                await loadInitialData();
            } else {
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    // Cargar datos iniciales
    const loadInitialData = async () => {
        await Promise.all([fetchAvailableDays(), fetchAppointments()]);
    };

    // Refresh manual de datos
    const refreshData = async () => {
        if (!isAuthenticated) return;

        setLastRefresh(new Date());
        await Promise.all([fetchAvailableDays(), fetchAppointments()]);
    };

    // Función para verificar si se puede cancelar
    const canCancelAppointment = (appointment) => {
        if (appointment.status !== 'confirmed') return false;

        const now = new Date();
        const appointmentDate = new Date(appointment.appointmentDate);
        const [hours, minutes] = appointment.timeSlot.start
            .split(':')
            .map(Number);
        appointmentDate.setHours(hours, minutes, 0, 0);

        const hoursUntil = Math.floor(
            (appointmentDate - now) / (1000 * 60 * 60)
        );
        return hoursUntil >= 36;
    };

    // Función para obtener horas restantes
    const getHoursUntilAppointment = (appointment) => {
        const now = new Date();
        const appointmentDate = new Date(appointment.appointmentDate);
        const [hours, minutes] = appointment.timeSlot.start
            .split(':')
            .map(Number);
        appointmentDate.setHours(hours, minutes, 0, 0);

        return Math.floor((appointmentDate - now) / (1000 * 60 * 60));
    };

    // Función para manejar cancelación
    const handleCancelAppointment = async () => {
        if (!selectedAppointment || !cancelReason.trim()) {
            alert('Por favor ingresa un motivo de cancelación');
            return;
        }

        setCancellingId(selectedAppointment._id);

        try {
            const response = await fetch(
                `/api/admin/appointments/${selectedAppointment._id}/cancel`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        reason: cancelReason.trim(),
                    }),
                }
            );

            const data = await response.json();

            if (response.ok) {
                alert(
                    `✅ Turno cancelado exitosamente\n\nSe canceló con ${data.hoursInAdvance} horas de anticipación.\nEl cliente es elegible para reembolso.`
                );

                await fetchAppointments();
                setShowCancelModal(false);
                setSelectedAppointment(null);
                setCancelReason('');
            } else {
                alert(`❌ Error: ${data.message}`);
            }
        } catch (error) {
            console.error('Error al cancelar:', error);
            alert('Error al cancelar el turno');
        } finally {
            setCancellingId(null);
        }
    };

    const fetchAppointments = async () => {
        try {
            const res = await fetch('/api/admin/appointments', {
                credentials: 'include',
            });

            if (!res.ok) {
                if (res.status === 401) {
                    setIsAuthenticated(false);
                    return;
                }
                console.error('Respuesta no OK:', res.status);
                setAppointments([]);
                return;
            }

            const text = await res.text();
            const data = text ? JSON.parse(text) : [];

            setAppointments(data);
        } catch (error) {
            console.error('Error al obtener turnos:', error);
            setAppointments([]);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ password }),
            });

            if (response.ok) {
                setIsAuthenticated(true);
                await loadInitialData();
            } else {
                alert('Contraseña incorrecta');
            }
        } catch (error) {
            console.error('Error during login:', error);
            alert('Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableDays = async () => {
        try {
            const response = await fetch('/api/admin/available-days', {
                credentials: 'include',
            });

            if (!response.ok) {
                if (response.status === 401) {
                    setIsAuthenticated(false);
                    return;
                }
                throw new Error('Error al obtener días disponibles');
            }

            const data = await response.json();
            setAvailableDays(data);
        } catch (error) {
            console.error('Error fetching available days:', error);
        }
    };

    const handleCreateDay = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/admin/available-days', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(newDay),
            });

            if (response.ok) {
                alert('Día creado exitosamente');
                fetchAvailableDays();
                setNewDay({
                    date: '',
                    timeSlots: [{ start: '09:00', end: '18:00' }],
                    zones: newDay.zones,
                });
            } else {
                alert('Error al crear el día');
            }
        } catch (error) {
            console.error('Error creating day:', error);
            alert('Error al crear el día');
        } finally {
            setLoading(false);
        }
    };

    const addTimeSlot = () => {
        setNewDay((prev) => ({
            ...prev,
            timeSlots: [...prev.timeSlots, { start: '09:00', end: '18:00' }],
        }));
    };

    const updateTimeSlot = (index, field, value) => {
        setNewDay((prev) => ({
            ...prev,
            timeSlots: prev.timeSlots.map((slot, i) =>
                i === index ? { ...slot, [field]: value } : slot
            ),
        }));
    };

    const removeTimeSlot = (index) => {
        setNewDay((prev) => ({
            ...prev,
            timeSlots: prev.timeSlots.filter((_, i) => i !== index),
        }));
    };

    const addZone = () => {
        setNewDay((prev) => ({
            ...prev,
            zones: [...prev.zones, { name: '', price: 0, duration: 0 }],
        }));
    };

    const updateZone = (index, field, value) => {
        setNewDay((prev) => ({
            ...prev,
            zones: prev.zones.map((zone, i) =>
                i === index ? { ...zone, [field]: value } : zone
            ),
        }));
    };

    const removeZone = (index) => {
        setNewDay((prev) => ({
            ...prev,
            zones: prev.zones.filter((_, i) => i !== index),
        }));
    };

    const toggleDayStatus = async (id, currentStatus) => {
        try {
            const response = await fetch('/api/admin/available-days', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    id,
                    isEnabled: !currentStatus,
                }),
            });

            if (response.ok) {
                fetchAvailableDays();
            }
        } catch (error) {
            console.error('Error updating day status:', error);
        }
    };

    // Modal de confirmación de cancelación
    const CancelModal = () => {
        if (!showCancelModal || !selectedAppointment) return null;

        const hoursUntil = getHoursUntilAppointment(selectedAppointment);
        const canCancel = hoursUntil >= 36;

        return (
            <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
                <div className='w-full max-w-md p-6 mx-4 bg-white rounded-lg'>
                    <h3 className='mb-4 text-lg font-semibold'>
                        Cancelar Turno
                    </h3>

                    <div className='p-3 mb-4 rounded bg-gray-50'>
                        <p>
                            <strong>Cliente:</strong>{' '}
                            {selectedAppointment.clientName}{' '}
                            {selectedAppointment.clientLastName}
                        </p>
                        <p>
                            <strong>Fecha:</strong>{' '}
                            {new Date(
                                selectedAppointment.appointmentDate
                            ).toLocaleDateString('es-AR')}
                        </p>
                        <p>
                            <strong>Horario:</strong>{' '}
                            {selectedAppointment.timeSlot.start} -{' '}
                            {selectedAppointment.timeSlot.end}
                        </p>
                        <p>
                            <strong>Zonas:</strong>{' '}
                            {selectedAppointment.selectedZones
                                .map((z) => z.name)
                                .join(', ')}
                        </p>
                    </div>

                    <div className='mb-4'>
                        <div
                            className={`p-3 rounded ${
                                canCancel
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-red-50 border border-red-200'
                            }`}
                        >
                            <p
                                className={`font-medium ${
                                    canCancel
                                        ? 'text-green-800'
                                        : 'text-red-800'
                                }`}
                            >
                                {canCancel
                                    ? `✅ Se puede cancelar (${hoursUntil} horas de anticipación)`
                                    : `❌ No se puede cancelar (solo ${hoursUntil} horas de anticipación, mínimo 36h)`}
                            </p>
                        </div>
                    </div>

                    {canCancel && (
                        <div className='mb-4'>
                            <label className='block mb-2 text-sm font-medium text-gray-700'>
                                Motivo de cancelación *
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) =>
                                    setCancelReason(e.target.value)
                                }
                                className='w-full px-3 py-2 text-gray-700 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500'
                                rows='3'
                                placeholder='Ej: Cliente solicitó cancelación, cambio de planes, etc.'
                                required
                            />
                        </div>
                    )}

                    <div className='flex space-x-3'>
                        <button
                            onClick={() => {
                                setShowCancelModal(false);
                                setSelectedAppointment(null);
                                setCancelReason('');
                            }}
                            className='flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300'
                        >
                            Cerrar
                        </button>
                        {canCancel && (
                            <button
                                onClick={handleCancelAppointment}
                                disabled={cancellingId || !cancelReason.trim()}
                                className='flex-1 px-4 py-2 text-gray-700 bg-red-600 rounded hover:bg-red-700 disabled:bg-gray-400'
                            >
                                {cancellingId
                                    ? 'Cancelando...'
                                    : 'Confirmar Cancelación'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Loading inicial
    if (isLoading) {
        return (
            <div className='flex items-center justify-center min-h-screen bg-gray-50'>
                <div className='text-center'>
                    <div className='w-16 h-16 mx-auto mb-4 border-b-2 border-indigo-500 rounded-full animate-spin'></div>
                    <p className='text-gray-600'>Verificando acceso...</p>
                </div>
            </div>
        );
    }

    // Pantalla de login
    if (!isAuthenticated) {
        return (
            <div className='flex items-center justify-center min-h-screen px-4 py-12 bg-gray-50 sm:px-6 lg:px-8'>
                <div className='w-full max-w-md space-y-8'>
                    <div>
                        <h2 className='mt-6 text-3xl font-extrabold text-center text-gray-900'>
                            Panel de Administración
                        </h2>
                        <p className='mt-2 text-sm text-center text-gray-600'>
                            Ingresa la contraseña para acceder
                        </p>
                    </div>
                    <form className='mt-8 space-y-6' onSubmit={handleLogin}>
                        <div>
                            <label htmlFor='password' className='sr-only'>
                                Contraseña
                            </label>
                            <input
                                id='password'
                                name='password'
                                type='password'
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className='relative block w-full px-3 py-2 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm'
                                placeholder='Contraseña'
                            />
                        </div>
                        <div>
                            <button
                                type='submit'
                                disabled={loading}
                                className='relative flex justify-center w-full px-4 py-2 text-sm font-medium text-gray-700 bg-indigo-600 border border-transparent rounded-md group hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400'
                            >
                                {loading ? 'Cargando...' : 'Ingresar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className='min-h-screen px-4 py-12 bg-gray-50 sm:px-6 lg:px-8'>
            <div className='mx-auto max-w-7xl'>
                <div className='p-6 mb-8 bg-white rounded-lg shadow'>
                    {/* Header con controles */}
                    <div className='flex flex-col mb-8 sm:flex-row sm:items-center sm:justify-between'>
                        <h1 className='mb-4 text-3xl font-bold text-gray-900 sm:mb-0'>
                            Panel de Administración
                        </h1>

                        <div className='flex flex-col gap-4 sm:flex-row'>
                            {/* Toggle auto-refresh */}
                            <div className='flex items-center'>
                                <input
                                    type='checkbox'
                                    id='autoRefresh'
                                    checked={autoRefresh}
                                    onChange={(e) =>
                                        setAutoRefresh(e.target.checked)
                                    }
                                    className='w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500'
                                />
                                <label
                                    htmlFor='autoRefresh'
                                    className='ml-2 text-sm text-gray-700'
                                >
                                    Auto-refresh (30s)
                                </label>
                            </div>

                            {/* Botón refresh manual */}
                            <button
                                onClick={refreshData}
                                className='inline-flex items-center px-3 py-2 text-sm font-medium leading-4 text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                            >
                                <svg
                                    className='w-4 h-4 mr-2'
                                    fill='none'
                                    viewBox='0 0 24 24'
                                    stroke='currentColor'
                                >
                                    <path
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        strokeWidth={2}
                                        d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                                    />
                                </svg>
                                Actualizar
                            </button>

                            <div className='text-xs text-gray-500'>
                                Última actualización:{' '}
                                {lastRefresh.toLocaleTimeString()}
                            </div>
                        </div>
                    </div>

                    {/* Formulario para crear nuevo día */}
                    <div className='mb-12'>
                        <h2 className='mb-6 text-2xl font-semibold text-gray-800'>
                            Crear Nuevo Día Disponible
                        </h2>
                        <form onSubmit={handleCreateDay} className='space-y-6'>
                            <div>
                                <label className='block mb-2 text-sm font-medium text-gray-700'>
                                    Fecha
                                </label>
                                <input
                                    type='date'
                                    value={newDay.date}
                                    onChange={(e) =>
                                        setNewDay((prev) => ({
                                            ...prev,
                                            date: e.target.value,
                                        }))
                                    }
                                    className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                                    required
                                />
                            </div>

                            {/* Horarios disponibles */}
                            <div>
                                <div className='flex items-center justify-between mb-4'>
                                    <label className='block text-sm font-medium text-gray-700'>
                                        Horarios Disponibles
                                    </label>
                                    <button
                                        type='button'
                                        onClick={addTimeSlot}
                                        className='px-3 py-1 text-sm text-gray-700 bg-blue-500 rounded hover:bg-blue-600'
                                    >
                                        Agregar Horario
                                    </button>
                                </div>
                                {newDay.timeSlots.map((slot, index) => (
                                    <div
                                        key={index}
                                        className='flex items-center mb-2 space-x-4'
                                    >
                                        <input
                                            type='time'
                                            value={slot.start}
                                            onChange={(e) =>
                                                updateTimeSlot(
                                                    index,
                                                    'start',
                                                    e.target.value
                                                )
                                            }
                                            className='px-3 py-2 border border-gray-300 rounded-md'
                                        />
                                        <span>a</span>
                                        <input
                                            type='time'
                                            value={slot.end}
                                            onChange={(e) =>
                                                updateTimeSlot(
                                                    index,
                                                    'end',
                                                    e.target.value
                                                )
                                            }
                                            className='px-3 py-2 border border-gray-300 rounded-md'
                                        />
                                        {newDay.timeSlots.length > 1 && (
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    removeTimeSlot(index)
                                                }
                                                className='px-2 py-1 text-sm text-gray-700 bg-red-500 rounded hover:bg-red-600'
                                            >
                                                Eliminar
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Zonas y precios */}
                            <div>
                                <div className='flex items-center justify-between mb-4'>
                                    <label className='block text-sm font-medium text-gray-700'>
                                        Zonas y Precios
                                    </label>
                                    <button
                                        type='button'
                                        onClick={addZone}
                                        className='px-3 py-1 text-sm text-gray-700 bg-green-500 rounded hover:bg-green-600'
                                    >
                                        Agregar Zona
                                    </button>
                                </div>
                                <div className='space-y-3'>
                                    {newDay.zones.map((zone, index) => (
                                        <div
                                            key={index}
                                            className='grid items-center grid-cols-4 gap-4'
                                        >
                                            <input
                                                type='text'
                                                placeholder='Nombre de la zona'
                                                value={zone.name}
                                                onChange={(e) =>
                                                    updateZone(
                                                        index,
                                                        'name',
                                                        e.target.value
                                                    )
                                                }
                                                className='px-3 py-2 border border-gray-300 rounded-md'
                                                required
                                            />
                                            <input
                                                type='number'
                                                placeholder='Precio'
                                                value={zone.price}
                                                onChange={(e) =>
                                                    updateZone(
                                                        index,
                                                        'price',
                                                        parseFloat(
                                                            e.target.value
                                                        ) || 0
                                                    )
                                                }
                                                className='px-3 py-2 border border-gray-300 rounded-md'
                                                required
                                            />
                                            <input
                                                type='number'
                                                placeholder='Duración (min)'
                                                value={zone.duration}
                                                onChange={(e) =>
                                                    updateZone(
                                                        index,
                                                        'duration',
                                                        parseInt(
                                                            e.target.value
                                                        ) || 0
                                                    )
                                                }
                                                className='px-3 py-2 border border-gray-300 rounded-md'
                                                required
                                            />
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    removeZone(index)
                                                }
                                                className='px-2 py-1 text-sm text-gray-700 bg-red-500 rounded hover:bg-red-600'
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                type='submit'
                                disabled={loading}
                                className='w-full px-4 py-2 text-gray-700 bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-400'
                            >
                                {loading
                                    ? 'Creando...'
                                    : 'Crear Día Disponible'}
                            </button>
                        </form>
                    </div>

                    {/* Lista de días disponibles */}
                    <div>
                        <h2 className='mb-6 text-2xl font-semibold text-gray-800'>
                            Días Disponibles
                        </h2>
                        <div className='overflow-x-auto'>
                            <table className='min-w-full divide-y divide-gray-200'>
                                <thead className='bg-gray-50'>
                                    <tr>
                                        <th className='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase'>
                                            Fecha
                                        </th>
                                        <th className='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase'>
                                            Estado
                                        </th>
                                        <th className='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase'>
                                            Horarios
                                        </th>
                                        <th className='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase'>
                                            Zonas
                                        </th>
                                        <th className='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase'>
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className='bg-white divide-y divide-gray-200'>
                                    {availableDays.map((day) => (
                                        <tr key={day._id}>
                                            <td className='px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap'>
                                                {format(
                                                    new Date(day.date),
                                                    'dd MMM yyyy',
                                                    { locale: es }
                                                )}
                                            </td>
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                <span
                                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                        day.isEnabled
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}
                                                >
                                                    {day.isEnabled
                                                        ? 'Habilitado'
                                                        : 'Deshabilitado'}
                                                </span>
                                            </td>
                                            <td className='px-6 py-4 text-sm text-gray-500'>
                                                {day.timeSlots.map(
                                                    (slot, idx) => (
                                                        <div key={idx}>
                                                            {slot.start} -{' '}
                                                            {slot.end}
                                                        </div>
                                                    )
                                                )}
                                            </td>
                                            <td className='px-6 py-4 text-sm text-gray-500'>
                                                {day.zones.length} zonas
                                                disponibles
                                            </td>
                                            <td className='px-6 py-4 text-sm font-medium whitespace-nowrap'>
                                                <button
                                                    onClick={() =>
                                                        toggleDayStatus(
                                                            day._id,
                                                            day.isEnabled
                                                        )
                                                    }
                                                    className={`px-3 py-1 rounded text-sm ${
                                                        day.isEnabled
                                                            ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                                                    }`}
                                                >
                                                    {day.isEnabled
                                                        ? 'Deshabilitar'
                                                        : 'Habilitar'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                {/* Turnos reservados */}
                <div className='p-6 bg-white rounded-lg shadow'>
                    <div className='flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between'>
                        <h2 className='text-2xl font-semibold text-gray-800'>
                            Turnos Reservados ({appointments.length})
                        </h2>

                        {/* Controles de WhatsApp */}
                        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
                            <div className='flex gap-2'>
                                <button
                                    onClick={selectAllConfirmed}
                                    className='px-3 py-2 text-sm text-gray-800 bg-blue-600 rounded hover:bg-blue-700'
                                >
                                    Seleccionar Confirmados (
                                    {
                                        appointments.filter(
                                            (apt) => apt.status === 'confirmed'
                                        ).length
                                    }
                                    )
                                </button>
                                <button
                                    onClick={clearSelection}
                                    className='px-3 py-2 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300'
                                >
                                    Limpiar ({selectedAppointments.size})
                                </button>
                            </div>

                            <button
                                onClick={openWhatsAppModal}
                                disabled={selectedAppointments.size === 0}
                                className='flex items-center gap-2 px-4 py-2 text-gray-800 bg-green-600 rounded hover:bg-green-700 disabled:bg-gray-400'
                            >
                                <svg
                                    className='w-4 h-4'
                                    fill='currentColor'
                                    viewBox='0 0 20 20'
                                >
                                    <path d='M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z' />
                                </svg>
                                WhatsApp Manual ({selectedAppointments.size})
                            </button>
                        </div>
                    </div>

                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-gray-200'>
                            <thead className='bg-gray-50'>
                                <tr>
                                    <th className='px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase'>
                                        <input
                                            type='checkbox'
                                            checked={
                                                selectedAppointments.size ===
                                                    appointments.filter(
                                                        (apt) =>
                                                            apt.status ===
                                                            'confirmed'
                                                    ).length &&
                                                appointments.filter(
                                                    (apt) =>
                                                        apt.status ===
                                                        'confirmed'
                                                ).length > 0
                                            }
                                            onChange={() => {
                                                if (
                                                    selectedAppointments.size >
                                                    0
                                                ) {
                                                    clearSelection();
                                                } else {
                                                    selectAllConfirmed();
                                                }
                                            }}
                                            className='w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500'
                                        />
                                    </th>
                                    <th className='px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase'>
                                        Fecha
                                    </th>
                                    <th className='px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase'>
                                        Horario
                                    </th>
                                    <th className='px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase'>
                                        Cliente
                                    </th>
                                    <th className='px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase'>
                                        Teléfono
                                    </th>
                                    <th className='px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase'>
                                        Zonas
                                    </th>
                                    <th className='px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase'>
                                        Estado
                                    </th>
                                    <th className='px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase'>
                                        WhatsApp
                                    </th>
                                    <th className='px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase'>
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className='bg-white divide-y divide-gray-200'>
                                {appointments.map((appointment, i) => {
                                    const canCancel =
                                        canCancelAppointment(appointment);
                                    const hoursUntil =
                                        getHoursUntilAppointment(appointment);

                                    return (
                                        <tr
                                            key={i}
                                            className={
                                                appointment.status ===
                                                'cancelled'
                                                    ? 'opacity-50'
                                                    : ''
                                            }
                                        >
                                            <td className='px-6 py-4 whitespace-nowrap'>
                                                {appointment.status ===
                                                    'confirmed' && (
                                                    <input
                                                        type='checkbox'
                                                        checked={selectedAppointments.has(
                                                            appointment._id
                                                        )}
                                                        onChange={() =>
                                                            toggleAppointmentSelection(
                                                                appointment._id
                                                            )
                                                        }
                                                        className='w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500'
                                                    />
                                                )}
                                            </td>
                                            <td className='px-6 py-4 text-sm text-gray-900'>
                                                {new Date(
                                                    appointment.appointmentDate
                                                ).toLocaleDateString('es-AR')}
                                            </td>
                                            <td className='px-6 py-4 text-sm text-gray-900'>
                                                {appointment.timeSlot.start} -{' '}
                                                {appointment.timeSlot.end}
                                            </td>
                                            <td className='px-6 py-4 text-sm text-gray-900'>
                                                {appointment.clientName}{' '}
                                                {appointment.clientLastName}
                                            </td>
                                            <td className='px-6 py-4 text-sm text-gray-900'>
                                                <a
                                                    href={`https://wa.me/${appointment.clientPhone.replace(
                                                        /\D/g,
                                                        ''
                                                    )}`}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    className='flex items-center gap-1 text-green-600 hover:text-green-800 hover:underline'
                                                >
                                                    <svg
                                                        className='w-4 h-4'
                                                        fill='currentColor'
                                                        viewBox='0 0 20 20'
                                                    >
                                                        <path d='M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z' />
                                                    </svg>
                                                    {appointment.clientPhone}
                                                </a>
                                            </td>
                                            <td className='px-6 py-4 text-sm text-gray-900'>
                                                {appointment.selectedZones
                                                    .map((z) => z.name)
                                                    .join(', ')}
                                            </td>
                                            <td className='px-6 py-4 text-sm text-gray-900'>
                                                <span
                                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                        appointment.status ===
                                                        'confirmed'
                                                            ? 'bg-green-100 text-green-800'
                                                            : appointment.status ===
                                                              'pending'
                                                            ? 'bg-yellow-100 text-yellow-800'
                                                            : appointment.status ===
                                                              'cancelled'
                                                            ? 'bg-red-100 text-red-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}
                                                >
                                                    {appointment.status}
                                                </span>
                                            </td>
                                            <td className='px-6 py-4 text-sm text-gray-900'>
                                                {appointment.whatsappSent ? (
                                                    <div className='text-xs'>
                                                        <span className='inline-flex items-center px-2 py-1 text-green-800 bg-green-100 rounded-full'>
                                                            <svg
                                                                className='w-3 h-3 mr-1'
                                                                fill='currentColor'
                                                                viewBox='0 0 20 20'
                                                            >
                                                                <path
                                                                    fillRule='evenodd'
                                                                    d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                                                    clipRule='evenodd'
                                                                />
                                                            </svg>
                                                            Enviado
                                                        </span>
                                                        <div className='mt-1 text-gray-500'>
                                                            {appointment.whatsappSentAt &&
                                                                new Date(
                                                                    appointment.whatsappSentAt
                                                                ).toLocaleDateString(
                                                                    'es-AR'
                                                                )}
                                                        </div>
                                                        <div className='text-gray-500'>
                                                            {appointment.whatsappMethod ||
                                                                'Manual'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className='inline-flex items-center px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded-full'>
                                                        <svg
                                                            className='w-3 h-3 mr-1'
                                                            fill='currentColor'
                                                            viewBox='0 0 20 20'
                                                        >
                                                            <path
                                                                fillRule='evenodd'
                                                                d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                                                                clipRule='evenodd'
                                                            />
                                                        </svg>
                                                        Pendiente
                                                    </span>
                                                )}
                                            </td>
                                            <td className='px-6 py-4 text-sm text-gray-900'>
                                                {appointment.status ===
                                                    'confirmed' && (
                                                    <div className='flex flex-col space-y-1'>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedAppointment(
                                                                    appointment
                                                                );
                                                                setShowCancelModal(
                                                                    true
                                                                );
                                                            }}
                                                            className={`px-3 py-1 text-xs rounded font-medium ${
                                                                canCancel
                                                                    ? 'bg-red-100 text-red-800 hover:bg-red-200 border border-red-200'
                                                                    : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                                            }`}
                                                            disabled={
                                                                !canCancel
                                                            }
                                                        >
                                                            {canCancel
                                                                ? 'Cancelar Turno'
                                                                : 'No cancelable'}
                                                        </button>
                                                        <span className='text-xs text-gray-500'>
                                                            {hoursUntil >= 0
                                                                ? `${hoursUntil}h restantes`
                                                                : 'Turno vencido'}
                                                        </span>
                                                        {appointment.depositAmount && (
                                                            <span className='text-xs font-medium text-green-600'>
                                                                Seña: $
                                                                {
                                                                    appointment.depositAmount
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {appointment.status ===
                                                    'cancelled' && (
                                                    <div className='text-xs'>
                                                        <span className='font-medium text-red-600'>
                                                            Cancelado
                                                        </span>
                                                        {appointment.cancellationReason && (
                                                            <p className='mt-1 text-gray-500'>
                                                                {
                                                                    appointment.cancellationReason
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                {appointment.status ===
                                                    'pending' && (
                                                    <span className='text-xs text-yellow-600'>
                                                        Esperando pago
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {appointments.length === 0 && (
                            <div className='py-8 text-center'>
                                <p className='text-gray-500'>
                                    No hay turnos reservados
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                {/* Modal de WhatsApp */}
                {isWhatsAppModalOpen && (
                    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
                        <div className='w-full max-w-3xl p-6 mx-4 bg-white rounded-lg max-h-[90vh] overflow-y-auto'>
                            <h3 className='mb-4 text-lg font-semibold'>
                                📱 Enviar WhatsApp Manual (
                                {selectedAppointments.size} turnos)
                            </h3>

                            <div className='p-4 mb-4 border border-blue-200 rounded-lg bg-blue-50'>
                                <h4 className='mb-2 font-medium text-blue-800'>
                                    📋 Turnos seleccionados:
                                </h4>
                                <div className='grid gap-2 md:grid-cols-2'>
                                    {appointments
                                        .filter((apt) =>
                                            selectedAppointments.has(apt._id)
                                        )
                                        .map((apt) => (
                                            <div
                                                key={apt._id}
                                                className='p-2 text-sm bg-white border rounded'
                                            >
                                                <div className='font-medium'>
                                                    {apt.clientName}{' '}
                                                    {apt.clientLastName}
                                                </div>
                                                <div className='text-gray-600'>
                                                    📞 {apt.clientPhone}
                                                </div>
                                                <div className='text-gray-600'>
                                                    📅{' '}
                                                    {new Date(
                                                        apt.appointmentDate
                                                    ).toLocaleDateString(
                                                        'es-AR'
                                                    )}
                                                    🕐 {apt.timeSlot.start}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            <div className='mb-4'>
                                <label className='block mb-2 text-sm font-medium text-gray-700'>
                                    💬 Mensaje (se enviará a todos los
                                    seleccionados)
                                </label>
                                <textarea
                                    value={whatsappMessage}
                                    onChange={(e) =>
                                        setWhatsappMessage(e.target.value)
                                    }
                                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500'
                                    rows='12'
                                    placeholder='Escribe tu mensaje aquí...'
                                />
                                <div className='mt-2 text-xs text-gray-500'>
                                    Caracteres: {whatsappMessage.length}
                                </div>
                            </div>

                            <div className='p-4 mb-4 border border-green-200 rounded-lg bg-green-50'>
                                <h4 className='mb-2 font-medium text-green-800'>
                                    🚀 Cómo funciona el envío manual:
                                </h4>
                                <ol className='space-y-1 text-sm text-green-700'>
                                    <li>
                                        1. Se abrirá una pestaña de WhatsApp Web
                                        para cada cliente
                                    </li>
                                    <li>
                                        2. El mensaje estará pre-cargado, solo
                                        debes presionar "Enviar"
                                    </li>
                                    <li>
                                        3. Los mensajes se envían desde:{' '}
                                        <strong>+54 9 2634 631033</strong>
                                    </li>
                                    <li>
                                        4. Se abre una pestaña cada segundo para
                                        evitar bloqueos
                                    </li>
                                    <li>
                                        5. Los turnos se marcan automáticamente
                                        como "WhatsApp enviado"
                                    </li>
                                </ol>
                            </div>

                            <div className='flex space-x-3'>
                                <button
                                    onClick={() => {
                                        setIsWhatsAppModalOpen(false);
                                        setWhatsappMessage('');
                                    }}
                                    className='flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300'
                                >
                                    ❌ Cancelar
                                </button>
                                <button
                                    onClick={sendManualWhatsApp}
                                    disabled={
                                        sendingWhatsApp ||
                                        !whatsappMessage.trim()
                                    }
                                    className='px-6 py-2 text-gray-700 bg-green-600 rounded flex-2 hover:bg-green-700 disabled:bg-gray-400'
                                >
                                    {sendingWhatsApp ? (
                                        <span className='flex items-center'>
                                            <svg
                                                className='w-4 h-4 mr-3 -ml-1 text-gray-700 animate-spin'
                                                xmlns='http://www.w3.org/2000/svg'
                                                fill='none'
                                                viewBox='0 0 24 24'
                                            >
                                                <circle
                                                    className='opacity-25'
                                                    cx='12'
                                                    cy='12'
                                                    r='10'
                                                    stroke='currentColor'
                                                    strokeWidth='4'
                                                ></circle>
                                                <path
                                                    className='opacity-75'
                                                    fill='currentColor'
                                                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                                                ></path>
                                            </svg>
                                            Enviando...
                                        </span>
                                    ) : (
                                        `📱 Enviar a ${selectedAppointments.size} clientes`
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Mantener el modal de cancelación existente */}
                {showCancelModal && <CancelModal />}
            </div>
        </div>
    );
}
