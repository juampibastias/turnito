// app/api/webhook/route.js - VERSIÓN CON WHATSAPP
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendConfirmationWhatsApp } from '@/lib/whatsappService';

export async function POST(request) {
    try {
        const body = await request.json();
        const topic = body?.type || body?.topic;
        const paymentId = body?.data?.id?.toString();

        console.log('[WEBHOOK] Recibido:', {
            topic,
            paymentId,
            status: body?.data?.status,
        });

        if (!paymentId) {
            console.warn('[WEBHOOK] No se recibió paymentId');
            return new Response('Missing paymentId', { status: 400 });
        }

        if (topic === 'payment') {
            // Obtener detalles del pago desde MercadoPago
            const res = await fetch(
                `https://api.mercadopago.com/v1/payments/${paymentId}`,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                    },
                }
            );

            const payment = await res.json();
            console.log('[WEBHOOK] Pago obtenido:', {
                id: payment.id,
                status: payment.status,
                metadata: payment.metadata,
            });

            const appointmentId =
                payment?.metadata?.appointmentId ||
                payment?.metadata?.appointment_id;

            if (!appointmentId) {
                console.warn('[WEBHOOK] No hay appointmentId en metadata');
                return new Response('Missing metadata', { status: 400 });
            }

            const client = await clientPromise;
            const db = client.db('depilation_booking');

            // Manejo según el estado del pago
            if (payment.status === 'approved') {
                // Pago aprobado - confirmar turno
                const updateResult = await db
                    .collection('appointments')
                    .updateOne(
                        { _id: new ObjectId(appointmentId) },
                        {
                            $set: {
                                status: 'confirmed',
                                paymentStatus: 'paid',
                                paymentId: payment.id,
                                depositAmount: payment.transaction_amount,
                                updatedAt: new Date(),
                            },
                        }
                    );

                if (updateResult.matchedCount > 0) {
                    console.log(
                        `[WEBHOOK] ✅ Turno confirmado para ID ${appointmentId}`
                    );

                    // 🎯 ENVIAR WHATSAPP AUTOMÁTICAMENTE
                    try {
                        // Obtener el appointment completo para el WhatsApp
                        const appointment = await db
                            .collection('appointments')
                            .findOne({
                                _id: new ObjectId(appointmentId),
                            });

                        if (appointment) {
                            console.log(
                                `[WEBHOOK] 📱 Enviando WhatsApp a ${appointment.clientPhone}...`
                            );

                            const whatsappResult =
                                await sendConfirmationWhatsApp(appointment);

                            // Actualizar el appointment con el resultado del WhatsApp
                            await db.collection('appointments').updateOne(
                                { _id: new ObjectId(appointmentId) },
                                {
                                    $set: {
                                        whatsappSent: whatsappResult.success,
                                        whatsappSentAt: new Date(),
                                        whatsappMethod: whatsappResult.method,
                                        whatsappError: whatsappResult.success
                                            ? null
                                            : whatsappResult.message,
                                    },
                                }
                            );

                            if (whatsappResult.success) {
                                console.log(
                                    `[WEBHOOK] ✅ WhatsApp enviado exitosamente via ${whatsappResult.method}`
                                );
                            } else {
                                console.log(
                                    `[WEBHOOK] ⚠️ WhatsApp no enviado automáticamente:`,
                                    whatsappResult
                                );
                                console.log(
                                    `[WEBHOOK] 📝 Mensaje para envío manual a ${appointment.clientPhone}:`
                                );
                                console.log(whatsappResult.messageContent);
                            }
                        }
                    } catch (whatsappError) {
                        console.error(
                            '[WEBHOOK] Error enviando WhatsApp:',
                            whatsappError
                        );
                        // No fallar el webhook por error de WhatsApp
                    }
                } else {
                    console.warn(
                        `[WEBHOOK] ⚠️ No se encontró turno con ID ${appointmentId}`
                    );
                }
            } else if (
                ['cancelled', 'rejected', 'expired', 'refunded'].includes(
                    payment.status
                )
            ) {
                // Pago fallido - eliminar reserva temporal
                const deleteResult = await db
                    .collection('appointments')
                    .deleteOne({
                        _id: new ObjectId(appointmentId),
                        status: 'pending',
                    });

                if (deleteResult.deletedCount > 0) {
                    console.log(
                        `[WEBHOOK] 🗑️ Turno eliminado (${payment.status}) para ID ${appointmentId}`
                    );
                } else {
                    console.warn(
                        `[WEBHOOK] ⚠️ No se pudo eliminar turno ${appointmentId} - posiblemente ya confirmado`
                    );
                }
            } else if (payment.status === 'pending') {
                // Pago pendiente - mantener reserva temporal
                await db.collection('appointments').updateOne(
                    { _id: new ObjectId(appointmentId) },
                    {
                        $set: {
                            paymentStatus: 'pending',
                            paymentId: payment.id,
                            updatedAt: new Date(),
                        },
                    }
                );
                console.log(
                    `[WEBHOOK] ⏳ Pago pendiente para ID ${appointmentId}`
                );
            } else {
                console.log(
                    `[WEBHOOK] 📝 Estado no manejado: ${payment.status} para ID ${appointmentId}`
                );
            }

            return new Response('OK', { status: 200 });
        }

        console.log(`[WEBHOOK] 📭 Evento no manejado: ${topic}`);
        return new Response('Evento no manejado', { status: 200 });
    } catch (error) {
        console.error('[WEBHOOK] 💥 Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
