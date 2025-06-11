import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { password } = body;

        // Comparar con la contraseña hasheada
        const isValid = await bcrypt.compare(
            password,
            await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
        );

        if (!isValid) {
            return NextResponse.json(
                { message: 'Invalid password' },
                { status: 401 }
            );
        }

        // Crear el token JWT usando NEXTAUTH_SECRET (como tenías originalmente)
        const token = jwt.sign({ role: 'admin' }, process.env.NEXTAUTH_SECRET, {
            expiresIn: '24h',
        });

        // Crear la respuesta con cookie
        const response = NextResponse.json(
            { message: 'Login successful' },
            { status: 200 }
        );

        // Establecer la cookie
        response.cookies.set('admin-token', token, {
            httpOnly: true,
            path: '/',
            maxAge: 86400, // 24 horas en segundos
            secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
            sameSite: 'strict',
        });

        return response;
    } catch (error) {
        console.error('Auth error:', error);
        return NextResponse.json({ message: 'Server error' }, { status: 500 });
    }
}

// Si necesitas manejar otros métodos, puedes agregar:
export async function GET(request) {
    return NextResponse.json(
        { message: 'Method not allowed' },
        { status: 405 }
    );
}
