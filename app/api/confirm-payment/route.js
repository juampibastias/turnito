import clientPromise from '../../lib/mongodb';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

export async function POST(request) {
    try {
        const body = await request.json();

        const { paymentId } = body;

        const payment = new Payment(client);
        const paymentData = await payment.get({ id: paymentId });

        if (paymentData.status === 'approved') {
            const mongoClient = await clientPromise;
            const db = mongoClient.db('depilation_booking');

            const appointmentData = {
                clientName: paymentData.metadata.client_name,
                clientLastName: paymentData.metadata.client_last_name,
                clientPhone: paymentData.metadata.client_phone,
                appointmentDate: new Date(
                    paymentData.metadata.appointment_date
                ),
                timeSlot: JSON.parse(paymentData.metadata.time_slot),
                selectedZones: JSON.parse(paymentData.metadata.selected_zones),
                totalPrice: parseFloat(paymentData.metadata.total_price),
                totalDuration: parseInt(paymentData.metadata.total_duration),
                paymentStatus: 'paid',
                paymentId,
                status: 'confirmed',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            await db.collection('appointments').insertOne(appointmentData);

            return Response.json({
                message: 'Payment confirmed and appointment created',
                appointment: appointmentData,
            });
        } else {
            return Response.json(
                { message: 'Payment not approved' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error confirming payment:', error);
        return Response.json(
            { message: 'Error confirming payment' },
            { status: 500 }
        );
    }
}

