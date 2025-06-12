// app/api/available-slots/route.js - VERSIÓN CORREGIDA
import clientPromise from '../../../lib/mongodb';
import { addMinutes, format, parseISO } from 'date-fns';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration'));

    console.log('=====================================');
    console.log('[API] 🕒 Slot Check - Fecha recibida:', dateParam);
    console.log('[API] 🕒 Slot Check - Duración:', duration);

    if (!dateParam || !duration) {
        return Response.json(
            { message: 'Fecha y duración son requeridos' },
            { status: 400 }
        );
    }

    try {
        const client = await clientPromise;
        const db = client.db('depilation_booking');

        // ✅ CORRECCIÓN 1: Normalización de fecha más robusta
        let normalizedDate;
        try {
            // Si viene en formato ISO (YYYY-MM-DD), parsearlo correctamente
            if (dateParam.includes('T')) {
                normalizedDate = new Date(
                    dateParam.split('T')[0] + 'T00:00:00.000Z'
                );
            } else {
                // Si viene solo la fecha (YYYY-MM-DD)
                normalizedDate = new Date(dateParam + 'T00:00:00.000Z');
            }

            // Verificar que la fecha es válida
            if (isNaN(normalizedDate.getTime())) {
                throw new Error('Fecha inválida');
            }

            console.log(
                '[API] ✅ Fecha normalizada:',
                normalizedDate.toISOString()
            );
        } catch (error) {
            console.error('[API] ❌ Error al normalizar fecha:', error);
            return Response.json(
                { message: 'Formato de fecha inválido' },
                { status: 400 }
            );
        }

        // ✅ CORRECCIÓN 2: Buscar día disponible con múltiples estrategias
        let availableDay = null;

        // Estrategia 1: Búsqueda exacta por fecha normalizada
        availableDay = await db.collection('availableDays').findOne({
            date: normalizedDate,
            isEnabled: true,
        });

        // Estrategia 2: Si falla, buscar por rango de fechas del mismo día
        if (!availableDay) {
            const startOfDay = new Date(normalizedDate);
            startOfDay.setUTCHours(0, 0, 0, 0);

            const endOfDay = new Date(normalizedDate);
            endOfDay.setUTCHours(23, 59, 59, 999);

            availableDay = await db.collection('availableDays').findOne({
                date: {
                    $gte: startOfDay,
                    $lte: endOfDay,
                },
                isEnabled: true,
            });
        }

        if (!availableDay) {
            console.log('[API] ❌ No se encontró día disponible');
            return Response.json(
                { message: 'Día no disponible' },
                { status: 404 }
            );
        }

        console.log('[API] ✅ Día encontrado:', availableDay.date);

        // ✅ CORRECCIÓN 3: Limpieza de reservas expiradas MÁS estricta
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        const expiredResult = await db.collection('appointments').deleteMany({
            status: 'pending',
            createdAt: { $lt: fifteenMinutesAgo },
        });

        if (expiredResult.deletedCount > 0) {
            console.log(
                `[API] 🧹 Eliminadas ${expiredResult.deletedCount} reservas expiradas`
            );
        }

        // ✅ CORRECCIÓN 4: Consulta MÁS estricta de turnos ocupados
        const startOfRequestedDay = new Date(normalizedDate);
        startOfRequestedDay.setUTCHours(0, 0, 0, 0);

        const endOfRequestedDay = new Date(normalizedDate);
        endOfRequestedDay.setUTCHours(23, 59, 59, 999);

        console.log('[API] 🔍 Buscando appointments entre:', {
            start: startOfRequestedDay.toISOString(),
            end: endOfRequestedDay.toISOString(),
        });

        const existingAppointments = await db
            .collection('appointments')
            .find({
                appointmentDate: {
                    $gte: startOfRequestedDay,
                    $lte: endOfRequestedDay,
                },
                // ✅ CRÍTICO: Solo considerar turnos válidos
                $or: [
                    { status: 'confirmed' }, // Confirmados = BLOQUEADOS
                    {
                        status: 'pending',
                        createdAt: { $gte: fifteenMinutesAgo },
                    }, // Pendientes recientes = BLOQUEADOS
                ],
            })
            .toArray();

        console.log(
            `[API] 📋 Encontrados ${existingAppointments.length} appointments ocupados:`
        );
        existingAppointments.forEach((apt, idx) => {
            console.log(
                `  ${idx + 1}. ${apt.status} | ${
                    apt.timeSlot?.start || 'N/A'
                }-${apt.timeSlot?.end || 'N/A'} | Cliente: ${
                    apt.clientName || 'N/A'
                }`
            );
        });

        const availableSlots = [];

        for (const timeSlot of availableDay.timeSlots) {
            if (timeSlot.isAvailable === false) continue;

            const [startHour, startMinute] = timeSlot.start
                .split(':')
                .map(Number);
            const [endHour, endMinute] = timeSlot.end.split(':').map(Number);

            // ✅ CORRECCIÓN 5: Crear fechas con la fecha correcta del día solicitado
            const slotStart = new Date(normalizedDate);
            slotStart.setUTCHours(startHour, startMinute, 0, 0);

            const slotEnd = new Date(normalizedDate);
            slotEnd.setUTCHours(endHour, endMinute, 0, 0);

            let currentTime = new Date(slotStart);

            // Generar slots cada 30 minutos
            while (currentTime < slotEnd) {
                const proposedEnd = addMinutes(currentTime, duration);

                // Verificar que el slot propuesto cabe en el timeSlot
                if (proposedEnd > slotEnd) {
                    break;
                }

                console.log(
                    `🔍 Evaluando slot: ${format(
                        currentTime,
                        'HH:mm'
                    )} → ${format(proposedEnd, 'HH:mm')}`
                );

                // ✅ CORRECCIÓN 6: Verificación de conflictos MÁS estricta
                const hasConflict = existingAppointments.some((appointment) => {
                    if (
                        !appointment.timeSlot ||
                        !appointment.timeSlot.start ||
                        !appointment.timeSlot.end
                    ) {
                        console.warn(
                            '⚠️ Appointment sin timeSlot válido:',
                            appointment._id
                        );
                        return false;
                    }

                    // Crear fechas del appointment usando la fecha del appointment
                    const appointmentDate = new Date(
                        appointment.appointmentDate
                    );

                    const appointmentStart = new Date(appointmentDate);
                    const [aptStartHour, aptStartMin] =
                        appointment.timeSlot.start.split(':').map(Number);
                    appointmentStart.setUTCHours(
                        aptStartHour,
                        aptStartMin,
                        0,
                        0
                    );

                    const appointmentEnd = new Date(appointmentDate);
                    const [aptEndHour, aptEndMin] = appointment.timeSlot.end
                        .split(':')
                        .map(Number);
                    appointmentEnd.setUTCHours(aptEndHour, aptEndMin, 0, 0);

                    // ✅ LÓGICA DE SOLAPAMIENTO CORREGIDA
                    // Dos rangos se solapan si: start1 < end2 && start2 < end1
                    const overlaps =
                        currentTime < appointmentEnd &&
                        appointmentStart < proposedEnd;

                    if (overlaps) {
                        console.log(`⚠️ CONFLICTO detectado:`);
                        console.log(
                            `   Slot propuesto: ${format(
                                currentTime,
                                'HH:mm'
                            )} - ${format(proposedEnd, 'HH:mm')}`
                        );
                        console.log(
                            `   Appointment (${appointment.status}): ${appointment.timeSlot.start} - ${appointment.timeSlot.end}`
                        );
                        console.log(
                            `   Cliente: ${appointment.clientName} ${appointment.clientLastName}`
                        );
                        return true;
                    }
                    return false;
                });

                if (!hasConflict) {
                    console.log('✅ Slot disponible agregado');
                    availableSlots.push({
                        start: format(currentTime, 'HH:mm'),
                        end: format(proposedEnd, 'HH:mm'),
                    });
                }

                // Avanzar al siguiente slot (cada 30 minutos)
                currentTime = addMinutes(currentTime, 30);
            }
        }

        console.log(
            `[API] ⏰ Total slots disponibles: ${availableSlots.length}`
        );
        return Response.json(availableSlots);
    } catch (error) {
        console.error('🛑 Error en available-slots:', error);
        return Response.json(
            { message: 'Error interno del servidor', error: error.message },
            { status: 500 }
        );
    }
}
