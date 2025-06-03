import clientPromise from '../../../lib/mongodb';

export async function POST(request) {
    try {
        const body = await request.json();

        // MercadoPago envía un objeto tipo "data" con un ID de pago
        const { data, type } = body;
        console.log('[WEBHOOK] Recibido:', body);

        if (type !== 'payment.created' && type !== 'payment.updated') {
            return new Response('Ignored', { status: 200 });
        }

        // Buscar detalles del pago si es necesario desde MP (opcional)
        const paymentId = data.id;

        // Suponiendo que mandaste el appointmentId como metadata
        // Lo mejor es pedir la info de pago directamente a MP con tu token privado
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

        // Actualizar el turno a "paid" si el estado es aprobado
        if (paymentData.status === 'approved') {
            await db.collection('appointments').updateOne(
                { _id: new ObjectId(appointmentId) },
                {
                    $set: {
                        status: 'paid',
                        paymentId: paymentData.id,
                        updatedAt: new Date(),
                    },
                }
            );

            console.log(`[WEBHOOK] Turno confirmado para ID ${appointmentId}`);
        }

        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Error en webhook:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
