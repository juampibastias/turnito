// app/api/available-slots/route.js - CORRECCIÓN COMPLETA Y DEFINITIVA
import clientPromise from '../../../lib/mongodb';
import { addMinutes, format } from 'date-fns';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration'));

    console.log('🔍 [SLOTS] === INICIO DEBUGGING ===');
    console.log('🔍 [SLOTS] Parámetros recibidos:', { dateParam, duration });

    if (!dateParam || !duration) {
        return Response.json([]);
    }

    try {
        const client = await clientPromise;
        const db = client.db('depilation_booking');

        // ✅ PASO 1: Normalizar fecha
        let requestedDate;
        try {
            if (dateParam.includes('T')) {
                requestedDate = new Date(
                    dateParam.split('T')[0] + 'T00:00:00.000Z'
                );
            } else {
                requestedDate = new Date(dateParam + 'T00:00:00.000Z');
            }

            if (isNaN(requestedDate.getTime())) {
                throw new Error('Fecha inválida');
            }
            console.log(
                '✅ [SLOTS] Fecha normalizada:',
                requestedDate.toISOString()
            );
        } catch (error) {
            console.error('❌ [SLOTS] Error fecha:', error);
            return Response.json([]);
        }

        // ✅ PASO 2: Buscar día disponible
        const availableDay = await db.collection('availableDays').findOne({
            date: requestedDate,
            isEnabled: true,
        });

        if (!availableDay) {
            console.log('❌ [SLOTS] No hay día disponible');
            return Response.json([]);
        }

        console.log('✅ [SLOTS] Día encontrado:', {
            fecha: availableDay.date,
            habilitado: availableDay.isEnabled,
            timeSlots: availableDay.timeSlots,
        });

        // ✅ PASO 3: Obtener primer timeSlot válido
        const timeSlot =
            availableDay.timeSlots && availableDay.timeSlots.length > 0
                ? availableDay.timeSlots[0]
                : null;

        if (
            !timeSlot ||
            !timeSlot.start ||
            !timeSlot.end ||
            timeSlot.isAvailable === false
        ) {
            console.log('❌ [SLOTS] TimeSlot inválido:', timeSlot);
            return Response.json([]);
        }

        console.log('✅ [SLOTS] TimeSlot válido:', timeSlot);

        // ✅ PASO 4: Crear horarios de inicio y fin EXACTOS
        const year = requestedDate.getFullYear();
        const month = requestedDate.getMonth();
        const day = requestedDate.getDate();

        // Parsear horario de inicio
        const [startHour, startMinute] = timeSlot.start.split(':').map(Number);
        const [endHour, endMinute] = timeSlot.end.split(':').map(Number);

        console.log('🔍 [SLOTS] Horarios parseados:', {
            inicio: { hora: startHour, minuto: startMinute },
            fin: { hora: endHour, minuto: endMinute },
        });

        // Crear fechas absolutas
        const slotStartTime = new Date(
            year,
            month,
            day,
            startHour,
            startMinute,
            0,
            0
        );
        const slotEndTime = new Date(
            year,
            month,
            day,
            endHour,
            endMinute,
            0,
            0
        );

        console.log('🕐 [SLOTS] Rango configurado:', {
            inicio: slotStartTime.toLocaleTimeString(),
            fin: slotEndTime.toLocaleTimeString(),
            inicioHora: slotStartTime.getHours(),
            finHora: slotEndTime.getHours(),
        });

        // ✅ VERIFICACIÓN CRÍTICA
        if (
            slotStartTime.getHours() !== startHour ||
            slotEndTime.getHours() !== endHour
        ) {
            console.error('💥 [SLOTS] ERROR CRÍTICO EN PARSING DE HORAS!');
            console.error('Esperado:', { startHour, endHour });
            console.error('Obtenido:', {
                start: slotStartTime.getHours(),
                end: slotEndTime.getHours(),
            });
            return Response.json([]);
        }

        // ✅ PASO 5: Limpiar reservas expiradas
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        await db.collection('appointments').deleteMany({
            status: 'pending',
            createdAt: { $lt: fifteenMinutesAgo },
        });

        // ✅ PASO 6: Obtener appointments del día
        const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

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
            `📋 [SLOTS] Appointments encontrados: ${existingAppointments.length}`
        );
        existingAppointments.forEach((apt, idx) => {
            console.log(
                `  ${idx + 1}. ${apt.status} | ${apt.timeSlot?.start}-${
                    apt.timeSlot?.end
                }`
            );
        });

        // ✅ PASO 7: Generar slots - EMPEZAR EN EL HORARIO EXACTO
        const availableSlots = [];
        let currentTime = new Date(slotStartTime); // 🎯 PUNTO CRÍTICO: Empezar en 08:00

        console.log(
            `🚀 [SLOTS] INICIANDO GENERACIÓN DESDE: ${format(
                currentTime,
                'HH:mm'
            )}`
        );
        console.log(
            `🏁 [SLOTS] TERMINAR ANTES DE: ${format(slotEndTime, 'HH:mm')}`
        );

        while (currentTime < slotEndTime) {
            const slotEnd = addMinutes(currentTime, duration);

            // Verificar que el slot completo cabe en el horario
            if (slotEnd > slotEndTime) {
                console.log(
                    `🛑 [SLOTS] Slot ${format(currentTime, 'HH:mm')}-${format(
                        slotEnd,
                        'HH:mm'
                    )} excede horario`
                );
                break;
            }

            const slotStart = format(currentTime, 'HH:mm');
            const slotEndFormatted = format(slotEnd, 'HH:mm');

            console.log(
                `🔍 [SLOTS] Evaluando: ${slotStart} - ${slotEndFormatted}`
            );

            // Verificar conflictos
            const hasConflict = existingAppointments.some((appointment) => {
                if (
                    !appointment.timeSlot?.start ||
                    !appointment.timeSlot?.end
                ) {
                    return false;
                }

                const aptStart = appointment.timeSlot.start;
                const aptEnd = appointment.timeSlot.end;

                // Lógica de solapamiento simple y efectiva
                const conflict = !(
                    slotEndFormatted <= aptStart || slotStart >= aptEnd
                );

                if (conflict) {
                    console.log(
                        `  ❌ CONFLICTO con: ${aptStart}-${aptEnd} (${appointment.status})`
                    );
                }

                return conflict;
            });

            if (!hasConflict) {
                availableSlots.push({
                    start: slotStart,
                    end: slotEndFormatted,
                });
                console.log(
                    `  ✅ DISPONIBLE: ${slotStart}-${slotEndFormatted}`
                );
            } else {
                console.log(`  ❌ OCUPADO: ${slotStart}-${slotEndFormatted}`);
            }

            // Avanzar 30 minutos
            currentTime = addMinutes(currentTime, 30);
        }

        console.log(
            `🎯 [SLOTS] RESULTADO FINAL: ${availableSlots.length} slots`
        );
        console.log(
            `📋 [SLOTS] Lista: [${availableSlots
                .map((s) => `${s.start}-${s.end}`)
                .join(', ')}]`
        );
        console.log('🔍 [SLOTS] === FIN DEBUGGING ===');

        return Response.json(availableSlots);
    } catch (error) {
        console.error('💥 [SLOTS] Error crítico:', error);
        return Response.json([]);
    }
}
