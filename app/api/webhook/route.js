import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
    try {
        const body = await request.json();
        const topic = body?.type || body?.topic;

        console.log('[WEBHOOK] Recibido:', body);

        if (topic === 'payment') {
            const paymentId = body.data.id;

            const res = await fetch(
                `https://api.mercadopago.com/v1/payments/${paymentId}`,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                    },
                }
            );

            const payment = await res.json();
            const appointmentId =
                payment.metadata?.appointment_id ||
                payment.metadata?.appointmentId;

            if (!appointmentId) {
                console.warn('[WEBHOOK] No hay appointmentId en metadata');
                return new Response('Missing metadata', { status: 400 });
            }

            const client = await clientPromise;
            const db = client.db('depilation_booking');

            if (payment.status === 'approved') {
                await db.collection('appointments').updateOne(
                    { _id: new ObjectId(appointmentId) },
                    {
                        $set: {
                            status: 'confirmed',
                            updatedAt: new Date(),
                            paymentId: payment.id,
                        },
                    }
                );
                console.log(
                    `[WEBHOOK] Turno confirmado para ID ${appointmentId}`
                );
            } else if (
                ['cancelled', 'rejected', 'expired'].includes(payment.status)
            ) {
                await db.collection('appointments').deleteOne({
                    _id: new ObjectId(appointmentId),
                    status: 'pending',
                });
                console.log(
                    `[WEBHOOK] Turno eliminado (${payment.status}) para ID ${appointmentId}`
                );
            }

            return new Response('OK', { status: 200 });
        }

        return new Response('Evento no manejado', { status: 200 });
    } catch (error) {
        console.error('Error en webhook:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
