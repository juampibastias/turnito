import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
    try {
        const body = await request.json();
        const { data, type } = body;

        console.log('[WEBHOOK] Recibido:', body);

        if (type !== 'payment.created' && type !== 'payment.updated') {
            return new Response('Ignored', { status: 200 });
        }

        const paymentId = data.id;

        const mpResponse = await fetch(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                },
            }
        );
        const paymentData = await mpResponse.json();
        const appointmentId = paymentData.metadata?.appointmentId;

        if (!appointmentId) {
            console.warn('[WEBHOOK] No hay appointmentId en metadata');
            return new Response('No metadata', { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db('depilation_booking');

        if (paymentData.status === 'approved') {
            await db.collection('appointments').updateOne(
                { _id: new ObjectId(appointmentId) },
                {
                    $set: {
                        status: 'confirmed',
                        paymentId: paymentData.id,
                        updatedAt: new Date(),
                    },
                }
            );
            console.log(`[WEBHOOK] Turno confirmado para ID ${appointmentId}`);
        } else if (
            paymentData.status === 'cancelled' ||
            paymentData.status === 'rejected' ||
            paymentData.status === 'expired'
        ) {
            await db.collection('appointments').deleteOne({
                _id: new ObjectId(appointmentId),
                status: 'pending',
            });
            console.log(
                `[WEBHOOK] Turno eliminado por pago fallido (${paymentData.status})`
            );
        }

        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Error en webhook:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
