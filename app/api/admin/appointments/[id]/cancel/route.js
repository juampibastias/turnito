// app/api/admin/appointments/[id]/cancel/route.js
import clientPromise from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { differenceInHours } from 'date-fns';

export async function POST(request, { params }) {
    try {
        const { id } = params;
        const { reason } = await request.json();

        if (!id || !ObjectId.isValid(id)) {
            return Response.json(
                { message: 'ID de appointment inválido' },
                { status: 400 }
            );
        }

        const client = await clientPromise;
        const db = client.db('depilation_booking');

        // Buscar el appointment
        const appointment = await db.collection('appointments').findOne({
            _id: new ObjectId(id),
        });

        if (!appointment) {
            return Response.json(
                { message: 'Turno no encontrado' },
                { status: 404 }
            );
        }

        // Verificar que esté confirmado
        if (appointment.status !== 'confirmed') {
            return Response.json(
                { message: 'Solo se pueden cancelar turnos confirmados' },
                { status: 400 }
            );
        }

        // ✅ VALIDACIÓN: 36 horas de anticipación
        const now = new Date();
        const appointmentDateTime = new Date(appointment.appointmentDate);

        // Agregar la hora del turno a la fecha
        const [hours, minutes] = appointment.timeSlot.start
            .split(':')
            .map(Number);
        appointmentDateTime.setHours(hours, minutes, 0, 0);

        const hoursUntilAppointment = differenceInHours(
            appointmentDateTime,
            now
        );

        if (hoursUntilAppointment < 36) {
            return Response.json(
                {
                    message:
                        'No se puede cancelar. Debe hacerlo con al menos 36 horas de anticipación.',
                    currentTime: now.toISOString(),
                    appointmentTime: appointmentDateTime.toISOString(),
                    hoursRemaining: hoursUntilAppointment,
                    minimumRequired: 36,
                },
                { status: 400 }
            );
        }

        // Cancelar el appointment
        const result = await db.collection('appointments').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    cancellationReason: reason || 'Cancelado por administrador',
                    refundEligible: true,
                    hoursInAdvance: hoursUntilAppointment,
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return Response.json(
                { message: 'Error al cancelar el turno' },
                { status: 500 }
            );
        }

        console.log(
            `[ADMIN] ✅ Turno cancelado: ${id} - ${hoursUntilAppointment}h de anticipación`
        );

        return Response.json({
            success: true,
            message: 'Turno cancelado exitosamente',
            refundEligible: true,
            hoursInAdvance: hoursUntilAppointment,
            appointmentId: id,
            cancelledAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[CANCEL] ❌ Error:', error);
        return Response.json(
            { message: 'Error al cancelar turno', error: error.message },
            { status: 500 }
        );
    }
}

// GET para verificar si se puede cancelar sin ejecutar la cancelación
export async function GET(request, { params }) {
    try {
        const { id } = params;

        if (!id || !ObjectId.isValid(id)) {
            return Response.json(
                { message: 'ID de appointment inválido' },
                { status: 400 }
            );
        }

        const client = await clientPromise;
        const db = client.db('depilation_booking');

        const appointment = await db.collection('appointments').findOne({
            _id: new ObjectId(id),
        });

        if (!appointment) {
            return Response.json(
                { message: 'Turno no encontrado' },
                { status: 404 }
            );
        }

        const now = new Date();
        const appointmentDateTime = new Date(appointment.appointmentDate);
        const [hours, minutes] = appointment.timeSlot.start
            .split(':')
            .map(Number);
        appointmentDateTime.setHours(hours, minutes, 0, 0);

        const hoursUntilAppointment = differenceInHours(
            appointmentDateTime,
            now
        );
        const canCancel =
            hoursUntilAppointment >= 36 && appointment.status === 'confirmed';

        return Response.json({
            canCancel,
            status: appointment.status,
            hoursUntilAppointment,
            minimumRequired: 36,
            appointmentTime: appointmentDateTime.toISOString(),
            currentTime: now.toISOString(),
            reason: canCancel
                ? 'Cancelación disponible'
                : appointment.status !== 'confirmed'
                ? 'Turno no confirmado'
                : 'Menos de 36 horas de anticipación',
        });
    } catch (error) {
        console.error('[CANCEL-CHECK] ❌ Error:', error);
        return Response.json(
            { message: 'Error al verificar cancelación', error: error.message },
            { status: 500 }
        );
    }
}
