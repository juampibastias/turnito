import clientPromise from '../../../lib/mongodb';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    try {
        const client = await clientPromise;
        const db = client.db('depilation_booking');

        const availableDay = await db.collection('availableDays').findOne({
            date: new Date(date),
            isEnabled: true,
        });

        if (!availableDay) {
            return Response.json(
                { message: 'Day not available' },
                { status: 404 }
            );
        }

        return Response.json(availableDay.zones);
    } catch (error) {
        return Response.json(
            { message: 'Error fetching zones' },
            { status: 500 }
        );
    }
}

