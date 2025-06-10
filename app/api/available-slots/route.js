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

        // ✅ CORRECCIÓN: Normalizar fecha a UTC correctamente
        const normalizedDate = new Date(date + 'T00:00:00.000Z');

        const availableDay = {
            date: normalizedDate, // ✅ Fecha normalizada UTC
            isEnabled: true,
            timeSlots: timeSlots.map((slot) => ({
                ...slot,
                isAvailable: true,
            })),
            zones,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.collection('availableDays').insertOne(availableDay);
        return Response.json(
            { message: 'Available day created successfully' },
            { status: 201 }
        );
    } catch (error) {
        return Response.json(
            { message: 'Error creating available day' },
            { status: 500 }
        );
    }
}

export async function PUT(request) {
    const client = await clientPromise;
    const db = client.db('depilation_booking');

    try {
        const { id, ...updateData } = await request.json();

        await db.collection('availableDays').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    ...updateData,
                    updatedAt: new Date(),
                },
            }
        );

        return Response.json({ message: 'Available day updated successfully' });
    } catch (error) {
        return Response.json(
            { message: 'Error updating available day' },
            { status: 500 }
        );
    }
}
