// app/api/whatsapp/send/route.js - VERSIÓN ACTUALIZADA
import { sendConfirmationWhatsApp } from '../../../../lib/whatsappService';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
    try {
        const {
            appointmentId,
            manualSend = false,
            message = null,
        } = await request.json();

        if (!appointmentId) {
            return Response.json(
                { message: 'appointmentId es requerido' },
                { status: 400 }
            );
        }

        // Obtener el appointment de la base de datos
        const client = await clientPromise;
        const db = client.db('depilation_booking');

        const appointment = await db.collection('appointments').findOne({
            _id: new ObjectId(appointmentId),
        });

        if (!appointment) {
            return Response.json(
                { message: 'Appointment no encontrado' },
                { status: 404 }
            );
        }

        if (appointment.status !== 'confirmed') {
            return Response.json(
                {
                    message:
                        'Solo se pueden enviar WhatsApp a turnos confirmados',
                },
                { status: 400 }
            );
        }

        let result;

        if (manualSend) {
            // Para envío manual, solo actualizar la base de datos
            result = {
                success: true,
                method: 'Manual',
                message: 'Marcado como enviado manualmente',
            };
        } else {
            // Enviar WhatsApp automáticamente
            result = await sendConfirmationWhatsApp(appointment);
        }

        // Guardar el registro del envío en la base de datos
        await db.collection('appointments').updateOne(
            { _id: new ObjectId(appointmentId) },
            {
                $set: {
                    whatsappSent: result.success,
                    whatsappSentAt: new Date(),
                    whatsappMethod: result.method || 'Manual',
                    whatsappError: result.success ? null : result.message,
                    whatsappMessage: message || null,
                    updatedAt: new Date(),
                },
            }
        );

        if (result.success) {
            console.log(
                `✅ WhatsApp ${
                    manualSend ? 'marcado como enviado' : 'enviado'
                } via ${result.method} para appointment ${appointmentId}`
            );
            return Response.json({
                success: true,
                message: manualSend
                    ? 'Marcado como enviado manualmente'
                    : 'WhatsApp enviado exitosamente',
                method: result.method,
                appointmentId,
            });
        } else {
            console.log(
                `📝 WhatsApp no enviado para appointment ${appointmentId}:`,
                result
            );
            return Response.json(
                {
                    success: false,
                    message: result.message,
                    phoneNumber: result.phoneNumber,
                    messageContent: result.messageContent,
                    appointmentId,
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error en /api/whatsapp/send:', error);
        return Response.json(
            { message: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
