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

        const totalPrice = selectedZones.reduce(
            (sum, zone) => sum + zone.price,
            0
        );
        const totalDuration = selectedZones.reduce(
            (sum, zone) => sum + zone.duration,
            0
        );
        const depositAmount = totalPrice * 0.5;

        const preference = await createPreference(
            [
                {
                    title: 'Reserva de turno - Depilación',
                    unit_price: depositAmount,
                    quantity: 1,
                },
            ],
            {
                clientName,
                clientLastName,
                clientPhone,
                appointmentDate,
                timeSlot: JSON.stringify(timeSlot),
                selectedZones: JSON.stringify(selectedZones),
                totalPrice,
                totalDuration,
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

