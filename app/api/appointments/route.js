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

        const totalPrice = selectedZones.reduce((sum, z) => sum + z.price, 0);
        const totalDuration = selectedZones.reduce(
            (sum, z) => sum + z.duration,
            0
        );
        const depositAmount = totalPrice * 0.5;

        const client = await clientPromise;
        const db = client.db('depilation_booking');

        // ✅ CORRECCIÓN: Normalizar fecha a UTC correctamente
        const normalizedDate = new Date(appointmentDate + 'T00:00:00.000Z');

        const result = await db.collection('appointments').insertOne({
            clientName,
            clientLastName,
            clientPhone,
            appointmentDate: normalizedDate, // ✅ Fecha normalizada
            timeSlot,
            selectedZones,
            totalPrice,
            totalDuration,
            depositAmount,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const preference = await createPreference(
            [
                {
                    title: 'Reserva de turno - Depilación',
                    unit_price: depositAmount,
                    quantity: 1,
                },
            ],
            {
                appointmentId: result.insertedId.toString(), // METADATA clave para webhook
            }
        );

        return Response.json({
            preferenceId: preference.id,
            initPoint: preference.init_point,
        });
    } catch (error) {
        console.error('Error creating appointment:', error);
        return Response.json(
            { message: 'Error creating appointment' },
            { status: 500 }
        );
    }
}
