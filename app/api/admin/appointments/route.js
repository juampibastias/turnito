import clientPromise from '../../../../lib/mongodb';

export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db('depilation_booking');

        const appointments = await db
            .collection('appointments')
            .find({})
            .sort({ appointmentDate: 1 })
            .toArray();

        return Response.json(appointments);
    } catch (error) {
        return Response.json(
            { message: 'Error fetching appointments' },
            { status: 500 }
        );
    }
}
