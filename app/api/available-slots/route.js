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

        // Buscar el día habilitado por rango de fecha
        const dayDate = new Date(date);
        dayDate.setUTCHours(0, 0, 0, 0);

        const availableDay = await db.collection('availableDays').findOne({
            date: dayDate,
            isEnabled: true,
        });


        if (!availableDay) {
            console.log('[API] ❌ No se encontró día habilitado en Mongo');
            return Response.json(
                { message: 'Day not available' },
                { status: 404 }
            );
        }

        console.log('[API] ✅ Día encontrado:', availableDay.date);
        console.log('[API] 🕳️ TimeSlots:', availableDay.timeSlots);

        // Buscar turnos existentes
        const existingAppointments = await db
            .collection('appointments')
            .find({
                appointmentDate: new Date(date),
                status: { $in: ['confirmed', 'paid'] },
            })
            .toArray();

        console.log(
            '[API] 📋 Appointments encontrados:',
            existingAppointments.length
        );

        const availableSlots = [];

        for (const timeSlot of availableDay.timeSlots) {
            if (timeSlot.isAvailable === false) continue;

            const [startHour, startMinute] = timeSlot.start
                .split(':')
                .map(Number);
            const [endHour, endMinute] = timeSlot.end.split(':').map(Number);

            const slotStart = new Date(date);
            slotStart.setHours(startHour, startMinute, 0, 0);

            const slotEnd = new Date(date);
            slotEnd.setHours(endHour, endMinute, 0, 0);

            let currentTime = slotStart;

            /* console.log(
                `[API] 🧱 Rango disponible: ${timeSlot.start} → ${timeSlot.end}`
            ); */

            while (
                isBefore(addMinutes(currentTime, duration), slotEnd) ||
                addMinutes(currentTime, duration).getTime() ===
                    slotEnd.getTime()
            ) {
                const proposedEnd = addMinutes(currentTime, duration);

                console.log(
                    `🔍 Propuesta: ${format(currentTime, 'HH:mm')} → ${format(
                        proposedEnd,
                        'HH:mm'
                    )}`
                );

                const hasConflict = existingAppointments.some((appointment) => {
                    const appointmentStart = parseISO(
                        `${date}T${appointment.timeSlot.start}`
                    );
                    const appointmentEnd = parseISO(
                        `${date}T${appointment.timeSlot.end}`
                    );

                    const conflicto =
                        (isAfter(currentTime, appointmentStart) &&
                            isBefore(currentTime, appointmentEnd)) ||
                        (isAfter(proposedEnd, appointmentStart) &&
                            isBefore(proposedEnd, appointmentEnd)) ||
                        (isBefore(currentTime, appointmentStart) &&
                            isAfter(proposedEnd, appointmentEnd));

                    if (conflicto) {
                        console.log(
                            `⚠️ Conflicto con turno existente: ${appointment.timeSlot.start} → ${appointment.timeSlot.end}`
                        );
                    }

                    return conflicto;
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
