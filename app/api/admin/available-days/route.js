// app/api/admin/available-days/route.js - VERSIÓN CORREGIDA
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
    const client = await clientPromise;
    const db = client.db('depilation_booking');

    try {
        const availableDays = await db
            .collection('availableDays')
            .find({})
            .sort({ date: 1 })
            .toArray();

        return Response.json(availableDays);
    } catch (error) {
        console.error('[ADMIN] Error fetching available days:', error);
        return Response.json(
            { message: 'Error fetching available days' },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    const client = await clientPromise;
    const db = client.db('depilation_booking');

    try {
        const { date, timeSlots, zones } = await request.json();

        // ✅ CORRECCIÓN CRÍTICA: Normalización de fecha más robusta
        let normalizedDate;
        try {
            if (typeof date === 'string') {
                // Si viene como string, asegurar formato UTC correcto
                if (date.includes('T')) {
                    normalizedDate = new Date(
                        date.split('T')[0] + 'T00:00:00.000Z'
                    );
                } else {
                    normalizedDate = new Date(date + 'T00:00:00.000Z');
                }
            } else {
                // Si viene como Date object
                normalizedDate = new Date(date);
                normalizedDate.setUTCHours(0, 0, 0, 0);
            }

            // Verificar que la fecha es válida y no es 1969
            if (
                isNaN(normalizedDate.getTime()) ||
                normalizedDate.getFullYear() < 2020
            ) {
                throw new Error(
                    `Fecha inválida o año incorrecto: ${normalizedDate}`
                );
            }

            console.log(
                '[ADMIN] ✅ Fecha normalizada para día disponible:',
                normalizedDate.toISOString()
            );
        } catch (error) {
            console.error('[ADMIN] ❌ Error al normalizar fecha:', error);
            return Response.json(
                { message: 'Formato de fecha inválido', error: error.message },
                { status: 400 }
            );
        }

        // Verificar si ya existe un día para esta fecha
        const existingDay = await db.collection('availableDays').findOne({
            date: normalizedDate,
        });

        if (existingDay) {
            return Response.json(
                { message: 'Ya existe un día disponible para esta fecha' },
                { status: 409 }
            );
        }

        const availableDay = {
            date: normalizedDate, // ✅ Fecha normalizada correctamente
            isEnabled: true,
            timeSlots: timeSlots.map((slot) => ({
                ...slot,
                isAvailable: true,
            })),
            zones,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db
            .collection('availableDays')
            .insertOne(availableDay);

        console.log('[ADMIN] ✅ Día disponible creado:', result.insertedId);

        return Response.json(
            {
                message: 'Available day created successfully',
                id: result.insertedId,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[ADMIN] 🛑 Error creating available day:', error);
        return Response.json(
            { message: 'Error creating available day', error: error.message },
            { status: 500 }
        );
    }
}

export async function PUT(request) {
    const client = await clientPromise;
    const db = client.db('depilation_booking');

    try {
        const { id, ...updateData } = await request.json();

        if (!id) {
            return Response.json(
                { message: 'ID es requerido' },
                { status: 400 }
            );
        }

        const result = await db.collection('availableDays').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    ...updateData,
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return Response.json(
                { message: 'Día no encontrado' },
                { status: 404 }
            );
        }

        console.log('[ADMIN] ✅ Día disponible actualizado:', id);

        return Response.json({ message: 'Available day updated successfully' });
    } catch (error) {
        console.error('[ADMIN] 🛑 Error updating available day:', error);
        return Response.json(
            { message: 'Error updating available day', error: error.message },
            { status: 500 }
        );
    }
}
