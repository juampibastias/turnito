// app/api/admin/cleanup/route.js
import clientPromise from '../../../lib/mongodb';

export async function POST(request) {
    try {
        // Verificar autenticación de admin
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.includes('admin-token')) {
            return Response.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const client = await clientPromise;
        const db = client.db('depilation_booking');

        // Eliminar reservas pendientes de más de 15 minutos
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        const result = await db.collection('appointments').deleteMany({
            status: 'pending',
            createdAt: { $lt: fifteenMinutesAgo },
        });

        console.log(
            `[CLEANUP] Eliminadas ${result.deletedCount} reservas expiradas`
        );

        return Response.json({
            message: 'Cleanup completed',
            deletedCount: result.deletedCount,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[CLEANUP] Error:', error);
        return Response.json(
            { message: 'Error during cleanup' },
            { status: 500 }
        );
    }
}

// Para llamar periódicamente desde el frontend o un cron job
export async function GET() {
    return POST(new Request('http://localhost:3000/api/admin/cleanup'));
}
