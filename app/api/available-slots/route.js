// app/api/available-slots/route.js - VERSIÓN CORREGIDA para respetar horarios
import clientPromise from '../../../lib/mongodb';
import { addMinutes, format } from 'date-fns';

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

        // ✅ NORMALIZACIÓN DE FECHA
        let normalizedDate;
        try {
            if (dateParam.includes('T')) {
                normalizedDate = new Date(
                    dateParam.split('T')[0] + 'T00:00:00.000Z'
                );
            } else {
                normalizedDate = new Date(dateParam + 'T00:00:00.000Z');
            }

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

        // ✅ BUSCAR DÍA DISPONIBLE
        let availableDay = await db.collection('availableDays').findOne({
            date: normalizedDate,
            isEnabled: true,
        });

        if (!availableDay) {
            // Buscar por rango si no encuentra exacto
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
        console.log('[API] 📋 TimeSlots configurados:', availableDay.timeSlots);

        // ✅ LIMPIAR RESERVAS EXPIRADAS
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

        // ✅ BUSCAR APPOINTMENTS OCUPADOS
        const startOfRequestedDay = new Date(normalizedDate);
        startOfRequestedDay.setUTCHours(0, 0, 0, 0);

        const endOfRequestedDay = new Date(normalizedDate);
        endOfRequestedDay.setUTCHours(23, 59, 59, 999);

        const existingAppointments = await db
            .collection('appointments')
            .find({
                appointmentDate: {
                    $gte: startOfRequestedDay,
                    $lte: endOfRequestedDay,
                },
                $or: [
                    { status: 'confirmed' },
                    {
                        status: 'pending',
                        createdAt: { $gte: fifteenMinutesAgo },
                    },
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

        // ✅ PROCESAR CADA TIMESLOT CONFIGURADO
        for (const timeSlot of availableDay.timeSlots) {
            if (timeSlot.isAvailable === false) {
                console.log(
                    `[API] ⏭️ Saltando timeSlot deshabilitado: ${timeSlot.start}-${timeSlot.end}`
                );
                continue;
            }

            console.log(
                `[API] 🔄 Procesando timeSlot: ${timeSlot.start} - ${timeSlot.end}`
            );

            // ✅ CORRECCIÓN CRÍTICA: Parsear horarios correctamente
            const [startHour, startMinute] = timeSlot.start
                .split(':')
                .map(Number);
            const [endHour, endMinute] = timeSlot.end.split(':').map(Number);

            console.log(
                `[API] 📊 Horario parseado: ${startHour}:${startMinute} - ${endHour}:${endMinute}`
            );

            // ✅ CREAR FECHA/HORA DE INICIO Y FIN RESPETANDO EL TIMESLOT
            const slotStartTime = new Date(normalizedDate);
            slotStartTime.setUTCHours(startHour, startMinute, 0, 0);

            const slotEndTime = new Date(normalizedDate);
            slotEndTime.setUTCHours(endHour, endMinute, 0, 0);

            console.log(
                `[API] ⏰ Rango de timeSlot: ${format(
                    slotStartTime,
                    'HH:mm'
                )} - ${format(slotEndTime, 'HH:mm')}`
            );

            // ✅ INICIALIZAR EN EL HORARIO DE INICIO DEL TIMESLOT (NO ANTES)
            let currentTime = new Date(slotStartTime);

            // ✅ GENERAR SLOTS CADA 30 MINUTOS DENTRO DEL RANGO
            while (currentTime < slotEndTime) {
                const proposedEnd = addMinutes(currentTime, duration);

                // ✅ VERIFICAR QUE EL SLOT PROPUESTO CABE COMPLETAMENTE EN EL TIMESLOT
                if (proposedEnd > slotEndTime) {
                    console.log(
                        `[API] 🚫 Slot ${format(currentTime, 'HH:mm')}-${format(
                            proposedEnd,
                            'HH:mm'
                        )} excede límite del timeSlot`
                    );
                    break;
                }

                console.log(
                    `🔍 Evaluando slot: ${format(
                        currentTime,
                        'HH:mm'
                    )} → ${format(proposedEnd, 'HH:mm')}`
                );

                // ✅ VERIFICAR CONFLICTOS CON APPOINTMENTS EXISTENTES
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

                    // Crear fechas del appointment
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

                    // LÓGICA DE SOLAPAMIENTO: start1 < end2 && start2 < end1
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
                } else {
                    console.log('❌ Slot con conflicto, no agregado');
                }

                // ✅ AVANZAR AL SIGUIENTE SLOT (CADA 30 MINUTOS)
                currentTime = addMinutes(currentTime, 30);
            }
        }

        console.log(
            `[API] ⏰ Total slots disponibles generados: ${availableSlots.length}`
        );
        console.log(
            `[API] 📋 Slots: ${availableSlots
                .map((s) => `${s.start}-${s.end}`)
                .join(', ')}`
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
