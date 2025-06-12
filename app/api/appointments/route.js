// app/api/appointments/route.js - VERSIÓN CORREGIDA
import clientPromise from '../../../lib/mongodb';
import { createPreference } from '../../../lib/mercadopago';

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            clientName,
            clientLastName,
            clientPhone,
            selectedZones,
            appointmentDate,
            timeSlot,
        } = body;

        // Validaciones básicas
        if (
            !clientName ||
            !clientLastName ||
            !clientPhone ||
            !selectedZones ||
            !appointmentDate ||
            !timeSlot
        ) {
            return Response.json(
                { message: 'Faltan campos requeridos' },
                { status: 400 }
            );
        }

        const totalPrice = selectedZones.reduce((sum, z) => sum + z.price, 0);
        const totalDuration = selectedZones.reduce(
            (sum, z) => sum + z.duration,
            0
        );
        const depositAmount = totalPrice * 0.5;

        const client = await clientPromise;
        const db = client.db('depilation_booking');

        // ✅ CORRECCIÓN CRÍTICA: Normalización de fecha más robusta
        let normalizedDate;
        try {
            if (typeof appointmentDate === 'string') {
                // Si viene como string ISO o date string
                if (appointmentDate.includes('T')) {
                    normalizedDate = new Date(
                        appointmentDate.split('T')[0] + 'T00:00:00.000Z'
                    );
                } else {
                    // Si viene solo la fecha (YYYY-MM-DD)
                    normalizedDate = new Date(
                        appointmentDate + 'T00:00:00.000Z'
                    );
                }
            } else {
                // Si viene como Date object
                normalizedDate = new Date(appointmentDate);
                normalizedDate.setUTCHours(0, 0, 0, 0);
            }

            // Verificar que la fecha es válida
            if (isNaN(normalizedDate.getTime())) {
                throw new Error('Fecha inválida');
            }

            console.log(
                '[APPOINTMENTS] ✅ Fecha normalizada:',
                normalizedDate.toISOString()
            );
        } catch (error) {
            console.error(
                '[APPOINTMENTS] ❌ Error al normalizar fecha:',
                error
            );
            return Response.json(
                { message: 'Formato de fecha inválido' },
                { status: 400 }
            );
        }

        // ✅ VERIFICACIÓN ADICIONAL: Comprobar que el slot sigue disponible antes de reservar
        const startOfDay = new Date(normalizedDate);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(normalizedDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const conflictingAppointments = await db
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
                        createdAt: {
                            $gte: new Date(Date.now() - 15 * 60 * 1000),
                        },
                    },
                ],
                'timeSlot.start': timeSlot.start,
                'timeSlot.end': timeSlot.end,
            })
            .toArray();

        if (conflictingAppointments.length > 0) {
            console.log(
                '[APPOINTMENTS] ⚠️ Horario ya reservado:',
                conflictingAppointments
            );
            return Response.json(
                {
                    message:
                        'Este horario ya no está disponible. Por favor selecciona otro.',
                },
                { status: 409 } // Conflict
            );
        }

        // Proceder con la creación del appointment
        const result = await db.collection('appointments').insertOne({
            clientName,
            clientLastName,
            clientPhone,
            appointmentDate: normalizedDate, // ✅ Fecha normalizada correctamente
            timeSlot,
            selectedZones,
            totalPrice,
            totalDuration,
            depositAmount,
            status: 'pending',
            createdAt: new Date(), // ✅ Timestamp correcto para expiración
            updatedAt: new Date(),
        });

        console.log('[APPOINTMENTS] ✅ Appointment creado:', result.insertedId);

        // Crear preferencia de MercadoPago
        const preference = await createPreference(
            [
                {
                    title: 'Reserva de turno - Depilación',
                    unit_price: depositAmount,
                    quantity: 1,
                },
            ],
            {
                appointmentId: result.insertedId.toString(),
            }
        );

        return Response.json({
            preferenceId: preference.id,
            initPoint: preference.init_point,
        });
    } catch (error) {
        console.error('[APPOINTMENTS] 🛑 Error creating appointment:', error);
        return Response.json(
            { message: 'Error creating appointment', error: error.message },
            { status: 500 }
        );
    }
}
