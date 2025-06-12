'use client';
import { useState, useEffect } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminPanel() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
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

    // Agregar al archivo app/admin/page.js - NUEVA SECCIÓN DESPUÉS DE LA TABLA DE TURNOS

    // Agregar estos estados al componente:
    const [cancellingId, setCancellingId] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    useEffect(() => {
        checkAuth();
    }, []);

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

                // Actualizar la lista de appointments
                await fetchAppointments();

                // Cerrar modal
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

    // Modal de confirmación de cancelación
const CancelModal = () => {
    if (!showCancelModal || !selectedAppointment) return null;

    const hoursUntil = getHoursUntilAppointment(selectedAppointment);
    const canCancel = hoursUntil >= 36;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md p-6 mx-4 bg-white rounded-lg">
                <h3 className="mb-4 text-lg font-semibold">
                    Cancelar Turno
                </h3>
                
                <div className="p-3 mb-4 rounded bg-gray-50">
                    <p><strong>Cliente:</strong> {selectedAppointment.clientName} {selectedAppointment.clientLastName}</p>
                    <p><strong>Fecha:</strong> {new Date(selectedAppointment.appointmentDate).toLocaleDateString('es-AR')}</p>
                    <p><strong>Horario:</strong> {selectedAppointment.timeSlot.start} - {selectedAppointment.timeSlot.end}</p>
                    <p><strong>Zonas:</strong> {selectedAppointment.selectedZones.map(z => z.name).join(', ')}</p>
                </div>

                <div className="mb-4">
                    <div className={`p-3 rounded ${canCancel ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <p className={`font-medium ${canCancel ? 'text-green-800' : 'text-red-800'}`}>
                            {canCancel ? 
                                `✅ Se puede cancelar (${hoursUntil} horas de anticipación)` :
                                `❌ No se puede cancelar (solo ${hoursUntil} horas de anticipación, mínimo 36h)`
                            }
                        </p>
                    </div>
                </div>

                {canCancel && (
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-medium text-gray-700">
                            Motivo de cancelación *
                        </label>
                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            rows="3"
                            placeholder="Ej: Cliente solicitó cancelación, cambio de planes, etc."
                            required
                        />
                    </div>
                )}

                <div className="flex space-x-3">
                    <button
                        onClick={() => {
                            setShowCancelModal(false);
                            setSelectedAppointment(null);
                            setCancelReason('');
                        }}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                    >
                        Cerrar
                    </button>
                    {canCancel && (
                        <button
                            onClick={handleCancelAppointment}
                            disabled={cancellingId || !cancelReason.trim()}
                            className="flex-1 px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700 disabled:bg-gray-400"
                        >
                            {cancellingId ? 'Cancelando...' : 'Confirmar Cancelación'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

    const fetchAppointments = async () => {
        try {
            const res = await fetch('/api/admin/appointments');

            if (!res.ok) {
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

    useEffect(() => {
        if (isAuthenticated) {
            fetchAvailableDays();
            fetchAppointments(); // << agrega esto
        }
    }, [isAuthenticated]);

    const checkAuth = () => {
        // En una implementación real, verificarías el token aquí
        const token = document.cookie.includes('admin-token');
        setIsAuthenticated(token);
        if (token) {
            fetchAvailableDays();
            fetchAppointments();
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
                body: JSON.stringify({ password }),
            });

            if (response.ok) {
                setIsAuthenticated(true);
                fetchAvailableDays();
                fetchAppointments();
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
            const response = await fetch('/api/admin/available-days');
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
                body: JSON.stringify(newDay),
            });

            if (response.ok) {
                alert('Día creado exitosamente');
                fetchAvailableDays();
                setNewDay({
                    date: '',
                    timeSlots: [{ start: '09:00', end: '18:00' }],
                    zones: newDay.zones, // Mantener las mismas zonas
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
                                className='relative flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md group hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400'
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
                    <h1 className='mb-8 text-3xl font-bold text-gray-900'>
                        Panel de Administración
                    </h1>

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
                                        className='px-3 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600'
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
                                                className='px-2 py-1 text-sm text-white bg-red-500 rounded hover:bg-red-600'
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
                                        className='px-3 py-1 text-sm text-white bg-green-500 rounded hover:bg-green-600'
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
                                                className='px-2 py-1 text-sm text-white bg-red-500 rounded hover:bg-red-600'
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
                                className='w-full px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-400'
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
            </div>
            {/* Turnos reservados */}
            <div className='mt-12'>
                <h2 className='mb-6 text-2xl font-semibold text-gray-800'>
                    Turnos Reservados
                </h2>
                <div className='overflow-x-auto'>
                    <table className='min-w-full divide-y divide-gray-200'>
                        <thead className='bg-gray-50'>
                            <tr>
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
                                            appointment.status === 'cancelled'
                                                ? 'opacity-50'
                                                : ''
                                        }
                                    >
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
                                            {appointment.clientPhone}
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
                                                        disabled={!canCancel}
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
                </div>
            </div>
            {showCancelModal && <CancelModal />}
        </div>
    );
}
