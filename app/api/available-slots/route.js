// app/api/available-slots/route.js - CORREGIDO
import clientPromise from '../../../lib/mongodb';
import { addMinutes, format, isAfter, isBefore, parseISO } from 'date-fns';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration'));

    console.log('=====================================');
    console.log('[API] 🕒 Slot Check - Fecha:', date);
    console.log('[API] 🕒 Slot Check - Duración solicitada:', duration);

    try {
        const client = await clientPromise;
        const db = client.db('depilation_booking');

        // ✅ LIMPIAR y normalizar la fecha
        const cleanDate = date.split('T')[0]; // Extraer solo "2025-06-25"
        const dayDate = new Date(cleanDate + 'T00:00:00.000Z');
        console.log('[API] 🔍 Fecha limpia:', cleanDate);
        console.log('[API] 🔍 Buscando fecha normalizada:', dayDate);

        // Estrategia 1: Buscar por fecha exacta
        let availableDay = await db.collection('availableDays').findOne({
            date: dayDate,
            isEnabled: true,
        });

        if (!availableDay) {
            console.log('[API] ❌ Estrategia 1 falló - Probando estrategia 2');

            // Estrategia 2: Buscar por rango de fechas
            const startOfDay = new Date(cleanDate + 'T00:00:00.000Z');
            const endOfDay = new Date(cleanDate + 'T23:59:59.999Z');

            availableDay = await db.collection('availableDays').findOne({
                date: {
                    $gte: startOfDay,
                    $lte: endOfDay,
                },
                isEnabled: true,
            });
        }

        if (!availableDay) {
            console.log('[API] ❌ Estrategia 2 falló - Probando estrategia 3');

            // Estrategia 3: Buscar sin normalización UTC
            const simpleDateStr = cleanDate; // "2025-06-25"
            availableDay = await db.collection('availableDays').findOne({
                $expr: {
                    $eq: [
                        {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$date',
                            },
                        },
                        simpleDateStr,
                    ],
                },
                isEnabled: true,
            });
        }

        if (!availableDay) {
            console.log('[API] ❌ TODAS las estrategias fallaron');

            // Debug: Mostrar TODOS los días disponibles
            const allDays = await db
                .collection('availableDays')
                .find({})
                .toArray();
            console.log('[API] 🔍 Días en la base de datos:');
            allDays.forEach((day) => {
                console.log(`  - ${day.date} (enabled: ${day.isEnabled})`);
            });

            return Response.json(
                { message: 'Day not available' },
                { status: 404 }
            );
        }

        console.log('[API] ✅ Día encontrado:', availableDay.date);

        // 1. Limpiar reservas expiradas (más de 15 minutos sin confirmar)
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

        // 2. Buscar turnos ocupados con rango de fechas
        const startOfDay = new Date(cleanDate + 'T00:00:00.000Z');
        const endOfDay = new Date(cleanDate + 'T23:59:59.999Z');

        const existingAppointments = await db
            .collection('appointments')
            .find({
                appointmentDate: {
                    $gte: startOfDay,
                    $lte: endOfDay,
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
            '[API] 📋 Appointments ocupados:',
            existingAppointments.length
        );

        const availableSlots = [];

        for (const timeSlot of availableDay.timeSlots) {
            if (timeSlot.isAvailable === false) continue;

            const [startHour, startMinute] = timeSlot.start
                .split(':')
                .map(Number);
            const [endHour, endMinute] = timeSlot.end.split(':').map(Number);

            const slotStart = new Date(cleanDate);
            slotStart.setHours(startHour, startMinute, 0, 0);

            const slotEnd = new Date(cleanDate);
            slotEnd.setHours(endHour, endMinute, 0, 0);

            let currentTime = slotStart;

            // Generar slots cada 30 minutos
            while (
                isBefore(addMinutes(currentTime, duration), slotEnd) ||
                addMinutes(currentTime, duration).getTime() ===
                    slotEnd.getTime()
            ) {
                const proposedEnd = addMinutes(currentTime, duration);

                console.log(
                    `🔍 Evaluando: ${format(currentTime, 'HH:mm')} → ${format(
                        proposedEnd,
                        'HH:mm'
                    )}`
                );

                // Verificar conflictos con reservas existentes
                const hasConflict = existingAppointments.some((appointment) => {
                    const appointmentStart = parseISO(
                        `${cleanDate}T${appointment.timeSlot.start}:00`
                    );
                    const appointmentEnd = parseISO(
                        `${cleanDate}T${appointment.timeSlot.end}:00`
                    );

                    // Verificar solapamiento de horarios
                    const overlaps =
                        (currentTime >= appointmentStart &&
                            currentTime < appointmentEnd) ||
                        (proposedEnd > appointmentStart &&
                            proposedEnd <= appointmentEnd) ||
                        (currentTime <= appointmentStart &&
                            proposedEnd >= appointmentEnd);

                    if (overlaps) {
                        console.log(
                            `⚠️ Conflicto con turno ${appointment.status}: ${appointment.timeSlot.start} → ${appointment.timeSlot.end}`
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
                        startTime: currentTime,
                        endTime: proposedEnd,
                    });
                }

                // Avanzar al siguiente slot (cada 30 minutos)
                currentTime = addMinutes(currentTime, 30);
            }
        }

        console.log(
            '[API] ⏰ Total de slots disponibles:',
            availableSlots.length
        );
        return Response.json(availableSlots);
    } catch (error) {
        console.error('🛑 Error en available-slots:', error);
        return Response.json(
            { message: 'Error fetching available slots' },
            { status: 500 }
        );
    }
}
