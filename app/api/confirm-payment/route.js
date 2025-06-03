import clientPromise from '../../../lib/mongodb';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { ObjectId } from 'mongodb';

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

            await db.collection('appointments').updateOne(
                { _id: new ObjectId(paymentData.metadata.appointmentId) },
                {
                    $set: {
                        status: 'confirmed',
                        paymentId,
                        paymentStatus: 'paid',
                        updatedAt: new Date(),
                    },
                }
            );

            const updatedAppointment = await db
                .collection('appointments')
                .findOne({ _id: new ObjectId(paymentData.metadata.appointmentId) });

            return Response.json({
                message: 'Payment confirmed and appointment updated',
                appointment: updatedAppointment,
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

