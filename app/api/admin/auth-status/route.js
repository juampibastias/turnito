// app/api/admin/auth-status/route.js
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const token = request.cookies.get('admin-token')?.value;

        if (!token) {
            return NextResponse.json(
                { message: 'No token provided' },
                { status: 401 }
            );
        }

        // Verificar el token
        try {
            jwt.verify(token, process.env.NEXTAUTH_SECRET);
            return NextResponse.json(
                { message: 'Token válido', authenticated: true },
                { status: 200 }
            );
        } catch (jwtError) {
            // Token inválido o expirado
            const response = NextResponse.json(
                { message: 'Token inválido o expirado' },
                { status: 401 }
            );

            // Limpiar cookie inválida
            response.cookies.set('admin-token', '', {
                httpOnly: true,
                path: '/',
                maxAge: 0,
            });

            return response;
        }
    } catch (error) {
        console.error('Error en verificación de auth:', error);
        return NextResponse.json(
            { message: 'Error del servidor' },
            { status: 500 }
        );
    }
}
